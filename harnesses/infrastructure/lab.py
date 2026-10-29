import argparse, hashlib, json, os, platform, sys, threading, time, uuid
from importlib.metadata import version
from collections import Counter
import boto3, psycopg2
from kafka import KafkaProducer, KafkaConsumer, TopicPartition
from kafka.structs import OffsetAndMetadata
from kafka.admin import KafkaAdminClient, NewTopic
from botocore.client import Config
from botocore.exceptions import ClientError

p = argparse.ArgumentParser()
p.add_argument('mode', choices=['broker', 'pipeline'])
p.add_argument('--count', type=int, default=100)
p.add_argument('--rate', type=float, default=20)
p.add_argument('--records', type=int, default=5)
p.add_argument('--pause-at', type=float, default=2)
p.add_argument('--pause-for', type=float, default=3)
p.add_argument('--timeout', type=float, default=60)
p.add_argument('--sink-delay', type=float, default=0)
p.add_argument('--poll', type=float, default=.2)
a = p.parse_args()
if a.count < 1 or a.count > 10000 or a.rate <= 0 or a.records < 1 or a.records > 1000 or a.timeout <= 0 or a.poll <= 0 or a.pause_at < 0 or a.pause_for < 0 or not 0 <= a.sink_delay <= 5:
    p.error('count 1–10000, records 1–1000, positive rate/timeout/poll, nonnegative pause and sink delay 0–5 required')

def retry(fn):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try: return fn()
        except Exception: time.sleep(1)
    raise RuntimeError('Service did not become ready within 90 seconds')

run = uuid.uuid4().hex
topic = 'lab-' + run
admin = retry(lambda: KafkaAdminClient(bootstrap_servers='kafka:9092'))
admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=1)])
producer = KafkaProducer(bootstrap_servers='kafka:9092', acks='all', retries=3, value_serializer=lambda x: json.dumps(x).encode())
consumer = KafkaConsumer(topic, bootstrap_servers='kafka:9092', group_id='group-'+run, auto_offset_reset='earliest', enable_auto_commit=False, value_deserializer=lambda x: json.loads(x))
store = boto3.client('s3', endpoint_url='http://store:8333', aws_access_key_id='labuser', aws_secret_access_key='labpassword', config=Config(s3={'addressing_style':'path'}, connect_timeout=2, read_timeout=5, retries={'total_max_attempts': 2, 'mode':'standard'}))
conn = None
postgres_version = None
bucket = 'benchmarking-lab'
if a.mode == 'pipeline':
    buckets = retry(lambda: store.list_buckets())
    if bucket not in {entry['Name'] for entry in buckets.get('Buckets', [])}:
        try:
            store.create_bucket(Bucket=bucket)
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') not in ('BucketAlreadyExists', 'BucketAlreadyOwnedByYou'):
                raise
            store.head_bucket(Bucket=bucket)
    conn = retry(lambda: psycopg2.connect(host='db', dbname='lab', user='lab', password='lab', connect_timeout=5))
    conn.autocommit = True
    with conn.cursor() as c:
        c.execute('SELECT version()'); postgres_version = c.fetchone()[0]
        c.execute('CREATE TABLE IF NOT EXISTS records (run text, object_id int, record_id int, value int, PRIMARY KEY(run, object_id, record_id))')
start = time.monotonic()
lock = threading.Lock()
observations = []
errors = []
received = []
received_values = {}
seen = set()
done = threading.Event()

def stamp(kind, **kw):
    with lock: observations.append(dict(t=round(time.monotonic()-start, 6), kind=kind, **kw))

def send(value, oid):
    try:
        producer.send(topic, value=value).get(timeout=20)
        stamp('ack', object_id=oid, record_id=value.get('record_id'))
    except Exception as e:
        errors.append(str(e)); stamp('error', stage='producer', message=str(e))

def read_worker():
    while not done.is_set():
        elapsed = time.monotonic()-start
        if a.pause_at <= elapsed < a.pause_at+a.pause_for:
            time.sleep(.05); continue
        for msg in consumer.poll(timeout_ms=100, max_records=100).values():
            for item in msg:
                while a.pause_at <= time.monotonic()-start < a.pause_at+a.pause_for and not done.is_set():
                    time.sleep(.05)
                if done.is_set(): return
                v = item.value; stamp('receipt', object_id=v['object_id'], record_id=v.get('record_id'), offset=item.offset)
                received.append((v['object_id'], v.get('record_id')))
                received_values[(v['object_id'], v.get('record_id'))] = v['object_id'] if v.get('run') == run else None
                if a.mode == 'pipeline':
                    try:
                        if v.get('run') != run: raise ValueError('Unexpected run identity')
                        if a.sink_delay: time.sleep(a.sink_delay)
                        with conn.cursor() as c:
                            c.execute('INSERT INTO records VALUES (%s,%s,%s,%s) ON CONFLICT (run,object_id,record_id) DO UPDATE SET value=EXCLUDED.value', (run,v['object_id'],v['record_id'],v['value']*2))
                    except Exception as e:
                        errors.append(str(e)); stamp('error', stage='sink', message=str(e)); done.set(); return
                stamp('processed', object_id=v['object_id'], record_id=v.get('record_id'))
                consumer.commit({TopicPartition(item.topic, item.partition): OffsetAndMetadata(item.offset + 1, "", -1)})
def guarded(name, fn):
    try: fn()
    except Exception as e:
        errors.append(str(e)); stamp('error', stage=name, message=str(e)); done.set()

thread = threading.Thread(target=lambda: guarded('consumer', read_worker), daemon=True); thread.start()
expected = {(i, j): (i*1000+j)*2 for i in range(a.count) for j in range(a.records)} if a.mode == 'pipeline' else {(i, None): i for i in range(a.count)}
submitted = set()
object_complete = set()
polls = 0
verification_seconds = 0.0

def verify_worker():
    global polls, verification_seconds
    verify_conn = retry(lambda: psycopg2.connect(host='db', dbname='lab', user='lab', password='lab', connect_timeout=5))
    verify_conn.autocommit = True
    while not done.is_set():
        t = time.monotonic()
        with verify_conn.cursor() as c:
            c.execute('SELECT object_id,record_id,value FROM records WHERE run=%s', (run,))
            rows = c.fetchall()
        verification_seconds += time.monotonic()-t; polls += 1
        present = {(o,r):v for o,r,v in rows}
        for i in list(submitted):
            if i not in object_complete and all(present.get((i,j)) == expected[(i,j)] for j in range(a.records)):
                object_complete.add(i); stamp('verified', object_id=i)
        time.sleep(a.poll)
    verify_conn.close()

verifier = None
if a.mode == 'pipeline':
    verifier = threading.Thread(target=lambda: guarded('verifier', verify_worker), daemon=True); verifier.start()
for i in range(a.count):
    if done.is_set(): break
    target = start + i/a.rate
    if done.wait(max(0,target-time.monotonic())): break
    stamp('offered', object_id=i, scheduled_t=round(i/a.rate, 6))
    submitted.add(i)
    if a.mode == 'broker':
        send({'run':run,'object_id':i},i)
    else:
        data = [{'run':run,'object_id':i,'record_id':j,'value':i*1000+j} for j in range(a.records)]
        try:
            store.put_object(Bucket=bucket, Key=f'{run}/{i}.json', Body=json.dumps(data).encode())
            stamp('upload_ack', object_id=i)
            # The ingestion adapter is deliberately synchronous: read this uploaded object and publish its records.
            obj = store.get_object(Bucket=bucket, Key=f'{run}/{i}.json')
            stamp('ingest_read', object_id=i)
            for v in json.loads(obj['Body'].read()): send(v,i)
            stamp('ingest_done', object_id=i)
        except Exception as e: errors.append(str(e)); stamp('error', stage='ingest', message=str(e)); done.set()
    # Offered scheduling is closed-loop when the client cannot keep up; expose actual timestamps.

deadline = time.monotonic()+a.timeout
while time.monotonic() < deadline:
    if done.is_set(): break
    if a.mode == 'broker' and len(set(received)) >= len(expected): break
    if a.mode == 'pipeline' and len(object_complete) == a.count: break
    time.sleep(a.poll)
done.set(); thread.join(timeout=35)
if verifier: verifier.join(timeout=35)
if thread.is_alive() or (verifier and verifier.is_alive()):
    errors.append('Worker did not stop; final snapshot may race pending work')
    stamp('error', stage='shutdown', message=errors[-1])
if a.mode == 'pipeline':
    try:
        with conn.cursor() as c:
            c.execute('SET statement_timeout = 5000')
            c.execute('SELECT object_id,record_id,value FROM records WHERE run=%s', (run,)); rows = c.fetchall()
        actual = {(o,r):v for o,r,v in rows}
    except Exception as e:
        errors.append(str(e)); stamp('error', stage='final_verification', message=str(e)); actual = {}
else: actual = received_values
counts = Counter(received)
missing = len(set(expected)-set(actual)); extra = len(set(actual)-set(expected))
wrong = sum(actual.get(k) != v for k,v in expected.items() if k in actual)
duplicates = sum(n-1 for n in counts.values() if n>1)
ordered = received == sorted(received)
provenance = {
    'harness_sha256': hashlib.sha256(open(__file__, 'rb').read()).hexdigest(),
    'runtime': {'python': platform.python_version(), 'kafka-python': version('kafka-python'), 'boto3': version('boto3'), 'botocore': version('botocore'), 'psycopg2-binary': version('psycopg2-binary'), 'postgres_server': postgres_version},
    'declared_images': {'client_base': 'python:3.12.10-slim', 'kafka': 'apache/kafka:3.9.1', 'store': 'chrislusf/seaweedfs:3.85', 'database': 'postgres:17.5'},
}
result = {'provenance': provenance, 'schema':'benchmarking-lab-infrastructure-v1','mode':a.mode,'run_id':run,'config':vars(a),'topology':'single Kafka broker, one partition and replica; local Compose network; Python clients; SeaweedFS and Postgres for pipeline','guarantees':'acks=all with one replica; explicit consumer commit after processing; sink upsert makes repeated keys idempotent; no fault-tolerance claim', 'summary':{'offered':len(submitted),'expected_records':len(expected),'received':len(received),'processed_unique':len(actual),'verified_objects':len(object_complete) if a.mode=='pipeline' else None,'missing':missing,'extra':extra,'wrong_values':wrong,'duplicate_receipts':duplicates,'ordered_receipts':ordered,'errors':len(errors),'verification_polls':polls,'verification_seconds':round(verification_seconds,6),'elapsed_seconds':round(time.monotonic()-start,6)},'observations':observations,'errors':errors}
os.makedirs('/results',exist_ok=True)
path='/results/'+a.mode+'-'+run+'.json'
with open(path,'w') as f: json.dump(result,f,indent=2)
print(json.dumps(result['summary'],indent=2)); print('Evidence:',path)
consumer.close(); producer.close(); admin.close()
if conn and not thread.is_alive(): conn.close()

# Preserve the evidence above, then fail the command if required work was not verified.
sys.exit(1 if missing or extra or wrong or errors or not ordered else 0)

# syntax=docker/dockerfile:1
FROM python:3.12.10-slim
RUN --mount=type=secret,id=proxy_ca,required=false if [ -f /run/secrets/proxy_ca ]; then PIP_CERT=/run/secrets/proxy_ca pip install --no-cache-dir kafka-python==2.2.10 boto3==1.38.23 psycopg2-binary==2.9.10; else pip install --no-cache-dir kafka-python==2.2.10 boto3==1.38.23 psycopg2-binary==2.9.10; fi
COPY lab.py /lab.py
ENTRYPOINT ["python", "/lab.py"]

// Copyright © 2026 Christopher Snow
import type { Request, Reply, Rows } from "./database-model";
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { PGlite } from "@electric-sql/pglite";
let duck: AsyncDuckDB | undefined;
let connection: AsyncDuckDBConnection | undefined;
let duckWorker: Worker | undefined;
let pg: PGlite | undefined;
async function run(sql: string): Promise<Rows> {
  if (connection) {
    const table = await connection.query(sql);
    return table
      .toArray()
      .map((row) =>
        table.schema.fields.map((field) => String(row[field.name])),
      );
  }
  if (pg) {
    const result = await pg.query(sql);
    return result.rows.map((row) =>
      result.fields.map((field) =>
        String((row as Record<string, unknown>)[field.name]),
      ),
    );
  }
  throw new Error("Engine has not started");
}
async function start(
  engine: "duckdb" | "pglite",
  assets: string,
): Promise<string> {
  if (engine === "duckdb") {
    const lib = await import("@duckdb/duckdb-wasm");
    duckWorker = new Worker(`${assets}duckdb-browser-mvp.worker.js`);
    duck = new lib.AsyncDuckDB(new lib.VoidLogger(), duckWorker);
    await duck.instantiate(`${assets}duckdb-mvp.wasm`);
    await duck.open({ path: ":memory:", maximumThreads: 1 });
    connection = await duck.connect();
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    async function wasm(file: string) {
      const response = await fetch(`${assets}${file}`);
      if (!response.ok)
        throw new Error(`Cannot load ${file}: HTTP ${response.status}`);
      return WebAssembly.compile(await response.arrayBuffer());
    }
    const [pgliteWasmModule, initdbWasmModule, bundleResponse] =
      await Promise.all([
        wasm("pglite.wasm"),
        wasm("initdb.wasm"),
        fetch(`${assets}pglite.data`),
      ]);
    if (!bundleResponse.ok)
      throw new Error(`Cannot load data bundle: HTTP ${bundleResponse.status}`);
    pg = new PGlite({
      pgliteWasmModule,
      initdbWasmModule,
      fsBundle: await bundleResponse.blob(),
      initialMemory: 128 * 1024 * 1024,
    });
    await pg.waitReady;
  }
  return (await run("SELECT version();"))[0][0];
}
self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  const reply: Reply = { id: request.id };
  try {
    if (request.operation === "start")
      reply.version = await start(request.engine, request.assets);
    else if (request.operation === "query") reply.rows = await run(request.sql);
    else if (request.operation === "exec") {
      if (connection) await connection.query(request.sql);
      else if (pg) await pg.exec(request.sql);
      else throw new Error("Engine has not started");
    } else {
      await connection?.close();
      await duck?.terminate();
      duckWorker?.terminate();
      await pg?.close();
    }
  } catch (error) {
    reply.error = error instanceof Error ? error.message : String(error);
  }
  self.postMessage(reply);
};

/// <reference lib="webworker" />
// The database worker. Started by lib/db/client.ts in the ONE tab that holds the database lock
// (the leader); other tabs reach it through that tab. It is the only code that touches SQLite.
//
//   1. Loads SQLite WASM and the OPFS "opfs-sahpool" storage, opens /orbit-<profile>.sqlite3.
//   2. Sets the connection PRAGMAs and migrates the file to the newest schema (lib/db/migrate.ts).
//   3. Runs named queries (lib/db/queries.ts): reads directly, writes in one transaction, and
//      reports every table a write may have changed (lib/db/effects.ts).

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import schemaSql from "@/db/schema.sql";
import { readEffects, affectedTables, type Effects } from "@/lib/db/effects";
import { migrate } from "@/lib/db/migrate";
import { MIGRATIONS } from "@/lib/db/migrations";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction, type Bind, type Row, type Sql } from "@/lib/db/sql";
import type { OpenInfo, Reply, WorkerReply, WorkerRequest } from "@/lib/db/protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerReply) => scope.postMessage(msg);

let sql: Sql | null = null;
let effects: Effects = new Map();

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type Stmt = ReturnType<InstanceType<Sqlite3["oo1"]["DB"]>["prepare"]>;

/** Wraps an oo1 database in the Sql interface, keeping each statement prepared after first use. */
function wrap(db: InstanceType<Sqlite3["oo1"]["DB"]>): Sql {
  const cache = new Map<string, Stmt>();
  const prepared = (q: string) => {
    let s = cache.get(q);
    if (!s) cache.set(q, (s = db.prepare(q)));
    return s;
  };
  const rows = <T>(q: string, params: Bind | undefined, limit: number): T[] => {
    const s = prepared(q);
    try {
      if (params && params.length) s.bind(params as never);
      const out: T[] = [];
      while (out.length < limit && s.step()) out.push(s.get({}) as T);
      return out;
    } finally {
      s.reset(true);
    }
  };
  return {
    all: <T = Row>(q: string, p?: Bind) => rows<T>(q, p, Infinity),
    get: <T = Row>(q: string, p?: Bind) => rows<T>(q, p, 1)[0],
    run(q, p) {
      rows(q, p, Infinity);
      return db.changes() as number;
    },
    exec(script) {
      db.exec(script);
    },
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The storage pool. Retries for a few seconds: when the previous leader tab has just closed,
 *  the browser may not have released its file handles yet. */
async function installPool(sqlite3: Sqlite3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await sqlite3.installOpfsSAHPoolVfs({
        name: "orbit",
        initialCapacity: 12, // each profile uses ~2 files (database + journal)
        preserveOnInitFailure: true, // a failed try must never wipe the stored files
        forceReinitIfPreviouslyFailed: true,
      } as Parameters<Sqlite3["installOpfsSAHPoolVfs"]>[0]);
    } catch (e) {
      lastError = e;
      await wait(250);
    }
  }
  throw lastError;
}

async function open(profile: string): Promise<OpenInfo> {
  const t0 = performance.now();
  if (!/^[a-z0-9_-]{1,40}$/i.test(profile)) throw new Error(`Bad profile name: ${profile}`);
  if (!navigator.storage?.getDirectory) throw new Error("This browser has no private file storage (OPFS).");
  const sqlite3 = await sqlite3InitModule();
  const pool = await installPool(sqlite3);
  const file = `/orbit-${profile}.sqlite3`;
  const db = new pool.OpfsSAHPoolDb(file);
  sql = wrap(db);
  sql.exec(`PRAGMA foreign_keys = ON;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -4000;`);
  const { from, to } = migrate(sql, schemaSql, MIGRATIONS);
  effects = readEffects(sql);
  const reads: Record<string, string[]> = {};
  for (const [name, def] of Object.entries(QUERIES) as [string, QueryDef<unknown, unknown>][])
    if (def.kind === "read") reads[name] = [...def.tables];
  return {
    file,
    sqliteVersion: sqlite3.version.libVersion,
    schemaVersion: to,
    migratedFrom: from,
    reads,
    openMs: Math.round(performance.now() - t0),
  };
}

function call(name: string, params: unknown): Reply {
  if (!sql) return { ok: false, error: "The database is not open." };
  const def = (QUERIES as unknown as Record<string, QueryDef<unknown, unknown>>)[name];
  if (!def) return { ok: false, error: `Unknown query "${name}".` };
  const db = sql;
  try {
    if (def.kind === "read") return { ok: true, data: def.run(db, params), changed: [] };
    const data = transaction(db, () => def.run(db, params));
    return { ok: true, data, changed: affectedTables(def.tables, effects) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "open") {
    try {
      post({ type: "ready", info: await open(msg.profile) });
    } catch (err) {
      post({ type: "open-failed", error: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === "call") {
    post({ type: "reply", wid: msg.wid, reply: call(msg.name, msg.params) });
  }
};

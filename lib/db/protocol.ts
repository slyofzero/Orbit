// Messages between the page, the database worker and other tabs. Type-only; no code.
//
//   page (leader tab) ⇄ worker            WorkerRequest / WorkerReply
//   every tab ⇄ every tab                 TabMessage over BroadcastChannel("orbit-db:<profile>")

/** What the worker reports once the database is open. */
export interface OpenInfo {
  file: string; // e.g. "/orbit-default.sqlite3" inside the OPFS pool
  sqliteVersion: string;
  schemaVersion: number; // PRAGMA user_version after migrating
  migratedFrom: number; // version before opening (0 = new file)
  reads: Record<string, string[]>; // query name → tables it reads (for live updates)
  openMs: number; // how long opening took
}

export type Reply = { ok: true; data: unknown; changed: string[] } | { ok: false; error: string };

export type WorkerRequest =
  | { type: "open"; profile: string }
  | { type: "call"; wid: number; name: string; params: unknown };

export type WorkerReply =
  | { type: "ready"; info: OpenInfo }
  | { type: "open-failed"; error: string }
  | { type: "reply"; wid: number; reply: Reply };

export type TabMessage =
  | { type: "who-leads"; from: string } // a tab asking which tab holds the database
  | { type: "leader"; tabId: string; info: OpenInfo } // "I hold it" (sent when taking over, and to answer who-leads)
  | { type: "call"; from: string; id: number; name: string; params: unknown } // follower → leader
  | { type: "result"; to: string; id: number; reply: Reply } // leader → follower
  | { type: "changed"; tables: string[] }; // leader → everyone, after a write

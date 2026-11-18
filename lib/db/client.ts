"use client";
// How screens talk to the database: useQuery / useMutation / dbCall. Works in any number of tabs.
//
// Only one tab can have the database file open (opfs-sahpool), so tabs elect a LEADER:
//   * Every tab asks for the same Web Lock ("orbit-db:<profile>"). The tab that gets it starts
//     the worker (lib/db/worker.ts), opens the database and says so on a BroadcastChannel.
//   * Other tabs are FOLLOWERS: they send their calls over the channel; the leader runs them in
//     its worker and sends the result back. After a write, the leader tells every tab which
//     tables changed, and each tab re-runs the queries that read them.
//   * When the leader tab closes, the browser frees the lock; the next tab in line gets it,
//     opens the database, announces itself, and every tab re-sends the calls still waiting.
//     A re-sent call that already ran gets the remembered answer, so nothing runs twice.
// Screens don't know or care which tab leads.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui";
import type { ArgsOf, QueryName, ResultOf } from "@/lib/db/queries";
import type { OpenInfo, Reply, TabMessage, WorkerReply, WorkerRequest } from "@/lib/db/protocol";

export type DbRole = "connecting" | "leader" | "follower" | "failed";

export interface DbStatus {
  role: DbRole;
  tabId: string;
  profile: string;
  leaderTab: string | null; // which tab holds the database (this one if role = leader)
  info: OpenInfo | null; // details of the open database
  error: string | null; // set when role = failed
}

interface Pending {
  name: string;
  params: unknown;
  resolve: (r: Reply) => void;
}

/** How long a leader remembers answers, so a re-sent call after a hand-over doesn't run twice. */
const REMEMBER_MS = 60_000;

class Connection {
  status: DbStatus;
  private statusListeners = new Set<() => void>();
  private changeListeners = new Set<(tables: Set<string>) => void>();
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private channel: BroadcastChannel;
  // leader only
  private worker: Worker | null = null;
  private nextWid = 1;
  private workerWaiting = new Map<number, (r: Reply) => void>();
  private served = new Map<string, Promise<Reply>>();

  constructor(profile: string) {
    const tabId = crypto.randomUUID().slice(0, 8);
    this.status = { role: "connecting", tabId, profile, leaderTab: null, info: null, error: null };
    this.channel = new BroadcastChannel(`orbit-db:${profile}`);
    this.channel.onmessage = (e: MessageEvent<TabMessage>) => this.onTabMessage(e.data);
    if (!("locks" in navigator) || typeof Worker === "undefined") {
      this.fail("This browser is too old for Orbit's storage (no Web Locks or Workers).");
      return;
    }
    navigator.locks.request(`orbit-db:${profile}`, () => this.lead());
    this.tell({ type: "who-leads", from: tabId });
  }

  // ------------------------------------------------------------------ public
  call(name: string, params: unknown): Promise<Reply> {
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, { name, params, resolve });
      this.send(id);
    });
  }
  onStatus(fn: () => void) {
    this.statusListeners.add(fn);
    return () => void this.statusListeners.delete(fn);
  }
  onChange(fn: (tables: Set<string>) => void) {
    this.changeListeners.add(fn);
    return () => void this.changeListeners.delete(fn);
  }

  // ------------------------------------------------------------------ routing
  private send(id: number) {
    const p = this.pending.get(id);
    if (!p || this.status.role === "failed") return;
    if (this.status.role === "leader")
      this.serve(this.status.tabId, id, p.name, p.params).then((r) => this.settle(id, r));
    // No leader known yet is fine: the call is re-sent when one announces itself.
    else this.tell({ type: "call", from: this.status.tabId, id, name: p.name, params: p.params });
  }
  private settle(id: number, reply: Reply) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    p.resolve(reply);
  }
  private resendAll() {
    for (const id of this.pending.keys()) this.send(id);
  }
  private tell(msg: TabMessage) {
    this.channel.postMessage(msg);
  }
  private setStatus(patch: Partial<DbStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.statusListeners) fn();
  }
  private fail(error: string) {
    this.setStatus({ role: "failed", error });
    for (const id of [...this.pending.keys()]) this.settle(id, { ok: false, error });
  }
  private changed(tables: string[]) {
    if (!tables.length) return;
    const set = new Set(tables);
    for (const fn of this.changeListeners) fn(set);
  }

  private onTabMessage(msg: TabMessage) {
    const me = this.status;
    switch (msg.type) {
      case "who-leads":
        if (me.role === "leader" && me.info) this.tell({ type: "leader", tabId: me.tabId, info: me.info });
        break;
      case "leader":
        if (me.role === "leader") break;
        this.setStatus({ role: "follower", leaderTab: msg.tabId, info: msg.info, error: null });
        this.resendAll();
        break;
      case "call":
        if (me.role === "leader")
          this.serve(msg.from, msg.id, msg.name, msg.params).then((reply) =>
            this.tell({ type: "result", to: msg.from, id: msg.id, reply }),
          );
        break;
      case "result":
        if (msg.to === me.tabId) this.settle(msg.id, msg.reply);
        break;
      case "changed":
        this.changed(msg.tables);
        break;
    }
  }

  // ------------------------------------------------------------------ leader
  /** Runs while this tab holds the lock. Never resolves while the database is open, so the
   *  lock is held until the tab closes. Resolves (freeing the lock) only if opening failed. */
  private async lead(): Promise<void> {
    this.setStatus({ role: "connecting", leaderTab: this.status.tabId });
    const worker = new Worker(new URL("@/lib/db/worker.ts", import.meta.url), { type: "module", name: "orbit-db" });
    const opened = new Promise<OpenInfo>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        const m = e.data;
        if (m.type === "ready") resolve(m.info);
        else if (m.type === "open-failed") reject(new Error(m.error));
        else if (m.type === "reply") {
          this.workerWaiting.get(m.wid)?.(m.reply);
          this.workerWaiting.delete(m.wid);
        }
      };
      worker.onerror = (e) => reject(new Error(e.message || "The database worker crashed."));
    });
    worker.postMessage({ type: "open", profile: this.status.profile } satisfies WorkerRequest);
    let info: OpenInfo;
    try {
      info = await opened;
    } catch (e) {
      worker.terminate();
      this.fail(e instanceof Error ? e.message : String(e));
      return;
    }
    this.worker = worker;
    this.setStatus({ role: "leader", leaderTab: this.status.tabId, info, error: null });
    this.tell({ type: "leader", tabId: this.status.tabId, info });
    this.resendAll();
    await new Promise<never>(() => {}); // hold the lock for the life of the tab
  }

  /** Runs one call in the worker, at most once per (tab, id). */
  private serve(from: string, id: number, name: string, params: unknown): Promise<Reply> {
    const key = `${from}:${id}`;
    const known = this.served.get(key);
    if (known) return known;
    const worker = this.worker!;
    const p = new Promise<Reply>((resolve) => {
      const wid = this.nextWid++;
      this.workerWaiting.set(wid, resolve);
      worker.postMessage({ type: "call", wid, name, params } satisfies WorkerRequest);
    }).then((reply) => {
      if (reply.ok && reply.changed.length) {
        this.changed(reply.changed);
        this.tell({ type: "changed", tables: reply.changed });
      }
      return reply;
    });
    this.served.set(key, p);
    setTimeout(() => this.served.delete(key), REMEMBER_MS);
    return p;
  }
}

// -------------------------------------------------------------------- module API
let connection: Connection | null = null;
/** The page's connection, started on first use (in the browser only). Profile "default" until
 *  profiles exist. */
function db(): Connection {
  if (typeof window === "undefined") throw new Error("The database is only available in the browser.");
  return (connection ??= new Connection("default"));
}

/** Calls a named query outside React. Throws with the error message if it fails. */
export async function dbCall<N extends QueryName>(name: N, ...args: ArgsOf<N>): Promise<ResultOf<N>> {
  const reply = await db().call(name, args[0]);
  if (!reply.ok) throw new Error(reply.error);
  return reply.data as ResultOf<N>;
}

const SERVER_STATUS: DbStatus = {
  role: "connecting",
  tabId: "",
  profile: "default",
  leaderTab: null,
  info: null,
  error: null,
};

/** Live status of the connection (role, leader tab, schema version…). */
export function useDbStatus(): DbStatus {
  return useSyncExternalStore(
    (fn) => db().onStatus(fn),
    () => db().status,
    () => SERVER_STATUS,
  );
}

export interface QueryState<T> {
  data: T | undefined; // the last result; kept while re-running so screens don't flicker
  error: string | null;
  loading: boolean; // true until the first result, and while re-running
  refetch: () => void;
}

/** Runs a named read query and re-runs it whenever a table it reads changes, in any tab. */
export function useQuery<N extends QueryName>(name: N, ...args: ArgsOf<N>): QueryState<ResultOf<N>> {
  const params = args[0];
  const key = JSON.stringify(params ?? null);
  const status = useDbStatus();
  const [state, setState] = useState<{ data: ResultOf<N> | undefined; error: string | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  // Re-run when a table this query reads changes.
  const reads = status.info?.reads[name];
  useEffect(() => {
    if (!reads) return;
    return db().onChange((tables) => {
      if (reads.some((t) => tables.has(t))) setVersion((v) => v + 1);
    });
  }, [reads]);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    db()
      .call(name, key === "null" ? undefined : JSON.parse(key))
      .then((r) => {
        if (!live) return;
        if (r.ok) setState({ data: r.data as ResultOf<N>, error: null, loading: false });
        else setState((s) => ({ data: s.data, error: r.error, loading: false }));
      });
    return () => {
      live = false;
    };
  }, [name, key, version]);

  return { ...state, refetch };
}

export interface MutationState<N extends QueryName> {
  /** Runs the write. Resolves to the result, or undefined if it failed (an error toast is shown). */
  run: (...args: ArgsOf<N>) => Promise<ResultOf<N> | undefined>;
  pending: boolean;
  error: string | null;
}

/** A named write query. Errors show a toast and never fail silently. */
export function useMutation<N extends QueryName>(name: N): MutationState<N> {
  const toast = useToast();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const run = useCallback(
    async (...args: ArgsOf<N>) => {
      setPending((n) => n + 1);
      try {
        const reply = await db().call(name, args[0]);
        if (reply.ok) {
          setError(null);
          return reply.data as ResultOf<N>;
        }
        setError(reply.error);
        toastRef.current(`Couldn't save: ${reply.error}`, "error");
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [name],
  );
  return { run, pending: pending > 0, error };
}

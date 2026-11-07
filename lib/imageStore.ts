"use client";
// The pictures live in IndexedDB (one database per profile) because a few pictures would fill the ~5 MB the browser gives localStorage.
import { scope } from "./profiles";
import { packImageNames } from "./images";
import { PackData, packToJson } from "./packs";

const STORE = "img";
const memory = new Map<string, string>();
const dbName = () => scope("images");

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName(), 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function saveImages(images: Record<string, string>): Promise<void> {
  const entries = Object.entries(images);
  if (!entries.length) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const [k, v] of entries) { tx.objectStore(STORE).put(v, k); memory.set(`${dbName()}/${k}`, v); }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadImages(names: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const need = names.filter((n) => { const m = memory.get(`${dbName()}/${n}`); if (m) out[n] = m; return !m; });
  if (!need.length) return out;
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    for (const n of need) { const g = tx.objectStore(STORE).get(n); g.onsuccess = () => { if (typeof g.result === "string") { out[n] = g.result; memory.set(`${dbName()}/${n}`, g.result); } }; }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
  return out;
}

export const loadImage = async (name: string) => (await loadImages([name]))[name];

/** The pack as an uploadable JSON object, with its pictures included. */
export async function exportPack(pack: PackData) {
  const names = packImageNames(pack);
  const images = names.length ? await loadImages(names) : {};
  return { ...packToJson(pack), ...(Object.keys(images).length ? { images } : {}) };
}

// Profiles work like browser profiles: each one has its own plan, question pack, progress, mocks, milestones and name.
// The first profile ("main") keeps the original storage keys, so nothing saved earlier is lost.
export interface Profile { id: string; name: string; admin?: boolean }
const LIST = "gate.profiles";
const ACTIVE = "gate.profile";
const MAIN: Profile = { id: "main", name: "Main" };

let cached: string | null = null;

export function listProfiles(): Profile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIST) ?? "null") as Profile[] | null;
    if (Array.isArray(raw) && raw.length) return raw;
  } catch { /* fall through */ }
  return [MAIN];
}
const saveList = (l: Profile[]) => localStorage.setItem(LIST, JSON.stringify(l));

export function activeProfileId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return MAIN.id;
  let id = MAIN.id;
  try { id = localStorage.getItem(ACTIVE) ?? MAIN.id; } catch { /* ignore */ }
  if (!listProfiles().some((p) => p.id === id)) id = listProfiles()[0].id;
  cached = id;
  return id;
}

/** "gate.plan" becomes "gate.p.<id>.plan" for every profile except the first one. */
export function scope(key: string, id = activeProfileId()): string {
  return id === MAIN.id ? key : key.replace(/^gate\./, `gate.p.${id}.`);
}

export const ADMIN_ID = "admin";
export const isAdminProfile = (id = activeProfileId()) => listProfiles().some((p) => p.id === id && p.admin);
/** The admin profile is made the first time it is opened. It keeps no plan or questions of its own: it manages the other profiles. */
export function ensureAdmin(): string {
  const list = listProfiles();
  if (!list.some((p) => p.id === ADMIN_ID)) saveList([...list, { id: ADMIN_ID, name: "Admin", admin: true }]);
  return ADMIN_ID;
}

export function createProfile(name: string): string {
  const list = listProfiles();
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
  let id = base;
  for (let n = 2; list.some((p) => p.id === id) || id === "main" || id === ADMIN_ID; n++) id = `${base}-${n}`;
  saveList([...list, { id, name: name.trim() || "New profile" }]);
  return id;
}

export function renameProfile(id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  saveList(listProfiles().map((p) => (p.id === id ? { ...p, name: n } : p)));
}

/**
 * Switching reloads the page so every screen starts clean on the other profile's data.
 * A full-screen veil covers the reload: it fades in here, stays up across the reload, then fades out (see components/Veil.tsx).
 */
export const VEIL_KEY = "gate.veil";
export function switchProfile(id: string, note = "", to?: string) {
  const name = listProfiles().find((p) => p.id === id)?.name ?? "";
  try { sessionStorage.setItem(VEIL_KEY, JSON.stringify({ name, note })); } catch { /* ignore */ }
  const el = document.documentElement;
  const veil = document.getElementById("veil");
  if (veil) {
    const av = veil.querySelector("[data-veil-av]"), nm = veil.querySelector("[data-veil-name]"), nt = veil.querySelector("[data-veil-note]");
    if (av) av.textContent = name.slice(0, 1).toUpperCase();
    if (nm) nm.textContent = name;
    if (nt) nt.textContent = note;
  }
  el.dataset.switching = "1";
  setTimeout(() => {
    localStorage.setItem(ACTIVE, id);
    cached = null;
    if (to) window.location.assign(to); else window.location.reload();
  }, 420);
}

/** Removes a profile and everything saved in it. The last remaining profile can't be removed. */
export function deleteProfile(id: string, keys: string[]) {
  const list = listProfiles();
  if (list.filter((p) => !p.admin).length < 2 && !list.find((p) => p.id === id)?.admin) return; // keep at least one normal profile
  if (list.find((p) => p.id === id)?.admin) return; // the admin profile stays
  for (const k of keys) localStorage.removeItem(scope(k, id));
  try { indexedDB.deleteDatabase(scope("images", id)); } catch { /* no pictures to remove */ }
  const rest = list.filter((p) => p.id !== id);
  saveList(rest);
  if (activeProfileId() === id) switchProfile(rest.find((p) => !p.admin)?.id ?? rest[0].id, `Deleted “${list.find((p) => p.id === id)?.name ?? "profile"}”`);
  else window.dispatchEvent(new CustomEvent("gate-profiles"));
}

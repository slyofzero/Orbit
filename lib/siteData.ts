// "Start fresh" helper: clears what the browser keeps for this site besides the database (the database is
// emptied by the `app.startFresh` query). Browser only.
//   * localStorage / sessionStorage: the theme choice, and anything else saved by pages
//   * cookies the page can see (Orbit sets none; a dev server may)
//   * Cache Storage and IndexedDB (Orbit doesn't use them; cleared so nothing of the site is left)

export async function clearBrowserData(): Promise<void> {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage blocked: nothing to clear */
  }
  try {
    const host = location.hostname;
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (!name) continue;
      for (const domain of ["", `; domain=${host}`, `; domain=.${host}`])
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  } catch {
    /* cookies blocked */
  }
  try {
    for (const key of await caches.keys()) await caches.delete(key);
  } catch {
    /* no Cache Storage here */
  }
  try {
    for (const db of (await indexedDB.databases?.()) ?? []) if (db.name) indexedDB.deleteDatabase(db.name);
  } catch {
    /* no IndexedDB listing here */
  }
}

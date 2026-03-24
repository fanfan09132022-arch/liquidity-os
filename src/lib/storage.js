const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export async function listDailySnapshotSummaries(days = 30) {
  const items = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateValue = d.toISOString().slice(0, 10);
    const key = `daily:${dateValue}`;
    try {
      const raw = read(key);
      if (!raw) continue;
      const snap = JSON.parse(raw);
      items.push({
        dateValue,
        hero: snap.heroSnapshot || null,
        fgVal: snap.fgVal ?? "",
        l4: snap.l4Snapshot || null,
        note: snap.dailyNote || "",
        hasMacro: !!snap.macroSnapshot,
        savedAt: snap.savedAt || null,
      });
    } catch {
      // ignore invalid snapshot
    }
  }
  return items;
}

export const storage = {
  /**
   * Read the raw string payload for a key.
   * Callers are responsible for JSON.parse when structured data is stored.
   * @param {string} key
   * @returns {Promise<{ value: string } | null>} Returns the original stored string or null.
   */
  async get(key) {
    const value = read(key);
    return value == null ? null : { value };
  },
  /**
   * Persist a raw string payload for a key.
   * Callers are responsible for JSON.stringify before passing objects or arrays.
   * Passing a non-string may be coerced by localStorage into values like "[object Object]" without throwing.
   * @param {string} key
   * @param {string} value
   * @returns {Promise<{ ok: true }>}
   */
  async set(key, value) {
    const ok = write(key, value);
    if (!ok) throw new Error("localStorage 写入失败");
    return { ok: true };
  },
};

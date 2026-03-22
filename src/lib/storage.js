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

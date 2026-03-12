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
  async get(key) {
    const value = read(key);
    return value == null ? null : { value };
  },
  async set(key, value) {
    const ok = write(key, value);
    if (!ok) throw new Error("localStorage 写入失败");
    return { ok: true };
  },
};

const WORKER_URL = import.meta.env.VITE_WORKER_BASE_URL || "https://liquidityos-data.fanfan09132022.workers.dev";

export async function fetchMacroViaAI() {
  throw new Error("独立站 MVP 未启用浏览器端 AI 兜底");
}

export async function fetchMacroViaWorker() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${WORKER_URL}/api/all`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAlphaSupport(chain, address) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const qs = new URLSearchParams({ chain, address });
    const res = await fetch(`${WORKER_URL}/api/alpha-support?${qs.toString()}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

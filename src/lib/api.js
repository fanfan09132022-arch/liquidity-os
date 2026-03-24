import { WORKER } from "../config.js";
const WORKER_URL = import.meta.env.VITE_WORKER_BASE_URL || WORKER;

export async function fetchMacroViaAI() {
  throw new Error("独立站 MVP 未启用浏览器端 AI 兜底");
}

export async function fetchMacroViaWorker() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
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

export async function fetchNewsflash(panel) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const qs = new URLSearchParams({ panel });
    const res = await fetch(`${WORKER_URL}/api/newsflash?${qs.toString()}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMemeRadar() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${WORKER_URL}/api/meme-radar`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Worker ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTokenSecurity(chain, address) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const qs = new URLSearchParams({ chain, address });
    const gmgn = await fetch(`${WORKER_URL}/api/gmgn/token-security?${qs.toString()}`, { signal: ctrl.signal });
    if (gmgn.ok) return await gmgn.json();

    const binance = await fetch(`${WORKER_URL}/api/binance/token-audit?${qs.toString()}`, { signal: ctrl.signal });
    if (binance.ok) return await binance.json();

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

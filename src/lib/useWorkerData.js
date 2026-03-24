import { useState, useEffect } from "react";
import { fetchMacroViaWorker } from "./api";

let _data = null;
let _loading = true;
let _error = null;
let _lastUpdated = null;
let _timer = null;
const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => fn({ data: _data, loading: _loading, error: _error, lastUpdated: _lastUpdated }));
}

async function _fetchOnce() {
  _loading = true;
  _error = null;
  _notify();
  try {
    _data = await fetchMacroViaWorker();
    _lastUpdated = new Date();
    _error = null;
  } catch (e) {
    _error = e?.message || "Worker 请求失败";
  } finally {
    _loading = false;
    _notify();
  }
}

function _startPolling() {
  if (_timer !== null) return;
  _fetchOnce();
  _timer = setInterval(_fetchOnce, 5 * 60 * 1000);
}

export function useWorkerData() {
  const [state, setState] = useState({
    data: _data,
    loading: _loading,
    error: _error,
    lastUpdated: _lastUpdated,
  });

  useEffect(() => {
    _listeners.add(setState);
    _startPolling();
    return () => {
      _listeners.delete(setState);
    };
  }, []);

  return state;
}

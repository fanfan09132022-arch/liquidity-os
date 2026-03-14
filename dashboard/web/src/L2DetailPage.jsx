import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WORKER } from "./config.js";

const C = {
  bg: "#F2F2F7", card: "#fff", label: "#000", labelSec: "#3C3C43",
  labelTer: "rgba(60,60,67,0.6)", labelQ: "rgba(60,60,67,0.4)",
  sep: "rgba(60,60,67,0.16)", fill: "rgba(120,120,128,0.08)",
  fill2: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", orange: "#FF9500",
  red: "#FF3B30", yellow: "#FFCC00", purple: "#AF52DE", teal: "#30B0C7",
};

const STABLECOINS_ENDPOINT = `${WORKER}/api/llama/stablecoins`;
const STABLECOIN_HISTORY_ENDPOINT = `${WORKER}/api/llama/stable-chart`;
const CHAIN_ENDPOINTS = {
  solana: `${WORKER}/api/llama/stable-chart/Solana`,
  bsc: `${WORKER}/api/llama/stable-chart/BSC`,
  base: `${WORKER}/api/llama/stable-chart/Base`,
};

const HISTORY_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, ALL: null };
const CHAIN_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: null };

const CHAIN_META = {
  solana: { label: "Solana", icon: "🟣", color: "#9945FF" },
  bsc: { label: "BSC", icon: "🟡", color: "#F3BA2F" },
  base: { label: "Base", icon: "🔵", color: "#0052FF" },
};

const pageBodyStyle = {
  background: "#F2F2F7",
  minHeight: "100vh",
  fontFamily: "-apple-system,'Helvetica Neue',sans-serif",
};

const contentWrapStyle = {
  padding: "16px 0 48px",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  margin: "0 16px 12px",
  padding: "16px",
};

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(value !== 0 && Math.abs(value) < 10 ? 2 : 0);
}

function fmtPct(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtBillions(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) / 1e9).toFixed(1)}B`;
}

function fmtSignedNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${fmtNum(Math.abs(value))}`;
}

function formatMonthDay(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function getXAxisInterval(period) {
  if (period === "1W") return 1;
  if (period === "1M") return 4;
  if (period === "3M") return 11;
  if (period === "6M") return 19;
  if (period === "1Y") return 30;
  if (period === "2Y" || period === "ALL") return 40;
  return 0;
}

function getPctColor(value) {
  const numeric = toNumber(value);
  if (numeric == null) return C.labelTer;
  if (numeric > 0) return C.green;
  if (numeric < 0) return C.red;
  return C.labelTer;
}

function sortByTimestampAsc(points) {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
}

function clampToRecentDays(points, days) {
  if (!Array.isArray(points) || !points.length) return [];
  const sorted = sortByTimestampAsc(points);
  const latest = sorted[sorted.length - 1].timestamp;
  const start = latest - ((days - 1) * 24 * 60 * 60 * 1000);
  return sorted.filter((point) => point.timestamp >= start);
}

function collapseToDaily(points) {
  const map = new Map();
  sortByTimestampAsc(points).forEach((point) => {
    map.set(formatMonthDay(point.timestamp), point);
  });
  return Array.from(map.values());
}

function getChainDirection(changePct, currentValue) {
  const numeric = toNumber(changePct);
  if (numeric == null || currentValue == null) return "—";
  if (numeric > 5) return "📈 流入";
  if (numeric < -5) return "📉 流出";
  return "➡️ 持平";
}

async function fetchJSON(url, timeout = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function SkeletonLine({ width = "100%", height = 12, radius = 999 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, rgba(120,120,128,0.08), rgba(120,120,128,0.18), rgba(120,120,128,0.08))",
      }}
    />
  );
}

function ChartSkeleton({ height }) {
  return (
    <div
      style={{
        height,
        borderRadius: 16,
        background: "linear-gradient(90deg, rgba(120,120,128,0.08), rgba(120,120,128,0.18), rgba(120,120,128,0.08))",
      }}
    />
  );
}

function PeriodButtons({ options, active, onChange }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {options.map((option) => {
        const activeFlag = option === active;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
              border: "none",
              borderRadius: 8,
              background: activeFlag ? C.blue : "rgba(15,23,42,0.05)",
              color: activeFlag ? "#fff" : "#6B7280",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 10px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ChartStateBlock({ loading, error, onRetry, height, children }) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) {
    return (
      <div style={{ minHeight: height, borderRadius: 16, background: "rgba(120,120,128,0.04)", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ display: "grid", gap: 10, justifyItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.labelTer }}>数据暂时不可用</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                border: "none",
                borderRadius: 10,
                background: "rgba(15,23,42,0.05)",
                color: "#6B7280",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return children;
}

function DataStateCard({ title, subtitle, loading, error, onRetry, action, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: -0.2 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.55, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {action || null}
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          <SkeletonLine width="34%" height={14} />
          <SkeletonLine width="26%" height={40} radius={12} />
          <ChartSkeleton height={200} />
        </div>
      ) : error ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: C.red }}>{error}</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                width: "fit-content",
                border: "none",
                borderRadius: 10,
                background: "rgba(255,59,48,0.08)",
                color: C.red,
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          ) : null}
        </div>
      ) : children}
    </section>
  );
}

function CustomTooltip({ active, label, payload, formatters = {} }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(60,60,67,0.12)", borderRadius: 12, boxShadow: "0 6px 18px rgba(15,23,42,0.08)", padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "grid", gap: 4 }}>
        {payload.map((item) => (
          <div key={`${item.dataKey}-${item.name}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color }} />
            <span style={{ color: "#111827" }}>
              {item.name}: {(formatters[item.dataKey] || ((v) => v))(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function extractStablecoinRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.peggedAssets)) return payload.peggedAssets;
  if (Array.isArray(payload?.assets)) return payload.assets;
  return [];
}

function getCirculatingUsd(item) {
  return toNumber(item?.circulating?.peggedUSD)
    ?? toNumber(item?.circulating?.circulatingUSD)
    ?? toNumber(item?.circulatingUSD?.peggedUSD)
    ?? toNumber(item?.marketCap)
    ?? 0;
}

function parseHistoryPoints(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.chart || payload?.data || [];
  return rows
    .map((item) => {
      const timestamp = toNumber(item?.date);
      const value = toNumber(item?.totalCirculatingUSD?.peggedUSD)
        ?? toNumber(item?.totalCirculating?.peggedUSD)
        ?? toNumber(item?.totalCirculatingUSD)
        ?? toNumber(item?.peggedUSD);
      return timestamp != null && value != null
        ? { timestamp: timestamp > 1e12 ? timestamp : timestamp * 1000, value }
        : null;
    })
    .filter(Boolean);
}

export default function L2DetailPage({ onBack }) {
  const [summaryState, setSummaryState] = useState({ loading: true, error: "", data: null });
  const [historyState, setHistoryState] = useState({ loading: true, error: "", points: [] });
  const [historyPeriod, setHistoryPeriod] = useState("3M");

  const [chainState, setChainState] = useState({ loading: true, error: "", chains: null });
  const [chainPeriod, setChainPeriod] = useState("1M");

  const loadSummary = useCallback(async () => {
    setSummaryState({ loading: true, error: "", data: null });
    try {
      const payload = await fetchJSON(STABLECOINS_ENDPOINT);
      const rows = extractStablecoinRows(payload);
      if (!rows.length) throw new Error("stablecoins empty");

      let total = 0;
      let usdt = 0;
      let usdc = 0;
      let other = 0;
      const otherSymbols = new Set(["DAI", "FDUSD", "USDE", "USD1"]);

      rows.forEach((item) => {
        const value = getCirculatingUsd(item);
        const symbol = String(item?.symbol || "").toUpperCase();
        total += value;
        if (symbol === "USDT") usdt += value;
        else if (symbol === "USDC") usdc += value;
        else if (otherSymbols.has(symbol)) other += value;
      });

      setSummaryState({
        loading: false,
        error: "",
        data: {
          total,
          usdt,
          usdc,
          other,
        },
      });
    } catch {
      setSummaryState({ loading: false, error: "数据暂时不可用", data: null });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryState({ loading: true, error: "", points: [] });
    try {
      const payload = await fetchJSON(STABLECOIN_HISTORY_ENDPOINT);
      const points = parseHistoryPoints(payload);
      if (!points.length) throw new Error("history empty");
      setHistoryState({ loading: false, error: "", points });
    } catch {
      setHistoryState({ loading: false, error: "数据暂时不可用", points: [] });
    }
  }, []);

  const loadChains = useCallback(async () => {
    setChainState({ loading: true, error: "", chains: null });
    try {
      const entries = await Promise.all(
        Object.entries(CHAIN_ENDPOINTS).map(async ([chain, url]) => {
          try {
            const payload = await fetchJSON(url);
            const points = parseHistoryPoints(payload);
            const current = points.length ? points[points.length - 1] : null;
            const sevenAgo = points.length >= 8 ? points[points.length - 8] : null;
            const changeValue = current && sevenAgo ? current.value - sevenAgo.value : null;
            const changePct = current && sevenAgo && sevenAgo.value ? ((current.value - sevenAgo.value) / sevenAgo.value) * 100 : null;
            return [chain, { current: current?.value ?? null, changeValue, changePct, points }];
          } catch {
            return [chain, null];
          }
        }),
      );

      const chains = Object.fromEntries(entries);
      if (!Object.values(chains).some(Boolean)) throw new Error("chains empty");
      setChainState({ loading: false, error: "", chains });
    } catch {
      setChainState({ loading: false, error: "数据暂时不可用", chains: null });
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadHistory();
    loadChains();
  }, [loadSummary, loadHistory, loadChains]);

  const historyChartData = useMemo(() => {
    const scoped = historyPeriod === "ALL"
      ? historyState.points
      : clampToRecentDays(historyState.points, HISTORY_PERIOD_DAYS[historyPeriod] || 90);
    return collapseToDaily(scoped).map((point) => ({
      timestamp: point.timestamp,
      label: formatMonthDay(point.timestamp),
      total: point.value,
    }));
  }, [historyPeriod, historyState.points]);

  const chainChartData = useMemo(() => {
    if (!chainState.chains) return [];
    const filteredByChain = Object.keys(CHAIN_META).map((chain) => {
      const points = chainState.chains[chain]?.points || [];
      const scoped = chainPeriod === "ALL"
        ? points
        : clampToRecentDays(points, CHAIN_PERIOD_DAYS[chainPeriod] || 30);
      return [chain, collapseToDaily(scoped)];
    });
    const chartMap = new Map();
    filteredByChain.forEach(([chain, points]) => {
      points.forEach((point) => {
        const existing = chartMap.get(point.timestamp) || { timestamp: point.timestamp };
        chartMap.set(point.timestamp, {
          ...existing,
          label: formatMonthDay(point.timestamp),
          [chain]: point.value,
        });
      });
    });
    return Array.from(chartMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [chainPeriod, chainState.chains]);

  const summaryCards = useMemo(() => {
    const total = summaryState.data?.total || 0;
    return [
      { key: "usdt", label: "USDT", value: summaryState.data?.usdt ?? null },
      { key: "usdc", label: "USDC", value: summaryState.data?.usdc ?? null },
      { key: "other", label: "其他主流", value: summaryState.data?.other ?? null },
    ].map((item) => ({
      ...item,
      pct: item.value != null && total > 0 ? (item.value / total) * 100 : null,
    }));
  }, [summaryState.data]);

  return (
    <div className="lo-btc-detail-page" style={pageBodyStyle}>
      <header className="lo-btc-detail-topbar">
        <div className="lo-btc-detail-topbar-inner">
          <button type="button" className="lo-btc-detail-back" onClick={onBack}>
            ← 返回
          </button>
          <div className="lo-btc-detail-heading">
            <h1 className="lo-btc-detail-title">L2 · 稳定币弹药</h1>
            <p className="lo-btc-detail-subtitle">稳定币总量 · 链上净流入 · 交易所储备</p>
          </div>
        </div>
      </header>

      <main style={contentWrapStyle}>
        <DataStateCard
          title="稳定币总量"
          subtitle="数据来源：DeFiLlama"
          loading={summaryState.loading}
          error={summaryState.error}
          onRetry={loadSummary}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ fontSize: 42, fontWeight: 760, letterSpacing: -1.4, color: "#111827" }}>
              {fmtNum(summaryState.data?.total)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {summaryCards.map((item) => (
                <div key={item.key} style={{ borderRadius: 14, padding: 14, background: "rgba(120,120,128,0.05)" }}>
                  <div style={{ fontSize: 12, color: C.labelTer, marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 760, letterSpacing: -0.8, color: "#111827", marginBottom: 6 }}>
                    {fmtNum(item.value)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.labelSec }}>
                    {item.pct == null ? "—" : `${item.pct.toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DataStateCard>

        <DataStateCard
          title="稳定币总量历史走势"
          subtitle="蓝线观察整体弹药变化，周期切换只过滤本地数据。"
          loading={historyState.loading}
          error={historyState.error}
          onRetry={loadHistory}
          action={<PeriodButtons options={Object.keys(HISTORY_PERIOD_DAYS)} active={historyPeriod} onChange={setHistoryPeriod} />}
        >
          <ChartStateBlock loading={false} error={historyChartData.length ? "" : "数据暂时不可用"} onRetry={loadHistory} height={200}>
            <div style={{ height: 200, borderRadius: 16, background: "rgba(120,120,128,0.04)", padding: "10px 6px 0" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChartData} margin={{ top: 12, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke="rgba(60,60,67,0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(60,60,67,0.6)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={getXAxisInterval(historyPeriod)}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "rgba(60,60,67,0.6)", fontSize: 11 }}
                    tickFormatter={fmtBillions}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip content={<CustomTooltip formatters={{ total: fmtNum }} />} />
                  <Line type="monotone" dataKey="total" name="稳定币总量" stroke="#007AFF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartStateBlock>
        </DataStateCard>

        <DataStateCard
          title="三链稳定币净流入"
          subtitle="追踪 Solana / BSC / Base 的当前余额与近 7 日净变化。"
          loading={chainState.loading}
          error={chainState.error}
          onRetry={loadChains}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {Object.keys(CHAIN_META).map((chain) => {
              const meta = CHAIN_META[chain];
              const item = chainState.chains?.[chain] || null;
              return (
                <div key={chain} style={{ borderRadius: 14, padding: 14, background: "rgba(120,120,128,0.05)", minHeight: 148 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{meta.label}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 760, letterSpacing: -1, color: "#111827", marginBottom: 10 }}>
                    {fmtNum(item?.current)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: getPctColor(item?.changeValue), marginBottom: 6 }}>
                    {item?.changeValue == null ? "—" : fmtSignedNum(item.changeValue)}
                  </div>
                  <div style={{ fontSize: 12, color: item?.changePct == null ? C.labelTer : meta.color, fontWeight: 700 }}>
                    {getChainDirection(item?.changePct, item?.current)}
                  </div>
                </div>
              );
            })}
          </div>
        </DataStateCard>

        <DataStateCard
          title="三链稳定币历史折线图"
          subtitle="复用已拉取的三链历史数据，切换仅过滤本地序列。"
          loading={chainState.loading}
          error={chainState.error}
          onRetry={loadChains}
          action={<PeriodButtons options={Object.keys(CHAIN_PERIOD_DAYS)} active={chainPeriod} onChange={setChainPeriod} />}
        >
          <ChartStateBlock loading={false} error={chainChartData.length ? "" : "数据暂时不可用"} onRetry={loadChains} height={200}>
            <div style={{ height: 200, borderRadius: 16, background: "rgba(120,120,128,0.04)", padding: "10px 6px 0" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chainChartData} margin={{ top: 12, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke="rgba(60,60,67,0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(60,60,67,0.6)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={getXAxisInterval(chainPeriod)}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: "rgba(60,60,67,0.6)", fontSize: 11 }}
                    tickFormatter={fmtBillions}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip content={<CustomTooltip formatters={{ solana: fmtNum, bsc: fmtNum, base: fmtNum }} />} />
                  <Legend verticalAlign="bottom" align="left" iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="solana" name="Solana" stroke="#9945FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="bsc" name="BSC" stroke="#F3BA2F" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="base" name="Base" stroke="#0052FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartStateBlock>
        </DataStateCard>

        <section style={{ margin: "8px 16px 0", fontSize: 12, color: C.labelTer }}>
          数据来源：DeFiLlama · 每日更新
        </section>
      </main>
    </div>
  );
}

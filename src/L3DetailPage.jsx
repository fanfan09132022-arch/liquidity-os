import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const DEFILLAMA_ENDPOINTS = {
  solana: `${WORKER}/api/llama/dex/solana`,
  bsc: `${WORKER}/api/llama/dex/bsc`,
  base: `${WORKER}/api/llama/dex/base`,
};

const DEX_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: null };

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

const numFontStyle = {
  fontFamily: "var(--lo-num-font)",
  fontVariantNumeric: "tabular-nums",
};

const refreshButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: "rgba(15,23,42,0.05)",
  color: "#6B7280",
  fontSize: 11,
  fontWeight: 700,
  padding: "6px 10px",
  cursor: "pointer",
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

function fmtTurnover(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  if (value >= 0.1) return `${value.toFixed(2)}x`;
  if (value >= 0.01) return `${value.toFixed(2)}x`;
  return `${value.toFixed(3)}x`;
}

function fmtBillions(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) / 1e9).toFixed(1)}B`;
}

function fmtThousandsUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) / 1e3).toFixed(0)}K`;
}

function getPctColor(value) {
  const numeric = toNumber(value);
  if (numeric == null) return C.labelTer;
  if (numeric > 0) return C.green;
  if (numeric < 0) return C.red;
  return C.labelTer;
}

function getSignalValueColor(value, neutralThreshold = 0) {
  const numeric = toNumber(value);
  if (numeric == null) return C.label;
  if (numeric > neutralThreshold) return "var(--lo-green, #34C759)";
  if (numeric < -neutralThreshold) return "var(--lo-red, #FF3B30)";
  return "var(--lo-yellow, #FF9500)";
}

function getTurnoverColor(value) {
  const numeric = toNumber(value);
  if (numeric == null) return C.labelTer;
  if (numeric >= 1) return C.green;
  if (numeric >= 0.3) return C.orange;
  return C.red;
}

function getTurnoverLabel(value) {
  const numeric = toNumber(value);
  if (numeric == null) return "数据暂缺";
  if (numeric >= 1) return "高周转";
  if (numeric >= 0.3) return "中周转";
  return "低周转";
}

function getRadarSignalLineColor(change24h, turnover) {
  const change = toNumber(change24h);
  const turn = toNumber(turnover);
  if ((change != null && change < 0) || (turn != null && turn < 0.1)) return "var(--lo-red, #FF3B30)";
  if ((change != null && change > 0) && (turn != null && turn >= 0.3)) return "var(--lo-green, #34C759)";
  return "var(--lo-yellow, #FF9500)";
}

function getRadarSignalTone(change24h, turnover) {
  const change = toNumber(change24h);
  const turn = toNumber(turnover);
  if ((change != null && change < 0) || (turn != null && turn < 0.1)) return "red";
  if ((change != null && change > 0) && (turn != null && turn >= 0.3)) return "green";
  return "yellow";
}

function getDexDirection(changePct) {
  const numeric = toNumber(changePct);
  if (numeric == null) return "—";
  if (numeric > 10) return "📈 上升";
  if (numeric < -10) return "📉 下降";
  return "➡️ 持平";
}

function getChartLabelFill(lineColor) {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") {
    return "rgba(255,255,255,0.50)";
  }
  return lineColor || "rgba(15,23,42,0.55)";
}

function renderDexEndLabel(data, lineName, lineColor, changePct) {
  return function DexEndLabel(props) {
    const { x, y, index, value } = props || {};
    if (!Array.isArray(data) || data.length < 2 || index !== data.length - 1 || x == null || y == null) return null;
    const numericValue = toNumber(value);
    if (numericValue == null) return null;
    const pct = toNumber(changePct);
    const arrow = pct == null ? "" : pct > 5 ? " ↑" : pct < -5 ? " ↓" : "";
    const formatted = numericValue >= 1e9
      ? `${(numericValue / 1e9).toFixed(1)}B`
      : numericValue >= 1e6
        ? `${(numericValue / 1e6).toFixed(0)}M`
        : numericValue >= 1e3
          ? `${(numericValue / 1e3).toFixed(0)}K`
          : numericValue.toFixed(0);
    return (
      <text
        x={x + 8}
        y={y}
        fill={getChartLabelFill(lineColor)}
        fontSize={10}
        fontFamily="var(--lo-num-font)"
        textAnchor="start"
        dominantBaseline="middle"
      >
        {lineName} {formatted}{arrow}
      </text>
    );
  };
}

function formatMonthDay(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatHourMinute(value) {
  if (!value) return "";
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getXAxisInterval(period) {
  if (period === "1D") return "preserveStartEnd";
  if (period === "1W") return 1;
  if (period === "1M") return 4;
  if (period === "3M") return 14;
  if (period === "6M") return 22;
  if (period === "1Y") return 29;
  if (period === "ALL") return 40;
  return 0;
}

function safeDivide(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function slugifyCoinId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.'"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COINGECKO_ID_MAP = {
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  BONK: "bonk",
  PENGU: "pudgy-penguins",
  TRUMP: "official-trump",
  PUMP: "pump-fun",
  M: "memecore",
  SIREN: "siren",
  PIPPIN: "pippin",
};

function resolveCoinGeckoId(item) {
  const symbol = String(item?.token || item?.symbol || "").toUpperCase();
  if (COINGECKO_ID_MAP[symbol]) return COINGECKO_ID_MAP[symbol];
  const nameSlug = slugifyCoinId(item?.name);
  if (nameSlug) return nameSlug;
  const tokenSlug = slugifyCoinId(item?.token || item?.symbol);
  return tokenSlug || null;
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

async function fetchProxyJSON(url, timeout = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      const start = Math.min(
        ...["[", "{"]
          .map((token) => text.indexOf(token))
          .filter((index) => index >= 0),
      );
      const endBracket = text.lastIndexOf("]");
      const endBrace = text.lastIndexOf("}");
      const end = Math.max(endBracket, endBrace);
      if (!Number.isFinite(start) || end <= start) throw new Error("proxy json parse failed");
      return JSON.parse(text.slice(start, end + 1));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSONWithFallback(url, timeout = 12000) {
  return fetchJSON(url, timeout);
}

async function fetchJSONInBatches(urls, batchSize = 3) {
  const results = [];
  for (let start = 0; start < urls.length; start += batchSize) {
    const chunk = urls.slice(start, start + batchSize);
    const chunkResults = await Promise.all(chunk.map((url) => fetchJSONWithFallback(url).catch(() => null)));
    results.push(...chunkResults);
  }
  return results;
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
          <ChartSkeleton height={220} />
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

export default function L3DetailPage({ onBack, memeTopData }) {
  const [memeSummaryState, setMemeSummaryState] = useState({ loading: true, error: "", data: null });

  const [dexState, setDexState] = useState({ loading: true, error: "", data: null });
  const [dexPeriod, setDexPeriod] = useState("1M");

  const [radarState, setRadarState] = useState({ loading: true, error: "", rows: [] });
  const [hoveredRow, setHoveredRow] = useState(null);

  const topRowsFromMacro = useMemo(() => {
    const items = Array.isArray(memeTopData?.items) ? memeTopData.items : [];
    return items.map((item, index) => {
      const marketCap = toNumber(item?.market_cap);
      const totalVolume = toNumber(item?.volume_24h ?? item?.total_volume);
      return {
        rank: toNumber(item?.rank) ?? index + 1,
        id: item?.id || resolveCoinGeckoId(item),
        symbol: String(item?.token || item?.symbol || "—").toUpperCase(),
        name: item?.name || "—",
        image: item?.image || item?.logo || null,
        marketCap,
        totalVolume,
        change24h: toNumber(item?.change_24h_pct ?? item?.price_change_percentage_24h),
        change7d: toNumber(item?.change_7d_pct ?? item?.price_change_percentage_7d_in_currency),
        turnover: safeDivide(totalVolume, marketCap),
      };
    });
  }, [memeTopData]);

  const loadDexVolumes = useCallback(async () => {
    setDexState({ loading: true, error: "", data: null });
    try {
      const entries = await Promise.all(
        Object.entries(DEFILLAMA_ENDPOINTS).map(async ([chain, url]) => {
          try {
            const payload = await fetchJSON(url);
            const totalDataChart = Array.isArray(payload?.totalDataChart) ? payload.totalDataChart : [];
            const chartPoints = totalDataChart
              .map((item) => ({
                timestamp: Array.isArray(item) ? (Number(item[0]) > 1e12 ? Number(item[0]) : Number(item[0]) * 1000) : null,
                value: Array.isArray(item) ? toNumber(item[1]) : null,
              }))
              .filter((item) => item.timestamp != null && item.value != null);
            const current = chartPoints.length ? chartPoints[chartPoints.length - 1].value : toNumber(payload?.total24h);
            const weekAgo = chartPoints.length >= 8 ? chartPoints[chartPoints.length - 8].value : null;
            const changePct = current != null && weekAgo ? ((current - weekAgo) / weekAgo) * 100 : null;
            return [chain, { current, changePct, chartPoints }];
          } catch {
            return [chain, null];
          }
        }),
      );

      const data = Object.fromEntries(entries);
      if (!Object.values(data).some(Boolean)) throw new Error("dex empty");
      setDexState({ loading: false, error: "", data: { chains: data } });
    } catch {
      setDexState({ loading: false, error: "数据暂时不可用", data: null });
    }
  }, []);

  useEffect(() => {
    loadDexVolumes();
  }, [loadDexVolumes]);

  useEffect(() => {
    if (topRowsFromMacro.length) {
      const marketCap = topRowsFromMacro.reduce((sum, item) => sum + (item.marketCap || 0), 0);
      const topTen = topRowsFromMacro.slice(0, 10);
      const avg24h = topTen.length
        ? topTen.reduce((sum, item) => sum + (item.change24h || 0), 0) / topTen.length
        : null;
      const avg7d = topTen.length
        ? topTen.reduce((sum, item) => sum + (item.change7d || 0), 0) / topTen.length
        : null;
      setMemeSummaryState({
        loading: false,
        error: "",
        data: {
          marketCap: marketCap || null,
          change24h: avg24h,
          change7d: avg7d,
        },
      });
      setRadarState({ loading: false, error: "", rows: topRowsFromMacro });
      return;
    }

    setMemeSummaryState({ loading: false, error: "数据暂时不可用", data: null });
    setRadarState({ loading: false, error: "数据暂时不可用", rows: [] });
  }, [topRowsFromMacro]);

  const dexChartData = useMemo(() => {
    if (!dexState.data?.chains) return [];
    const filteredByChain = Object.entries(CHAIN_META).map(([chain]) => {
      const points = dexState.data.chains[chain]?.chartPoints || [];
      const scoped = dexPeriod === "ALL"
        ? points
        : clampToRecentDays(points, DEX_PERIOD_DAYS[dexPeriod] || 30);
      return [chain, scoped];
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
  }, [dexPeriod, dexState.data]);

  const top10Turnover = useMemo(() => {
    const items = radarState.rows.slice(0, 10).filter((item) => item.turnover != null);
    if (!items.length) return null;
    return items.reduce((sum, item) => sum + item.turnover, 0) / items.length;
  }, [radarState.rows]);
  const radarSummary = useMemo(() => {
    return radarState.rows.reduce((acc, row) => {
      acc[getRadarSignalTone(row.change24h, row.turnover)] += 1;
      return acc;
    }, { green: 0, red: 0, yellow: 0 });
  }, [radarState.rows]);

  return (
    <div className="lo-btc-detail-page" style={{ ...pageBodyStyle, borderTop: "2px solid rgba(240,180,41,0.3)" }}>
      <header className="lo-btc-detail-topbar">
        <div className="lo-btc-detail-topbar-inner">
          <button type="button" className="lo-btc-detail-back" onClick={onBack}>
            ← 返回
          </button>
          <div className="lo-btc-detail-heading">
            <h1 className="lo-btc-detail-title">L3 · Meme 板块</h1>
            <p className="lo-btc-detail-subtitle">Meme 市值 · 三链 DEX 交易量 · Top 50 雷达</p>
          </div>
        </div>
      </header>

      <main style={contentWrapStyle}>
        <DataStateCard
          title="Meme 总市值"
          subtitle="数据来源：CoinGecko"
          loading={false}
          error=""
          onRetry={null}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{
                ...numFontStyle,
                fontSize: 42,
                fontWeight: 760,
                letterSpacing: -1.4,
                color: getSignalValueColor(memeSummaryState.data?.change24h, 0.1),
              }}>
                {fmtNum(memeSummaryState.data?.marketCap)}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 140, padding: "12px 14px", borderRadius: 12, background: "rgba(52,199,89,0.08)" }}>
                  <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 6 }}>24h 变化</div>
                  <div style={{ ...numFontStyle, fontSize: 20, fontWeight: 700, color: getPctColor(memeSummaryState.data?.change24h) }}>{fmtPct(memeSummaryState.data?.change24h, 2)}</div>
                </div>
                <div style={{ minWidth: 140, padding: "12px 14px", borderRadius: 12, background: "rgba(15,23,42,0.04)" }}>
                  <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 6 }}>7 日变化</div>
                  <div style={{ ...numFontStyle, fontSize: 20, fontWeight: 700, color: getPctColor(memeSummaryState.data?.change7d) }}>{fmtPct(memeSummaryState.data?.change7d, 2)}</div>
                </div>
              </div>
            </div>
            <div style={{ borderRadius: 16, background: "rgba(120,120,128,0.04)", padding: "18px 16px", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>历史走势图暂不可用</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: C.labelTer }}>
                CoinGecko 免费 API 在前端详情页场景下存在限速，当前只展示实时快照。
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: C.labelTer }}>
                历史趋势图需要更稳定的数据源或付费 API，后续再单独恢复。
              </div>
            </div>
          </div>
        </DataStateCard>

        <DataStateCard
          title="三链 DEX 交易量对比"
          subtitle="数据来源：DeFiLlama"
          loading={dexState.loading}
          error={dexState.error}
          onRetry={loadDexVolumes}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {Object.keys(CHAIN_META).map((chainKey) => {
                const chainInfo = CHAIN_META[chainKey];
                const item = dexState.data?.chains?.[chainKey] || null;
                return (
                  <div key={chainKey} style={{ borderRadius: 14, padding: 14, background: "rgba(120,120,128,0.05)", minHeight: 146 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>{chainInfo.icon}</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{chainInfo.label}</div>
                    </div>
                    <div style={{ ...numFontStyle, fontSize: 28, fontWeight: 760, letterSpacing: -1, color: "#111827", marginBottom: 12 }}>{fmtNum(item?.current)}</div>
                    <div style={{ ...numFontStyle, fontSize: 13, fontWeight: 700, color: getPctColor(item?.changePct), marginBottom: 6 }}>{fmtPct(item?.changePct, 2)}</div>
                    <div style={{ fontSize: 12, color: item?.changePct == null ? C.labelTer : chainInfo.color, fontWeight: 700 }}>{getDexDirection(item?.changePct)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <PeriodButtons
                options={Object.keys(DEX_PERIOD_DAYS)}
                active={dexPeriod}
                onChange={setDexPeriod}
              />
            </div>

            <ChartStateBlock
              loading={false}
              error={dexChartData.length ? "" : "数据暂时不可用"}
              height={220}
            >
              <div style={{ height: 220, borderRadius: 16, background: "rgba(120,120,128,0.04)", padding: "10px 6px 0", overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dexChartData} margin={{ top: 12, right: 60, left: 4, bottom: 12 }}>
                    <CartesianGrid stroke="rgba(60,60,67,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(60,60,67,0.6)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval={getXAxisInterval(dexPeriod)}
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
                    <Line type="monotone" dataKey="solana" name="Solana" stroke="#9945FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "Solana", "#9945FF", dexState.data?.chains?.solana?.changePct)} />
                    <Line type="monotone" dataKey="bsc" name="BSC" stroke="#F3BA2F" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "BSC", "#F3BA2F", dexState.data?.chains?.bsc?.changePct)} />
                    <Line type="monotone" dataKey="base" name="Base" stroke="#0052FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "Base", "#0052FF", dexState.data?.chains?.base?.changePct)} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartStateBlock>
          </div>
        </DataStateCard>

        <DataStateCard
          title="Top 50 Meme 市场雷达"
          subtitle="按 CoinGecko 市值榜读取 Top 50，重点看 24h 波动与换手率。"
          loading={radarState.loading}
          error={radarState.error}
          onRetry={null}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(15,23,42,0.04)", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 6 }}>Top 10 平均换手率</div>
                <div style={{ ...numFontStyle, fontSize: 28, fontWeight: 760, letterSpacing: -0.8, color: getTurnoverColor(top10Turnover) }}>{fmtTurnover(top10Turnover)}</div>
              </div>
              <div style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "7px 12px", background: "rgba(120,120,128,0.08)", fontSize: 12, fontWeight: 700, color: getTurnoverColor(top10Turnover) }}>
                {getTurnoverLabel(top10Turnover)}
              </div>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(60,60,67,0.08)" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid rgba(60,60,67,0.08)", background: "rgba(120,120,128,0.03)" }}>
                <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-muted, rgba(60,60,67,0.4))" }}>绿线 {radarSummary.green} 个</div>
                <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-muted, rgba(60,60,67,0.4))" }}>红线 {radarSummary.red} 个</div>
                <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-muted, rgba(60,60,67,0.4))" }}>黄线 {radarSummary.yellow} 个</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "rgba(120,120,128,0.05)" }}>
                    {["代币名", "市值", "24H 涨跌", "换手率"].map((label) => (
                      <th
                        key={label}
                        style={{
                          textAlign: label === "代币名" ? "left" : "right",
                          padding: "11px 12px",
                          fontSize: "var(--lo-text-meta)",
                          color: "var(--lo-text-muted, rgba(60,60,67,0.4))",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radarState.rows.map((row) => {
                    const rowKey = `${row.rank}-${row.symbol}`;
                    return (
                      <tr
                        key={rowKey}
                        onMouseEnter={() => setHoveredRow(rowKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          background: hoveredRow === rowKey ? "rgba(120,120,128,0.06)" : "#fff",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px", borderTop: "1px solid rgba(60,60,67,0.08)", borderLeft: `3px solid ${getRadarSignalLineColor(row.change24h, row.turnover)}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {row.image ? (
                              <img src={row.image} alt={row.symbol} style={{ width: 20, height: 20, borderRadius: 10, objectFit: "cover", background: "rgba(120,120,128,0.08)" }} />
                            ) : (
                              <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(120,120,128,0.12)" }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...numFontStyle, fontSize: 13, fontWeight: 700, color: "#111827" }}>{row.symbol}</div>
                              <div style={{ fontSize: 11, color: C.labelTer, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{row.name}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...numFontStyle, padding: "12px", fontSize: 12, color: "#111827", textAlign: "right", borderTop: "1px solid rgba(60,60,67,0.08)" }}>
                          {fmtNum(row.marketCap)}
                        </td>
                        <td style={{ ...numFontStyle, padding: "12px", fontSize: 12, fontWeight: 700, color: getPctColor(row.change24h), textAlign: "right", borderTop: "1px solid rgba(60,60,67,0.08)" }}>
                          {fmtPct(row.change24h, 2)}
                        </td>
                        <td style={{ ...numFontStyle, padding: "12px", fontSize: 12, fontWeight: 700, color: getTurnoverColor(row.turnover), textAlign: "right", borderTop: "1px solid rgba(60,60,67,0.08)" }}>
                          {fmtTurnover(row.turnover)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </DataStateCard>

        <div style={{ fontSize: 11, color: C.labelTer, padding: "6px 20px 0" }}>
          数据来源：CoinGecko · DeFiLlama · 每日自动更新（部分）
        </div>
      </main>
    </div>
  );
}

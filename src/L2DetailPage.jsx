import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NewsStrip } from "./components/NewsStrip.jsx";
import {
  Legend,
  Line,
} from "recharts";
import { WORKER } from "./config.js";
import { LOChart } from "./components/shared/LOChart";
import SkeletonLine from "./components/shared/SkeletonLine";
import ChartSkeleton from "./components/shared/ChartSkeleton";
import DataStateCard from "./components/shared/DataStateCard";
import PeriodButtons from "./components/shared/PeriodButtons";
import ChartStateBlock from "./components/shared/ChartStateBlock";
import CustomTooltip from "./components/shared/CustomTooltip";
import { fmtBillions, fmtNum, fmtPct, toNum } from "./lib/utils";

const STABLECOINS_ENDPOINT = `${WORKER}/api/llama/stablecoins`;
const STABLECOIN_HISTORY_ENDPOINT = `${WORKER}/api/llama/stable-chart`;
const CHAIN_ENDPOINTS = {
  solana: `${WORKER}/api/llama/stable-chart/Solana`,
  bsc: `${WORKER}/api/llama/stable-chart/BSC`,
  base: `${WORKER}/api/llama/stable-chart/Base`,
};

const HISTORY_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, ALL: null };
const CHAIN_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: null };
const CHART_HEIGHT = 220;

const CHAIN_META = {
  solana: { label: "Solana", icon: "🟣", color: "#9945FF" },
  bsc: { label: "BSC", icon: "🟡", color: "#F3BA2F" },
  base: { label: "Base", icon: "🔵", color: "#0052FF" },
};

function fmtSignedNum(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${fmtNum(Math.abs(value))}`;
}

function getSignalValueColor(value, neutralThreshold = 0) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-primary)";
  if (numeric > neutralThreshold) return "var(--lo-signal-bull)";
  if (numeric < -neutralThreshold) return "var(--lo-signal-bear)";
  return "var(--lo-signal-neutral)";
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
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-muted)";
  if (numeric > 0) return "var(--lo-signal-bull)";
  if (numeric < 0) return "var(--lo-signal-bear)";
  return "var(--lo-text-muted)";
}

function getPaddedDomain(rows, keys, paddingRatio = 0.1) {
  const values = [];
  for (const row of rows || []) {
    for (const key of keys) {
      const value = Number(row?.[key]);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padding = range > 0 ? range * paddingRatio : Math.max(Math.abs(max) * paddingRatio, 1e8);
  return [min - padding, max + padding];
}

function getPeakAnchor(points, windowDays) {
  const windowed = clampToRecentDays(points || [], windowDays).filter((point) => Number.isFinite(Number(point?.value)));
  if (windowed.length < 4) return null;
  let peakPoint = windowed[0];
  for (const point of windowed) {
    if (Number(point.value) > Number(peakPoint.value)) peakPoint = point;
  }
  const currentPoint = windowed[windowed.length - 1];
  if (!currentPoint || !Number.isFinite(Number(currentPoint.value)) || !Number.isFinite(Number(peakPoint.value)) || peakPoint.value === 0) return null;
  return {
    peakValue: Number(peakPoint.value),
    deltaPct: ((Number(currentPoint.value) - Number(peakPoint.value)) / Number(peakPoint.value)) * 100,
  };
}

function getFlowDirectionMeta(value) {
  const numeric = toNum(value);
  if (numeric == null) return { arrow: "→", color: "var(--lo-text-muted)" };
  if (numeric > 0) return { arrow: "↑", color: "var(--lo-signal-bull)" };
  if (numeric < 0) return { arrow: "↓", color: "var(--lo-signal-bear)" };
  return { arrow: "→", color: "var(--lo-signal-neutral)" };
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
  const numeric = toNum(changePct);
  if (numeric == null || currentValue == null) return "—";
  if (numeric > 5) return "📈 流入";
  if (numeric < -5) return "📉 流出";
  return "➡️ 持平";
}

function getChartLabelFill(lineColor) {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") {
    return "rgba(255,255,255,0.50)";
  }
  return lineColor || "rgba(15,23,42,0.55)";
}

function renderLineEndLabel(data, lineName, lineColor, formatter = fmtNum) {
  return function EndLabel(props) {
    const { x, y, index, value } = props || {};
    if (!Array.isArray(data) || data.length < 2 || index !== data.length - 1 || x == null || y == null) return null;
    const renderedValue = formatter(value);
    if (!renderedValue || renderedValue === "—") return null;
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
        {lineName} {renderedValue}
      </text>
    );
  };
}

function renderStableEndAnnotation(data, stableChange7d) {
  return function StableEndAnnotation(props) {
    const { x, y, index } = props || {};
    if (!Array.isArray(data) || data.length < 2 || index !== data.length - 1 || x == null || y == null) return null;
    const change = toNum(stableChange7d);
    if (change == null) return null;
    const isUp = change > 0;
    const color = isUp ? "var(--lo-signal-bull)" : change < 0 ? "var(--lo-signal-bear)" : "var(--lo-signal-neutral)";
    const arrow = isUp ? "↑" : change < 0 ? "↓" : "→";
    const text = `${change > 0 ? "+" : change < 0 ? "-" : ""}${fmtBillions(Math.abs(change), 1)} ${arrow}`;
    return (
      <text
        x={x + 8}
        y={y}
        fill={color}
        fontSize={11}
        fontFamily="var(--lo-num-font)"
        fontWeight={600}
        textAnchor="start"
        dominantBaseline="middle"
      >
        {text}
      </text>
    );
  };
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

function extractStablecoinRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.peggedAssets)) return payload.peggedAssets;
  if (Array.isArray(payload?.assets)) return payload.assets;
  return [];
}

function getCirculatingUsd(item) {
  return toNum(item?.circulating?.peggedUSD)
    ?? toNum(item?.circulating?.circulatingUSD)
    ?? toNum(item?.circulatingUSD?.peggedUSD)
    ?? toNum(item?.marketCap)
    ?? 0;
}

function parseHistoryPoints(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.chart || payload?.data || [];
  return rows
    .map((item) => {
      const timestamp = toNum(item?.date);
      const value = toNum(item?.totalCirculatingUSD?.peggedUSD)
        ?? toNum(item?.totalCirculating?.peggedUSD)
        ?? toNum(item?.totalCirculatingUSD)
        ?? toNum(item?.peggedUSD);
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

  const total7dChange = useMemo(() => {
    const points = historyState.points || [];
    const current = points.length ? points[points.length - 1] : null;
    const weekAgo = points.length >= 8 ? points[points.length - 8] : null;
    return current && weekAgo ? current.value - weekAgo.value : null;
  }, [historyState.points]);

  const historyDomain = useMemo(() => getPaddedDomain(historyChartData, ["total"]), [historyChartData]);
  const chainDomain = useMemo(() => getPaddedDomain(chainChartData, ["solana", "bsc", "base"]), [chainChartData]);
  const peakAnchor = useMemo(() => getPeakAnchor(historyState.points || [], 90), [historyState.points]);

  return (
    <div className="lo-btc-detail-page lo-detail-page" style={{ borderTop: "2px solid color-mix(in srgb, var(--lo-signal-bull) 30%, transparent)" }}>
      <main className="lo-detail-content">
        <NewsStrip panel="l2" />
        <DataStateCard
          title="稳定币总量"
          subtitle="数据来源：DeFiLlama"
          loading={summaryState.loading}
          error={summaryState.error}
          onRetry={loadSummary}
        >
          <div className="lo-d-grid" style={{ gap: 18 }}>
            <div className="lo-metric lo-metric--xl" style={{ color: getSignalValueColor(total7dChange, 1e8) }}>
              {fmtNum(summaryState.data?.total)}
            </div>
            {peakAnchor ? (
              <div className="lo-text-meta-muted" style={{ lineHeight: 1.6 }}>
                近 90 日峰值 {fmtNum(peakAnchor.peakValue)} · 当前较峰值 {peakAnchor.deltaPct > 0 ? "+" : ""}{peakAnchor.deltaPct.toFixed(1)}%
              </div>
            ) : null}
            <div className="lo-d-grid--3col">
              {summaryCards.map((item) => (
                <div key={item.key} className="lo-inset-panel">
                  <div className="lo-inset-panel__label">{item.label}</div>
                  <div className="lo-metric lo-metric--md" style={{ color: "var(--lo-text-primary)", marginBottom: 6 }}>
                    {fmtNum(item.value)}
                  </div>
                  <div className="lo-metric lo-metric--secondary">
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
            <LOChart
              data={historyChartData}
              height={200}
              xDataKey="label"
              xInterval={getXAxisInterval(historyPeriod)}
              yDomain={historyDomain}
              yTickFormatter={fmtBillions}
              yWidth={44}
              tooltipContent={<CustomTooltip formatters={{ total: fmtNum }} />}
              margin={{ top: 12, right: 60, left: 4, bottom: 12 }}
            >
              <Line
                type="monotone"
                dataKey="total"
                name="稳定币总量"
                stroke={"var(--lo-brand)"}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                label={renderStableEndAnnotation(historyChartData, total7dChange)}
              />
            </LOChart>
          </ChartStateBlock>
        </DataStateCard>

        <DataStateCard
          title="三链稳定币净流入"
          subtitle="追踪 Solana / BSC / Base 的当前余额与近 7 日净变化。"
          loading={chainState.loading}
          error={chainState.error}
          onRetry={loadChains}
        >
          <div className="lo-d-grid--3col">
            {Object.keys(CHAIN_META).map((chain) => {
              const meta = CHAIN_META[chain];
              const item = chainState.chains?.[chain] || null;
              const flowMeta = getFlowDirectionMeta(item?.changeValue);
              return (
                <div key={chain} className="lo-inset-panel" style={{ minHeight: 148 }}>
                  <div className="lo-inset-panel__header">
                    <span className="lo-inset-panel__header-icon">{meta.icon}</span>
                    <div className="lo-inset-panel__header-title">{meta.label}</div>
                  </div>
                  <div className="lo-metric lo-metric--lg" style={{ color: "var(--lo-text-primary)", marginBottom: 10 }}>
                    {fmtNum(item?.current)}
                  </div>
                  <div className="lo-metric lo-metric--xs" style={{ fontSize: 14, color: getPctColor(item?.changeValue), marginBottom: 6 }}>
                    {item?.changeValue == null ? "—" : `${flowMeta.arrow} ${fmtNum(Math.abs(item.changeValue))}`}
                  </div>
                  <div className="lo-metric lo-metric--secondary" style={{ color: item?.changePct == null ? "var(--lo-text-muted)" : meta.color }}>
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
            <LOChart
              data={chainChartData}
              height={200}
              xDataKey="label"
              xInterval={getXAxisInterval(chainPeriod)}
              yDomain={chainDomain}
              yTickFormatter={fmtBillions}
              yWidth={44}
              tooltipContent={<CustomTooltip formatters={{ solana: fmtNum, bsc: fmtNum, base: fmtNum }} />}
              margin={{ top: 12, right: 60, left: 4, bottom: 12 }}
            >
              <Legend verticalAlign="bottom" align="left" iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="solana" name="Solana" stroke="#9945FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderLineEndLabel(chainChartData, "Solana", "#9945FF")} />
              <Line type="monotone" dataKey="bsc" name="BSC" stroke="#F3BA2F" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderLineEndLabel(chainChartData, "BSC", "#F3BA2F")} />
              <Line type="monotone" dataKey="base" name="Base" stroke="#0052FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderLineEndLabel(chainChartData, "Base", "#0052FF")} />
            </LOChart>
          </ChartStateBlock>
        </DataStateCard>

        <section className="lo-text-footnote" style={{ margin: "8px 16px 0" }}>
          数据来源：DeFiLlama · 每日更新
        </section>
      </main>
    </div>
  );
}

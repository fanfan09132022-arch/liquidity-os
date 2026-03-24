import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const refreshButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: "var(--lo-bg-hover)",
  color: "var(--lo-text-muted)",
  fontSize: 11,
  fontWeight: 700,
  padding: "6px 10px",
  cursor: "pointer",
};

function fmtTurnover(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const value = Number(n);
  if (value >= 0.1) return `${value.toFixed(2)}x`;
  if (value >= 0.01) return `${value.toFixed(2)}x`;
  return `${value.toFixed(3)}x`;
}

function fmtThousandsUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) / 1e3).toFixed(0)}K`;
}

function getPctColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-muted)";
  if (numeric > 0) return "var(--lo-signal-bull)";
  if (numeric < 0) return "var(--lo-signal-bear)";
  return "var(--lo-text-muted)";
}

function getSignalValueColor(value, neutralThreshold = 0) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-primary)";
  if (numeric > neutralThreshold) return "var(--lo-signal-bull)";
  if (numeric < -neutralThreshold) return "var(--lo-signal-bear)";
  return "var(--lo-signal-neutral)";
}

function getTurnoverColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-muted)";
  if (numeric >= 1) return "var(--lo-signal-bull)";
  if (numeric >= 0.3) return "var(--lo-signal-neutral)";
  return "var(--lo-signal-bear)";
}

function getTurnoverLabel(value) {
  const numeric = toNum(value);
  if (numeric == null) return "数据暂缺";
  if (numeric >= 1) return "高周转";
  if (numeric >= 0.3) return "中周转";
  return "低周转";
}

function getRadarSignalLineColor(change24h, turnover) {
  const change = toNum(change24h);
  const turn = toNum(turnover);
  if ((change != null && change < 0) || (turn != null && turn < 0.1)) return "var(--lo-signal-bear)";
  if ((change != null && change > 0) && (turn != null && turn >= 0.3)) return "var(--lo-signal-bull)";
  return "var(--lo-signal-neutral)";
}

function getRadarSignalTone(change24h, turnover) {
  const change = toNum(change24h);
  const turn = toNum(turnover);
  if ((change != null && change < 0) || (turn != null && turn < 0.1)) return "red";
  if ((change != null && change > 0) && (turn != null && turn >= 0.3)) return "green";
  return "yellow";
}

function getDexDirection(changePct) {
  const numeric = toNum(changePct);
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
    const numericValue = toNum(value);
    if (numericValue == null) return null;
    const pct = toNum(changePct);
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

export default function L3DetailPage({ onBack, memeTopData }) {
  const [memeSummaryState, setMemeSummaryState] = useState({ loading: true, error: "", data: null });

  const [dexState, setDexState] = useState({ loading: true, error: "", data: null });
  const [dexPeriod, setDexPeriod] = useState("1M");

  const [radarState, setRadarState] = useState({ loading: true, error: "", rows: [] });

  const topRowsFromMacro = useMemo(() => {
    const items = Array.isArray(memeTopData?.items) ? memeTopData.items : [];
    return items.map((item, index) => {
      const marketCap = toNum(item?.market_cap);
      const totalVolume = toNum(item?.volume_24h ?? item?.total_volume);
      return {
        rank: toNum(item?.rank) ?? index + 1,
        id: item?.id || resolveCoinGeckoId(item),
        symbol: String(item?.token || item?.symbol || "—").toUpperCase(),
        name: item?.name || "—",
        image: item?.image || item?.logo || null,
        marketCap,
        totalVolume,
        change24h: toNum(item?.change_24h_pct ?? item?.price_change_percentage_24h),
        change7d: toNum(item?.change_7d_pct ?? item?.price_change_percentage_7d_in_currency),
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
                value: Array.isArray(item) ? toNum(item[1]) : null,
              }))
              .filter((item) => item.timestamp != null && item.value != null);
            const current = chartPoints.length ? chartPoints[chartPoints.length - 1].value : toNum(payload?.total24h);
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
    <div className="lo-btc-detail-page lo-detail-page" style={{ borderTop: "2px solid color-mix(in srgb, var(--lo-signal-neutral) 30%, transparent)" }}>
      <main className="lo-detail-content">
        <NewsStrip panel="l3" />
        <DataStateCard
          title="Meme 总市值"
          subtitle="数据来源：CoinGecko"
          loading={false}
          error=""
          onRetry={null}
        >
          <div className="lo-d-grid" style={{ gap: 16 }}>
            <div className="lo-d-flex-between lo-d-flex-between--end">
              <div className="lo-metric lo-metric--xl" style={{ color: getSignalValueColor(memeSummaryState.data?.change24h, 0.1) }}>
                {fmtNum(memeSummaryState.data?.marketCap)}
              </div>
              <div className="lo-d-flex-wrap" style={{ gap: 14 }}>
                <div className="lo-stat-card" style={{ minWidth: 140, background: "var(--lo-signal-bull-soft)" }}>
                  <div className="lo-turnover-panel__label">24h 变化</div>
                  <div className="lo-metric lo-metric--sm" style={{ color: getPctColor(memeSummaryState.data?.change24h) }}>{fmtPct(memeSummaryState.data?.change24h, 2)}</div>
                </div>
                <div className="lo-stat-card" style={{ minWidth: 140, background: "var(--lo-bg-hover)" }}>
                  <div className="lo-turnover-panel__label">7 日变化</div>
                  <div className="lo-metric lo-metric--sm" style={{ color: getPctColor(memeSummaryState.data?.change7d) }}>{fmtPct(memeSummaryState.data?.change7d, 2)}</div>
                </div>
              </div>
            </div>
            <div className="lo-note-panel">
              <div className="lo-text-label-primary" style={{ fontSize: 13 }}>历史走势图暂不可用</div>
              <div className="lo-text-footnote" style={{ lineHeight: 1.6 }}>
                CoinGecko 免费 API 在前端详情页场景下存在限速，当前只展示实时快照。
              </div>
              <div className="lo-text-footnote" style={{ lineHeight: 1.6 }}>
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
          <div className="lo-d-grid" style={{ gap: 16 }}>
            <div className="lo-d-grid--3col">
              {Object.keys(CHAIN_META).map((chainKey) => {
                const chainInfo = CHAIN_META[chainKey];
                const item = dexState.data?.chains?.[chainKey] || null;
                return (
                  <div key={chainKey} className="lo-inset-panel" style={{ minHeight: 146 }}>
                    <div className="lo-inset-panel__header">
                      <span className="lo-inset-panel__header-icon">{chainInfo.icon}</span>
                      <div className="lo-inset-panel__header-title">{chainInfo.label}</div>
                    </div>
                    <div className="lo-metric lo-metric--lg" style={{ color: "var(--lo-text-primary)", marginBottom: 12 }}>{fmtNum(item?.current)}</div>
                    <div className="lo-metric lo-metric--xs" style={{ color: getPctColor(item?.changePct), marginBottom: 6 }}>{fmtPct(item?.changePct, 2)}</div>
                    <div className="lo-metric lo-metric--secondary" style={{ color: item?.changePct == null ? "var(--lo-text-muted)" : chainInfo.color }}>{getDexDirection(item?.changePct)}</div>
                  </div>
                );
              })}
            </div>

            <div className="lo-d-flex-end">
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
              <LOChart
                data={dexChartData}
                height={220}
                xDataKey="label"
                xInterval={getXAxisInterval(dexPeriod)}
                yTickFormatter={fmtBillions}
                yWidth={44}
                tooltipContent={<CustomTooltip formatters={{ solana: fmtNum, bsc: fmtNum, base: fmtNum }} />}
                margin={{ top: 12, right: 60, left: 4, bottom: 12 }}
              >
                <Legend verticalAlign="bottom" align="left" iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="solana" name="Solana" stroke="#9945FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "Solana", "#9945FF", dexState.data?.chains?.solana?.changePct)} />
                <Line type="monotone" dataKey="bsc" name="BSC" stroke="#F3BA2F" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "BSC", "#F3BA2F", dexState.data?.chains?.bsc?.changePct)} />
                <Line type="monotone" dataKey="base" name="Base" stroke="#0052FF" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls label={renderDexEndLabel(dexChartData, "Base", "#0052FF", dexState.data?.chains?.base?.changePct)} />
              </LOChart>
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
          <div className="lo-d-grid" style={{ gap: 14 }}>
            <div className="lo-turnover-panel">
              <div>
                <div className="lo-turnover-panel__label">Top 10 平均换手率</div>
                <div className="lo-metric lo-metric--lg" style={{ letterSpacing: -0.8, color: getTurnoverColor(top10Turnover) }}>{fmtTurnover(top10Turnover)}</div>
              </div>
              <div className="lo-stat-pill" style={{ color: getTurnoverColor(top10Turnover) }}>
                {getTurnoverLabel(top10Turnover)}
              </div>
            </div>

            <div className="lo-radar-table__wrapper">
              <div className="lo-radar-table__summary">
                <div className="lo-text-meta-muted">绿线 {radarSummary.green} 个</div>
                <div className="lo-text-meta-muted">红线 {radarSummary.red} 个</div>
                <div className="lo-text-meta-muted">黄线 {radarSummary.yellow} 个</div>
              </div>
              <table className="lo-radar-table">
                <thead>
                  <tr>
                    {["代币名", "市值", "24H 涨跌", "换手率"].map((label) => (
                      <th key={label}>
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
                        className="lo-radar-table__row"
                      >
                        <td style={{ borderLeft: `3px solid ${getRadarSignalLineColor(row.change24h, row.turnover)}` }}>
                          <div className="lo-radar-table__token-cell">
                            {row.image ? (
                              <img src={row.image} alt={row.symbol} className="lo-radar-table__token-img" />
                            ) : (
                              <div className="lo-radar-table__token-placeholder" />
                            )}
                            <div className="lo-radar-table__token-copy">
                              <div className="lo-metric lo-metric--xs" style={{ color: "var(--lo-text-primary)" }}>{row.symbol}</div>
                              <div className="lo-radar-table__token-name">{row.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="lo-metric" style={{ color: "var(--lo-text-primary)" }}>
                          {fmtNum(row.marketCap)}
                        </td>
                        <td className="lo-metric" style={{ color: getPctColor(row.change24h) }}>
                          {fmtPct(row.change24h, 2)}
                        </td>
                        <td className="lo-metric" style={{ color: getTurnoverColor(row.turnover) }}>
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

        <div className="lo-text-footnote" style={{ fontSize: 11, padding: "6px 20px 0" }}>
          数据来源：CoinGecko · DeFiLlama · 每日自动更新（部分）
        </div>
      </main>
    </div>
  );
}

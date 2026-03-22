import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import BTCDetailPage from "./BTCDetailPage";
import FGDetailPage from "./FGDetailPage";
import L1DetailPage from "./L1DetailPage";
import L2DetailPage from "./L2DetailPage";
import L3DetailPage from "./L3DetailPage";
import { fetchAlphaSupport, fetchMacroViaWorker, fetchMemeRadar } from "./lib/api";
import { calcManualGnl, clampNum, clampNumber, fmtB, fmtCount, fmtNum, fmtPct, fmtRatio, fmtTop50Price, fmtTrillionsFromInput, fmtUsd, fmtUsdWhole, formatDateLabel, formatTimeLabel, getDateValue, getRecentDateValues, getTop50FallbackPalette, keyForDate, notePreview, parseDateValue, pickTop50Icon, shortAddr, toNum } from "./lib/utils";

// ── COLORS ──
const C = {
  bg: "var(--lo-bg-deep)", card: "var(--lo-bg-card)", label: "var(--lo-text-primary)", labelSec: "var(--lo-text-secondary)",
  labelTer: "color-mix(in srgb, var(--lo-text-secondary) 72%, transparent)", labelQ: "var(--lo-text-muted)",
  sep: "var(--lo-border)", fill: "var(--lo-bg-inset)",
  fill2: "var(--lo-bg-input)",
  blue: "var(--lo-brand)", green: "var(--lo-green)", orange: "var(--lo-yellow)",
  red: "var(--lo-red)", yellow: "var(--lo-yellow)", purple: "#AF52DE", teal: "#30B0C7",
};

function getFgToneKey(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "yellow";
  if (numeric < 30) return "red";
  if (numeric < 55) return "yellow";
  return "green";
}

function getFgToneColor(value) {
  const tone = getFgToneKey(value);
  if (tone === "red") return "var(--lo-red)";
  if (tone === "green") return "var(--lo-green)";
  return "var(--lo-yellow)";
}

function getFgBackgroundTone(value) {
  const tone = getFgToneKey(value);
  if (tone === "red") return "rgba(255,77,77,0.06)";
  if (tone === "green") return "rgba(57,211,83,0.06)";
  return "rgba(240,180,41,0.05)";
}

function mapChain(chainId) {
  return ({ solana: "solana", bsc: "bsc" })[chainId] ?? "solana";
}

function getMacroRefreshErrorMessage(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();

  if (name === "AbortError" || /abort|timeout|timed out|upstream_timeout/.test(normalized)) {
    return "数据刷新超时，Worker 响应较慢，请稍后重试";
  }

  if (/failed to fetch|networkerror|load failed/.test(normalized)) {
    return "网络连接失败，请检查网络后重试";
  }

  return `数据刷新失败：${message || "未知错误"}`;
}
const NOTE_PANEL_STORAGE_KEY = "ui:global-note-panel";
function getDefaultNotePanelState() {
  const hasWindow = typeof window !== "undefined";
  const viewportWidth = hasWindow ? window.innerWidth : 1440;
  const viewportHeight = hasWindow ? window.innerHeight : 900;
  const mobile = viewportWidth <= 720;
  return {
    x: mobile ? 12 : Math.max(18, viewportWidth - 392),
    y: mobile ? Math.max(92, viewportHeight - 204) : 108,
    hidden: false,
    collapsed: mobile,
  };
}
function readNotePanelState() {
  const fallback = getDefaultNotePanelState();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(NOTE_PANEL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      x: Number.isFinite(Number(parsed?.x)) ? Number(parsed.x) : fallback.x,
      y: Number.isFinite(Number(parsed?.y)) ? Number(parsed.y) : fallback.y,
      hidden: Boolean(parsed?.hidden),
      collapsed: typeof parsed?.collapsed === "boolean" ? parsed.collapsed : fallback.collapsed,
    };
  } catch {
    return fallback;
  }
}
function writeNotePanelState(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTE_PANEL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore UI preference persistence failures
  }
}
function clampNotePanelState(state, panelWidth, panelHeight, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440, viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900) {
  const minX = 12;
  const minY = viewportWidth <= 720 ? 84 : 74;
  const maxX = Math.max(minX, viewportWidth - panelWidth - 12);
  const maxY = Math.max(minY, viewportHeight - panelHeight - 12);
  return {
    ...state,
    x: clampNum(Number.isFinite(Number(state.x)) ? Number(state.x) : maxX, minX, maxX),
    y: clampNum(Number.isFinite(Number(state.y)) ? Number(state.y) : maxY, minY, maxY),
  };
}

function buildDailySnapshot({
  selectedDate, macro, macroTime, macroSource,
  heroSignal, l2Signal, l3Signal, fgSignal, l4Signal,
  l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards,
  alphaDecisionsToday,
}) {
  return {
    date: selectedDate,
    macroSnapshot: macro,
    macroMeta: { time: macroTime, source: macroSource },
    heroSnapshot: heroSignal?.score == null ? null : {
      score: heroSignal.score,
      color: heroSignal.color,
      label: heroSignal.label,
      count: heroSignal.count,
      reason: heroSignal.reason,
      desc: heroSignal.desc,
    },
    signalSnapshots: {
      l2: l2Signal || null,
      l3: l3Signal || null,
      fg: fgSignal || null,
      l4: l4Signal || null,
    },
    l4Snapshot: l4Signal ? { score: l4Signal.score, color: l4Signal.color, reason: l4Signal.reason } : null,
    l0Cycle,
    l1Manual,
    mvrvManual,
    fgVal,
    dailyNote,
    watchlist,
    alphaCards,
    alphaDecisionsToday: alphaDecisionsToday || [],
    savedAt: new Date().toISOString(),
  };
}

function normalizeAlphaCards(cards) {
  if (!Array.isArray(cards)) return buildEmptyAlphaCards();
  return cards.map((card) => ({
    ...emptyAlpha(),
    ...card,
    chain: card?.chain || "solana",
  }));
}

function normalizeWatchlistRows(rows) {
  if (!Array.isArray(rows)) return buildEmptyWatchlist();
  return rows.map((row) => {
    const fallbackVmc = row?.vmc != null && row.vmc !== ""
      ? row.vmc
      : (toNum(row?.mcap) != null && toNum(row?.vol24h) != null && toNum(row?.mcap) > 0)
        ? (toNum(row.vol24h) / toNum(row.mcap)).toFixed(2)
        : "";
    return {
      ...emptyWatchRow(),
      ...row,
      status: row?.status || "watching",
      chipsScore: row?.chipsScore || "",
      poolDepth: row?.poolDepth || "",
      note: row?.note || "",
      chg1m: row?.chg1m || "",
      vmc: fallbackVmc,
    };
  });
}

function normalizeMacroData(raw = {}) {
  const rawMemeTopItems = Array.isArray(raw.meme_top?.items)
    ? raw.meme_top.items
    : Array.isArray(raw.meme_top?.data)
      ? raw.meme_top.data
      : Array.isArray(raw.meme_top)
        ? raw.meme_top
        : [];
  const normalizedMemeTopItems = rawMemeTopItems.map(item => ({
    rank: toNum(item.rank),
    token: item.token || item.symbol || "",
    name: item.name || "",
    image: pickTop50Icon(item),
    price: toNum(item.price),
    market_cap: toNum(item.market_cap ?? item.marketCap),
    change_24h_pct: toNum(item.change_24h_pct ?? item.price_change_percentage_24h),
    change_7d_pct: toNum(item.change_7d_pct ?? item.price_change_percentage_7d_in_currency),
    volume_24h: toNum(item.volume_24h ?? item.total_volume),
  }));
  const derivedMemeMcap = normalizedMemeTopItems.reduce((sum, item) => sum + (item.market_cap || 0), 0);
  const derivedTopTen = normalizedMemeTopItems.slice(0, 10);
  const derivedMeme24h = derivedTopTen.length
    ? derivedTopTen.reduce((sum, item) => sum + (item.change_24h_pct || 0), 0) / derivedTopTen.length
    : null;
  const normalizedMemeMcap = toNum(raw.meme?.mcap) ?? (derivedMemeMcap > 0 ? derivedMemeMcap : null);
  const normalizedMeme24h = toNum(raw.meme?.mcap_change_24h) ?? derivedMeme24h;

  return {
    timestamp: raw.timestamp || null,
    fear_greed: {
      value: toNum(raw.fear_greed?.value),
      label: raw.fear_greed?.label || null,
    },
    btc: {
      price: toNum(raw.btc?.price),
      change_24h: toNum(raw.btc?.change_24h),
      source: raw.btc?.source || null,
      ma_200: toNum(raw.btc?.ma_200),
      ma_source: raw.btc?.ma_source || null,
      vs_ma_200_pct: toNum(raw.btc?.vs_ma_200_pct),
      updated_at: raw.btc?.updated_at || null,
    },
    meme: {
      mcap: normalizedMemeMcap,
      mcap_change_24h: normalizedMeme24h,
    },
    tvl: {
      solana: toNum(raw.tvl?.solana),
      ethereum: toNum(raw.tvl?.ethereum),
      bsc: toNum(raw.tvl?.bsc),
    },
    stablecoins: {
      total: toNum(raw.stablecoins?.total),
      change_7d: toNum(raw.stablecoins?.change_7d),
      change_7d_pct: toNum(raw.stablecoins?.change_7d_pct),
    },
    chain_stablecoins: {
      solana: { net_inflow_7d: toNum(raw.chain_stablecoins?.solana?.net_inflow_7d) },
      bsc: { net_inflow_7d: toNum(raw.chain_stablecoins?.bsc?.net_inflow_7d) },
    },
    dex_volume: {
      solana: {
        total_24h: toNum(raw.dex_volume?.solana?.total_24h),
        change_1d_pct: toNum(raw.dex_volume?.solana?.change_1d_pct),
      },
      base: {
        total_24h: toNum(raw.dex_volume?.base?.total_24h),
        change_1d_pct: toNum(raw.dex_volume?.base?.change_1d_pct),
      },
      bsc: {
        total_24h: toNum(raw.dex_volume?.bsc?.total_24h),
        change_1d_pct: toNum(raw.dex_volume?.bsc?.change_1d_pct),
      },
    },
    fred: raw.fred || null,
    meme_top: {
      source: raw.meme_top?.source || null,
      updated_at: raw.meme_top?.updated_at || null,
      items: normalizedMemeTopItems,
    },
  };
}

// ── SIGNAL LOGIC ──
function calcL2SignalDetail(macro) {
  const stblVal = toNum(macro.stablecoins?.change_7d);
  const inflowVal = toNum(macro.chain_stablecoins?.solana?.net_inflow_7d);
  const stblOk = stblVal == null ? null : stblVal > 0;
  const inflowOk = inflowVal == null ? null : inflowVal > 0;
  let color = "yellow";
  let score = 0.5;
  let reason = "稳定币与净流入信号分歧";

  if (stblOk === true && inflowOk === true) {
    color = "green";
    score = 1;
    reason = "稳定币净增且 Solana 净流入为正";
  } else if (stblOk === false && inflowOk === false) {
    color = "red";
    score = 0;
    reason = "稳定币净变化与 Solana 净流入同时转负";
  } else if (stblOk === null && inflowOk === null) {
    reason = "稳定币与净流入数据都缺失，降级为黄灯";
  } else if (stblOk === null) {
    reason = inflowOk ? "稳定币缺失，仅依据净流入，降级为黄灯" : "稳定币缺失且净流入转负，降级为黄灯";
  } else if (inflowOk === null) {
    reason = stblOk ? "净流入缺失，仅依据稳定币净增，降级为黄灯" : "净流入缺失且稳定币转负，降级为黄灯";
  }

  return { color, score, reason, stblOk, inflowOk, missing: [stblVal == null ? "stablecoins" : null, inflowVal == null ? "solana_inflow" : null].filter(Boolean) };
}
function calcL3SignalDetail(macro) {
  const dex = macro.dex_volume || {};
  const dir = (v) => v == null ? 0.5 : v >= 5 ? 1 : v <= -5 ? 0 : 0.5;
  const memeDir = macro.meme?.mcap_change_24h == null ? 0.5 : macro.meme.mcap_change_24h >= 1 ? 1 : macro.meme.mcap_change_24h <= -1 ? 0 : 0.5;
  const score = parseFloat((((memeDir + dir(dex.solana?.change_1d_pct)) * 1.0 + (dir(dex.base?.change_1d_pct) + dir(dex.bsc?.change_1d_pct)) * 0.5) / 3).toFixed(3));
  const missing = [
    macro.meme?.mcap_change_24h == null ? "meme_mcap" : null,
    dex.solana?.change_1d_pct == null ? "solana_dex" : null,
    dex.base?.change_1d_pct == null ? "base_dex" : null,
    dex.bsc?.change_1d_pct == null ? "bsc_dex" : null,
  ].filter(Boolean);

  let color = score >= 0.7 ? "green" : score >= 0.4 ? "yellow" : "red";
  let reason = color === "green" ? "Meme 市值与 DEX 交易量共振偏强" : color === "yellow" ? "Meme 板块信号中性或分歧" : "Meme 板块热度整体偏弱";
  if (missing.length > 0) {
    color = "yellow";
    reason = `L3 存在缺失数据（${missing.join(" / ")}），按黄灯降级处理`;
  }

  return { color, score, reason, missing };
}
function calcFGSignalDetail(fg) {
  if (fg == null) return { color: "yellow", score: 0.5, reason: "F&G 缺失，降级为黄灯" };
  if (fg >= 55) return { color: "green", score: 1, reason: "F&G ≥ 55，情绪偏强" };
  if (fg >= 30) return { color: "yellow", score: 0.5, reason: "F&G 处于 30-55，中性偏谨慎" };
  return { color: "red", score: 0, reason: "F&G < 30，市场偏恐惧" };
}

function signalToScore(color) {
  if (color === "green") return 1;
  if (color === "yellow") return 0.5;
  return 0;
}

function getHeroInfo(sigScore) {
  if (sigScore == null) return { label: "等待数据", bg: "linear-gradient(140deg,#8E8E93,#636366)", desc: "点击「更新数据」· 约需 10-20 秒" };
  if (sigScore >= 0.7) return { label: "进　攻", bg: "linear-gradient(140deg,#34C759,#30D158)", desc: "多层共振看涨" };
  if (sigScore >= 0.5) return { label: "积　极", bg: "linear-gradient(140deg,#007AFF,#5AC8FA)", desc: "整体偏多 · 选择性参与" };
  if (sigScore >= 0.35) return { label: "观　望", bg: "linear-gradient(140deg,#FF9500,#FFCC00)", desc: "信号分歧 · 等待确认" };
  return { label: "防　御", bg: "linear-gradient(140deg,#FF3B30,#FF6B35 60%,#FF9500)", desc: "多层偏空 · 缩减仓位" };
}

function calcL4SignalDetail(watchlist, alphaCards) {
  const filled = watchlist.filter((r) => r.token && r.mcap);
  const alphaFilled = alphaCards.filter((a) => a.token);
  if (filled.length === 0 && alphaFilled.length === 0) return null;

  const activeCount = filled.filter((r) => {
    const mcap = toNum(r.mcap);
    const vol24h = toNum(r.vol24h);
    if (mcap == null || mcap <= 0 || vol24h == null) return false;
    return (vol24h / mcap) >= 0.3;
  }).length;
  const bullCount = filled.filter((r) => parseFloat(r.chg24h) > 0).length;

  const goodAlpha = alphaFilled.filter((a) => (a.chipsJudgment === "spread" || a.chipsJudgment === "retail") && (a.momentumJudgment === "surge" || a.momentumJudgment === "stable")).length;
  const badAlpha = alphaFilled.filter((a) => a.momentumJudgment === "decay" && (a.poolJudgment === "weak" || toNum(a.poolLiqVol) < 0.5)).length;

  const bullRatio = filled.length > 0 ? bullCount / filled.length : 0;
  const vmcActive = filled.length > 0 ? activeCount / filled.length : 0;
  const stockScore = bullRatio * 0.4 + vmcActive * 0.3;
  const alphaAdjustment = (goodAlpha > 0 ? 0.2 : 0) + (badAlpha > 0 ? -0.15 : 0);
  let score = 0.5;
  if (filled.length > 0) score += stockScore;
  score += alphaAdjustment;
  const clampedScore = Math.max(0, Math.min(1, parseFloat(score.toFixed(3))));
  const color = clampedScore >= 0.6 ? "green" : clampedScore >= 0.35 ? "yellow" : "red";
  const reasons = [];
  if (filled.length === 0) reasons.push("存量数据为空，保留基线分");
  else {
    reasons.push(`上涨占比 ${(bullRatio * 100).toFixed(0)}%`);
    reasons.push(`V/Liq 活跃占比 ${(vmcActive * 100).toFixed(0)}%`);
  }
  if (goodAlpha > 0) reasons.push(`goodAlpha +${(goodAlpha > 0 ? 0.2 : 0).toFixed(2)}`);
  if (badAlpha > 0) reasons.push(`badAlpha ${(-0.15).toFixed(2)}`);
  if (goodAlpha === 0 && badAlpha === 0) reasons.push("增量侧无额外调整");

  return {
    color,
    score: clampedScore,
    reason: reasons.join(" · "),
    bullRatio,
    vmcActive,
    stockScore: parseFloat(stockScore.toFixed(3)),
    goodAlpha,
    badAlpha,
    alphaAdjustment,
    filledCount: filled.length,
    alphaCount: alphaFilled.length,
  };
}

function calcHeroSignal(signals) {
  const activeSignals = signals.filter((s) => s && s.color);
  if (activeSignals.length === 0) return { score: null, color: null, count: 0, reason: "暂无有效信号", ...getHeroInfo(null) };
  const score = parseFloat((activeSignals.reduce((sum, s) => sum + (s.score ?? signalToScore(s.color)), 0) / activeSignals.length).toFixed(3));
  const hero = getHeroInfo(score);
  const color = score >= 0.7 ? "green" : score >= 0.5 ? "blue" : score >= 0.35 ? "yellow" : "red";
  const reason = activeSignals.map((s) => s.reason).filter(Boolean).join(" | ");
  return { score, color, count: activeSignals.length, reason, ...hero };
}

const signalEmoji = { green: "🟢", yellow: "🟡", red: "🔴" };
const cycleMeta = {
  expansion: { label: "扩张", color: C.green, hint: "环境偏正向" },
  transition: { label: "过渡", color: C.orange, hint: "先控仓位" },
  contraction: { label: "收缩", color: C.red, hint: "环境偏负向" },
};
const statusTone = {
  ok: { color: C.green, bg: "var(--lo-green-soft)" },
  warn: { color: C.orange, bg: "var(--lo-yellow-soft)" },
  bad: { color: C.red, bg: "var(--lo-red-soft)" },
  info: { color: C.blue, bg: "var(--lo-brand-soft)" },
  idle: { color: C.labelTer, bg: C.fill },
};

const cardStyle = { margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" };
const secLabel = { padding: "0 20px 7px", fontSize: "var(--lo-text-label)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.labelTer };
const miniInput = { border: "none", outline: "none", background: C.fill2, borderRadius: 6, padding: "5px 6px", fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif", width: "100%", textAlign: "center" };
const numTextStyle = { fontFamily: "var(--lo-num-font)", fontVariantNumeric: "tabular-nums" };
const miniNumInput = { ...miniInput, ...numTextStyle };

function DataRow({ label, value, sub, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `0.5px solid ${C.sep}` }}>
      <span style={{ fontSize: "var(--lo-text-label)", color: C.labelSec }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "var(--lo-text-label)", fontWeight: 600, color: color || C.label }}>{value}</span>
        {sub && <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function projectSvgTrendPoints(points, width = 220, height = 52) {
  const clean = points.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (clean.length < 2) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  return clean.map((point, idx) => ({
    x: Number(((idx / (clean.length - 1)) * width).toFixed(1)),
    y: Number((height - ((point - min) / range) * height).toFixed(1)),
  }));
}

function buildSvgPoints(points, width = 220, height = 52) {
  const plotPoints = projectSvgTrendPoints(points, width, height);
  if (plotPoints.length < 2) return "";
  let d = `M ${plotPoints[0].x} ${plotPoints[0].y}`;
  for (let idx = 0; idx < plotPoints.length - 1; idx += 1) {
    const start = plotPoints[idx];
    const end = plotPoints[idx + 1];
    const dx = end.x - start.x;
    const c1x = Number((start.x + dx / 3).toFixed(1));
    const c2x = Number((end.x - dx / 3).toFixed(1));
    d += ` C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`;
  }
  return d;
}

const TREND_ASSIST_MOTION_CSS = `
@keyframes loTrendPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.88; }
}

@keyframes navPulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--nav-pulse-rgb, 100, 100, 100), 0.35); }
  50% { transform: scale(1.4); box-shadow: 0 0 0 10px rgba(var(--nav-pulse-rgb, 100, 100, 100), 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--nav-pulse-rgb, 100, 100, 100), 0); }
}

@keyframes flowPulse {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
`;

const UNIFIED_STATUS_META = {
  positive: { label: "正向", color: C.green, bg: "var(--lo-green-soft)", line: C.green, fill: "color-mix(in srgb, var(--lo-green-soft) 72%, transparent)" },
  neutral: { label: "盘整中", color: C.orange, bg: "var(--lo-yellow-soft)", line: C.orange, fill: "color-mix(in srgb, var(--lo-yellow-soft) 72%, transparent)" },
  negative: { label: "负向", color: C.red, bg: "var(--lo-red-soft)", line: C.red, fill: "color-mix(in srgb, var(--lo-red-soft) 72%, transparent)" },
  idle: { label: "等待数据", color: C.labelTer, bg: C.fill, line: "var(--lo-text-muted)", fill: "color-mix(in srgb, var(--lo-text-muted) 20%, transparent)" },
};

function getTrendStats(points = []) {
  const clean = points.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return {
      clean,
      hasTrend: false,
      last: clean.at(-1) ?? null,
      totalDelta: null,
      totalPct: null,
      statusKey: null,
    };
  }
  const last = clean[clean.length - 1];
  const first = clean[0];
  const totalDelta = last - first;
  const totalPct = first === 0 ? 0 : totalDelta / Math.abs(first);
  let statusKey = "neutral";
  if (totalPct >= 0.012) statusKey = "positive";
  else if (totalPct <= -0.012) statusKey = "negative";
  return { clean, hasTrend: true, last, totalDelta, totalPct, statusKey };
}

function classifyThreeState(value, positiveThreshold, negativeThreshold) {
  if (value == null || Number.isNaN(Number(value))) return null;
  if (Number(value) >= positiveThreshold) return "positive";
  if (Number(value) <= negativeThreshold) return "negative";
  return "neutral";
}

function fmtSignedFromRaw(value, formatter = fmtNum) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const rendered = formatter(n);
  if (rendered === "—") return rendered;
  return n > 0 && !String(rendered).startsWith("+") ? `+${rendered}` : rendered;
}

function SignalDot({ color = "none", size = 10, glow = false }) {
  const colorMap = {
    green: "var(--lo-green)",
    red: "var(--lo-red)",
    yellow: "var(--lo-yellow)",
    blue: "var(--lo-brand)",
    none: "var(--lo-text-secondary)",
  };
  const dotColor = colorMap[color] || colorMap.none;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: dotColor,
        flexShrink: 0,
        boxShadow: glow ? `0 0 ${Math.max(8, size)}px ${dotColor}` : "none",
      }}
    />
  );
}

function getSignalColorVar(color = "none") {
  const colorMap = {
    green: "var(--lo-green)",
    red: "var(--lo-red)",
    yellow: "var(--lo-yellow)",
    blue: "var(--lo-brand)",
    none: "var(--lo-border)",
  };
  return colorMap[color] || colorMap.none;
}

function getHeroLampGlow(color = "none") {
  if (color === "green") return "0 0 8px rgba(52,199,89,0.5)";
  if (color === "red") return "0 0 8px rgba(255,59,48,0.5)";
  if (color === "yellow") return "0 0 8px rgba(255,149,0,0.4)";
  return "none";
}

function getSignalToneBorder(color = "none", strength = 45) {
  if (!color || color === "none") return "var(--lo-border)";
  return `color-mix(in srgb, ${getSignalColorVar(color)} ${strength}%, transparent)`;
}

function TrendArrow({ value, threshold = 2 }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numericValue = Number(value);
  let arrow = "→";
  let color = "var(--lo-yellow)";
  if (numericValue > threshold) {
    arrow = "↑";
    color = "var(--lo-green)";
  } else if (numericValue < -threshold) {
    arrow = "↓";
    color = "var(--lo-red)";
  }
  return (
    <span
      aria-hidden="true"
      style={{
        marginLeft: 6,
        color,
        fontFamily: "var(--lo-num-font)",
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {arrow}
    </span>
  );
}

function FGGauge({ value, size = 160 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const clampedValue = Number.isFinite(Number(value)) ? clampNumber(Number(value), 0, 100) : 0;

  useEffect(() => {
    setDisplayValue(0);
    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      setDisplayValue(clampedValue);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [clampedValue]);

  const pointerAngle = -180 + (displayValue / 100) * 180;
  const toneColor = getFgToneColor(clampedValue);

  return (
    <div style={{ overflow: "hidden", display: "flex", justifyContent: "center" }}>
      <svg
        viewBox="0 0 160 96"
        width={size}
        height={size * 0.6}
        role="img"
        aria-label={`F&G 仪表盘，当前值 ${Math.round(clampedValue)}`}
      >
        <defs>
          <linearGradient id="fg-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF4D4D" />
            <stop offset="25%" stopColor="#FF9500" />
            <stop offset="50%" stopColor="#F0B429" />
            <stop offset="75%" stopColor="#34C759" />
            <stop offset="100%" stopColor="#30D158" />
          </linearGradient>
        </defs>

        <path
          d="M 20 88 A 60 60 0 0 1 140 88"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 20 88 A 60 60 0 0 1 140 88"
          fill="none"
          stroke="url(#fg-arc-grad)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        <g
          style={{
            transformOrigin: "80px 88px",
            transformBox: "fill-box",
            transform: `rotate(${pointerAngle}deg)`,
            transition: "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <line x1="80" y1="88" x2="126" y2="88" stroke={toneColor} strokeWidth="1.5" />
          <circle
            cx="126"
            cy="88"
            r="3"
            fill={toneColor}
            style={{ filter: `drop-shadow(0 0 4px ${toneColor})` }}
          />
        </g>

        <circle cx="80" cy="88" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <text
          x="80"
          y="86"
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "var(--lo-num-font)",
            fontSize: 22,
            fontWeight: 700,
            fill: toneColor,
          }}
        >
          {Math.round(clampedValue)}
        </text>
      </svg>
    </div>
  );
}

function ScanInput({ label, unit, value, onChange, placeholder, width, ...props }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const focusValueRef = useRef(value ?? "");
  const lockTimerRef = useRef(null);
  const changedWhileFocusedRef = useRef(false);

  useEffect(() => () => {
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
  }, []);

  const handleFocus = useCallback((event) => {
    focusValueRef.current = event.target.value ?? "";
    changedWhileFocusedRef.current = false;
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback((event) => {
    setIsFocused(false);
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
    const currentValue = String(event.target.value ?? "").trim();
    if (currentValue && changedWhileFocusedRef.current) {
      setIsLocked(true);
      lockTimerRef.current = window.setTimeout(() => {
        setIsLocked(false);
      }, 600);
    } else {
      setIsLocked(false);
    }
  }, []);

  const handleChange = useCallback((event) => {
    const nextValue = String(event.target.value ?? "");
    if (isFocused && nextValue !== String(focusValueRef.current ?? "")) {
      changedWhileFocusedRef.current = true;
    }
    onChange(event);
  }, [isFocused, onChange]);

  const borderColor = isLocked
    ? "var(--lo-green)"
    : isFocused
      ? "var(--lo-brand)"
      : "rgba(120,120,128,0.24)";
  const glowColor = isLocked
    ? "rgba(52,199,89,0.18)"
    : isFocused
      ? "rgba(0,122,255,0.18)"
      : "transparent";

  return (
    <div style={{ width: width || "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: "var(--lo-text-secondary)" }}>{label}</div>
        {unit ? <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)" }}>{unit}</div> : null}
        {isLocked ? <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: "var(--lo-green)" }}>✓ 已锁定</div> : null}
      </div>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          ...miniInput,
          width: "100%",
          border: `1px solid ${borderColor}`,
          boxShadow: `0 0 0 3px ${glowColor}`,
          background: "var(--lo-bg-inset)",
          color: "var(--lo-text-primary)",
          fontFamily: "var(--lo-num-font)",
          fontVariantNumeric: "tabular-nums",
          transition: "border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease, color 180ms ease",
        }}
        inputMode="decimal"
        {...props}
      />
    </div>
  );
}

function GNLReadout({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState(false);
  const animationFrameRef = useRef(null);
  const flashTimerRef = useRef(null);
  const lastValueRef = useRef(value);

  useEffect(() => () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  useEffect(() => {
    const prevValue = lastValueRef.current;
    if (value == null) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      setDisplayValue(null);
      setFlash(false);
      lastValueRef.current = value;
      return;
    }
    if (prevValue === value) {
      setDisplayValue(value);
      return;
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);

    const startValue = prevValue == null || Number.isNaN(Number(prevValue)) ? 0 : Number(prevValue);
    const endValue = Number(value);
    const duration = 600;
    const startTime = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const nextValue = startValue + (endValue - startValue) * easeOut(progress);
      setDisplayValue(nextValue);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endValue);
        setFlash(true);
        flashTimerRef.current = window.setTimeout(() => setFlash(false), 800);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    lastValueRef.current = value;
  }, [value]);

  const numericValue = value == null || Number.isNaN(Number(value)) ? null : Number(value);
  const tone = numericValue == null ? "neutral" : numericValue >= 0 ? "positive" : "negative";
  const toneMap = {
    neutral: {
      color: "var(--lo-text-secondary)",
      bg: "var(--lo-bg-inset)",
      border: "rgba(120,120,128,0.18)",
      flash: "rgba(120,120,128,0.24)",
    },
    positive: {
      color: "var(--lo-green)",
      bg: "var(--lo-green-soft)",
      border: "rgba(52,199,89,0.22)",
      flash: "rgba(52,199,89,0.28)",
    },
    negative: {
      color: "var(--lo-red)",
      bg: "var(--lo-red-soft)",
      border: "rgba(255,59,48,0.22)",
      flash: "rgba(255,59,48,0.28)",
    },
  };
  const palette = toneMap[tone];
  const renderedValue = displayValue == null || Number.isNaN(Number(displayValue))
    ? "—"
    : `${Number(displayValue) >= 0 ? "+" : ""}${Number(displayValue).toFixed(3)}T`;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        boxShadow: flash ? `0 0 0 3px ${palette.flash}` : "none",
        transition: "box-shadow 220ms ease, background-color 220ms ease, border-color 220ms ease",
      }}
    >
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: "var(--lo-text-secondary)", marginBottom: 4 }}>手动 GNL</div>
      <div
        style={{
          fontSize: "var(--lo-text-value)",
          fontWeight: 700,
          color: palette.color,
          fontFamily: "var(--lo-num-font)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {renderedValue}
      </div>
    </div>
  );
}

function LayerGateBar({
  l0Cycle,
  heroSignal,
  l2Signal,
  l3Signal,
  l4Signal,
  onLayerClick,
}) {
  const [clickedNode, setClickedNode] = useState(null);
  const [activeLayer, setActiveLayer] = useState("L0");
  const l0ColorMap = {
    expansion: "green",
    transition: "yellow",
    contraction: "red",
  };
  const layers = [
    { id: "L0", label: "天色", done: Boolean(l0Cycle), color: l0ColorMap[l0Cycle] || "none" },
    { id: "L1", label: "流动性", done: heroSignal?.score != null, color: heroSignal?.color || "none" },
    { id: "L2", label: "稳定币", done: Boolean(l2Signal), color: l2Signal?.color || "none" },
    { id: "L3", label: "Meme", done: Boolean(l3Signal), color: l3Signal?.color || "none" },
    { id: "L4", label: "选品", done: Boolean(l4Signal), color: l4Signal?.color || "none" },
  ];
  const completedCount = layers.filter((layer) => layer.done).length;
  const l4Ready = layers[0].done && layers[1].done && layers[2].done;
  const sectionTargetMap = {
    L0: ["section-l0"],
    L1: ["section-l1", "section-market"],
    L2: ["section-l2", "section-market"],
    L3: ["section-l3", "section-market"],
    L4: ["section-l4"],
  };
  const sectionToLayerMap = {
    "section-l0": "L0",
    "section-btc": "L0",
    "section-market": "L1",
    "section-l1": "L1",
    "section-l2": "L2",
    "section-l3": "L3",
    "section-l4": "L4",
    "section-review": "L4",
  };

  useEffect(() => {
    const sectionIds = ["section-l0", "section-btc", "section-market", "section-l1", "section-l2", "section-l3", "section-l4", "section-review"];
    const observed = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (observed.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveLayer(sectionToLayerMap[visible[0].target.id] || "L0");
        }
      },
      {
        rootMargin: "-150px 0px -60% 0px",
        threshold: 0,
      }
    );

    observed.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [Boolean(l2Signal), Boolean(l3Signal), Boolean(l4Signal)]);

  const scrollToSection = useCallback((layerId) => {
    const targetId = (sectionTargetMap[layerId] || []).find((id) => document.getElementById(id));
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (!element) return;
    const offset = 140;
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const getLayerToneVisual = (color = "none") => {
    if (color === "blue") {
      return {
        dotGlow: "0 0 8px rgba(0,122,255,0.45)",
        pulseRgb: "0, 122, 255",
        lineBackground: "linear-gradient(90deg, transparent 0%, rgba(0,122,255,0.5) 50%, transparent 100%)",
        lineDuration: "3.5s",
      };
    }
    if (color === "green") {
      return {
        dotGlow: "0 0 8px rgba(52,199,89,0.5)",
        pulseRgb: "52, 199, 89",
        lineBackground: "linear-gradient(90deg, transparent 0%, rgba(52,199,89,0.55) 50%, transparent 100%)",
        lineDuration: "3s",
      };
    }
    if (color === "yellow") {
      return {
        dotGlow: "0 0 6px rgba(255,149,0,0.4)",
        pulseRgb: "255, 149, 0",
        lineBackground: "linear-gradient(90deg, transparent 0%, rgba(255,149,0,0.5) 50%, transparent 100%)",
        lineDuration: "4s",
      };
    }
    if (color === "red") {
      return {
        dotGlow: "0 0 8px rgba(255,59,48,0.5)",
        pulseRgb: "255, 59, 48",
        lineBackground: "linear-gradient(90deg, transparent 0%, rgba(255,59,48,0.52) 50%, transparent 100%)",
        lineDuration: "5s",
      };
    }
    return {
      dotGlow: "none",
      pulseRgb: "120, 120, 128",
      lineBackground: "var(--lo-border)",
      lineDuration: null,
    };
  };

  return (
    <div
      data-layer-gate="bar"
      style={{
        position: "sticky",
        top: 68,
        zIndex: 18,
        padding: "10px 16px 8px",
        background: "var(--lo-surface-overlay-bar)",
        borderBottom: "1px solid var(--lo-border)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gap: 14,
          alignItems: "center",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <style>{TREND_ASSIST_MOTION_CSS}</style>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          {layers.map((layer, idx) => {
            const isActive = activeLayer === layer.id;
            const isL4 = layer.id === "L4";
            const isL4Locked = isL4 && !l4Ready;
            const nextLayer = layers[idx + 1];
            const isLineToLockedL4 = nextLayer?.id === "L4" && !l4Ready;
            const toneVisual = getLayerToneVisual(layer.done ? layer.color : "none");
            return (
              <React.Fragment key={layer.id}>
                <button
                  type="button"
                  onClick={() => {
                    onLayerClick?.(layer.id);
                    setClickedNode(layer.id);
                    window.setTimeout(() => setClickedNode((current) => (current === layer.id ? null : current)), 600);
                    scrollToSection(layer.id);
                  }}
                  data-layer-node={layer.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    minWidth: 56,
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    opacity: isL4Locked ? 0.35 : 1,
                    transition: "opacity 180ms ease, transform 180ms ease",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isL4Locked
                        ? "transparent"
                        : layer.done
                          ? "var(--lo-bg-card)"
                          : "var(--lo-bg-inset)",
                      border: isL4Locked
                        ? "1.5px dashed rgba(0,0,0,0.15)"
                        : "1px solid var(--lo-border)",
                      boxShadow: layer.done && !isL4Locked ? "0 6px 18px rgba(15,23,42,0.06)" : "none",
                    }}
                  >
                    {!isL4Locked && (
                      <span
                        aria-hidden="true"
                        style={{
                          "--nav-pulse-rgb": toneVisual.pulseRgb,
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: getSignalColorVar(layer.done ? layer.color : "none"),
                          boxShadow: layer.done ? toneVisual.dotGlow : "none",
                          animation: clickedNode === layer.id ? "navPulse 0.5s ease-out" : "none",
                          transition: "box-shadow 180ms ease, transform 180ms ease",
                        }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--lo-text-meta)",
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? (C.blue || "var(--lo-brand)") : C.labelTer,
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      transition: "color 0.3s ease, font-weight 0.3s ease",
                    }}
                  >
                    {layer.id}
                    <span style={{ marginLeft: 4, fontWeight: "inherit" }}>{layer.label}</span>
                  </span>
                </button>
                {idx < layers.length - 1 && (
                  <div
                    aria-hidden="true"
                    data-layer-line={`${layer.id}-${layers[idx + 1].id}`}
                    style={{
                      height: isLineToLockedL4 ? 0 : 2,
                      flex: 1,
                      minWidth: 18,
                      margin: "0 8px 16px",
                      borderRadius: 999,
                      backgroundColor: isLineToLockedL4
                        ? "transparent"
                        : layer.done && layer.color !== "none"
                          ? "transparent"
                          : "var(--lo-border)",
                      backgroundImage: isLineToLockedL4
                        ? "none"
                        : layer.done && layer.color !== "none"
                          ? toneVisual.lineBackground
                          : "none",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: layer.done && layer.color !== "none" ? "200% 100%" : "100% 100%",
                      animation: layer.done && layer.color !== "none" && !isLineToLockedL4
                        ? `flowPulse ${toneVisual.lineDuration} ease-in-out infinite`
                        : "none",
                      opacity: layer.done ? 1 : 0.9,
                      borderTop: isLineToLockedL4 ? "1.5px dashed rgba(0,0,0,0.1)" : "none",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!l4Ready && (
            <div data-layer-gate="prompt" style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)", whiteSpace: "nowrap" }}>
              先确认 L0–L2 再进入 L4
            </div>
          )}
          <div
            data-layer-gate="summary"
            style={{
              padding: "7px 10px",
              borderRadius: 999,
              background: "var(--lo-bg-inset)",
              border: "1px solid var(--lo-border)",
              fontSize: "var(--lo-text-meta)",
              fontWeight: 700,
              color: "var(--lo-text-primary)",
              whiteSpace: "nowrap",
            }}
          >
            {completedCount}/5 已确认
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendAssist({
  points = [],
  statusKey,
  ariaLabel,
  emptyLabel = "历史快照不足，暂不显示趋势",
  emptyHint = "先按左侧单点值判断",
  deltaLabel = "区间变化",
  latestLabel = "最新值",
  valueFormatter = fmtNum,
}) {
  const stats = getTrendStats(points);
  const meta = UNIFIED_STATUS_META[statusKey || stats.statusKey || "idle"];
  if (!stats.hasTrend) {
    const emptyDots = Array.from({ length: 5 }, (_, idx) => ({
      cx: 22 + idx * 44,
      cy: 12,
      r: idx === 2 ? 3.2 : 2.4,
      opacity: idx === 2 ? 0.88 : 0.48 + idx * 0.08,
    }));
    return (
      <div className="lo-trend-assist lo-trend-assist-empty" aria-label={ariaLabel}>
        <style>{TREND_ASSIST_MOTION_CSS}</style>
        <svg viewBox="0 0 220 24" width="100%" height="24" preserveAspectRatio="none" aria-hidden="true" style={{ marginBottom: 4 }}>
          {emptyDots.map((dot, idx) => (
            <circle
              key={idx}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill="currentColor"
              opacity={dot.opacity}
              style={{ color: meta.line }}
            />
          ))}
        </svg>
        <div className="lo-trend-empty-copy">{emptyLabel}</div>
        <div className="lo-trend-empty-hint">{emptyHint}</div>
      </div>
    );
  }
  const trendPath = buildSvgPoints(stats.clean, 220, 64);
  const plotPoints = projectSvgTrendPoints(stats.clean, 220, 64);
  const areaPath = `${trendPath} L 220 64 L 0 64 Z`;
  const lastPoint = plotPoints.at(-1) || null;
  return (
    <div className="lo-trend-assist" aria-label={ariaLabel}>
      <style>{TREND_ASSIST_MOTION_CSS}</style>
      <div className="lo-trend-metrics">
        <div className="lo-trend-metric">
          <div className="lo-trend-metric-label">{deltaLabel}</div>
          <div className="lo-trend-metric-value" style={{ color: meta.color, ...numTextStyle }}>
            {fmtSignedFromRaw(stats.totalDelta, valueFormatter)}
          </div>
        </div>
        <div className="lo-trend-metric">
          <div className="lo-trend-metric-label">{latestLabel}</div>
          <div className="lo-trend-metric-value" style={numTextStyle}>{valueFormatter(stats.last)}</div>
        </div>
      </div>
      <svg viewBox="0 0 220 64" width="100%" height="64" preserveAspectRatio="none" role="img" aria-hidden="true">
        <path d={areaPath} fill={meta.fill} />
        <path
          d={trendPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: meta.line, filter: "drop-shadow(0 0 3px currentColor)" }}
        />
        {lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="4"
            fill="#fff"
            stroke={meta.line}
            strokeWidth="2"
            style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px`, animation: "loTrendPulse 2s ease-in-out infinite" }}
          />
        )}
      </svg>
      <div className="lo-trend-caption">近 {stats.clean.length} 次快照</div>
    </div>
  );
}

function InsightMetricCard({
  variant = "decision",
  title,
  question,
  statusKey,
  headAction = null,
  primaryLabel,
  primaryValue,
  changeLabel,
  changeValue,
  changeTone,
  summary,
  points = [],
  emptyTrendCopy,
  emptyTrendHint,
  metaItems = [],
  accentColor,
  trendDeltaLabel,
  trendLatestLabel,
  trendFormatter,
  quickReadChips = [],
  actionFramework = null,
  changeArrow = null,
  detailExpanded = true,
  onToggleDetail = null,
  expandLabel = "展开详细",
  collapseLabel = "收起详细",
}) {
  const status = UNIFIED_STATUS_META[statusKey || "idle"];
  const showDetail = onToggleDetail ? detailExpanded : true;
  const cardStyle = {
    "--lo-insight-accent": accentColor || status.color,
    "--lo-insight-accent-soft": status.bg,
  };
  return (
    <div className={`lo-insight-card lo-insight-card-${variant}`} style={cardStyle}>
      <div className="lo-insight-head">
        <div className="lo-insight-title">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {headAction}
          <div className="lo-insight-status" style={{ color: status.color, background: status.bg }}>
            {status.label}
          </div>
        </div>
      </div>
      {summary && (
        <div style={{
          background: `${status.color}09`,
          borderLeft: `3px solid ${status.color}`,
          borderRadius: "0 8px 8px 0",
          padding: "8px 12px",
          margin: "8px 0",
          fontSize: "var(--lo-text-label)",
          lineHeight: 1.65,
          color: C.labelSec,
        }}>
          {summary}
        </div>
      )}
      {quickReadChips.length > 0 && <QuickReadRow chips={quickReadChips} />}
      {onToggleDetail && (
        <button
          type="button"
          onClick={onToggleDetail}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "10px 0",
            cursor: "pointer",
            color: C.blue || "var(--lo-brand)",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            borderTop: `1px solid ${C.sep}`,
            marginTop: 12,
            background: "none",
            transition: "color 0.2s ease",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              transform: showDetail ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              fontSize: 10,
            }}
          >
            ▶
          </span>
          {showDetail ? collapseLabel : expandLabel}
        </button>
      )}
      {showDetail && (
        <div style={{ animation: "rise 0.3s both" }}>
          <div className="lo-insight-body">
            <div className="lo-insight-copy">
              <div className="lo-insight-question">{question}</div>
              <div className="lo-insight-primary-label">{primaryLabel}</div>
              <div className="lo-insight-primary-value">{primaryValue}</div>
              <div className="lo-insight-change">
                <span className="lo-insight-change-label">{changeLabel}</span>
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  <span className="lo-insight-change-value" style={{ color: changeTone || status.color }}>{changeValue}</span>
                  {changeArrow}
                </span>
              </div>
            </div>
            <TrendAssist
              points={points}
              statusKey={statusKey}
              ariaLabel={`${title} 趋势`}
              emptyLabel={emptyTrendCopy}
              emptyHint={emptyTrendHint}
              deltaLabel={trendDeltaLabel}
              latestLabel={trendLatestLabel}
              valueFormatter={trendFormatter}
            />
          </div>
          {metaItems.length > 0 && (
            <div className="lo-insight-meta-grid">
              {metaItems.map((item) => (
                <div key={item.label} className="lo-insight-meta">
                  <div className="lo-insight-meta-label">{item.label}</div>
                  <div className="lo-insight-meta-value" style={item.color ? { color: item.color } : undefined}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {actionFramework && (
            <ActionFramework
              trigger={actionFramework.trigger}
              invalidate={actionFramework.invalidate}
              watchLevel={actionFramework.watchLevel}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  PATCH-UI-01：Stocki 风格升级组件
// ══════════════════════════════════════════════════════

// 1. 速读标签单个 Chip
function QuickReadChip({ label, value, tone }) {
  const toneMap = {
    positive: { color: "#1a7a35", bg: "rgba(52,199,89,0.10)", border: "rgba(52,199,89,0.22)" },
    negative: { color: "#c0392b", bg: "rgba(255,59,48,0.10)", border: "rgba(255,59,48,0.22)" },
    neutral: { color: "#a66200", bg: "rgba(255,149,0,0.10)", border: "rgba(255,149,0,0.22)" },
    info: { color: "#0055b3", bg: "rgba(0,122,255,0.10)", border: "rgba(0,122,255,0.22)" },
    idle: { color: "#5a5a6a", bg: "rgba(120,120,128,0.08)", border: "rgba(120,120,128,0.18)" },
  };
  const t = toneMap[tone] || toneMap.idle;
  return (
    <div style={{
      display: "inline-flex",
      flexDirection: "column",
      gap: 2,
      padding: "7px 10px",
      borderRadius: 10,
      minWidth: 76,
      background: t.bg,
      border: `1px solid ${t.border}`,
    }}>
      <span style={{
        fontSize: "var(--lo-text-meta)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: t.color,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "var(--lo-text-label)",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: t.color,
      }}>
        {value}
      </span>
    </div>
  );
}

// 2. 速读标签行（横排 3 chips）
function QuickReadRow({ chips = [] }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 4px" }}>
      {chips.map((chip, i) => <QuickReadChip key={i} {...chip} />)}
    </div>
  );
}

// 3. 下一步建议框（可折叠）
function ActionFramework({ trigger, invalidate, watchLevel }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.sep}`, paddingTop: 2 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "9px 0 6px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "-apple-system,sans-serif",
        }}
      >
        <span style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.blue, letterSpacing: "0.04em" }}>▶ 下一步建议</span>
        <span style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ }}>{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, paddingBottom: 12 }}>
          {[
            { label: "触发条件", text: trigger, bg: "rgba(52,199,89,0.07)", border: "rgba(52,199,89,0.20)", lc: "#15803d" },
            { label: "失效条件", text: invalidate, bg: "rgba(255,59,48,0.07)", border: "rgba(255,59,48,0.18)", lc: "#c0392b" },
            { label: "关注位", text: watchLevel, bg: "rgba(0,122,255,0.07)", border: "rgba(0,122,255,0.18)", lc: "#0055b3" },
          ].map(({ label, text, bg, border, lc }) => (
            <div key={label} style={{ padding: "9px 10px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
              <div style={{
                fontSize: "var(--lo-text-meta)",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: lc,
                marginBottom: 5,
              }}>
                {label}
              </div>
              <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelSec, lineHeight: 1.65 }}>
                {text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LayerTransition({ message, isDark = false, style = undefined }) {
  const lineColor = isDark ? "rgba(255,255,255,0.06)" : C.sep;
  const capsuleBg = isDark ? "rgba(255,255,255,0.06)" : C.fill2;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "20px 24px",
        margin: "8px 16px 8px",
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(to right, transparent, ${lineColor})`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 16px",
          borderRadius: 20,
          background: capsuleBg,
          flexShrink: 0,
          transition: "background 0.6s ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: message.color,
            boxShadow: `0 0 6px ${message.color}`,
            flexShrink: 0,
            transition: "background 0.6s ease, box-shadow 0.6s ease",
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: message.color,
            whiteSpace: "nowrap",
            transition: "color 0.6s ease",
          }}
        >
          {message.text}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(to left, transparent, ${lineColor})`,
        }}
      />
    </div>
  );
}

// 4. 速读 chips 生成器 — L1
function buildL1Chips(l1StatusKey, l1CurrentValue, hasFredAuto, l1TrendStats) {
  const gnlStr = l1CurrentValue != null ? l1CurrentValue.toFixed(3) + "T" : "—";
  const arrowMap = { positive: " ↑", negative: " ↓", neutral: " →" };
  const trendLabel = !l1TrendStats?.hasTrend ? "单点值"
    : l1StatusKey === "positive" ? "持续扩张"
      : l1StatusKey === "negative" ? "持续收缩" : "盘整";
  return [
    { label: "GNL 水平", value: gnlStr + (arrowMap[l1StatusKey] || ""), tone: l1StatusKey || "idle" },
    { label: "趋势状态", value: trendLabel, tone: l1StatusKey || "idle" },
    { label: "数据来源", value: hasFredAuto ? "FRED 自动" : "手动录入", tone: hasFredAuto ? "positive" : "neutral" },
  ];
}

// 5. 速读 chips 生成器 — L2
function buildL2Chips(macro, l2StatusKey) {
  if (!macro) return [];
  const c7d = macro.stablecoins?.change_7d;
  const c7dStr = c7d != null
    ? (c7d >= 0 ? "+" : "") + fmtNum(c7d) + (c7d >= 0 ? " ↑" : " ↓") : "—";
  const sol = macro.chain_stablecoins?.solana?.net_inflow_7d;
  const solStr = sol != null
    ? fmtB(sol) + (sol >= 0 ? " ↑" : " ↓") : "—";
  const ammoLabel = l2StatusKey === "positive" ? "弹药补充"
    : l2StatusKey === "negative" ? "弹药流失" : "弹药持平";
  return [
    { label: "7日净变化", value: c7dStr, tone: c7d == null ? "idle" : c7d > 0 ? "positive" : c7d < 0 ? "negative" : "neutral" },
    { label: "SOL 净流入", value: solStr, tone: sol == null ? "idle" : sol > 0 ? "positive" : "negative" },
    { label: "弹药状态", value: ammoLabel, tone: l2StatusKey || "idle" },
  ];
}

// 6. 速读 chips 生成器 — L3
function buildL3Chips(macro, l3StatusKey) {
  if (!macro) return [];
  const mc = macro.meme?.mcap_change_24h;
  const mcStr = mc != null
    ? (mc >= 0 ? "+" : "") + mc.toFixed(1) + "%"
      + (mc >= 1 ? " ↑" : mc <= -1 ? " ↓" : " →") : "—";
  const sd = macro.dex_volume?.solana?.change_1d_pct;
  const sdStr = sd != null
    ? (sd >= 0 ? "+" : "") + sd.toFixed(1) + "%"
      + (sd >= 5 ? " ↑" : sd <= -5 ? " ↓" : " →") : "—";
  const heatLabel = l3StatusKey === "positive" ? "风险升温"
    : l3StatusKey === "negative" ? "风险降温" : "情绪中性";
  return [
    { label: "Meme 24h", value: mcStr, tone: mc == null ? "idle" : mc >= 1 ? "positive" : mc <= -1 ? "negative" : "neutral" },
    { label: "SOL DEX量", value: sdStr, tone: sd == null ? "idle" : sd >= 5 ? "positive" : sd <= -5 ? "negative" : "neutral" },
    { label: "风险偏好", value: heatLabel, tone: l3StatusKey || "idle" },
  ];
}

// 7. WatchlistRow 综合快判摘要生成器
function buildWatchVerdict(row) {
  const vmcN = parseFloat(row.vmc);
  const chg24N = parseFloat(row.chg24h);
  const vmcOk = !isNaN(vmcN) ? (vmcN >= 0.5 ? 1 : vmcN >= 0.2 ? 0 : -1) : null;
  const chgOk = !isNaN(chg24N) ? (chg24N > 0 ? 1 : chg24N < 0 ? -1 : 0) : null;
  const chipsOk = row.chipsScore === "healthy" ? 1
    : row.chipsScore === "concentrated" ? -1 : 0;
  const poolOk = row.poolDepth === "deep" ? 1
    : row.poolDepth === "shallow" ? -1 : 0;

  const valid = [vmcOk, chgOk, chipsOk, poolOk].filter((v) => v !== null);
  if (valid.length === 0) return null;

  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const parts = [];
  if (vmcOk === 1) parts.push("V/Liq 活跃");
  else if (vmcOk === -1) parts.push("V/Liq 低迷");
  if (chgOk === 1) parts.push("24h 上涨");
  else if (chgOk === -1) parts.push("仓位回撤");
  if (chipsOk === 1) parts.push("筹码健康");
  else if (chipsOk === -1) parts.push("筹码集中");
  if (poolOk === 1) parts.push("池子充足");
  else if (poolOk === -1) parts.push("池子偏浅");
  if (parts.length === 0) return null;

  if (avg >= 0.5) {
    return {
      tone: "positive",
      label: "综合偏强 · " + parts.slice(0, 2).join(" · "),
      action: "考虑建仓",
      bg: "rgba(52,199,89,0.07)",
      border: "rgba(52,199,89,0.18)",
      dot: "#34C759",
      textColor: "#1a3a1a",
      actionColor: "#15803d",
    };
  }
  if (avg <= -0.5) {
    return {
      tone: "negative",
      label: "信号偏弱 · " + parts.slice(0, 2).join(" · "),
      action: "暂时观察",
      bg: "rgba(255,59,48,0.06)",
      border: "rgba(255,59,48,0.16)",
      dot: "#FF3B30",
      textColor: "#5a1a1a",
      actionColor: "#c0392b",
    };
  }
  return {
    tone: "neutral",
    label: "信号分歧 · " + parts.slice(0, 2).join(" · "),
    action: "等待确认",
    bg: "rgba(255,149,0,0.07)",
    border: "rgba(255,149,0,0.20)",
    dot: "#FF9500",
    textColor: "#7a4200",
    actionColor: "#a66200",
  };
}

// 8. AlphaCard 综合快判输出块
function AlphaSynthesis({ card }) {
  const chipMap = {
    spread: { label: "分布", icon: "📊", c: "#15803d", bg: "rgba(52,199,89,0.08)", bd: "rgba(52,199,89,0.18)" },
    retail: { label: "散户为主", icon: "👥", c: "#0055b3", bg: "rgba(0,122,255,0.08)", bd: "rgba(0,122,255,0.18)" },
    controlled: { label: "控盘", icon: "🎯", c: "#c0392b", bg: "rgba(255,59,48,0.08)", bd: "rgba(255,59,48,0.18)" },
    surge: { label: "喷发", icon: "🚀", c: "#15803d", bg: "rgba(52,199,89,0.08)", bd: "rgba(52,199,89,0.18)" },
    stable: { label: "承接稳", icon: "🤝", c: "#0055b3", bg: "rgba(0,122,255,0.08)", bd: "rgba(0,122,255,0.18)" },
    selling: { label: "卖压", icon: "📉", c: "#a66200", bg: "rgba(255,149,0,0.08)", bd: "rgba(255,149,0,0.20)" },
    decay: { label: "衰减", icon: "💀", c: "#c0392b", bg: "rgba(255,59,48,0.08)", bd: "rgba(255,59,48,0.18)" },
    strong: { label: "强", icon: "💧", c: "#15803d", bg: "rgba(52,199,89,0.08)", bd: "rgba(52,199,89,0.18)" },
    medium: { label: "中", icon: "🌊", c: "#a66200", bg: "rgba(255,149,0,0.08)", bd: "rgba(255,149,0,0.20)" },
    weak: { label: "弱", icon: "🫧", c: "#c0392b", bg: "rgba(255,59,48,0.08)", bd: "rgba(255,59,48,0.18)" },
  };
  const ci = chipMap[card.chipsJudgment];
  const mi = chipMap[card.momentumJudgment];
  const pi = chipMap[card.poolJudgment];
  if (!ci && !mi && !pi) return null;

  const goodN = [
    card.chipsJudgment === "spread" || card.chipsJudgment === "retail",
    card.momentumJudgment === "surge" || card.momentumJudgment === "stable",
    card.poolJudgment === "strong" || card.poolJudgment === "medium",
  ].filter(Boolean).length;
  const badN = [
    card.chipsJudgment === "controlled",
    card.momentumJudgment === "decay",
    card.poolJudgment === "weak",
  ].filter(Boolean).length;

  let v = {
    text: "初步观察，维度填写不完整",
    sub: "先补充三个维度的判断再看结论。",
    c: "#5a5a6a",
    bg: "rgba(120,120,128,0.07)",
    bd: "rgba(120,120,128,0.15)",
    dot: "#8E8E93",
  };
  if (goodN >= 2 && badN === 0) {
    v = {
      text: "初筛通过，建议加入主区观测",
      sub: "三维度整体偏强，等 V/Liq 超 0.3 后可建仓。",
      c: "#0055b3",
      bg: "rgba(0,122,255,0.07)",
      bd: "rgba(0,122,255,0.15)",
      dot: "#007AFF",
    };
  } else if (badN >= 2) {
    v = {
      text: "质量存疑，暂不建议推进",
      sub: "控盘/衰减/池浅信号出现 2 个以上，先踢出候选。",
      c: "#c0392b",
      bg: "rgba(255,59,48,0.07)",
      bd: "rgba(255,59,48,0.15)",
      dot: "#FF3B30",
    };
  } else if (goodN === 1 && badN === 1) {
    v = {
      text: "信号分歧，等待进一步确认",
      sub: "好信号与风险信号并存，暂观望。",
      c: "#a66200",
      bg: "rgba(255,149,0,0.07)",
      bd: "rgba(255,149,0,0.18)",
      dot: "#FF9500",
    };
  }

  const dimCard = (label, info) => !info ? (
    <div style={{
      padding: "8px 9px",
      borderRadius: 9,
      textAlign: "center",
      background: "rgba(120,120,128,0.06)",
      border: "1px solid rgba(120,120,128,0.14)",
    }}>
      <div style={{ fontSize: "var(--lo-text-secondary-value)", marginBottom: 3 }}>—</div>
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5a5a6a", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: "#5a5a6a" }}>未填写</div>
    </div>
  ) : (
    <div style={{ padding: "8px 9px", borderRadius: 9, textAlign: "center", background: info.bg, border: `1px solid ${info.bd}` }}>
      <div style={{ fontSize: "var(--lo-text-secondary-value)", marginBottom: 3 }}>{info.icon}</div>
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: info.c, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: info.c }}>{info.label}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${C.sep}`, paddingTop: 12 }}>
      <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.labelQ, marginBottom: 8 }}>综合快判</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
        {dimCard("筹码", ci)}
        {dimCard("动量", mi)}
        {dimCard("池子", pi)}
      </div>
      <div style={{
        padding: "9px 12px",
        borderRadius: 10,
        background: v.bg,
        border: `1px solid ${v.bd}`,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.dot, flexShrink: 0, marginTop: 4 }} />
        <div>
          <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: v.c }}>{v.text}</div>
          <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, lineHeight: 1.6, marginTop: 3 }}>{v.sub}</div>
        </div>
      </div>
    </div>
  );
}

function PatrickMark({ color = "currentColor", size = 13, stroke = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.8l2.65 5.32 5.87.85-4.26 4.15 1.01 5.88L12 16.2 6.73 19l1.01-5.88-4.26-4.15 5.87-.85L12 2.8z"
        fill={stroke === "none" ? color : "none"}
        stroke={stroke === "none" ? "none" : stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionButton({ kind = "primary", children, iconColor, style, ...props }) {
  return (
    <button className={`lo-btn lo-btn-${kind}`} style={style} {...props}>
      <span className="lo-btn-token">
        <PatrickMark color={iconColor || (kind === "primary" ? C.bg : C.blue)} size={12} />
      </span>
      <span>{children}</span>
    </button>
  );
}

const WATCH_STATUS_OPTS = [
  { val: "watching", label: "观察中", c: C.blue, b: "var(--lo-brand-soft)" },
  { val: "ready", label: "准备建仓", c: C.orange, b: "var(--lo-yellow-soft)" },
  { val: "position", label: "已有仓位", c: C.green, b: "var(--lo-green-soft)" },
];
const WATCH_CHIPS_OPTS = [
  { val: "healthy", label: "健康", c: C.green, b: "var(--lo-green-soft)" },
  { val: "neutral", label: "中性", c: C.orange, b: "var(--lo-yellow-soft)" },
  { val: "concentrated", label: "集中", c: C.red, b: "var(--lo-red-soft)" },
];
const WATCH_POOL_OPTS = [
  { val: "deep", label: "深", c: C.green, b: "var(--lo-green-soft)" },
  { val: "mid", label: "中", c: C.orange, b: "var(--lo-yellow-soft)" },
  { val: "shallow", label: "浅", c: C.red, b: "var(--lo-red-soft)" },
];
const WATCH_ROW_PALETTES = [
  { accent: C.blue, tint: "var(--lo-brand-soft)" },
  { accent: C.teal, tint: "color-mix(in srgb, #30B0C7 14%, transparent)" },
  { accent: C.orange, tint: "var(--lo-yellow-soft)" },
  { accent: C.purple, tint: "color-mix(in srgb, #AF52DE 14%, transparent)" },
  { accent: C.red, tint: "var(--lo-red-soft)" },
];

function WatchPillGroup({ options, current, onSelect, tone = "score" }) {
  return (
    <div className={`lo-watch-segment-buttons ${tone}`}>
      {options.map((opt) => {
        const active = current === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            className="lo-watch-pill"
            onClick={() => onSelect(active ? "" : opt.val)}
            style={{
              borderColor: active ? opt.c : "var(--lo-border)",
              background: active ? opt.b : "var(--lo-bg-card)",
              color: active ? opt.c : "var(--lo-text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function WatchlistRow({ row, idx, onChange, onRemove, canRemove, compactViewport = false, autoData, autoLoading, onFetchAuto, id, signalGreen = false }) {
  const [expanded, setExpanded] = useState(false);
  const vmc = row.vmc || "";
  const vmcN = parseFloat(vmc);
  const vmcColor = isNaN(vmcN) ? C.labelQ : vmcN >= 0.5 ? C.green : vmcN >= 0.2 ? C.orange : C.red;
  const chgColor = (v) => { const n = parseFloat(v); return isNaN(n) ? C.labelQ : n > 0 ? C.green : n < 0 ? C.red : C.labelTer; };
  const statusMeta = WATCH_STATUS_OPTS.find((opt) => opt.val === row.status);
  const rowPalette = WATCH_ROW_PALETTES[idx % WATCH_ROW_PALETTES.length];
  const rowAccent = statusMeta?.c || rowPalette.accent;
  const rowTint = statusMeta?.b || rowPalette.tint;
  const verdict = buildWatchVerdict(row);
  const verdictColor = verdict?.tone === "positive"
    ? getSignalColorVar("green")
    : verdict?.tone === "negative"
      ? getSignalColorVar("red")
      : verdict?.tone === "neutral"
        ? getSignalColorVar("yellow")
        : "rgba(255,255,255,0.08)";
  const mainGridColumns = compactViewport
    ? "repeat(2, minmax(0, 1fr))"
    : "minmax(0, 1.25fr) minmax(0, 1.55fr) minmax(110px, 0.7fr) minmax(0, 1.1fr)";
  const quickVerdictLabel = verdict?.label || "填写 V/Liq / 24h 后生成快判";
  const quickVerdictAction = verdict?.action || "等待确认";
  const handleRowToggle = useCallback((event) => {
    if (event.target.closest("input, button, select, textarea, a")) return;
    setExpanded((prev) => !prev);
  }, []);
  return (
    <div
      id={id}
      className="lo-watch-row"
      onClick={handleRowToggle}
      style={{
        "--lo-watch-accent": rowAccent,
        "--lo-watch-tint": rowTint,
        borderLeft: `3px solid ${verdictColor}`,
        transition: "border-left-color 0.3s ease",
        cursor: "pointer",
      }}
    >
      <div
        className="lo-watch-row-gap"
        style={{
          display: "grid",
          gridTemplateColumns: mainGridColumns,
          gap: 12,
          alignItems: "start",
        }}
      >
        <div>
          <div className="lo-field-label">{`观测 ${String(idx + 1).padStart(2, "0")} / Token`}</div>
          <input value={row.token} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder={`#${idx + 1}`} style={{ ...miniInput, fontWeight: 700, fontSize: "var(--lo-text-label)" }} className="lo-input lo-input-left" />
        </div>
        <div className="lo-watch-segment">
          <div className="lo-watch-status-meta">
            <div className="lo-field-label lo-field-label-tight">状态 pill</div>
            <div style={{ fontSize: "var(--lo-text-meta)", color: statusMeta?.c || C.labelTer, fontWeight: 700 }}>{statusMeta?.label || "未设定"}</div>
          </div>
          <WatchPillGroup options={WATCH_STATUS_OPTS} current={row.status} onSelect={(val) => onChange(idx, "status", val)} tone="status" />
        </div>
        <div>
          <div className="lo-field-label">V/Liq</div>
          <input value={row.vmc || ""} onChange={(e) => onChange(idx, "vmc", e.target.value)} placeholder="0.45" style={{ ...miniNumInput, color: vmcColor }} inputMode="decimal" />
        </div>
        <div
          style={{
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 12,
            background: verdict?.bg || rowTint,
            border: `1px solid ${verdict?.border || "var(--lo-border)"}`,
            display: "grid",
            gap: 4,
            alignSelf: "stretch",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <SignalDot color={verdict?.tone === "positive" ? "green" : verdict?.tone === "negative" ? "red" : verdict?.tone === "neutral" ? "yellow" : "none"} size={8} />
              <span style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: verdict?.textColor || C.labelSec, whiteSpace: "nowrap" }}>
                {quickVerdictAction}
              </span>
            </div>
            {signalGreen && row.token && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--lo-green)",
                background: "rgba(57,211,83,0.12)",
                borderRadius: 999,
                padding: "2px 7px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                ⚡ 对齐
              </span>
            )}
            <span style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, flexShrink: 0 }}>
              {expanded ? "收起" : "展开"}
            </span>
          </div>
          <div style={{ fontSize: "var(--lo-text-meta)", color: verdict?.textColor || C.labelTer, lineHeight: 1.5 }}>
            {quickVerdictLabel}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          <div className="lo-watch-metrics-row lo-watch-mobile-secondary lo-watch-row-gap">
            <div>
              <div className="lo-field-label">MCap</div>
              <input value={row.mcap} onChange={(e) => onChange(idx, "mcap", e.target.value)} placeholder="MCap" style={miniNumInput} inputMode="decimal" />
            </div>
            <div>
              <div className="lo-field-label">24h</div>
              <input value={row.chg24h} onChange={(e) => onChange(idx, "chg24h", e.target.value)} placeholder="24h%" style={{ ...miniNumInput, color: chgColor(row.chg24h) }} inputMode="decimal" />
            </div>
            <div>
              <div className="lo-field-label">7d</div>
              <input value={row.chg7d} onChange={(e) => onChange(idx, "chg7d", e.target.value)} placeholder="7d%" style={{ ...miniNumInput, color: chgColor(row.chg7d) }} inputMode="decimal" />
            </div>
            <div>
              <div className="lo-field-label">1m</div>
              <input value={row.chg1m || ""} onChange={(e) => onChange(idx, "chg1m", e.target.value)} placeholder="1m%" style={{ ...miniNumInput, color: chgColor(row.chg1m) }} inputMode="decimal" />
            </div>
          </div>

          <div className="lo-watch-judgment-row">
            <div className="lo-watch-segment lo-watch-mobile-secondary">
              <div className="lo-field-label lo-field-label-tight">筹码集中度评分</div>
              <WatchPillGroup options={WATCH_CHIPS_OPTS} current={row.chipsScore} onSelect={(val) => onChange(idx, "chipsScore", val)} />
            </div>
            <div className="lo-watch-segment lo-watch-mobile-secondary">
              <div className="lo-field-label lo-field-label-tight">池子深度比</div>
              <WatchPillGroup options={WATCH_POOL_OPTS} current={row.poolDepth} onSelect={(val) => onChange(idx, "poolDepth", val)} />
            </div>
            <div className="lo-watch-segment">
              <div className="lo-field-label lo-field-label-tight">备注</div>
              <input value={row.note || ""} onChange={(e) => onChange(idx, "note", e.target.value)} placeholder="等回踩 / 底仓已建 / 控盘疑虑..." style={{ ...miniInput }} className="lo-input lo-input-left lo-watch-note" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select
              value={row.chain || "solana"}
              onChange={(e) => onChange(idx, "chain", e.target.value)}
              style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600 }}
              className="lo-alpha-select"
            >
              <option value="solana">solana</option>
              <option value="bsc">bsc</option>
            </select>
            <input
              value={row.address || ""}
              onChange={(e) => onChange(idx, "address", e.target.value)}
              placeholder="token address"
              style={{ ...miniInput, textAlign: "left", flex: 1 }}
              className="lo-input lo-input-left"
            />
            <ActionButton
              kind={autoLoading ? "secondary" : "primary"}
              onClick={() => onFetchAuto?.(idx)}
              disabled={autoLoading || !row.address}
              style={{ padding: "8px 12px", fontSize: "var(--lo-text-meta)", opacity: !row.address ? 0.45 : 1 }}
            >
              {autoLoading ? "拉取中..." : "自动拉数"}
            </ActionButton>
          </div>

          {autoData && !autoLoading && (
            <div style={{ display: "flex", gap: 12, marginTop: 8, padding: "6px 8px", background: "rgba(120,120,128,0.05)", borderRadius: 8, fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)" }}>
              <span>筹码 Top10: <strong>{autoData?.chips?.top10_share_pct != null ? `${autoData.chips.top10_share_pct}%` : (autoData?.chips?.error || "—")}</strong></span>
              <span>Liq/Vol: <strong>{autoData?.pool?.liq_vol_ratio != null ? autoData.pool.liq_vol_ratio : (autoData?.pool?.error || "—")}</strong></span>
              <span>V/Liq: <strong>{(autoData?.pool?.volume_24h_usd && autoData?.pool?.liquidity_usd) ? (autoData.pool.volume_24h_usd / autoData.pool.liquidity_usd).toFixed(2) : "—"}</strong></span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ, whiteSpace: "nowrap" }}>
                入场价
              </span>
              <input
                value={row.entryPrice || ""}
                onChange={(e) => onChange(idx, "entryPrice", e.target.value)}
                placeholder="0.0000"
                style={{ ...miniInput, width: 88, textAlign: "right" }}
                className="lo-input"
              />
            </div>

            {autoData?.momentum?.price != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ, whiteSpace: "nowrap" }}>
                  当前价
                </span>
                <span style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.label }}>
                  {autoData.momentum.price < 0.0001
                    ? autoData.momentum.price.toExponential(2)
                    : autoData.momentum.price.toFixed(
                      autoData.momentum.price < 0.01 ? 6
                        : autoData.momentum.price < 1 ? 4
                          : 2
                    )}
                </span>
              </div>
            )}

            {(() => {
              const entry = parseFloat(row.entryPrice);
              const current = autoData?.momentum?.price;
              if (!isFinite(entry) || entry <= 0 || current == null) return null;
              const pnl = ((current - entry) / entry) * 100;
              const color = pnl > 0 ? "var(--lo-green)" : pnl < 0 ? "var(--lo-red)" : C.labelSec;
              return (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 999,
                  background: pnl > 0 ? "rgba(57,211,83,0.08)" : pnl < 0 ? "rgba(255,77,77,0.08)" : "transparent",
                  fontSize: "var(--lo-text-meta)", fontWeight: 700, color,
                }}>
                  {pnl > 0 ? "+" : ""}{pnl.toFixed(2)}%
                </div>
              );
            })()}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="lo-watch-remove"
              onClick={() => onRemove(idx)}
              disabled={!canRemove}
              aria-label={`删除第 ${idx + 1} 行观察项`}
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CHIP_OPTS = [
  { val: "controlled", label: "🎯 控盘", c: C.red, b: "rgba(255,59,48,0.1)" },
  { val: "spread", label: "📊 分布", c: C.green, b: "rgba(52,199,89,0.1)" },
  { val: "retail", label: "👥 散户", c: C.blue, b: "rgba(0,122,255,0.1)" },
];
const MOMENTUM_OPTS = [
  { val: "surge", label: "🚀 喷发", c: C.green, b: "rgba(52,199,89,0.1)" },
  { val: "stable", label: "🤝 承接稳", c: C.blue, b: "rgba(0,122,255,0.1)" },
  { val: "selling", label: "📉 卖压", c: C.orange, b: "rgba(255,149,0,0.1)" },
  { val: "decay", label: "💀 衰减", c: C.red, b: "rgba(255,59,48,0.1)" },
];
const POOL_OPTS = [
  { val: "strong", label: "💧 强", c: C.green, b: "rgba(52,199,89,0.1)" },
  { val: "medium", label: "🌊 中", c: C.orange, b: "rgba(255,149,0,0.1)" },
  { val: "weak", label: "🫧 弱", c: C.red, b: "rgba(255,59,48,0.1)" },
];

function getAlphaSummaryTone(current, options) {
  if (!current) return { color: C.labelQ, glow: "none" };
  const matched = options.find((option) => option.val === current);
  if (!matched) return { color: C.blue, glow: `0 0 4px ${C.blue}` };
  return { color: matched.c, glow: `0 0 4px ${matched.c}` };
}

function AlphaCard({ card, idx, onChange, autoData, autoLoading, onFetchAuto, onAddToWatch, onClear, watchHasSlot, expanded = false, onToggle = null, id, onDecision }) {
  const stopCardToggle = useCallback((event) => {
    event.stopPropagation();
  }, []);
  const optBtn = (opts, field, current) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${opts.length},1fr)`, gap: 4 }}>
      {opts.map((o) => {
        const sel = current === o.val;
        return <button key={o.val} onClick={(event) => { event.stopPropagation(); onChange(idx, field, sel ? "" : o.val); }} style={{ border: sel ? `1.5px solid ${o.c}` : "1.5px solid rgba(60,60,67,0.15)", borderRadius: 8, padding: "6px 2px", fontSize: "var(--lo-text-meta)", fontWeight: 600, cursor: "pointer", background: sel ? o.b : "transparent", color: sel ? o.c : C.labelTer, transition: "all 0.15s", fontFamily: "-apple-system,sans-serif" }}>{o.label}</button>;
      })}
    </div>
  );
  const summaryItems = [
    { label: "筹码", tone: getAlphaSummaryTone(card.chipsJudgment, CHIP_OPTS) },
    { label: "动量", tone: getAlphaSummaryTone(card.momentumJudgment, MOMENTUM_OPTS) },
    { label: "池子", tone: getAlphaSummaryTone(card.poolJudgment, POOL_OPTS) },
  ];
  return (
    <div
      id={id}
      className="lo-alpha-card"
      onClick={!expanded ? onToggle : undefined}
      style={{
        cursor: expanded ? "default" : "pointer",
      }}
    >
      <div className="lo-alpha-top">
        <div className="lo-alpha-index">{idx + 1}</div>
        <select value={card.chain || "solana"} onClick={stopCardToggle} onChange={(e) => onChange(idx, "chain", e.target.value)} style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} className="lo-alpha-select">
          <option value="solana">solana</option>
          <option value="bsc">bsc</option>
        </select>
        <input value={card.token} onClick={stopCardToggle} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder="token address" style={{ fontSize: "var(--lo-text-label)", fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} className="lo-alpha-token" />
        <ActionButton
          kind={autoLoading ? "secondary" : "primary"}
          onClick={(event) => {
            event.stopPropagation();
            onFetchAuto(idx);
          }}
          disabled={autoLoading || !card.token}
          style={{ padding: "8px 12px", fontSize: "var(--lo-text-meta)", opacity: !card.token ? 0.45 : 1 }}
        >
          {autoLoading ? "拉取中..." : "自动拉数"}
        </ActionButton>
        {expanded && (
          <ActionButton
            kind="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onClear?.(idx);
            }}
            style={{ padding: "8px 12px", fontSize: "var(--lo-text-meta)" }}
          >
            ✕ 清除
          </ActionButton>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 0",
          borderTop: `1px solid ${C.sep}`,
          marginTop: 8,
        }}
      >
        {summaryItems.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: item.tone.color,
                boxShadow: item.tone.glow,
              }}
            />
            <span style={{ fontSize: 11, color: C.labelTer }}>{item.label}</span>
          </div>
        ))}
        {!expanded && (
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.labelQ }}>
            ▶ 展开
          </div>
        )}
      </div>
      {expanded && (
        <div style={{ animation: "rise 0.3s both" }}>
          {(autoLoading || autoData) && (
            <div className="lo-alpha-auto-panel" style={{ border: `1px dashed ${C.sep}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.labelSec }}>自动支撑数据（仅参考）</div>
                <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ }}>{autoLoading ? "正在从 Worker 拉取" : `更新于 ${formatTimeLabel(autoData?.updated_at)}`}</div>
              </div>
              {autoData?.error && <div style={{ fontSize: "var(--lo-text-meta)", color: C.red, marginBottom: 8 }}>{autoData.error}</div>}
              <div className="lo-alpha-auto-grid">
                <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
                  <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>筹码集中度</div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, lineHeight: 1.6 }}>
                    Holder: <span style={{ color: C.label }}>{fmtCount(autoData?.chips?.holder_count)}</span><br />
                    Top 10: <span style={{ color: C.label }}>{fmtPct(autoData?.chips?.top10_share_pct)}</span><br />
                    样本数: <span style={{ color: C.label }}>{fmtCount(autoData?.chips?.top_holders_count)}</span>
                  </div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: autoData?.chips?.error ? C.red : C.labelQ, marginTop: 6 }}>
                    {autoData?.chips?.error ? autoData.chips.error : `${autoData?.chips?.source || "birdeye"} · ${formatTimeLabel(autoData?.chips?.updated_at)}`}
                  </div>
                </div>
                <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
                  <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>资金动量</div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, lineHeight: 1.6 }}>
                    Price: <span style={{ color: C.label }}>{fmtUsd(autoData?.momentum?.price)}</span><br />
                    24h 价变: <span style={{ color: C.label }}>{fmtPct(autoData?.momentum?.price_change_24h_pct)}</span><br />
                    24h 量: <span style={{ color: C.label }}>{fmtUsd(autoData?.momentum?.volume_24h)}</span><br />
                    24h 量变: <span style={{ color: C.label }}>{fmtPct(autoData?.momentum?.volume_change_24h_pct)}</span>
                  </div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: autoData?.momentum?.error ? C.red : C.labelQ, marginTop: 6 }}>
                    {autoData?.momentum?.error ? autoData.momentum.error : `${autoData?.momentum?.source || "birdeye"} · ${formatTimeLabel(autoData?.momentum?.updated_at)}`}
                  </div>
                </div>
                <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
                  <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>池子强度</div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, lineHeight: 1.6 }}>
                    Liq: <span style={{ color: C.label }}>{fmtUsd(autoData?.pool?.liquidity_usd)}</span><br />
                    Vol: <span style={{ color: C.label }}>{fmtUsd(autoData?.pool?.volume_24h_usd)}</span><br />
                    Liq/Vol: <span style={{ color: C.label }}>{fmtRatio(autoData?.pool?.liq_vol_ratio)}</span><br />
                    Pool: <span style={{ color: C.label }}>{shortAddr(autoData?.pool?.pool_address)}</span>
                  </div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: autoData?.pool?.error ? C.red : C.labelQ, marginTop: 6 }}>
                    {autoData?.pool?.error ? autoData.pool.error : `${autoData?.pool?.source || "geckoterminal"} · ${formatTimeLabel(autoData?.pool?.updated_at)}`}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>筹码集中度</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>前 10 地址占比</div>
              <input value={card.top10Share || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "top10Share", e.target.value)} placeholder="45%" style={miniInput} />
            </div>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>持币地址变化</div>
              <input value={card.holderChange || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "holderChange", e.target.value)} placeholder="+12%" style={miniInput} />
            </div>
          </div>
          {optBtn(CHIP_OPTS, "chipsJudgment", card.chipsJudgment)}
          <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginTop: 10, marginBottom: 4 }}>资金动量</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 成交量变化</div>
              <input value={card.volumeChange24h || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "volumeChange24h", e.target.value)} placeholder="+35%" style={miniInput} />
            </div>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 价格变化</div>
              <input value={card.priceChange24h || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "priceChange24h", e.target.value)} placeholder="+18%" style={miniInput} />
            </div>
          </div>
          {optBtn(MOMENTUM_OPTS, "momentumJudgment", card.momentumJudgment)}
          <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginTop: 10, marginBottom: 4 }}>池子强度</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>流动性</div>
              <input value={card.poolLiquidity || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "poolLiquidity", e.target.value)} placeholder="$220K" style={miniInput} />
            </div>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 成交量</div>
              <input value={card.poolVolume24h || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "poolVolume24h", e.target.value)} placeholder="$180K" style={miniInput} />
            </div>
            <div>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>Liq/Vol</div>
              <input value={card.poolLiqVol || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "poolLiqVol", e.target.value)} placeholder="1.2" style={miniInput} />
            </div>
          </div>
          {optBtn(POOL_OPTS, "poolJudgment", card.poolJudgment)}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>备注</div>
              <input value={card.note || ""} onClick={stopCardToggle} onChange={(e) => onChange(idx, "note", e.target.value)} placeholder="简要判断..." style={{ ...miniInput, textAlign: "left" }} />
            </div>
          </div>
          <AlphaSynthesis card={card} />
          <ActionButton
            kind="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onAddToWatch?.({ token: card.token, chain: card.chain || "solana" });
            }}
            disabled={!card.token || !watchHasSlot}
            style={{ padding: "8px 12px", fontSize: "var(--lo-text-meta)", opacity: (!card.token || !watchHasSlot) ? 0.45 : 1, marginTop: 10 }}
          >
            → Watch
          </ActionButton>
          {card.token && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[
                { label: "进 入场", value: "进", color: "var(--lo-green)", bg: "rgba(57,211,83,0.10)" },
                { label: "观 观望", value: "观", color: "var(--lo-yellow)", bg: "rgba(255,204,0,0.10)" },
                { label: "弃 放弃", value: "弃", color: "var(--lo-red)", bg: "rgba(255,77,77,0.10)" },
              ].map(({ label, value, color, bg }) => (
                <button
                  key={value}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDecision?.(idx, value);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: `1.5px solid ${color}`,
                    background: bg,
                    color,
                    fontSize: "var(--lo-text-meta)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "-apple-system,sans-serif",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle?.();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "10px 0",
              cursor: "pointer",
              color: C.blue || "var(--lo-brand)",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderTop: `1px solid ${C.sep}`,
              marginTop: 8,
              background: "none",
            }}
          >
            <span aria-hidden="true" style={{ transform: "rotate(270deg)", fontSize: 10 }}>▶</span>
            收起
          </button>
        </div>
      )}
    </div>
  );
}

function MemeRadar({ items, loading, error, updatedAt, onAddToAlpha, onAddToWatch, alphaHasSlot, watchHasSlot, heroSignal, l0Cycle, l2Signal, l3Signal }) {
  const [showAll, setShowAll] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  const formatSinceLaunch = (pairCreatedAt) => {
    const createdAt = Number(pairCreatedAt);
    if (!Number.isFinite(createdAt)) return "—";
    const diffMs = Date.now() - createdAt;
    if (diffMs <= 0) return "刚刚";
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)} 分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    return `${Math.floor(diffHours / 24)} 天前`;
  };
  const sortedItems = useMemo(() => {
    if (sortMode === "vliq") {
      return [...items].sort((a, b) => {
        const va = (a.volumeH1 > 0 && a.liquidityUsd > 0) ? a.volumeH1 / a.liquidityUsd : -Infinity;
        const vb = (b.volumeH1 > 0 && b.liquidityUsd > 0) ? b.volumeH1 / b.liquidityUsd : -Infinity;
        return vb - va;
      });
    }
    if (sortMode === "change") {
      return [...items].sort((a, b) => {
        const ca = Number(a.priceChangeH1) || -Infinity;
        const cb = Number(b.priceChangeH1) || -Infinity;
        return cb - ca;
      });
    }
    return items;
  }, [items, sortMode]);
  const displayItems = showAll ? sortedItems : sortedItems.slice(0, 8);

  useEffect(() => {
    setShowAll(false);
    setSortMode("default");
  }, [items]);

  const getChangeToneClass = (value) => {
    if (value == null || Number.isNaN(Number(value))) return "";
    if (Number(value) > 0) return "is-up";
    if (Number(value) < 0) return "is-down";
    return "is-flat";
  };

  const formatChange = (value) => {
    if (value == null || Number.isNaN(Number(value))) return "—";
    const numeric = Number(value);
    return `${numeric > 0 ? "+" : ""}${numeric.toFixed(0)}%`;
  };

  return (
    <div className="meme-radar-panel">
      <div className="meme-radar-head">
        <div>
          <div className="meme-radar-role-pill">候选发现层</div>
          <div className="meme-radar-title">Meme 雷达</div>
          <div className="meme-radar-note">从最新链上 token 里找候选，感兴趣的填进 Alpha Scanner 做初筛。</div>
        </div>
        <div className="meme-radar-updated">
          <div>共 {items.length} 条</div>
          {updatedAt && <div>更新于 {formatSinceLaunch(new Date(updatedAt).getTime())}</div>}
        </div>
      </div>
      {heroSignal && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          margin: "8px 0 10px",
          padding: "8px 12px",
          borderRadius: 10,
          background: heroSignal.color === "green"
            ? "rgba(57,211,83,0.07)"
            : heroSignal.color === "red"
              ? "rgba(255,77,77,0.07)"
              : "rgba(120,120,128,0.06)",
          border: `1px solid ${heroSignal.color === "green"
            ? "rgba(57,211,83,0.25)"
            : heroSignal.color === "red"
              ? "rgba(255,77,77,0.25)"
              : "rgba(120,120,128,0.15)"}`,
          fontSize: "var(--lo-text-meta)",
        }}>
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: getSignalColorVar(heroSignal.color || "none"),
          }} />
          <span style={{ fontWeight: 700, color: "var(--lo-text-primary)" }}>
            {heroSignal.label}
          </span>
          <span style={{ color: "var(--lo-text-secondary)" }}>·</span>
          <span style={{ color: "var(--lo-text-secondary)" }}>
            {l0Cycle === "expansion" ? "扩张期"
              : l0Cycle === "contraction" ? "收缩期"
                : "过渡期"}
          </span>
          {l2Signal?.color && (
            <>
              <span style={{ color: "var(--lo-text-secondary)" }}>·</span>
              <span style={{ color: "var(--lo-text-secondary)" }}>
                L2 <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: getSignalColorVar(l2Signal.color), verticalAlign: "middle",
                }} />
              </span>
            </>
          )}
          {l3Signal?.color && (
            <>
              <span style={{ color: "var(--lo-text-secondary)" }}>·</span>
              <span style={{ color: "var(--lo-text-secondary)" }}>
                L3 <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: getSignalColorVar(l3Signal.color), verticalAlign: "middle",
                }} />
              </span>
            </>
          )}
          <span style={{ marginLeft: "auto", color: "var(--lo-text-tertiary)", fontStyle: "italic" }}>
            {heroSignal.color === "green" ? "适合发现新候选"
              : heroSignal.color === "red" ? "谨慎筛选，控制仓位"
                : "先观察，等信号明确"}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-tertiary)", marginRight: 2 }}>排序</span>
        {[
          { key: "default", label: "最新" },
          { key: "vliq", label: "V/Liq ↓" },
          { key: "change", label: "涨幅 ↓" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortMode(key)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: sortMode === key ? "1.5px solid var(--lo-brand)" : "1.5px solid var(--lo-border)",
              background: sortMode === key ? "var(--lo-brand)" : "transparent",
              color: sortMode === key ? "#fff" : "var(--lo-text-secondary)",
              fontSize: "var(--lo-text-meta)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "-apple-system,sans-serif",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && <div className="meme-radar-status">正在加载 Meme 雷达...</div>}
      {!loading && error && <div className="meme-radar-status is-error">{error}</div>}
      {!loading && !error && items.length === 0 && <div className="meme-radar-status">暂无候选</div>}
      {!loading && !error && items.length > 0 && (
        <div className="meme-radar-list">
          {displayItems.map((item, idx) => (
            <div
              key={`${item.tokenAddress || item.url || item.symbol || "meme"}-${idx}`}
              className="meme-radar-item"
            >
              <div className="meme-radar-main">
                <div className="meme-radar-symbol-row">
                  <span className="meme-radar-symbol">{item.symbol || "—"}</span>
                  <span className="meme-radar-chain">{item.chainId || "unknown"}</span>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="meme-radar-ext-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ↗
                    </a>
                  )}
                </div>
                <div className="meme-radar-subline">
                  <div>{item.name ? (item.name.length > 20 ? `${item.name.slice(0, 20)}…` : item.name) : "—"}</div>
                  <div>{formatSinceLaunch(item.pairCreatedAt)} 上线</div>
                </div>
              </div>
              <div className="meme-radar-metric">
                <span className="meme-radar-metric-label">1h 涨幅</span>
                <span className={`meme-radar-metric-value ${getChangeToneClass(item.priceChangeH1)}`}>{formatChange(item.priceChangeH1)}</span>
              </div>
              <div className="meme-radar-metric">
                <span className="meme-radar-metric-label">1h 成交量</span>
                <span className="meme-radar-metric-value">{item.volumeH1 == null ? "—" : fmtUsd(item.volumeH1)}</span>
              </div>
              <div className="meme-radar-metric">
                <span className="meme-radar-metric-label">流动性</span>
                <span className="meme-radar-metric-value">{item.liquidityUsd == null ? "—" : fmtUsd(item.liquidityUsd)}</span>
              </div>
              <div className="meme-radar-actions">
                <button
                  type="button"
                  className="meme-radar-action-btn"
                  disabled={!alphaHasSlot}
                  onClick={() => onAddToAlpha(item)}
                >
                  + Alpha
                </button>
                <button
                  type="button"
                  className="meme-radar-action-btn"
                  disabled={!watchHasSlot}
                  onClick={() => onAddToWatch(item)}
                >
                  + Watch
                </button>
              </div>
            </div>
          ))}
          {!showAll && items.length > 8 && (
            <button type="button" className="meme-radar-show-more" onClick={() => setShowAll(true)}>
              查看全部 {items.length} 条
            </button>
          )}
          {showAll && items.length > 8 && (
            <button type="button" className="meme-radar-show-more" onClick={() => setShowAll(false)}>
              收起
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const emptyWatchRow = () => ({
  token: "",
  address: "",
  chain: "solana",
  entryPrice: "",
  status: "watching",
  mcap: "",
  chg24h: "",
  chg7d: "",
  chg1m: "",
  vmc: "",
  vol24h: "",
  chipsScore: "",
  poolDepth: "",
  note: "",
});
const emptyAlpha = () => ({
  chain: "solana",
  token: "",
  top10Share: "",
  holderChange: "",
  chipsJudgment: "",
  volumeChange24h: "",
  priceChange24h: "",
  momentumJudgment: "",
  poolLiquidity: "",
  poolVolume24h: "",
  poolLiqVol: "",
  poolJudgment: "",
  note: "",
});
const buildEmptyWatchlist = () => Array.from({ length: 5 }, emptyWatchRow);
const buildEmptyAlphaCards = () => Array.from({ length: 3 }, emptyAlpha);

export default function App() {
  const [currentPage, setCurrentPage] = useState("main");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.localStorage.getItem("lo-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const todayValue = getDateValue();
  const yesterdayValue = getDateValue(new Date(Date.now() - 86400000));
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [macro, setMacro] = useState(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState("");
  const [macroTime, setMacroTime] = useState("");
  const [macroSource, setMacroSource] = useState("");
  const [l0Cycle, setL0Cycle] = useState("transition");
  const [l1Manual, setL1Manual] = useState({ fed: "", tga: "", rrp: "", date: "" });
  const [mvrvManual, setMvrvManual] = useState({ score: "", date: "", source: "LookIntoBitcoin" });
  const [fgVal, setFgVal] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySummaries, setHistorySummaries] = useState([]);
  const [trendSeries, setTrendSeries] = useState({ btc: [], l1: [], l2: [], l3: [], fg: [] });
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [saveState, setSaveState] = useState({ tone: "idle", label: "未保存", detail: "等待输入变化" });
  const [cacheState, setCacheState] = useState({ tone: "idle", label: "未读取", detail: "当天点击“更新数据”后按默认策略更新" });
  const [viewState, setViewState] = useState({ tone: "idle", label: "等待切换", detail: "切日期后会重载当日快照" });
  const [watchlist, setWatchlist] = useState(buildEmptyWatchlist);
  const [alphaCards, setAlphaCards] = useState(buildEmptyAlphaCards);
  const [alphaAutoData, setAlphaAutoData] = useState({});
  const [alphaAutoLoading, setAlphaAutoLoading] = useState({});
  const [alphaDecisions, setAlphaDecisions] = useState(() => {
    try {
      const raw = window.localStorage.getItem("lo:alpha-decisions");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [watchAutoData, setWatchAutoData] = useState({});
  const [watchAutoLoading, setWatchAutoLoading] = useState({});
  const [watchAutoRefreshEnabled, setWatchAutoRefreshEnabled] = useState(false);
  const [memeRadarItems, setMemeRadarItems] = useState([]);
  const [memeRadarLoading, setMemeRadarLoading] = useState(false);
  const [memeRadarError, setMemeRadarError] = useState(null);
  const [memeRadarUpdatedAt, setMemeRadarUpdatedAt] = useState(null);
  const [notePanelUi, setNotePanelUi] = useState(() => readNotePanelState());
  const [isCompactViewport, setIsCompactViewport] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 720 : false));
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1440));
  const [showL1Dock, setShowL1Dock] = useState(false);
  const [l1Expanded, setL1Expanded] = useState(false);
  const [expandedAlphaCards, setExpandedAlphaCards] = useState(() => new Set());

  const today = formatDateLabel(selectedDate);
  const isHydrating = useRef(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);
  const stateFlowVersion = useRef(0);
  const notePanelRef = useRef(null);
  const notePanelUiRef = useRef(notePanelUi);
  const notePanelMeasureRaf = useRef(null);
  const notePanelDrag = useRef({ active: false, pointerId: null, offsetX: 0, offsetY: 0 });
  const watchConcurrentRef = useRef(0);
  const loadWatchAutoAllRef = useRef(null);
  const WATCH_CONCURRENT_MAX = 3;

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("lo-theme", next);
        } catch {
          // ignore theme persistence failures
        }
      }
      return next;
    });
  }, []);

  const markDirty = useCallback(() => {
    pendingSave.current = true;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem("lo:alpha-decisions", JSON.stringify(alphaDecisions));
    } catch {}
  }, [alphaDecisions]);

  useEffect(() => {
    setMemeRadarLoading(true);
    fetchMemeRadar()
      .then((d) => {
        if (d?.error) {
          setMemeRadarError(d.error);
          setMemeRadarItems([]);
          setMemeRadarUpdatedAt(d?.updatedAt ?? null);
          return;
        }
        setMemeRadarItems(Array.isArray(d?.items) ? d.items : []);
        setMemeRadarUpdatedAt(d?.updatedAt ?? null);
        setMemeRadarError(null);
      })
      .catch(() => {
        setMemeRadarError("Meme 雷达数据加载失败");
        setMemeRadarItems([]);
        setMemeRadarUpdatedAt(null);
      })
      .finally(() => setMemeRadarLoading(false));
  }, []);

  const resetDailyState = useCallback(() => {
    setMacro(null);
    setMacroTime("");
    setMacroSource("");
    setMacroError("");
    setL0Cycle("transition");
    setL1Manual({ fed: "", tga: "", rrp: "", date: "" });
    setMvrvManual({ score: "", date: "", source: "LookIntoBitcoin" });
    setFgVal("");
    setDailyNote("");
    setWatchlist(buildEmptyWatchlist());
    setAlphaCards(buildEmptyAlphaCards());
    setAlphaAutoData({});
    setAlphaAutoLoading({});
    setWatchAutoData({});
    setWatchAutoLoading({});
  }, []);

  const clampAndCommitNotePanel = useCallback((incomingState, fallbackRect = null) => {
    if (typeof window === "undefined") return;
    const panel = notePanelRef.current;
    const width = fallbackRect?.width
      || panel?.offsetWidth
      || (incomingState?.collapsed ? 188 : (window.innerWidth <= 720 ? Math.min(window.innerWidth - 24, 344) : 360));
    const height = fallbackRect?.height
      || panel?.offsetHeight
      || (incomingState?.collapsed ? 58 : (window.innerWidth <= 720 ? 232 : 316));
    const next = clampNotePanelState(incomingState || notePanelUiRef.current, width, height, window.innerWidth, window.innerHeight);
    setNotePanelUi((prev) => (
      prev.x === next.x
      && prev.y === next.y
      && prev.hidden === next.hidden
      && prev.collapsed === next.collapsed
    ) ? prev : next);
  }, []);

  useEffect(() => {
    notePanelUiRef.current = notePanelUi;
    writeNotePanelState(notePanelUi);
  }, [notePanelUi]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth <= 720);
      setViewportWidth(window.innerWidth);
      if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
      notePanelMeasureRaf.current = window.requestAnimationFrame(() => {
        clampAndCommitNotePanel(notePanelUiRef.current);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
    };
  }, [clampAndCommitNotePanel]);

  useEffect(() => {
    if (!l1Expanded && showL1Dock) {
      setShowL1Dock(false);
    }
  }, [l1Expanded, showL1Dock]);

  useEffect(() => {
    if (notePanelUi.hidden || typeof window === "undefined") return undefined;
    if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
    notePanelMeasureRaf.current = window.requestAnimationFrame(() => {
      clampAndCommitNotePanel(notePanelUiRef.current);
    });
    return () => {
      if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
    };
  }, [clampAndCommitNotePanel, notePanelUi.hidden, notePanelUi.collapsed, isCompactViewport]);

  useEffect(() => () => {
    if (notePanelMeasureRaf.current && typeof window !== "undefined") {
      window.cancelAnimationFrame(notePanelMeasureRaf.current);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const runVersion = ++stateFlowVersion.current;
      isHydrating.current = true;
      pendingSave.current = false;
      setViewState({ tone: "info", label: "切换中", detail: `正在读取 ${selectedDate} 的本地快照` });
      setCacheState({
        tone: selectedDate === todayValue ? "idle" : "warn",
        label: selectedDate === todayValue ? "未读取" : "历史只读",
        detail: selectedDate === todayValue ? "当天点击“更新数据”后按默认策略更新" : "历史日期不请求网络，只读本地快照",
      });
      resetDailyState();
      try {
        const r = await window.storage.get(keyForDate(selectedDate));
        if (runVersion !== stateFlowVersion.current) return;
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.macroSnapshot) setMacro(normalizeMacroData(d.macroSnapshot));
          if (d.macroMeta?.time) setMacroTime(d.macroMeta.time);
          if (d.macroMeta?.source) setMacroSource(d.macroMeta.source);
          if (d.l0Cycle) setL0Cycle(d.l0Cycle);
          if (d.l1Manual && typeof d.l1Manual === "object") setL1Manual((prev) => ({ ...prev, ...d.l1Manual }));
          if (d.mvrvManual && typeof d.mvrvManual === "object") setMvrvManual((prev) => ({ ...prev, ...d.mvrvManual }));
          if (d.fgVal != null) setFgVal(d.fgVal);
          if (d.dailyNote != null) setDailyNote(d.dailyNote);
          if (Array.isArray(d.watchlist)) setWatchlist(normalizeWatchlistRows(d.watchlist));
          if (Array.isArray(d.alphaCards)) setAlphaCards(normalizeAlphaCards(d.alphaCards));
          setViewState({
            tone: "ok",
            label: selectedDate === todayValue ? "今日工作区" : "历史快照",
            detail: `${selectedDate} 已加载${d.savedAt ? ` · 保存于 ${formatTimeLabel(d.savedAt)}` : ""}`,
          });
          setSaveState({
            tone: selectedDate === todayValue ? "idle" : "info",
            label: selectedDate === todayValue ? "已加载" : "只读查看",
            detail: d.savedAt ? `${selectedDate} 最近保存于 ${formatTimeLabel(d.savedAt)}` : `${selectedDate} 已加载本地快照`,
          });
        } else {
          setViewState({
            tone: selectedDate === todayValue ? "info" : "warn",
            label: selectedDate === todayValue ? "今日空白" : "历史为空",
            detail: `${selectedDate} 当前没有已保存快照`,
          });
          setSaveState({
            tone: selectedDate === todayValue ? "idle" : "warn",
            label: selectedDate === todayValue ? "未保存" : "只读空白",
            detail: selectedDate === todayValue ? "今天还没有写入任何快照" : `${selectedDate} 当前没有历史记录`,
          });
          if (selectedDate === todayValue) {
            latestHandleMacroRefreshRef.current?.(false);
          }
        }
      } catch {
        if (runVersion !== stateFlowVersion.current) return;
        setViewState({ tone: "bad", label: "切换失败", detail: `${selectedDate} 快照读取异常` });
        setSaveState({ tone: "bad", label: "读取失败", detail: `${selectedDate} 无法确认保存状态` });
      }
      if (runVersion !== stateFlowVersion.current) return;
      isHydrating.current = false;
    })();
  }, [selectedDate, resetDailyState, todayValue]);

  const refreshHistorySummaries = useCallback(async () => {
    const dates = getRecentDateValues(30);
    const items = [];
    for (const dateValue of dates) {
      try {
        const r = await window.storage.get(keyForDate(dateValue));
        if (!r?.value) continue;
        const d = JSON.parse(r.value);
        items.push({
          dateValue,
          hero: d.heroSnapshot || null,
          fgVal: d.fgVal ?? "",
          l4: d.l4Snapshot || null,
          note: d.dailyNote || "",
          hasMacro: !!d.macroSnapshot,
          savedAt: d.savedAt || null,
        });
      } catch {
        // ignore invalid local snapshot
      }
    }
    setHistorySummaries(items);
  }, []);

  useEffect(() => {
    refreshHistorySummaries();
  }, [refreshHistorySummaries]);

  useEffect(() => {
    (async () => {
      const dates = getRecentDateValues(12, parseDateValue(selectedDate)).reverse();
      const next = { btc: [], l1: [], l2: [], l3: [], fg: [] };
      for (const dateValue of dates) {
        try {
          const r = await window.storage.get(keyForDate(dateValue));
          if (!r?.value) continue;
          const d = JSON.parse(r.value);
          const m = d.macroSnapshot || {};
          const btcPrice = toNum(m.btc?.price);
          const gnl = toNum(m.fred?.gnl?.value_t);
          const stableTotal = toNum(m.stablecoins?.total);
          const memeMcap = toNum(m.meme?.mcap);
          const fg = d.fgVal !== "" ? toNum(d.fgVal) : toNum(m.fear_greed?.value);
          if (btcPrice != null) next.btc.push(btcPrice);
          if (gnl != null) next.l1.push(gnl);
          if (stableTotal != null) next.l2.push(stableTotal);
          if (memeMcap != null) next.l3.push(memeMcap);
          if (fg != null) next.fg.push(fg);
        } catch {
          // ignore invalid snapshot
        }
      }
      setTrendSeries(next);
    })();
  }, [selectedDate, historySummaries.length]);

  const handleMacroRefresh = useCallback(async (force = false) => {
    const refreshVersion = ++stateFlowVersion.current;
    isHydrating.current = false;
    if (selectedDate !== todayValue) {
      setCacheState({ tone: "warn", label: "历史只读", detail: "历史日期不请求网络，只读本地快照" });
      return;
    }
    if (force) {
      setCacheState({ tone: "info", label: "强制更新", detail: "已跳过默认缓存策略，准备请求网络" });
    }
    if (!force) {
      try {
        const cached = await window.storage.get(keyForDate(selectedDate));
        if (refreshVersion !== stateFlowVersion.current) return;
        if (cached?.value) {
          const parsed = JSON.parse(cached.value);
          if (parsed.macroSnapshot) {
            setMacro(normalizeMacroData(parsed.macroSnapshot));
            setMacroTime(parsed.macroMeta?.time || macroTime);
            setMacroSource(parsed.macroMeta?.source ? `${parsed.macroMeta.source} · 缓存` : "本地快照");
            if (parsed.fgVal != null) setFgVal(parsed.fgVal);
            setCacheState({
              tone: "ok",
              label: "缓存命中",
              detail: `${selectedDate} 宏观快照已回填${parsed.macroMeta?.time ? ` · ${parsed.macroMeta.time}` : ""}`,
            });
            return;
          }
        }
        setCacheState({ tone: "warn", label: "缓存缺失", detail: "当天没有宏观快照，改走网络请求" });
      } catch {
        if (refreshVersion !== stateFlowVersion.current) return;
        setCacheState({ tone: "bad", label: "缓存异常", detail: "本地快照读取失败，改走网络请求" });
      }
    }
    setMacroLoading(true);
    setMacroError("");
    try {
      const data = await fetchMacroViaWorker();
      if (refreshVersion !== stateFlowVersion.current) return;
      const normalized = normalizeMacroData(data);
      pendingSave.current = true;
      setMacro(normalized);
      setMacroSource("Worker");
      setMacroTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      if (normalized.fear_greed?.value != null) setFgVal(String(normalized.fear_greed.value));
      setCacheState({
        tone: "ok",
        label: "网络成功",
        detail: "已从 Worker 获取最新宏观数据",
      });
    } catch (e) {
      if (refreshVersion !== stateFlowVersion.current) return;
      const message = getMacroRefreshErrorMessage(e);
      setMacroError(`❌ ${message}`);
      setCacheState({ tone: "bad", label: "刷新失败", detail: message });
    } finally {
      if (refreshVersion !== stateFlowVersion.current) return;
      setMacroLoading(false);
    }
  }, [selectedDate, todayValue, macroTime]);

  const latestHandleMacroRefreshRef = useRef(handleMacroRefresh);

  useEffect(() => {
    latestHandleMacroRefreshRef.current = handleMacroRefresh;
  }, [handleMacroRefresh]);

  const updWatch = (idx, field, val) => {
    markDirty();
    setWatchlist((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, [field]: val };
      const mcap = toNum(next.mcap);
      const vmc = toNum(next.vmc);
      if (mcap != null && mcap > 0 && vmc != null) {
        next.vol24h = String(parseFloat((mcap * vmc).toFixed(6)));
      } else if (field === "vmc" || field === "mcap") {
        next.vol24h = "";
      }
      return next;
    }));
    if (field === "chain" || field === "address") {
      setWatchAutoData((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
  };
  const updAlpha = (idx, field, val) => {
    markDirty();
    if (field === "chain" || field === "token") {
      setAlphaAutoData((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
    setAlphaCards((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const loadAlphaAuto = useCallback(async (idx) => {
    const card = alphaCards[idx];
    if (!card?.token) return;
    setAlphaAutoLoading((prev) => ({ ...prev, [idx]: true }));
    try {
      const data = await fetchAlphaSupport(card.chain || "solana", card.token.trim());
      setAlphaAutoData((prev) => ({ ...prev, [idx]: data }));
    } catch (e) {
      const msg = e.message || "自动拉数失败";
      setAlphaAutoData((prev) => ({
        ...prev,
        [idx]: {
          error: msg,
          updated_at: new Date().toISOString(),
          chips: { error: msg },
          momentum: { error: msg },
          pool: { error: msg },
        },
      }));
    } finally {
      setAlphaAutoLoading((prev) => ({ ...prev, [idx]: false }));
    }
  }, [alphaCards]);
  const loadWatchAuto = useCallback(async (idx) => {
    const row = watchlist[idx];
    if (!row?.address) return;
    if (watchConcurrentRef.current >= WATCH_CONCURRENT_MAX) return;
    watchConcurrentRef.current += 1;
    setWatchAutoLoading((prev) => ({ ...prev, [idx]: true }));
    try {
      const data = await fetchAlphaSupport(row.chain || "solana", row.address.trim());
      setWatchAutoData((prev) => ({ ...prev, [idx]: data }));
    } catch (e) {
      const msg = e.message || "自动拉数失败";
      setWatchAutoData((prev) => ({
        ...prev,
        [idx]: {
          error: msg,
          updated_at: new Date().toISOString(),
          chips: { error: msg },
          momentum: { error: msg },
          pool: { error: msg },
        },
      }));
    } finally {
      watchConcurrentRef.current -= 1;
      setWatchAutoLoading((prev) => ({ ...prev, [idx]: false }));
    }
  }, [watchlist]);
  const loadWatchAutoAll = useCallback(() => {
    watchlist.forEach((row, idx) => {
      if (row?.address) loadWatchAuto(idx);
    });
  }, [watchlist, loadWatchAuto]);

  useEffect(() => {
    loadWatchAutoAllRef.current = loadWatchAutoAll;
  }, [loadWatchAutoAll]);

  useEffect(() => {
    if (!watchAutoRefreshEnabled) return;
    loadWatchAutoAllRef.current?.();
    const id = setInterval(() => loadWatchAutoAllRef.current?.(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [watchAutoRefreshEnabled]);
  const updL1Manual = (field, val) => {
    markDirty();
    setL1Manual((prev) => ({ ...prev, [field]: val }));
  };
  const updMvrvManual = (field, val) => {
    markDirty();
    setMvrvManual((prev) => ({ ...prev, [field]: val }));
  };
  const addWatchRow = () => {
    if (watchlist.length < 10) {
      markDirty();
      setWatchlist((prev) => [...prev, emptyWatchRow()]);
    }
  };
  const removeWatchRow = (idx) => {
    markDirty();
    setWatchlist((prev) => prev.filter((_, i) => i !== idx));
    setWatchAutoData((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx) next[n] = v;
        else if (n > idx) next[n - 1] = v;
      });
      return next;
    });
  };
  const addToAlpha = useCallback((item) => {
    const idx = alphaCards.findIndex((c) => !String(c?.token || "").trim());
    if (idx === -1) return;
    markDirty();
    setAlphaCards((prev) => prev.map((c, i) => (
      i === idx ? { ...c, chain: mapChain(item.chainId), token: item.tokenAddress || "" } : c
    )));
    requestAnimationFrame(() => {
      const el = document.getElementById(`alpha-card-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("lo-slot-flash");
        void el.offsetWidth;
        el.classList.add("lo-slot-flash");
      }
    });
  }, [alphaCards, markDirty]);
  const addToWatch = useCallback((item) => {
    const idx = watchlist.findIndex((r) => !String(r?.token || "").trim());
    if (idx === -1) return;
    markDirty();
    setWatchlist((prev) => prev.map((r, i) => (
      i === idx ? {
        ...r,
        token: item.symbol || item.tokenAddress || "",
        address: item.tokenAddress || "",
        chain: mapChain(item.chainId) || "solana",
      } : r
    )));
    requestAnimationFrame(() => {
      const el = document.getElementById(`watch-row-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("lo-slot-flash");
        void el.offsetWidth;
        el.classList.add("lo-slot-flash");
      }
    });
  }, [watchlist, markDirty]);
  const addToWatchFromAlpha = useCallback((card) => {
    const idx = watchlist.findIndex((r) => !String(r?.token || "").trim());
    if (idx === -1) return;
    markDirty();
    setWatchlist((prev) => prev.map((r, i) => (
      i === idx ? {
        ...r,
        token: card.token || "",
        address: card.token || "",
        chain: card.chain || "solana",
      } : r
    )));
    requestAnimationFrame(() => {
      const el = document.getElementById(`watch-row-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("lo-slot-flash");
        void el.offsetWidth;
        el.classList.add("lo-slot-flash");
      }
    });
  }, [watchlist, markDirty]);
  const clearAlphaCard = useCallback((idx) => {
    markDirty();
    setAlphaCards((prev) => prev.map((c, i) => (i === idx ? emptyAlpha() : c)));
    setAlphaAutoData((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }, [markDirty]);
  const l0Info = cycleMeta[l0Cycle] || cycleMeta.transition;
  const isTodayView = selectedDate === todayValue;
  const manualGnl = calcManualGnl(l1Manual.fed, l1Manual.tga, l1Manual.rrp);
  const hasFredAuto = !!macro?.fred?.gnl;
  const fredSource = macro?.fred?.source || "FRED";
  const fredDate = macro?.fred?.gnl?.date || macro?.fred?.fed?.date || macro?.fred?.tga?.date || macro?.fred?.rrp?.date || null;
  const fredUpdatedAt = macro?.fred?.updated_at || null;
  const dataFreshLabel = macroLoading ? "更新中" : macroTime ? "已更新" : "待更新";
  const watchActiveCount = watchlist.filter((row) => String(row?.token || "").trim()).length;
  const visibleWatchEntries = watchlist
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => String(row?.token || "").trim());
  const firstDraftWatchIdx = watchlist.findIndex((row) => !String(row?.token || "").trim());
  const alphaFilledCount = alphaCards.filter((card) => String(card?.token || "").trim()).length;
  const alphaHasSlot = alphaCards.some((c) => !String(c?.token || "").trim());
  const watchHasSlot = firstDraftWatchIdx !== -1;
  const watchStatusCounts = watchlist.reduce((acc, row) => {
    const key = row.status || "watching";
    acc[key] = (acc[key] || 0) + (row.token ? 1 : 0);
    return acc;
  }, { watching: 0, ready: 0, position: 0 });
  const l2Signal = useMemo(() => (macro ? calcL2SignalDetail(macro) : null), [macro]);
  const l3Signal = useMemo(() => (macro ? calcL3SignalDetail(macro) : null), [macro]);
  const fgSignal = useMemo(() => calcFGSignalDetail(parseInt(fgVal) || null), [fgVal]);
  const l4Signal = useMemo(() => calcL4SignalDetail(watchlist, alphaCards), [watchlist, alphaCards]);
  const heroSignal = useMemo(() => calcHeroSignal([l2Signal, l3Signal, fgSignal, l4Signal]), [l2Signal, l3Signal, fgSignal, l4Signal]);
  const recordAlphaDecision = useCallback((idx, decision) => {
    const card = alphaCards[idx];
    if (!card?.token) return;
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      token: card.token,
      chain: card.chain || "solana",
      decision,
      timestamp: new Date().toISOString(),
      macro_snapshot: {
        l0_score: heroSignal?.score ?? null,
        l1_trend: heroSignal?.color ?? null,
        l2_status: l2Signal?.color ?? null,
        l3_signal: l3Signal?.color ?? null,
        market_phase: l0Cycle ?? null,
      },
    };
    setAlphaDecisions((prev) => [record, ...prev].slice(0, 100));
    setExpandedAlphaCards((prev) => {
      const next = new Set(prev);
      next.delete(`alpha-${idx + 1}`);
      return next;
    });
  }, [alphaCards, heroSignal, l2Signal, l3Signal, l0Cycle]);
  const filteredHistory = historySummaries.filter((item) => {
    if (historyFilter === "macro") return item.hasMacro;
    if (historyFilter === "notes") return !!item.note;
    if (historyFilter === "attack") return item.hero?.label === "进　攻";
    return true;
  });
  const historyWithHero = filteredHistory.filter((item) => item.hero?.score != null);
  const avgHeroScore = historyWithHero.length > 0 ? (historyWithHero.reduce((sum, item) => sum + item.hero.score, 0) / historyWithHero.length) : null;
  const fgHistoryItems = filteredHistory.filter((item) => item.fgVal !== "" && !isNaN(Number(item.fgVal)));
  const avgFg = fgHistoryItems.length > 0 ? (fgHistoryItems.reduce((sum, item) => sum + Number(item.fgVal), 0) / fgHistoryItems.length) : null;
  const fgHistoryPoints = useMemo(() => (
    [...historySummaries]
      .sort((a, b) => String(a.dateValue || "").localeCompare(String(b.dateValue || "")))
      .map((item) => Number(item.fgVal))
      .filter((value) => Number.isFinite(value))
      .slice(-10)
  ), [historySummaries]);
  const macroDays = filteredHistory.filter((item) => item.hasMacro).length;
  const attackDays = filteredHistory.filter((item) => item.hero?.label === "进　攻").length;
  const selectedHistorySummary = historySummaries.find((item) => item.dateValue === selectedDate) || null;
  const historyState = historySummaries.length === 0
    ? { tone: "warn", label: "无历史记录", detail: "还没有任何按日快照" }
    : { tone: "ok", label: `${historySummaries.length} 条记录`, detail: `近 30 天内有 ${macroDays} 天宏观快照` };
  const l4GateReady = Boolean(l0Cycle) && heroSignal?.score != null && Boolean(l2Signal);
  const l4SignalGreen = l2Signal?.color === "green" && l3Signal?.color === "green";
  const notePanelSummary = isTodayView
    ? `Hero ${heroSignal?.label || "—"} · F&G ${fgVal === "" ? "—" : fgVal} · ${macro ? "含宏观上下文" : "无宏观快照"}`
    : selectedHistorySummary?.hero?.label
      ? `Hero ${selectedHistorySummary.hero.label} · F&G ${selectedHistorySummary.fgVal === "" ? "—" : selectedHistorySummary.fgVal} · ${selectedHistorySummary.hasMacro ? "含宏观快照" : "无宏观快照"}`
      : "当前日期还没有形成完整摘要，可继续补记录。";
  const notePanelRoleLabel = isTodayView ? "全局记录工具" : "历史记录工具";
  const notePanelRoleCopy = isTodayView
    ? "看任何板块时都能随手记下判断、入场理由和风控条件。"
    : "回看历史快照时，也能直接补充当日复盘痕迹。";
  const openNotePanel = useCallback(() => {
    const nextBase = { ...notePanelUiRef.current, hidden: false };
    setNotePanelUi(nextBase);
    if (typeof window !== "undefined") {
      if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
      notePanelMeasureRaf.current = window.requestAnimationFrame(() => clampAndCommitNotePanel(nextBase));
    }
  }, [clampAndCommitNotePanel]);

  const toggleNotePanelCollapse = useCallback(() => {
    const nextBase = { ...notePanelUiRef.current, hidden: false, collapsed: !notePanelUiRef.current.collapsed };
    setNotePanelUi(nextBase);
    if (typeof window !== "undefined") {
      if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
      notePanelMeasureRaf.current = window.requestAnimationFrame(() => clampAndCommitNotePanel(nextBase));
    }
  }, [clampAndCommitNotePanel]);

  const hideNotePanel = useCallback(() => {
    notePanelDrag.current = { active: false, pointerId: null, offsetX: 0, offsetY: 0 };
    setNotePanelUi((prev) => ({ ...prev, hidden: true }));
  }, []);

  const handleNotePanelPointerDown = useCallback((event) => {
    if (event.button != null && event.button !== 0) return;
    if (notePanelUiRef.current.hidden) return;
    if (event.target instanceof Element && event.target.closest("button, textarea, input")) return;
    const panel = notePanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    notePanelDrag.current = {
      active: true,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, []);

  const handleNotePanelPointerMove = useCallback((event) => {
    const drag = notePanelDrag.current;
    if (!drag.active || drag.pointerId !== event.pointerId || typeof window === "undefined") return;
    const panel = notePanelRef.current;
    const width = panel?.offsetWidth || (notePanelUiRef.current.collapsed ? 188 : (window.innerWidth <= 720 ? Math.min(window.innerWidth - 24, 344) : 360));
    const height = panel?.offsetHeight || (notePanelUiRef.current.collapsed ? 58 : (window.innerWidth <= 720 ? 232 : 316));
    const next = clampNotePanelState({
      ...notePanelUiRef.current,
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    }, width, height, window.innerWidth, window.innerHeight);
    if (notePanelMeasureRaf.current) window.cancelAnimationFrame(notePanelMeasureRaf.current);
    notePanelMeasureRaf.current = window.requestAnimationFrame(() => {
      setNotePanelUi((prev) => (prev.x === next.x && prev.y === next.y) ? prev : { ...prev, x: next.x, y: next.y });
    });
  }, []);

  const finishNotePanelDrag = useCallback((event) => {
    const drag = notePanelDrag.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    notePanelDrag.current = { active: false, pointerId: null, offsetX: 0, offsetY: 0 };
    notePanelRef.current?.releasePointerCapture?.(event.pointerId);
    if (typeof window !== "undefined" && notePanelMeasureRaf.current) {
      window.cancelAnimationFrame(notePanelMeasureRaf.current);
      notePanelMeasureRaf.current = window.requestAnimationFrame(() => clampAndCommitNotePanel(notePanelUiRef.current));
    }
  }, [clampAndCommitNotePanel]);

  const btcTrendStats = useMemo(() => getTrendStats(trendSeries.btc), [trendSeries.btc]);
  const l1TrendStats = useMemo(() => getTrendStats(trendSeries.l1), [trendSeries.l1]);
  const l2TrendStats = useMemo(() => getTrendStats(trendSeries.l2), [trendSeries.l2]);
  const l3TrendStats = useMemo(() => getTrendStats(trendSeries.l3), [trendSeries.l3]);

  const btcPositionPct = toNum(macro?.btc?.vs_ma_200_pct);
  const btcStatusKey = btcPositionPct != null
    ? classifyThreeState(btcPositionPct, 3, -3)
    : (btcTrendStats.statusKey || null);
  const l1CurrentValue = hasFredAuto ? toNum(macro?.fred?.gnl?.value_t) : manualGnl;
  const l1StatusKey = l1TrendStats.statusKey || (hasFredAuto ? "neutral" : manualGnl != null ? "neutral" : null);
  const l2ChangePct = toNum(macro?.stablecoins?.change_7d_pct);
  const l2StatusKey = l2TrendStats.statusKey || classifyThreeState(l2ChangePct, 0.2, -0.2);
  const l3ChangePct = toNum(macro?.meme?.mcap_change_24h);
  const l3StatusKey = l3TrendStats.statusKey || classifyThreeState(l3ChangePct, 1, -1);
  const heroDecisionBorderColor = getSignalToneBorder(heroSignal?.color || "none");
  const sectionCardPadding = 24;
  const useDecisionGridLayout = viewportWidth > 1200;
  const decisionCardWidth = isCompactViewport ? "100%" : "calc((100% - 24px) / 2)";
  const heroDecisionCardStyle = {
    borderTop: `2px solid ${heroDecisionBorderColor}`,
    transition: "border-color 0.4s ease",
    padding: sectionCardPadding,
    minWidth: 0,
    gridColumn: useDecisionGridLayout ? "auto" : undefined,
    width: useDecisionGridLayout ? undefined : decisionCardWidth,
    flex: useDecisionGridLayout ? undefined : `0 0 ${decisionCardWidth}`,
  };
  const decisionGridStyle = {
    display: useDecisionGridLayout ? "grid" : "flex",
    flexWrap: useDecisionGridLayout ? undefined : "wrap",
    gap: 24,
    gridTemplateColumns: useDecisionGridLayout && !isCompactViewport ? "1fr 1fr" : undefined,
    gridTemplateRows: useDecisionGridLayout && !isCompactViewport ? "auto auto" : undefined,
    alignItems: "start",
  };
  const layerTransitionMessage = (() => {
    if (heroSignal?.score == null) {
      return { text: "宏观数据不足 · 先完成上方扫描", color: C.labelTer };
    }
    if (l0Cycle === "contraction") {
      return { text: "宏观偏空 · 缩小仓位，快进快出", color: C.red };
    }
    if (l0Cycle === "expansion") {
      return { text: "宏观偏多 · 可积极执行", color: C.green };
    }
    if (l0Cycle === "transition") {
      return { text: "宏观信号分歧 · 执行需选择性", color: C.blue || "var(--lo-brand)" };
    }
    if (heroSignal.score >= 0.7) {
      return { text: "宏观偏多 · 可积极执行", color: C.green };
    }
    if (heroSignal.score >= 0.4) {
      return { text: "宏观信号分歧 · 执行需选择性", color: C.yellow };
    }
    return { text: "宏观偏空 · 缩小仓位，快进快出", color: C.red };
  })();
  const fgNumericValue = fgVal === "" ? null : Number(fgVal);
  const fgGaugeValue = fgNumericValue == null || Number.isNaN(fgNumericValue) ? 0 : clampNumber(fgNumericValue, 0, 100);
  const fgCardBackground = fgNumericValue == null || Number.isNaN(fgNumericValue) ? "transparent" : getFgBackgroundTone(fgNumericValue);
  const fgHistoryCompareItems = [
    { label: "昨天", value: toNum(macro?.fear_greed?.yesterday ?? macro?.fear_greed?.day_ago) },
    { label: "上周", value: toNum(macro?.fear_greed?.last_week ?? macro?.fear_greed?.week_ago) },
    { label: "上月", value: toNum(macro?.fear_greed?.last_month ?? macro?.fear_greed?.month_ago) },
  ].filter((item) => item.value != null);
  const fgTagLabel = fgNumericValue == null || Number.isNaN(fgNumericValue)
    ? "等待录入"
    : fgNumericValue < 20
      ? "极度恐惧"
      : fgNumericValue < 45
        ? "恐惧"
        : fgNumericValue < 55
          ? "中性"
          : fgNumericValue < 80
            ? "贪婪"
            : "极度贪婪";

  const btcSummary = btcPositionPct == null
    ? "现价与 200MA 关系暂不可读，先按当前价格观察。"
    : btcStatusKey === "positive"
      ? `现价位于 200MA 上方 ${fmtPct(btcPositionPct)}，BTC 大位置仍偏强。`
      : btcStatusKey === "negative"
        ? `现价位于 200MA 下方 ${fmtPct(btcPositionPct)}，BTC 大位置承压。`
        : `现价贴近 200MA（${fmtPct(btcPositionPct)}），BTC 大位置处于盘整中。`;
  const l1Summary = l1CurrentValue == null
    ? "先录入手动 GNL 或更新宏观数据，再判断流动性方向。"
    : l1TrendStats.hasTrend
      ? l1StatusKey === "positive"
        ? "近几次快照里的 GNL 持续抬升，流动性背景偏正向。"
        : l1StatusKey === "negative"
          ? "近几次快照里的 GNL 持续回落，流动性背景偏收缩。"
          : "GNL 波动收窄，净流动性暂时处于盘整中。"
      : "当前只有单点值，先看 GNL 水平，不单独放大趋势判断。";
  const l2Summary = macro?.stablecoins?.total == null
    ? "稳定币总量暂缺，先等待宏观数据更新。"
    : l2StatusKey === "positive"
      ? "稳定币总量仍在回补，场内弹药继续补充。"
      : l2StatusKey === "negative"
        ? "稳定币总量回落，场内弹药正在流失。"
        : "稳定币总量变化收窄，场内弹药处于盘整中。";
  const l3Summary = macro?.meme?.mcap == null
    ? "板块总市值暂缺，先等待宏观数据更新。"
    : l3StatusKey === "positive"
      ? "Meme 总市值和热度方向偏上，板块风险偏好继续走强。"
      : l3StatusKey === "negative"
        ? "Meme 总市值回落，板块风险偏好正在走弱。"
        : "Meme 板块热度没有明显扩散，风险偏好处于盘整中。";
  // ── PATCH-UI-01：速读 chips ──
  const l1Chips = buildL1Chips(l1StatusKey, l1CurrentValue, hasFredAuto, l1TrendStats);
  const l2Chips = buildL2Chips(macro, l2StatusKey);
  const l3Chips = buildL3Chips(macro, l3StatusKey);
  const btcPanelSummary = macro
    ? btcSummary
    : "先更新宏观数据，再用 200MA 比率和 MVRV Z-Score 判断 BTC 周期位置。";
  const isDarkTheme = theme === "dark";
  const topbarBadgeStyle = {
    background: isDarkTheme ? "rgba(230,237,243,0.08)" : "rgba(15,23,42,0.04)",
    borderColor: isDarkTheme ? "rgba(230,237,243,0.12)" : "rgba(148,163,184,0.18)",
  };
  const themeToggleStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 999,
    border: `1px solid ${isDarkTheme ? "rgba(230,237,243,0.12)" : "rgba(148,163,184,0.18)"}`,
    background: isDarkTheme ? "rgba(230,237,243,0.08)" : "rgba(255,255,255,0.72)",
    color: isDarkTheme ? "var(--lo-text-primary)" : "rgba(15,23,42,0.72)",
    fontSize: "var(--lo-text-meta)",
    fontWeight: 700,
    cursor: "pointer",
  };
  const detailEntryButtonStyle = {
    fontSize: "var(--lo-text-meta)",
    color: isDarkTheme ? "rgba(230,237,243,0.72)" : "#6B7280",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 6px",
  };
  const heroSignalStripColumns = isCompactViewport ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))";
  const signalWashColor = (() => {
    switch (l0Cycle) {
      case "expansion":
        return "rgba(52, 199, 89, 0.07)";
      case "contraction":
        return "rgba(255, 59, 48, 0.06)";
      case "transition":
        return "rgba(0, 122, 255, 0.06)";
      default:
        return "rgba(0, 122, 255, 0.04)";
    }
  })();
  const heroTextColor = heroSignal.score == null
    ? C.labelTer
    : heroSignal.score >= 0.8
      ? C.blue
      : heroSignal.score >= 0.6
        ? C.green
        : heroSignal.score >= 0.4
          ? C.yellow
          : C.red;
  const signalDotColor = heroTextColor;
  const heroChipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 20,
    background: C.fill2,
    color: C.labelSec,
    fontSize: 12,
    fontWeight: 600,
  };
  const heroSignalStripItems = [[l2Signal, "稳定币"], [l3Signal, "Meme 板块"], [fgSignal, "情绪"], [l4Signal, "个股"]];
  const dockStatusLabel = !isTodayView ? "历史快照" : macroLoading ? "刷新中..." : macroTime ? `已更新 ${macroTime}` : "待更新";
  const dockFontFamily = "-apple-system,'Helvetica Neue','PingFang SC',sans-serif";
  const signalStripSurfaceStyle = {
    background: isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    border: isDarkTheme ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.04)",
    labelColor: isDarkTheme ? "rgba(255,255,255,0.4)" : C.labelTer,
  };
  const handleNavCardMouseEnter = useCallback((event) => {
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) return;
    const node = event.currentTarget;
    if (!node.dataset.baseShadow) {
      node.dataset.baseShadow = window.getComputedStyle(node).boxShadow;
    }
    node.style.transform = "translateY(-2px)";
    node.style.boxShadow = isDarkTheme
      ? "0 12px 28px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.05) inset"
      : "0 4px 20px rgba(0,0,0,0.08)";
  }, [isDarkTheme]);
  const handleNavCardMouseLeave = useCallback((event) => {
    const node = event.currentTarget;
    node.style.transform = "none";
    if (node.dataset.baseShadow) {
      node.style.boxShadow = node.dataset.baseShadow;
    } else {
      node.style.removeProperty("box-shadow");
    }
  }, []);
  const toggleAlphaCard = useCallback((cardKey) => {
    setExpandedAlphaCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) {
        next.delete(cardKey);
      } else {
        next.add(cardKey);
      }
      return next;
    });
  }, []);

  const snapshotPayload = useMemo(() => JSON.stringify(buildDailySnapshot({
    selectedDate,
    macro,
    macroTime,
    macroSource,
    heroSignal,
    l2Signal,
    l3Signal,
    fgSignal,
    l4Signal,
    l0Cycle,
    l1Manual,
    mvrvManual,
    fgVal,
    dailyNote,
    watchlist,
    alphaCards,
    alphaDecisionsToday: alphaDecisions.filter(
      (d) => d.timestamp.startsWith(todayValue)
    ),
  })), [selectedDate, macro, macroTime, macroSource, heroSignal, l2Signal, l3Signal, fgSignal, l4Signal, l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards, alphaDecisions, todayValue]);

  const doSave = useCallback(async () => {
    try {
      setSaveState({ tone: "info", label: "保存中", detail: `${selectedDate} 快照正在写入本地存储` });
      await window.storage.set(keyForDate(selectedDate), snapshotPayload);
      pendingSave.current = false;
      await refreshHistorySummaries();
      setSaveState({ tone: "ok", label: "已保存", detail: `${selectedDate} 最近保存于 ${formatTimeLabel(new Date().toISOString())}` });
    } catch {
      setSaveState({ tone: "bad", label: "保存失败", detail: `${selectedDate} 快照写入异常` });
    }
  }, [selectedDate, snapshotPayload, refreshHistorySummaries]);

  const copyL4Brief = useCallback(() => {
    const today = todayValue;
    const heroLabel = heroSignal?.label || "—";
    const phase = l0Cycle === "expansion" ? "扩张期"
      : l0Cycle === "contraction" ? "收缩期"
        : "过渡期";
    const l2c = l2Signal?.color || "—";
    const l3c = l3Signal?.color || "—";

    const watchLines = visibleWatchEntries.map(({ row, idx }) => {
      const status = row.status || "watching";
      const entry = parseFloat(row.entryPrice);
      const current = watchAutoData[idx]?.momentum?.price;
      let pnlStr = "";
      if (isFinite(entry) && entry > 0 && current != null) {
        const pnl = ((current - entry) / entry) * 100;
        pnlStr = ` P&L ${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}%`;
      }
      return `  · ${row.token} [${status}]${row.entryPrice ? ` 入场 ${row.entryPrice}` : ""}${pnlStr}`;
    });

    const todayDecisions = alphaDecisions.filter((d) => d.timestamp.startsWith(today));
    const decisionLines = todayDecisions.map((d) => {
      const t = new Date(d.timestamp);
      const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      return `  · ${d.token} → ${d.decision} @ ${time}`;
    });

    const lines = [
      `📅 ${today} LiquidityOS L4 简报`,
      `${"─".repeat(36)}`,
      `宏观：${heroLabel} | ${phase} | L2 ${l2c} | L3 ${l3c}`,
      "",
      `观测站（${visibleWatchEntries.length}）：`,
      ...(watchLines.length ? watchLines : ["  （暂无标的）"]),
      "",
      `Alpha 决策（今日 ${todayDecisions.length} 条）：`,
      ...(decisionLines.length ? decisionLines : ["  （今日暂无决策）"]),
      `${"─".repeat(36)}`,
    ];

    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    doSave();
  }, [todayValue, heroSignal, l0Cycle, l2Signal, l3Signal, visibleWatchEntries, watchAutoData, alphaDecisions, doSave]);

  useEffect(() => {
    if (isHydrating.current) return;
    if (!pendingSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState({ tone: "info", label: "等待保存", detail: `${selectedDate} 检测到输入变化，800ms 后自动保存` });
    saveTimer.current = setTimeout(doSave, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedDate, macro, macroTime, macroSource, l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards, alphaDecisions, doSave]);

  if (currentPage === "btc-detail") {
    return <BTCDetailPage onBack={() => setCurrentPage("main")} />;
  }
  if (currentPage === "fg") {
    return <FGDetailPage onBack={() => setCurrentPage("main")} />;
  }
  if (currentPage === "l1") {
    return <L1DetailPage onBack={() => setCurrentPage("main")} />;
  }
  if (currentPage === "l2") {
    return <L2DetailPage onBack={() => setCurrentPage("main")} />;
  }
  if (currentPage === "l3") {
    return <L3DetailPage onBack={() => setCurrentPage("main")} memeTopData={macro?.meme_top} />;
  }

  return (
    <div className="lo-app" style={{ backgroundColor: C.bg, color: C.label }}>
      <div
        data-testid="signal-wash"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "70vh",
          background: `linear-gradient(180deg, ${signalWashColor} 0%, transparent 100%)`,
          transition: "background 1.2s ease",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
      <div className="lo-topbar">
        <div className="lo-topbar-inner">
          <div>
            <div style={{ fontSize: "var(--lo-text-secondary-value)", fontWeight: 700, letterSpacing: -0.5, color: isDarkTheme ? "var(--lo-text-primary)" : "#0F172A" }}>LiquidityOS</div>
            <div style={{ fontSize: "var(--lo-text-meta)", color: isDarkTheme ? "var(--lo-text-secondary)" : C.labelTer, marginTop: 4 }}>
              {macroTime ? `当前数据：${macroSource} · ${macroTime}` : `当前工作区：${today}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="lo-badge" style={topbarBadgeStyle}>数据状态 · {dataFreshLabel}</div>
            <button type="button" onClick={toggleTheme} style={themeToggleStyle}>
              {isDarkTheme ? "☀️ 浅色" : "🌙 暗色"}
            </button>
            <button
              className="lo-btn lo-btn-text"
              onClick={() => setShowSystemStatus((v) => !v)}
              style={{ color: C.blue }}
            >
              <span className="lo-btn-token"><PatrickMark color={C.blue} size={11} /></span>
              <span>{showSystemStatus ? "收起诊断" : "展开诊断"}</span>
            </button>
          </div>
        </div>
      </div>

      <LayerGateBar
        l0Cycle={l0Cycle}
        heroSignal={heroSignal}
        l2Signal={l2Signal}
        l3Signal={l3Signal}
        l4Signal={l4Signal}
        onLayerClick={() => {}}
      />

      <div className="lo-shell" style={{ padding: "24px 24px 56px" }}>
        <section
          id="section-l0"
          style={{
            padding: isCompactViewport ? "32px 20px 16px" : "40px 24px 16px",
            position: "relative",
            zIndex: 1,
            animation: "rise 0.45s backwards",
            animationDelay: "0s",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              flexWrap: isCompactViewport ? "wrap" : "nowrap",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: signalDotColor,
                  boxShadow: `0 0 10px ${signalDotColor}`,
                  flexShrink: 0,
                }}
              />
              <span
                className="lo-command-core-title"
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  letterSpacing: -2,
                  color: heroTextColor,
                  lineHeight: 1,
                }}
              >
                {heroSignal.label}
              </span>
            </div>

            <div style={{ textAlign: "right", marginLeft: "auto" }}>
              <div style={{ fontSize: 11, color: isDarkTheme ? "rgba(255,255,255,0.55)" : C.labelTer, marginBottom: 2 }}>HERO 分数</div>
              <div
                className="lo-command-score-value"
                style={{
                  ...numTextStyle,
                  fontSize: 28,
                  fontWeight: 600,
                  color: isDarkTheme ? "rgba(255,255,255,0.68)" : C.labelSec,
                  letterSpacing: -1,
                }}
              >
                {heroSignal.score == null ? "—" : heroSignal.score.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="lo-command-core-desc" style={{ fontSize: 14, color: C.labelSec, marginBottom: 20 }}>
            {heroSignal.desc}
          </div>

          <div className="lo-command-climate-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div className="lo-command-climate-pill" style={heroChipStyle}>
              <span
                aria-hidden="true"
                className="lo-command-climate-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: l0Info.color,
                  boxShadow: `0 0 8px ${l0Info.color}`,
                  flexShrink: 0,
                }}
              />
              <span>L0-A 环境 · {l0Info.label}</span>
            </div>
            <div className="lo-command-climate-note" style={heroChipStyle}>{l0Info.hint}</div>
            <div className="lo-command-climate-note" style={heroChipStyle}>有效信号 {heroSignal.count}/4</div>
          </div>

          <div className="lo-command-cycle-switch" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(cycleMeta).map(([key, meta]) => {
              const active = l0Cycle === key;
              const activeTextColor = key === "transition" ? "#000" : "#fff";
              return (
                <button
                  key={key}
                  onClick={() => { markDirty(); setL0Cycle(key); }}
                  className={`lo-command-cycle-pill${active ? " active" : ""}`}
                  style={{
                    border: active ? `1.5px solid ${meta.color}` : `1.5px solid ${C.sep}`,
                    background: active ? meta.color : "transparent",
                    color: active ? activeTextColor : C.labelTer,
                    borderRadius: 20,
                    padding: "7px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="lo-command-core-note" style={{ fontSize: 11, color: C.labelQ, marginTop: 8 }}>
            L0-A 只作为主控环境，不再单独占卡；执行前再用 BTC 主控依据做最后确认。
          </div>
        </section>

        <div
          className="lo-command-signal-strip"
          style={{
            margin: "8px 24px 16px",
            padding: "14px 24px",
            background: signalStripSurfaceStyle.background,
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            borderRadius: 16,
            border: signalStripSurfaceStyle.border,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            display: "grid",
            gridTemplateColumns: heroSignalStripColumns,
            animation: "rise 0.45s backwards",
            animationDelay: "0.08s",
          }}
        >
          {heroSignalStripItems.map(([s, l], idx) => (
            <div
              key={l}
              className="lo-command-signal-item"
              style={{
                borderRight: !isCompactViewport && idx !== 3 ? `0.5px solid ${C.sep}` : "none",
                borderBottom: isCompactViewport && idx < 2 ? `0.5px solid ${C.sep}` : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: isCompactViewport ? "16px 6px" : "18px 6px",
              }}
            >
              <div className="lo-command-signal-emoji">
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: getSignalColorVar(s?.color || "none"),
                    boxShadow: getHeroLampGlow(s?.color || "none"),
                  }}
                />
              </div>
              <div className="lo-command-signal-label" style={{ color: signalStripSurfaceStyle.labelColor }}>{l}</div>
            </div>
          ))}
        </div>

        <section
          id="section-btc"
          className="lo-command-btc-panel lo-panel lo-nav-card"
          style={{ padding: sectionCardPadding, marginBottom: 24, marginTop: 0, animation: "rise 0.45s backwards", animationDelay: "0.16s" }}
          onMouseEnter={handleNavCardMouseEnter}
          onMouseLeave={handleNavCardMouseLeave}
        >
          <div className="lo-command-btc-head">
            <div>
              <div className="lo-section-kicker">BTC Anchor</div>
              <div className="lo-command-btc-title">L0-B · BTC 周期位置</div>
              <div className="lo-command-btc-note">继续保留 200MA 比率与 MVRV Z-Score，作为 Hero 之后的主控确认依据。</div>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage("btc-detail")}
              style={detailEntryButtonStyle}
            >
              详细数据 →
            </button>
          </div>
          <InsightMetricCard
            variant="main"
            title="L0-B · BTC"
            question="BTC 大位置怎么走？"
            statusKey={btcStatusKey}
            accentColor={C.blue}
            primaryLabel="BTC 现价"
            primaryValue={<span style={numTextStyle}>{macro?.btc?.price ? fmtUsdWhole(macro.btc.price) : "—"}</span>}
            changeLabel="200MA 比率"
            changeValue={<span style={numTextStyle}>{fmtPct(btcPositionPct)}</span>}
            changeTone={btcPositionPct != null ? (btcPositionPct >= 0 ? C.green : C.red) : C.labelTer}
            summary={btcPanelSummary}
            points={trendSeries.btc}
            emptyTrendCopy="历史快照不足，先按现价与 200MA 判断"
            emptyTrendHint="趋势区先弱化，不影响主控判断"
            trendDeltaLabel="区间价格变化"
            trendLatestLabel="最新快照"
            trendFormatter={fmtUsdWhole}
            metaItems={[
              { label: "200MA", value: macro?.btc?.ma_200 ? fmtUsdWhole(macro.btc.ma_200) : "—" },
              { label: "MVRV Z-Score", value: mvrvManual.score || "—", color: C.blue },
            ]}
          />
          <div className="lo-mvrv-manual">
            <div className="lo-mvrv-head">
              <div>
                <div className="lo-field-label lo-field-label-tight">MVRV 手动位</div>
                <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, lineHeight: 1.55 }}>保留手动输入，不接自动源，也跟随日快照保存。</div>
              </div>
              <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer }}>当前值 {mvrvManual.score || "—"}</div>
            </div>
            <div className="lo-mvrv-grid">
              <div>
                <div className="lo-field-label">Z-Score</div>
                <input value={mvrvManual.score} onChange={(e) => updMvrvManual("score", e.target.value)} placeholder="2.35" style={{ ...miniNumInput, color: C.blue, textAlign: "left" }} className="lo-input lo-input-left" inputMode="decimal" />
              </div>
              <div>
                <div className="lo-field-label">日期</div>
                <input value={mvrvManual.date} onChange={(e) => updMvrvManual("date", e.target.value)} placeholder="2026-03-12" style={miniInput} className="lo-input lo-input-left" />
              </div>
              <div>
                <div className="lo-field-label">引用</div>
                <input value={mvrvManual.source} onChange={(e) => updMvrvManual("source", e.target.value)} placeholder="LookIntoBitcoin" style={miniInput} className="lo-input lo-input-left" />
              </div>
            </div>
          </div>
          <div className="lo-command-footnote">
            BTC 数据 {macro?.btc?.source || "—"} · 更新时间 {macro?.btc?.updated_at ? formatTimeLabel(macro.btc.updated_at) : macroTime || "—"} · MVRV 引用 {mvrvManual.source || "—"} / {mvrvManual.date || "未填"}
          </div>
        </section>

        <section id="section-market" className="lo-panel lo-market-stage" style={{ padding: sectionCardPadding, marginBottom: 24, animation: "rise 0.45s backwards", animationDelay: "0.24s" }}>
          <div className="lo-section-head">
            <div>
              <div className="lo-section-kicker">Market Context</div>
              <div className="lo-section-title">先扫环境，再进工作台</div>
              <div className="lo-section-note">先用四张快扫卡判断今天的环境方向，只有需要维护口径或手动覆盖时，再进入下方的数据维护区。</div>
            </div>
            <div className="lo-badge-row">
              <div className="lo-badge">先扫判断</div>
              <div className="lo-badge">再做录入</div>
              <div className="lo-badge">最后进入执行</div>
            </div>
          </div>

          <div className="lo-context-summary-grid" style={decisionGridStyle}>
            <div
              id="section-l1"
              className="lo-panel-soft lo-decision-compact lo-nav-card"
              style={heroDecisionCardStyle}
              onMouseEnter={handleNavCardMouseEnter}
              onMouseLeave={handleNavCardMouseLeave}
            >
              <InsightMetricCard
                title="L1 · 净流动性"
                question="净流动性在扩张还是收缩？"
                statusKey={l1StatusKey}
                headAction={(
                  <button
                    type="button"
                    onClick={() => setCurrentPage("l1")}
                    style={detailEntryButtonStyle}
                  >
                    详细数据 →
                  </button>
                )}
                accentColor={C.blue}
                primaryLabel="当前 GNL"
                primaryValue={<span style={numTextStyle}>{l1CurrentValue == null ? "—" : `${l1CurrentValue.toFixed(3)}T`}</span>}
                changeLabel="自动口径"
                changeValue={hasFredAuto ? `${macro.fred.gnl.value_t}T` : "缺失，使用手动位"}
                changeTone={hasFredAuto ? C.blue : C.orange}
                summary={l1Summary}
                points={trendSeries.l1}
                emptyTrendCopy="历史快照不足，先按当前 GNL 观察"
                emptyTrendHint="先看左侧 GNL 水平，再等趋势补齐"
                trendDeltaLabel="区间 GNL 变化"
                trendLatestLabel="最新快照"
                trendFormatter={(value) => value == null || Number.isNaN(Number(value)) ? "—" : `${Number(value).toFixed(3)}T`}
                metaItems={[
                  { label: "来源", value: hasFredAuto ? fredSource : "手动输入" },
                  { label: "数据日期", value: hasFredAuto ? (fredDate || "—") : (l1Manual.date || "未填") },
                  { label: "手动 GNL", value: manualGnl == null ? "—" : `${manualGnl.toFixed(3)}T`, color: C.blue },
                ]}
                quickReadChips={l1Chips}
                actionFramework={{
                  trigger: "GNL 连续 ≥3 周扩张，且绝对值 >5.5T",
                  invalidate: "GNL 单周回落 >0.15T，或 RRP 快速膨胀抽走流动性",
                  watchLevel: "每周四 FRED 数据更新窗口（重点核查 TGA 余额方向）",
                }}
                detailExpanded={l1Expanded}
                onToggleDetail={() => setL1Expanded((prev) => !prev)}
                expandLabel="展开详细"
                collapseLabel="收起详细"
              />
              {l1Expanded && (
                <div className="lo-context-card-foot lo-context-card-foot-action">
                  <span>需要维护口径时，再进入按需维护位。</span>
                  <button type="button" className="lo-context-inline-toggle" onClick={() => setShowL1Dock((v) => !v)}>
                    {showL1Dock ? "收起维护区" : "展开维护区"}
                  </button>
                </div>
              )}
            </div>

            {macro && (
              <>
                <div id="section-l2" className="lo-panel-soft lo-decision-compact" style={heroDecisionCardStyle}>
                  <InsightMetricCard
                    title="L2 · 稳定币弹药"
                    question="场内弹药在补充还是流失？"
                    statusKey={l2StatusKey}
                    headAction={(
                      <button
                        type="button"
                        onClick={() => setCurrentPage("l2")}
                        style={detailEntryButtonStyle}
                      >
                        详细数据 →
                      </button>
                    )}
                    accentColor={C.teal}
                    primaryLabel="稳定币总市值"
                    primaryValue={<span style={numTextStyle}>{fmtB(macro.stablecoins?.total)}</span>}
                    changeLabel="7 日净变化"
                    changeValue={macro.stablecoins?.change_7d != null ? fmtSignedFromRaw(macro.stablecoins.change_7d) : "—"}
                    changeArrow={<TrendArrow value={macro.stablecoins?.change_7d_pct} threshold={0.5} />}
                    changeTone={macro.stablecoins?.change_7d != null ? (macro.stablecoins.change_7d >= 0 ? C.green : C.red) : C.labelTer}
                    summary={l2Summary}
                    points={trendSeries.l2}
                    emptyTrendCopy="历史快照不足，先按总量与 7 日变化判断"
                    emptyTrendHint="先用左侧净变化做判断，趋势区暂弱化"
                    trendDeltaLabel="区间总量变化"
                    trendLatestLabel="最新快照"
                    trendFormatter={fmtB}
                    metaItems={[
                      { label: "7 日占比", value: fmtPct(macro.stablecoins?.change_7d_pct) },
                      { label: "Solana TVL", value: fmtB(macro.tvl?.solana) },
                      { label: "BSC TVL", value: fmtB(macro.tvl?.bsc) },
                    ]}
                    quickReadChips={l2Chips}
                    actionFramework={{
                      trigger: "稳定币总量净增 & Solana 链净流入同步转正，连续 2 周以上",
                      invalidate: "稳定币净流出连续 2 周，或 Solana 净流入单周转负超 -0.5B",
                      watchLevel: "Solana 链周净流入方向，以及稳定币总量是否守住当前关口",
                    }}
                  />
                  <div className="lo-context-card-foot">L2 评分 {l2Signal.score.toFixed(2)} · {l2Signal.reason}</div>
                </div>

                <div id="section-l3" className="lo-panel-soft lo-decision-compact" style={heroDecisionCardStyle}>
                  <InsightMetricCard
                    title="L3 · Meme 板块"
                    question="Meme 风险偏好在升温还是降温？"
                    statusKey={l3StatusKey}
                    headAction={(
                      <button
                        type="button"
                        onClick={() => setCurrentPage("l3")}
                        style={detailEntryButtonStyle}
                      >
                        详细数据 →
                      </button>
                    )}
                    accentColor={C.orange}
                    primaryLabel="Meme 总市值"
                    primaryValue={<span style={numTextStyle}>{macro.meme?.mcap ? fmtB(macro.meme.mcap) : "—"}</span>}
                    changeLabel="24h 变化"
                    changeValue={fmtPct(macro.meme?.mcap_change_24h)}
                    changeArrow={<TrendArrow value={macro.meme?.mcap_change_24h} threshold={1} />}
                    changeTone={macro.meme?.mcap_change_24h != null ? (macro.meme.mcap_change_24h >= 0 ? C.green : C.red) : C.labelTer}
                    summary={l3Summary}
                    points={trendSeries.l3}
                    emptyTrendCopy="历史快照不足，先按总市值与 24h 变化判断"
                    emptyTrendHint="先看左侧热度信号，趋势区后补"
                    trendDeltaLabel="区间板块变化"
                    trendLatestLabel="最新快照"
                    trendFormatter={fmtB}
                    metaItems={[
                      { label: "Solana DEX", value: fmtB(macro.dex_volume?.solana?.total_24h) },
                      { label: "Base DEX", value: fmtB(macro.dex_volume?.base?.total_24h) },
                      { label: "BSC DEX", value: fmtB(macro.dex_volume?.bsc?.total_24h) },
                    ]}
                    quickReadChips={l3Chips}
                    actionFramework={{
                      trigger: "Meme 市值 24h ≥+3% 且 Solana DEX 量同步放大 ≥10%",
                      invalidate: "DEX 成交量连续 2 日收缩 >15%，或 Meme 市值跌破近期整数关口",
                      watchLevel: "Meme 市值当前区间支撑位，及下一轮 Solana DEX 日量能否超前高",
                    }}
                  />
                  <div className="lo-context-card-foot">L3 评分 {l3Signal.score.toFixed(2)} · {l3Signal.reason}</div>
                </div>
              </>
            )}

            <div
              className="lo-panel-soft lo-decision-compact lo-fg-card-compact lo-nav-card"
              style={{
                ...heroDecisionCardStyle,
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                background: fgCardBackground,
                transition: "background 0.8s ease, border-color 0.4s ease",
              }}
              onMouseEnter={handleNavCardMouseEnter}
              onMouseLeave={handleNavCardMouseLeave}
            >
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...secLabel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: 0 }}>
                  <span>情绪补充 · F&G</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("fg")}
                    style={detailEntryButtonStyle}
                  >
                    详细数据 →
                  </button>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "6px 10px", borderRadius: 999, background: C.fill, border: `1px solid ${C.sep}` }}>
                  <SignalDot color={fgSignal.color || "none"} size={8} />
                  <span style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: getFgToneColor(fgGaugeValue) }}>{fgTagLabel}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <FGGauge value={fgGaugeValue} size={160} />
                </div>
                <div className="lo-fg-card-note">只做情绪辅助，不替代 L1-L3 判断。</div>
                <input
                  value={fgVal}
                  onChange={(e) => { markDirty(); setFgVal(e.target.value.replace(/\D/, "")); }}
                  maxLength={3}
                  placeholder="输入今日 F&G"
                  className="lo-fg-card-input"
                  style={{
                    ...numTextStyle,
                    width: "100%",
                    textAlign: "left",
                    fontSize: "var(--lo-text-meta)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <div className="lo-context-card-foot">F&G 评分 {fgSignal.score.toFixed(2)} · {fgSignal.reason}</div>
              </div>

              <div style={{ flex: "0 0 140px", width: 140, minHeight: 1, display: "grid", gap: 10, alignContent: "start" }}>
                {fgHistoryCompareItems.length > 0 ? (
                  fgHistoryCompareItems.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "12px auto 1fr",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 12,
                        background: C.fill,
                        border: `1px solid ${C.sep}`,
                      }}
                    >
                      <SignalDot color={getFgToneKey(item.value)} size={8} />
                      <span style={{ ...numTextStyle, fontSize: "var(--lo-text-secondary-value)", fontWeight: 700, color: getFgToneColor(item.value) }}>
                        {Math.round(item.value)}
                      </span>
                      <span style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ, justifySelf: "end" }}>{item.label}</span>
                    </div>
                  ))
                ) : fgHistoryPoints.length >= 2 ? (
                  <TrendAssist
                    points={fgHistoryPoints}
                    statusKey={fgSignal.color === "green" ? "positive" : fgSignal.color === "red" ? "negative" : "neutral"}
                    ariaLabel="F&G 历史趋势"
                    emptyLabel=""
                    emptyHint=""
                    deltaLabel="区间变化"
                    latestLabel="最新值"
                    valueFormatter={(v) => v == null ? "—" : String(Math.round(v))}
                  />
                ) : (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 10,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                      textAlign: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ }}>每次保存日快照后</div>
                    <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ }}>趋势会逐渐积累</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {l1Expanded && showL1Dock && (
          <div className="lo-context-dock">
            <div className="lo-context-dock-head">
              <div>
                <div className="lo-context-dock-kicker">Manual Dock</div>
                <div className="lo-context-dock-title">L1 数据维护区</div>
                <div className="lo-context-dock-copy">这里不是第一眼快扫区，而是需要维护 FRED 口径、手动覆盖或补录日期时才进入的工作位。</div>
              </div>
              <div className="lo-context-dock-status">{hasFredAuto ? `${fredSource} · ${fredDate || "—"}` : "当前使用手动位 / 待刷新"}</div>
            </div>

            <div className="lo-context-dock-grid">
              <div className="lo-context-dock-panel">
                <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, marginBottom: 10, padding: "8px 10px", background: C.fill, borderRadius: 10, lineHeight: 1.55 }}>净流动性由 Fed、TGA、RRP 共同决定，反映市场可用美元背景。自动数据优先来自 Worker 聚合；缺失时仍可手动录入并自动计算 GNL。</div>
                {hasFredAuto ? (
                  <>
                    <DataRow label="GNL" value={macro.fred.gnl.value_t + "T"} color={C.blue} />
                    <DataRow label="Fed" value={macro.fred.fed?.value ? (macro.fred.fed.value / 1e6).toFixed(3) + "T" : "—"} sub={macro.fred.fed?.date} />
                    <DataRow label="TGA" value={macro.fred.tga?.value ? (macro.fred.tga.value / 1e6).toFixed(3) + "T" : "—"} />
                    <DataRow label="RRP" value={macro.fred.rrp?.value ? (macro.fred.rrp.value / 1e3).toFixed(3) + "T" : "—"} />
                    <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>来源：{fredSource} · 数据日期：{fredDate || "—"} · 更新时间：{fredUpdatedAt ? formatTimeLabel(fredUpdatedAt) : "—"}</div>
                  </>
                ) : (
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>{macro ? "FRED Key 未设置，当前使用手动录入。单位统一按 T 输入，例如 `6.600`。" : "尚未刷新宏观数据，可先手动录入 L1。单位统一按 T 输入，例如 `6.600`。"}</div>
                )}
              </div>

              <div className="lo-context-dock-panel">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
                  <ScanInput
                    label="Fed"
                    unit="T"
                    value={l1Manual.fed}
                    onChange={(e) => updL1Manual("fed", e.target.value)}
                    placeholder="6.600"
                  />
                  <ScanInput
                    label="TGA"
                    unit="T"
                    value={l1Manual.tga}
                    onChange={(e) => updL1Manual("tga", e.target.value)}
                    placeholder="0.700"
                  />
                  <ScanInput
                    label="RRP"
                    unit="T"
                    value={l1Manual.rrp}
                    onChange={(e) => updL1Manual("rrp", e.target.value)}
                    placeholder="0.300"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: "var(--lo-text-meta)", fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>数据日期</div>
                    <input value={l1Manual.date} onChange={(e) => updL1Manual("date", e.target.value)} placeholder="2026-03-09" style={{ ...miniInput, textAlign: "left" }} />
                  </div>
                  <div className="lo-context-dock-highlight">
                    <GNLReadout value={manualGnl} />
                  </div>
                </div>
                <div className="lo-context-dock-values">
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer }}>Fed：{fmtTrillionsFromInput(l1Manual.fed)}</div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer }}>TGA：{fmtTrillionsFromInput(l1Manual.tga)}</div>
                  <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer }}>RRP：{fmtTrillionsFromInput(l1Manual.rrp)}</div>
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        <LayerTransition message={layerTransitionMessage} isDark={isDarkTheme} style={{ animation: "rise 0.45s backwards", animationDelay: "0.32s" }} />

        <section id="section-l4" className="lo-panel" style={{ padding: sectionCardPadding, marginBottom: 24, opacity: l4GateReady ? 1 : 0.72, transition: "opacity 180ms ease", animation: "rise 0.45s backwards", animationDelay: "0.40s" }}>
          <div className="lo-section-head">
            <div>
              <div className="lo-section-kicker">L4 Workbench</div>
              <div className="lo-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <SignalDot color={l4Signal?.color || "none"} size={10} />
                <span>执行工作台</span>
              </div>
              <div className="lo-section-note">进入工作台后先处理存量观测站，再在 Alpha Scanner 看新增候选，Top 50 只作为旁侧市场参考。</div>
              {!l4GateReady && (
                <div style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "var(--lo-bg-inset)",
                  border: "1px solid var(--lo-border)",
                  fontSize: "var(--lo-text-meta)",
                  fontWeight: 700,
                  color: "var(--lo-text-secondary)",
                }}>
                  <SignalDot color="none" size={8} />
                  <span>先确认 L0–L2，再进入 L4 选品</span>
                </div>
              )}
            </div>
          </div>

          <MemeRadar
            items={memeRadarItems}
            loading={memeRadarLoading}
            error={memeRadarError}
            updatedAt={memeRadarUpdatedAt}
            onAddToAlpha={addToAlpha}
            onAddToWatch={addToWatch}
            alphaHasSlot={alphaHasSlot}
            watchHasSlot={watchHasSlot}
            heroSignal={heroSignal}
            l0Cycle={l0Cycle}
            l2Signal={l2Signal}
            l3Signal={l3Signal}
          />

          <div className="lo-l4-grid" style={{ gap: 24 }}>
            <div className="lo-workbench-panel lo-panel-soft lo-l4-main-panel lo-workbench-panel-main" style={{ padding: sectionCardPadding }}>
              <div className="lo-workbench-subhead">
                <div>
                  <div className="lo-workbench-role-pill main">主工作区</div>
                  <div className="lo-workbench-main-title">存量观测站</div>
                  <div className="lo-workbench-main-copy">把今天最可能执行的标的集中在这里。先看状态、24h 与 V/Liq，再回看筹码、池深和备注，让盯盘和执行判断保持连续。</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton
                    kind={watchAutoRefreshEnabled ? "primary" : "secondary"}
                    onClick={() => setWatchAutoRefreshEnabled((prev) => !prev)}
                    style={{ padding: "10px 14px" }}
                  >
                    {watchAutoRefreshEnabled ? "自动刷新 ON" : "自动刷新 OFF"}
                  </ActionButton>
                  <ActionButton kind="secondary" onClick={addWatchRow} disabled={watchlist.length >= 10} style={{ padding: "10px 14px" }}>
                    添加行
                  </ActionButton>
                </div>
              </div>

              <div className="lo-workbench-lead lo-workbench-lead-main">
                <div className="lo-workbench-stat-grid">
                  <div className="lo-workbench-stat-card">
                    <div className="lo-workbench-stat-label">主观标的</div>
                    <div className="lo-workbench-stat-value">{watchActiveCount}</div>
                  </div>
                  <div className="lo-workbench-stat-card">
                    <div className="lo-workbench-stat-label">准备执行</div>
                    <div className="lo-workbench-stat-value">{watchStatusCounts.ready}</div>
                  </div>
                  <div className="lo-workbench-stat-card">
                    <div className="lo-workbench-stat-label">已有仓位</div>
                    <div className="lo-workbench-stat-value">{watchStatusCounts.position}</div>
                  </div>
                </div>
                <div className="lo-workbench-lead-note">默认先读 Token / 状态 / 24h / V/Liq，次层再看 7d、1m、筹码与池深，减少无效视线跳转。</div>
              </div>

              <div className="lo-panel lo-workbench-table-shell" style={{ padding: sectionCardPadding, boxShadow: "none", borderRadius: 18 }}>
                <div className="lo-watch-head-grid" style={{ gridTemplateColumns: isCompactViewport ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1.25fr) minmax(0, 1.55fr) minmax(110px, 0.7fr) minmax(0, 1.1fr)" }}>
                  {["Token", "状态 pill", "V/Liq", "快判"].map((h) => <div key={h} style={{ fontSize: "var(--lo-text-meta)", fontWeight: 700, color: C.labelQ, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>)}
                </div>
                {visibleWatchEntries.length === 0 ? (
                  <div
                    style={{
                      border: `1px dashed ${C.sep}`,
                      borderRadius: 12,
                      padding: 32,
                      textAlign: "center",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 24, color: C.blue, lineHeight: 1 }}>+</div>
                    <div style={{ fontSize: "var(--lo-text-label)", color: C.labelSec, fontWeight: 600 }}>添加第一个观察标的</div>
                    <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ }}>点击下方“添加行”开始跟踪</div>
                    {firstDraftWatchIdx !== -1 && (
                      <div style={{ width: "min(100%, 280px)", margin: "6px auto 0" }}>
                        <input
                          value={watchlist[firstDraftWatchIdx]?.token || ""}
                          onChange={(e) => updWatch(firstDraftWatchIdx, "token", e.target.value)}
                          placeholder="#1"
                          style={{ ...miniInput, fontWeight: 700, textAlign: "left" }}
                          className="lo-input lo-input-left"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  visibleWatchEntries.map(({ row, idx }) => (
                    <WatchlistRow
                      key={idx}
                      row={row}
                      idx={idx}
                      onChange={updWatch}
                      onRemove={removeWatchRow}
                      canRemove={watchlist.length > 0}
                      compactViewport={isCompactViewport}
                      autoData={watchAutoData[idx]}
                      autoLoading={!!watchAutoLoading[idx]}
                      onFetchAuto={loadWatchAuto}
                      id={`watch-row-${idx}`}
                      signalGreen={l4SignalGreen}
                    />
                  ))
                )}
                <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ, marginTop: 10, lineHeight: 1.55 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    V/Liq ≥ 0.5
                    <SignalDot color="green" size={8} />
                    活跃
                  </span>
                  <span> · </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    0.2-0.5
                    <SignalDot color="yellow" size={8} />
                    一般
                  </span>
                  <span> · </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    &lt;0.2
                    <SignalDot color="red" size={8} />
                    低迷
                  </span>
                  <span>。默认先扫 Token、状态、V/Liq 与快判，其余字段按需展开。</span>
                </div>
              </div>
            </div>

            <div className="lo-workbench-panel lo-panel-soft lo-l4-secondary-panel lo-workbench-panel-inc" style={{ padding: sectionCardPadding }}>
              <div className="lo-workbench-subhead">
                <div>
                  <div className="lo-workbench-role-pill inc">辅工作区</div>
                  <div className="lo-workbench-side-title">Alpha Scanner</div>
                  <div className="lo-workbench-side-copy">把新增候选收进第二工作区，优先完成初筛、研究和手动判断。自动值只提供支撑，不覆盖结论。</div>
                </div>
              </div>
              <div className="lo-alpha-zone-note lo-alpha-zone-note-strong">
                <span>候选槽位 {alphaFilledCount} / {alphaCards.length}</span>
                <span>先看候选质量，再决定是否回主区跟踪</span>
              </div>
              {alphaCards.map((card, idx) => (
                <AlphaCard
                  key={`alpha-${idx + 1}`}
                  card={card}
                  idx={idx}
                  onChange={updAlpha}
                  autoData={alphaAutoData[idx]}
                  autoLoading={!!alphaAutoLoading[idx]}
                  onFetchAuto={loadAlphaAuto}
                  onAddToWatch={addToWatchFromAlpha}
                  onClear={clearAlphaCard}
                  watchHasSlot={watchHasSlot}
                  expanded={expandedAlphaCards.has(`alpha-${idx + 1}`)}
                  onToggle={() => toggleAlphaCard(`alpha-${idx + 1}`)}
                  id={`alpha-card-${idx}`}
                  onDecision={recordAlphaDecision}
                />
              ))}
              {l4Signal && <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelTer, marginTop: 2, marginBottom: 8, lineHeight: 1.5, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>L4 分数 {l4Signal.score.toFixed(2)} = 基线 0.50 + 存量 {l4Signal.stockScore.toFixed(2)} + 增量 {l4Signal.alphaAdjustment >= 0 ? "+" : ""}{l4Signal.alphaAdjustment.toFixed(2)}。上涨占比 {Math.round(l4Signal.bullRatio * 100)}% · V/Liq 活跃占比 {Math.round(l4Signal.vmcActive * 100)}% · goodAlpha {l4Signal.goodAlpha} · badAlpha {l4Signal.badAlpha}</div>}
              <div style={{ fontSize: "var(--lo-text-meta)", color: C.labelQ, marginTop: 4, lineHeight: 1.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SignalDot color="green" size={8} />
                  <span>进攻：存量普涨 + V/Liq 高 + 新币筹码分布&承接稳</span>
                </span>
                <br />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SignalDot color="yellow" size={8} />
                  <span>观望：头尾背离 或 新币控盘严重</span>
                </span>
                <br />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SignalDot color="red" size={8} />
                  <span>防御：存量全线回撤 + 新币池浅&动量衰减</span>
                </span>
              </div>
            </div>

          </div>
          <div style={{
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(120,120,128,0.05)",
            border: "1px solid var(--lo-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: "var(--lo-text-label)", fontWeight: 700, color: "var(--lo-text-primary)", marginBottom: 2 }}>
                L4 每日简报
              </div>
              <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)" }}>
                包含宏观状态、观测标的、今日 Alpha 决策；一键复制后可粘贴记录。
              </div>
            </div>
            <button
              type="button"
              onClick={copyL4Brief}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1.5px solid var(--lo-brand)",
                background: "transparent",
                color: "var(--lo-brand)",
                fontSize: "var(--lo-text-meta)",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "-apple-system,sans-serif",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              复制简报
            </button>
          </div>
        </section>

        <section id="section-review" className="lo-record-stage" style={{ marginBottom: 24, padding: sectionCardPadding, animation: "rise 0.45s backwards", animationDelay: "0.48s" }}>
          <div className="lo-record-stage-head">
            <div>
              <div className="lo-section-kicker">Review & Diagnostics</div>
              <div className="lo-section-title">复盘与诊断层</div>
              <div className="lo-section-note">这一层只负责回看过去的判断并确认系统运行状态。摘要与笔记已上浮成全局记录工具，不再埋在页面最后。</div>
            </div>
            <div className="lo-record-stage-key">Workspace Key · {keyForDate(selectedDate)}</div>
          </div>

          <div className="lo-record-grid lo-record-shell" style={{ gap: 24 }}>
            <div className="lo-record-panel lo-record-panel-history" style={{ gridColumn: "span 9", padding: sectionCardPadding }}>
              <div className="lo-record-panel-head">
                <div>
                  <div className="lo-record-panel-kicker">Archive</div>
                  <div className="lo-record-panel-title">历史回看</div>
                  <div className="lo-record-panel-note">把日快照当成复盘档案来读。先切时间，再看当天 Hero、情绪和 L4 结果，最后回看留下的笔记痕迹。</div>
                </div>
                <div className="lo-record-history-switch">
                  <button onClick={() => setSelectedDate(todayValue)} className={`lo-record-switch-btn${selectedDate === todayValue ? " active" : ""}`}>今天</button>
                  <button onClick={() => setSelectedDate(yesterdayValue)} className={`lo-record-switch-btn${selectedDate === yesterdayValue ? " active" : ""}`}>昨天</button>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...miniInput, textAlign: "left", padding: "8px 10px" }} className="lo-record-date-input" />
                </div>
              </div>

              <div className="lo-record-history-banner">
                <div className="lo-record-history-banner-title">{isTodayView ? "当前是今日工作区" : "当前在历史快照视图"}</div>
                <div className="lo-record-history-banner-copy">{isTodayView ? "今天可以继续更新数据、记录判断并写入快照。" : "历史日期只读取本地已保存记录，用来复盘，不再请求网络。"}</div>
              </div>

              <div className="lo-record-summary-grid">
                {[["记录", filteredHistory.length], ["宏观", macroDays], ["进攻日", attackDays], ["Hero 均值", avgHeroScore == null ? "—" : avgHeroScore.toFixed(2)], ["F&G 均值", avgFg == null ? "—" : avgFg.toFixed(0)], ["当前笔记", selectedHistorySummary?.note ? "已记录" : "未留痕"]].map(([label, value]) => (
                  <div key={label} className="lo-record-summary-card">
                    <div className="lo-record-summary-label">{label}</div>
                    <div className="lo-record-summary-value">{value}</div>
                  </div>
                ))}
              </div>

              <div className="lo-record-filter-row">
                {[
                  { key: "all", label: "全部记录" },
                  { key: "macro", label: "有宏观快照" },
                  { key: "notes", label: "有笔记" },
                  { key: "attack", label: "进攻日" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setHistoryFilter(opt.key)}
                    className={`lo-record-filter-btn${historyFilter === opt.key ? " active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {historySummaries.length === 0 ? (
                <div className="lo-record-empty">还没有任何可回看的历史记录。等你保存日快照后，这里会逐步形成复盘档案。</div>
              ) : filteredHistory.length === 0 ? (
                <div className="lo-record-empty">当前筛选下没有匹配记录，可以切回全部记录继续回看。</div>
              ) : (
                <div className="lo-record-timeline">
                  {filteredHistory.map((item) => {
                    const active = item.dateValue === selectedDate;
                    return (
                      <button
                        key={item.dateValue}
                        onClick={() => setSelectedDate(item.dateValue)}
                        className={`lo-record-timeline-item${active ? " active" : ""}`}
                      >
                        <div className="lo-record-timeline-dot" />
                        <div className="lo-record-timeline-body">
                          <div className="lo-record-timeline-head">
                            <div className="lo-record-timeline-date">{formatDateLabel(item.dateValue)}</div>
                            <div className="lo-record-timeline-time">{item.savedAt ? new Date(item.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                          </div>
                          <div className="lo-record-timeline-meta">
                            Hero：{item.hero?.label || "—"} · F&G：{item.fgVal === "" ? "—" : item.fgVal} · L4：
                            {item.l4?.color ? (
                              <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
                                <SignalDot color={item.l4.color} size={8} />
                              </span>
                            ) : "—"}
                          </div>
                          <div className="lo-record-timeline-note">笔记：{notePreview(item.note)} {item.hasMacro ? "" : "· 无宏观快照"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lo-record-panel" style={{ gridColumn: "span 9", padding: sectionCardPadding, marginTop: 16 }}>
              <div className="lo-record-panel-head">
                <div>
                  <div className="lo-record-panel-kicker">Decisions</div>
                  <div className="lo-record-panel-title">Alpha 决策历史</div>
                  <div className="lo-record-panel-note">每次点击进/观/弃按钮时自动记录，保留最近 100 条。刷新不清空。</div>
                </div>
                {alphaDecisions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("确认清空全部 Alpha 决策记录？")) {
                        setAlphaDecisions([]);
                      }
                    }}
                    style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-red)", background: "transparent", border: "1px solid var(--lo-red)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}
                  >
                    清空记录
                  </button>
                )}
              </div>
              {alphaDecisions.length > 0 && (() => {
                const counts = { 进: 0, 观: 0, 弃: 0 };
                alphaDecisions.forEach((d) => {
                  if (counts[d.decision] != null) counts[d.decision]++;
                });
                const total = alphaDecisions.length;
                return (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 4px" }}>
                    {[
                      { label: "进", color: "var(--lo-green)" },
                      { label: "观", color: "var(--lo-yellow)" },
                      { label: "弃", color: "var(--lo-red)" },
                    ].map(({ label, color }) => (
                      <div key={label} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 8,
                        background: "rgba(120,120,128,0.05)",
                        fontSize: "var(--lo-text-meta)",
                      }}>
                        <span style={{ fontWeight: 700, color }}>{label}</span>
                        <span style={{ fontWeight: 600, color: "var(--lo-text-primary)" }}>
                          {counts[label]}
                        </span>
                        <span style={{ color: "var(--lo-text-tertiary)" }}>
                          ({total > 0 ? Math.round(counts[label] / total * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 8,
                      background: "rgba(120,120,128,0.05)",
                      fontSize: "var(--lo-text-meta)",
                      color: "var(--lo-text-secondary)",
                    }}>
                      合计 <span style={{ fontWeight: 600, color: "var(--lo-text-primary)", marginLeft: 4 }}>{total}</span>
                    </div>
                  </div>
                );
              })()}

              {alphaDecisions.length === 0 ? (
                <div className="lo-record-empty">还没有任何决策记录。在 Alpha Scanner 展开卡片后点击进/观/弃即可记录。</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {alphaDecisions.slice(0, 20).map((rec) => {
                    const decisionColor = rec.decision === "进" ? "var(--lo-green)"
                      : rec.decision === "观" ? "var(--lo-yellow)"
                        : "var(--lo-red)";
                    const date = new Date(rec.timestamp);
                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
                    return (
                      <div key={rec.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 8,
                        background: "rgba(120,120,128,0.05)",
                        fontSize: "var(--lo-text-meta)",
                      }}>
                        <span style={{ fontWeight: 700, color: decisionColor, minWidth: 24 }}>{rec.decision}</span>
                        <span style={{ fontWeight: 600, color: "var(--lo-text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rec.token}
                        </span>
                        <span style={{ color: "var(--lo-text-secondary)" }}>{rec.chain}</span>
                        <span style={{ color: "var(--lo-text-secondary)", whiteSpace: "nowrap" }}>{dateStr}</span>
                        {rec.macro_snapshot?.market_phase && (
                          <span style={{ color: "var(--lo-text-tertiary)", whiteSpace: "nowrap" }}>
                            {rec.macro_snapshot.market_phase}
                            {rec.macro_snapshot.l0_score != null ? ` · L0 ${rec.macro_snapshot.l0_score.toFixed(2)}` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {alphaDecisions.length > 20 && (
                    <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-tertiary)", textAlign: "center", padding: "4px 0" }}>
                      共 {alphaDecisions.length} 条，仅显示最近 20 条
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lo-record-stack" style={{ gridColumn: "span 3", gap: 24 }}>
              <div className="lo-record-panel lo-record-panel-diagnostics" style={{ padding: sectionCardPadding }}>
                <button onClick={() => setShowSystemStatus((v) => !v)} className="lo-record-diagnostics-toggle">
                  <div>
                    <div className="lo-record-panel-kicker">Diagnostics</div>
                    <div className="lo-record-panel-title lo-record-panel-title-small">系统状态</div>
                    <div className="lo-record-panel-note">只用于确认日期切换、保存、缓存和历史汇总是否正常，不参与主判断。</div>
                  </div>
                  <span className="lo-btn lo-btn-text" style={{ color: C.blue }}>
                    <span className="lo-btn-token"><PatrickMark color={C.blue} size={11} /></span>
                    <span>{showSystemStatus ? "收起" : "展开"}</span>
                  </span>
                </button>

                <div className="lo-record-diagnostics-grid">
                  {[
                    { title: "日期", state: viewState },
                    { title: "保存", state: saveState },
                    { title: "缓存", state: cacheState },
                    { title: "历史", state: historyState },
                  ].map((item) => {
                    const tone = statusTone[item.state.tone] || statusTone.idle;
                    return (
                      <div key={item.title} className="lo-record-diagnostics-card">
                        <div className="lo-record-diagnostics-label">{item.title}</div>
                        <div className="lo-record-diagnostics-value" style={{ color: tone.color }}>{item.state.label}</div>
                      </div>
                    );
                  })}
                </div>

                {showSystemStatus && (
                  <div className="lo-record-diagnostics-detail">
                    {[
                      { title: "日期切换层", state: viewState },
                      { title: "快照保存层", state: saveState },
                      { title: "缓存读取层", state: cacheState },
                      { title: "历史汇总层", state: historyState },
                    ].map((item) => {
                      const tone = statusTone[item.state.tone] || statusTone.idle;
                      return (
                        <div key={item.title} className="lo-record-diagnostics-detail-card" style={{ background: tone.bg }}>
                          <div className="lo-record-diagnostics-detail-title">{item.title}</div>
                          <div className="lo-record-diagnostics-detail-value" style={{ color: tone.color }}>{item.state.label}</div>
                          <div className="lo-record-diagnostics-detail-copy">{item.state.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {!notePanelUi.hidden && (
          <aside
            ref={notePanelRef}
            className={`lo-floating-note${notePanelUi.collapsed ? " is-collapsed" : ""}`}
            style={{ transform: `translate3d(${notePanelUi.x}px, ${notePanelUi.y}px, 0)` }}
            onPointerMove={handleNotePanelPointerMove}
            onPointerUp={finishNotePanelDrag}
            onPointerCancel={finishNotePanelDrag}
          >
            <div className="lo-floating-note-handle" onPointerDown={handleNotePanelPointerDown}>
              <div>
                <div className="lo-floating-note-kicker">{notePanelRoleLabel}</div>
                <div className="lo-floating-note-title">摘要与笔记</div>
              </div>
              <div className="lo-floating-note-actions">
                <button type="button" className="lo-floating-note-icon" onClick={toggleNotePanelCollapse}>
                  {notePanelUi.collapsed ? "展开" : "收起"}
                </button>
                <button type="button" className="lo-floating-note-icon" onClick={hideNotePanel}>
                  隐藏
                </button>
              </div>
            </div>

            {!notePanelUi.collapsed && (
              <div className="lo-floating-note-body">
                <div className="lo-floating-note-summary">
                  <div className="lo-floating-note-summary-label">当前上下文</div>
                  <div className="lo-floating-note-summary-copy">{notePanelSummary}</div>
                  <div className="lo-floating-note-summary-note">{notePanelRoleCopy}</div>
                </div>

                <textarea
                  placeholder="记录市场观察、入场理由、风控位、复盘结论……"
                  value={dailyNote}
                  onChange={(e) => { markDirty(); setDailyNote(e.target.value); }}
                  className="lo-floating-note-textarea"
                />
              </div>
            )}
          </aside>
        )}

        <div style={{ textAlign: "center", padding: "8px 20px 28px", fontSize: "var(--lo-text-meta)", color: C.labelQ, lineHeight: 1.7 }}>LiquidityOS v3.1 · L0-L4 四层框架<br />DeFiLlama · CoinGecko · Alternative.me · Binance · GMGN</div>
      </div>
      </div>

      <div
        className="lo-global-dock"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          background: isDarkTheme ? "rgba(20,28,44,0.85)" : "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRadius: 16,
          boxShadow: isDarkTheme ? "0 10px 32px rgba(0,0,0,0.34), 0 1px 0 rgba(255,255,255,0.05) inset" : "0 2px 12px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.05)",
          border: isDarkTheme ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.04)",
          zIndex: 500,
          overflow: "hidden",
          fontFamily: dockFontFamily,
          minWidth: 164,
        }}
      >
        <button
          className="lo-global-dock-button"
          type="button"
          onClick={() => handleMacroRefresh(false)}
          disabled={macroLoading || !isTodayView}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            cursor: macroLoading || !isTodayView ? "not-allowed" : "pointer",
            border: "none",
            borderBottom: isDarkTheme ? "0.5px solid rgba(255,255,255,0.06)" : "0.5px solid rgba(0,0,0,0.06)",
            background: "transparent",
            textAlign: "left",
            opacity: macroLoading || !isTodayView ? 0.6 : 1,
            transition: "background 0.15s",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14, opacity: macroLoading ? 1 : 0.5, animation: macroLoading ? "spin 1s linear infinite" : "none" }}>↻</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: isDarkTheme ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.45)" }}>{dockStatusLabel}</span>
          <span aria-hidden="true" style={{ marginLeft: "auto", fontSize: 10, color: isDarkTheme ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.2)" }}>›</span>
        </button>

        <button
          className="lo-global-dock-button"
          type="button"
          onClick={openNotePanel}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            cursor: "pointer",
            border: "none",
            background: "transparent",
            textAlign: "left",
            transition: "background 0.15s",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>📝</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: isDarkTheme ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.45)" }}>便签</span>
        </button>
      </div>
    </div>
  );
}

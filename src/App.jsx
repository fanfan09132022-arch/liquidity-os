import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import BTCDetailPage from "./BTCDetailPage";
import FGDetailPage from "./FGDetailPage";
import L1DetailPage from "./L1DetailPage";
import L2DetailPage from "./L2DetailPage";
import L3DetailPage from "./L3DetailPage";
import { fetchAlphaSupport, fetchMacroViaAI, fetchMacroViaWorker } from "./lib/api";

// ── COLORS ──
const C = {
  bg: "#F2F2F7", card: "#fff", label: "#000", labelSec: "#3C3C43",
  labelTer: "rgba(60,60,67,0.6)", labelQ: "rgba(60,60,67,0.4)",
  sep: "rgba(60,60,67,0.16)", fill: "rgba(120,120,128,0.08)",
  fill2: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", orange: "#FF9500",
  red: "#FF3B30", yellow: "#FFCC00", purple: "#AF52DE", teal: "#30B0C7",
};

function fmtNum(n) {
  if (n == null || isNaN(n)) return "—";
  n = parseFloat(n);
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(n !== 0 && Math.abs(n) < 10 ? 2 : 0);
}
function fmtB(n) { return n != null ? (n / 1e9).toFixed(2) + "B" : "—"; }
function fmtPct(n) { return n != null ? (n > 0 ? "+" : "") + parseFloat(n).toFixed(2) + "%" : "—"; }
function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(v >= 10 ? 2 : 4)}`;
}
function fmtUsdWhole(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n)).toLocaleString("en-US")}`;
}
function fmtTop50Price(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (Math.abs(v) >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (Math.abs(v) >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}
function pickTop50Icon(item = {}) {
  const candidates = [
    item.image,
    item.logo,
    item.thumb,
    item.icon,
    item.icon_url,
    item.logo_url,
    item.image_url,
    item.small,
  ];
  const chosen = candidates.find((value) => typeof value === "string" && value.trim());
  return chosen ? chosen.trim() : null;
}
const TOP50_FALLBACK_PALETTES = [
  { bgTop: "rgba(37, 99, 235, 0.18)", bgBottom: "rgba(191, 219, 254, 0.82)", core: "rgba(37, 99, 235, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(16, 185, 129, 0.18)", bgBottom: "rgba(209, 250, 229, 0.84)", core: "rgba(5, 150, 105, 0.78)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(245, 158, 11, 0.18)", bgBottom: "rgba(254, 240, 138, 0.86)", core: "rgba(217, 119, 6, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(168, 85, 247, 0.18)", bgBottom: "rgba(233, 213, 255, 0.86)", core: "rgba(147, 51, 234, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
];
function getTop50FallbackPalette(seed = "") {
  const score = Array.from(String(seed || "token")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TOP50_FALLBACK_PALETTES[score % TOP50_FALLBACK_PALETTES.length];
}
function fmtRatio(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}
function fmtCount(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("zh-CN");
}
function shortAddr(v) {
  if (!v) return "—";
  const s = String(v);
  return s.length > 14 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
}

function getDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function storageKeyForDate(dateValue) {
  return `daily:${dateValue}`;
}

function keyForDate(dateValue) {
  return storageKeyForDate(dateValue);
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "—";
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return dateValue;
  return new Date(year, month - 1, day).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

function parseDateValue(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function getRecentDateValues(days = 7, startDate = new Date()) {
  return Array.from({ length: days }, (_, idx) => getDateValue(new Date(startDate.getTime() - idx * 86400000)));
}

function notePreview(text) {
  if (!text) return "无笔记";
  return text.length > 32 ? text.slice(0, 32) + "…" : text;
}

const NOTE_PANEL_STORAGE_KEY = "ui:global-note-panel";
function clampNum(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
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

function formatTimeLabel(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildDailySnapshot({
  selectedDate, macro, macroTime, macroSource,
  heroSignal, l2Signal, l3Signal, fgSignal, l4Signal,
  l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards,
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
    savedAt: new Date().toISOString(),
  };
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtTrillionsFromInput(v) {
  const n = toNum(v);
  return n == null ? "—" : n.toFixed(3) + "T";
}

function calcManualGnl(fed, tga, rrp) {
  const fedVal = toNum(fed);
  const tgaVal = toNum(tga);
  const rrpVal = toNum(rrp);
  if (fedVal == null || tgaVal == null || rrpVal == null) return null;
  return parseFloat((fedVal - tgaVal - rrpVal).toFixed(3));
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
      mcap: toNum(raw.meme?.mcap),
      mcap_change_24h: toNum(raw.meme?.mcap_change_24h),
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
      items: rawMemeTopItems.map(item => ({
        rank: toNum(item.rank),
        token: item.token || "",
        name: item.name || "",
        image: pickTop50Icon(item),
        price: toNum(item.price),
        market_cap: toNum(item.market_cap),
        change_24h_pct: toNum(item.change_24h_pct),
        change_7d_pct: toNum(item.change_7d_pct),
        volume_24h: toNum(item.volume_24h),
      })),
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
    reasons.push(`V/MC 活跃占比 ${(vmcActive * 100).toFixed(0)}%`);
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
  ok: { color: C.green, bg: "rgba(52,199,89,0.10)" },
  warn: { color: C.orange, bg: "rgba(255,149,0,0.10)" },
  bad: { color: C.red, bg: "rgba(255,59,48,0.10)" },
  info: { color: C.blue, bg: "rgba(0,122,255,0.10)" },
  idle: { color: C.labelTer, bg: C.fill },
};

const cardStyle = { margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" };
const secLabel = { padding: "0 20px 7px", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.labelTer };
const miniInput = { border: "none", outline: "none", background: C.fill2, borderRadius: 6, padding: "5px 6px", fontSize: 12, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif", width: "100%", textAlign: "center" };

function DataRow({ label, value, sub, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `0.5px solid ${C.sep}` }}>
      <span style={{ fontSize: 13, color: C.labelSec }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: color || C.label }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: C.labelTer, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function buildSvgPoints(points, width = 220, height = 52) {
  const clean = points.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (clean.length < 2) return "";
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  return clean.map((point, idx) => {
    const x = (idx / (clean.length - 1)) * width;
    const y = height - ((point - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const UNIFIED_STATUS_META = {
  positive: { label: "正向", color: C.green, bg: "rgba(52,199,89,0.12)", line: C.green, fill: "rgba(52,199,89,0.08)" },
  neutral: { label: "盘整中", color: C.orange, bg: "rgba(255,149,0,0.12)", line: C.orange, fill: "rgba(255,149,0,0.08)" },
  negative: { label: "负向", color: C.red, bg: "rgba(255,59,48,0.12)", line: C.red, fill: "rgba(255,59,48,0.08)" },
  idle: { label: "等待数据", color: C.labelTer, bg: C.fill, line: "#8E8E93", fill: "rgba(120,120,128,0.08)" },
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
    return (
      <div className="lo-trend-assist lo-trend-assist-empty" aria-label={ariaLabel}>
        <div className="lo-trend-empty-line" />
        <div className="lo-trend-empty-copy">{emptyLabel}</div>
        <div className="lo-trend-empty-hint">{emptyHint}</div>
      </div>
    );
  }
  const pointsStr = buildSvgPoints(stats.clean, 220, 64);
  const area = `${pointsStr} 220,64 0,64`;
  const lastPoint = pointsStr.split(" ").at(-1)?.split(",") || null;
  return (
    <div className="lo-trend-assist" aria-label={ariaLabel}>
      <div className="lo-trend-metrics">
        <div className="lo-trend-metric">
          <div className="lo-trend-metric-label">{deltaLabel}</div>
          <div className="lo-trend-metric-value" style={{ color: meta.color }}>
            {fmtSignedFromRaw(stats.totalDelta, valueFormatter)}
          </div>
        </div>
        <div className="lo-trend-metric">
          <div className="lo-trend-metric-label">{latestLabel}</div>
          <div className="lo-trend-metric-value">{valueFormatter(stats.last)}</div>
        </div>
      </div>
      <svg viewBox="0 0 220 64" width="100%" height="64" preserveAspectRatio="none" role="img" aria-hidden="true">
        <path d={`M${area}`} fill={meta.fill} />
        <polyline fill="none" stroke={meta.line} strokeWidth="2.4" points={pointsStr} strokeLinecap="round" strokeLinejoin="round" />
        {lastPoint && (
          <circle
            cx={Number(lastPoint[0])}
            cy={Number(lastPoint[1])}
            r="4"
            fill="#fff"
            stroke={meta.line}
            strokeWidth="2"
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
}) {
  const status = UNIFIED_STATUS_META[statusKey || "idle"];
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
      <div className="lo-insight-body">
        <div className="lo-insight-copy">
          <div className="lo-insight-question">{question}</div>
          <div className="lo-insight-primary-label">{primaryLabel}</div>
          <div className="lo-insight-primary-value">{primaryValue}</div>
          <div className="lo-insight-change">
            <span className="lo-insight-change-label">{changeLabel}</span>
            <span className="lo-insight-change-value" style={{ color: changeTone || status.color }}>{changeValue}</span>
          </div>
          <div className="lo-insight-summary">{summary}</div>
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
        <PatrickMark color={iconColor || (kind === "primary" ? "#fff" : "#2563eb")} size={12} />
      </span>
      <span>{children}</span>
    </button>
  );
}

const WATCH_STATUS_OPTS = [
  { val: "watching", label: "观察中", c: C.blue, b: "rgba(0,122,255,0.1)" },
  { val: "ready", label: "准备建仓", c: C.orange, b: "rgba(255,149,0,0.12)" },
  { val: "position", label: "已有仓位", c: C.green, b: "rgba(52,199,89,0.12)" },
];
const WATCH_CHIPS_OPTS = [
  { val: "healthy", label: "健康", c: C.green, b: "rgba(52,199,89,0.12)" },
  { val: "neutral", label: "中性", c: C.orange, b: "rgba(255,149,0,0.12)" },
  { val: "concentrated", label: "集中", c: C.red, b: "rgba(255,59,48,0.12)" },
];
const WATCH_POOL_OPTS = [
  { val: "deep", label: "深", c: C.green, b: "rgba(52,199,89,0.12)" },
  { val: "mid", label: "中", c: C.orange, b: "rgba(255,149,0,0.12)" },
  { val: "shallow", label: "浅", c: C.red, b: "rgba(255,59,48,0.12)" },
];
const WATCH_ROW_PALETTES = [
  { accent: "#2563eb", tint: "rgba(37,99,235,0.07)" },
  { accent: "#0f766e", tint: "rgba(15,118,110,0.07)" },
  { accent: "#b45309", tint: "rgba(180,83,9,0.07)" },
  { accent: "#7c3aed", tint: "rgba(124,58,237,0.07)" },
  { accent: "#be123c", tint: "rgba(190,18,60,0.07)" },
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
              borderColor: active ? opt.c : "rgba(15,23,42,0.12)",
              background: active ? opt.b : "rgba(255,255,255,0.72)",
              color: active ? opt.c : "rgba(15,23,42,0.7)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function WatchlistRow({ row, idx, onChange, onRemove, canRemove }) {
  const vmc = row.vmc || "";
  const vmcN = parseFloat(vmc);
  const vmcColor = isNaN(vmcN) ? C.labelQ : vmcN >= 0.5 ? C.green : vmcN >= 0.2 ? C.orange : C.red;
  const chgColor = (v) => { const n = parseFloat(v); return isNaN(n) ? C.labelQ : n > 0 ? C.green : n < 0 ? C.red : C.labelTer; };
  const statusMeta = WATCH_STATUS_OPTS.find((opt) => opt.val === row.status);
  const rowPalette = WATCH_ROW_PALETTES[idx % WATCH_ROW_PALETTES.length];
  const rowAccent = statusMeta?.c || rowPalette.accent;
  const rowTint = statusMeta?.b || rowPalette.tint;
  return (
    <div className="lo-watch-row" style={{ "--lo-watch-accent": rowAccent, "--lo-watch-tint": rowTint }}>
      <div className="lo-watch-row-head lo-watch-row-gap">
        <div className="lo-watch-row-index">观测 {String(idx + 1).padStart(2, "0")}</div>
        <div className="lo-watch-row-current">{statusMeta?.label || "未设定状态"}</div>
      </div>
      <div className="lo-watch-status-row lo-watch-row-gap">
        <div>
          <div className="lo-field-label">Token</div>
          <input value={row.token} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder={`#${idx + 1}`} style={{ ...miniInput, fontWeight: 700, fontSize: 13 }} className="lo-input lo-input-left" />
        </div>
        <div className="lo-watch-segment">
          <div className="lo-watch-status-meta">
            <div className="lo-field-label lo-field-label-tight">状态</div>
            <div style={{ fontSize: 10, color: statusMeta?.c || C.labelTer, fontWeight: 700 }}>{statusMeta?.label || "未设定"}</div>
          </div>
          <WatchPillGroup options={WATCH_STATUS_OPTS} current={row.status} onSelect={(val) => onChange(idx, "status", val)} tone="status" />
        </div>
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

      <div className="lo-watch-metrics-row lo-watch-mobile-secondary lo-watch-row-gap">
        <div>
          <div className="lo-field-label">MCap</div>
          <input value={row.mcap} onChange={(e) => onChange(idx, "mcap", e.target.value)} placeholder="MCap" style={miniInput} inputMode="decimal" />
        </div>
        <div>
          <div className="lo-field-label">24h</div>
          <input value={row.chg24h} onChange={(e) => onChange(idx, "chg24h", e.target.value)} placeholder="24h%" style={{ ...miniInput, color: chgColor(row.chg24h) }} inputMode="decimal" />
        </div>
        <div>
          <div className="lo-field-label">7d</div>
          <input value={row.chg7d} onChange={(e) => onChange(idx, "chg7d", e.target.value)} placeholder="7d%" style={{ ...miniInput, color: chgColor(row.chg7d) }} inputMode="decimal" />
        </div>
        <div>
          <div className="lo-field-label">1m</div>
          <input value={row.chg1m || ""} onChange={(e) => onChange(idx, "chg1m", e.target.value)} placeholder="1m%" style={{ ...miniInput, color: chgColor(row.chg1m) }} inputMode="decimal" />
        </div>
        <div>
          <div className="lo-field-label">V/MC</div>
          <input value={row.vmc || ""} onChange={(e) => onChange(idx, "vmc", e.target.value)} placeholder="0.45" style={{ ...miniInput, color: vmcColor }} inputMode="decimal" />
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

function AlphaCard({ card, idx, onChange, autoData, autoLoading, onFetchAuto }) {
  const optBtn = (opts, field, current) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${opts.length},1fr)`, gap: 4 }}>
      {opts.map((o) => {
        const sel = current === o.val;
        return <button key={o.val} onClick={() => onChange(idx, field, sel ? "" : o.val)} style={{ border: sel ? `1.5px solid ${o.c}` : "1.5px solid rgba(60,60,67,0.15)", borderRadius: 8, padding: "6px 2px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: sel ? o.b : "transparent", color: sel ? o.c : C.labelTer, transition: "all 0.15s", fontFamily: "-apple-system,sans-serif" }}>{o.label}</button>;
      })}
    </div>
  );
  return (
    <div className="lo-alpha-card">
      <div className="lo-alpha-top">
        <div className="lo-alpha-index">{idx + 1}</div>
        <select value={card.chain || "solana"} onChange={(e) => onChange(idx, "chain", e.target.value)} style={{ fontSize: 12, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} className="lo-alpha-select">
          <option value="solana">solana</option>
          <option value="bsc">bsc</option>
        </select>
        <input value={card.token} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder="token address" style={{ fontSize: 13, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} className="lo-alpha-token" />
        <ActionButton
          kind={autoLoading ? "secondary" : "primary"}
          onClick={() => onFetchAuto(idx)}
          disabled={autoLoading || !card.token}
          style={{ padding: "8px 12px", fontSize: 11, opacity: !card.token ? 0.45 : 1 }}
        >
          {autoLoading ? "拉取中..." : "自动拉数"}
        </ActionButton>
      </div>
      {(autoLoading || autoData) && (
        <div className="lo-alpha-auto-panel" style={{ border: `1px dashed ${C.sep}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.labelSec }}>自动支撑数据（仅参考）</div>
            <div style={{ fontSize: 10, color: C.labelQ }}>{autoLoading ? "正在从 Worker 拉取" : `更新于 ${formatTimeLabel(autoData?.updated_at)}`}</div>
          </div>
          {autoData?.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{autoData.error}</div>}
          <div className="lo-alpha-auto-grid">
            <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>筹码集中度</div>
              <div style={{ fontSize: 10, color: C.labelTer, lineHeight: 1.6 }}>
                Holder: <span style={{ color: C.label }}>{fmtCount(autoData?.chips?.holder_count)}</span><br />
                Top 10: <span style={{ color: C.label }}>{fmtPct(autoData?.chips?.top10_share_pct)}</span><br />
                样本数: <span style={{ color: C.label }}>{fmtCount(autoData?.chips?.top_holders_count)}</span>
              </div>
              <div style={{ fontSize: 9, color: autoData?.chips?.error ? C.red : C.labelQ, marginTop: 6 }}>
                {autoData?.chips?.error ? autoData.chips.error : `${autoData?.chips?.source || "birdeye"} · ${formatTimeLabel(autoData?.chips?.updated_at)}`}
              </div>
            </div>
            <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>资金动量</div>
              <div style={{ fontSize: 10, color: C.labelTer, lineHeight: 1.6 }}>
                Price: <span style={{ color: C.label }}>{fmtUsd(autoData?.momentum?.price)}</span><br />
                24h 价变: <span style={{ color: C.label }}>{fmtPct(autoData?.momentum?.price_change_24h_pct)}</span><br />
                24h 量: <span style={{ color: C.label }}>{fmtUsd(autoData?.momentum?.volume_24h)}</span><br />
                24h 量变: <span style={{ color: C.label }}>{fmtPct(autoData?.momentum?.volume_change_24h_pct)}</span>
              </div>
              <div style={{ fontSize: 9, color: autoData?.momentum?.error ? C.red : C.labelQ, marginTop: 6 }}>
                {autoData?.momentum?.error ? autoData.momentum.error : `${autoData?.momentum?.source || "birdeye"} · ${formatTimeLabel(autoData?.momentum?.updated_at)}`}
              </div>
            </div>
            <div style={{ background: "rgba(120,120,128,0.05)", borderRadius: 8, padding: "8px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.labelSec, marginBottom: 6 }}>池子强度</div>
              <div style={{ fontSize: 10, color: C.labelTer, lineHeight: 1.6 }}>
                Liq: <span style={{ color: C.label }}>{fmtUsd(autoData?.pool?.liquidity_usd)}</span><br />
                Vol: <span style={{ color: C.label }}>{fmtUsd(autoData?.pool?.volume_24h_usd)}</span><br />
                Liq/Vol: <span style={{ color: C.label }}>{fmtRatio(autoData?.pool?.liq_vol_ratio)}</span><br />
                Pool: <span style={{ color: C.label }}>{shortAddr(autoData?.pool?.pool_address)}</span>
              </div>
              <div style={{ fontSize: 9, color: autoData?.pool?.error ? C.red : C.labelQ, marginTop: 6 }}>
                {autoData?.pool?.error ? autoData.pool.error : `${autoData?.pool?.source || "geckoterminal"} · ${formatTimeLabel(autoData?.pool?.updated_at)}`}
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>筹码集中度</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>前 10 地址占比</div>
          <input value={card.top10Share || ""} onChange={(e) => onChange(idx, "top10Share", e.target.value)} placeholder="45%" style={miniInput} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>持币地址变化</div>
          <input value={card.holderChange || ""} onChange={(e) => onChange(idx, "holderChange", e.target.value)} placeholder="+12%" style={miniInput} />
        </div>
      </div>
      {optBtn(CHIP_OPTS, "chipsJudgment", card.chipsJudgment)}
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginTop: 10, marginBottom: 4 }}>资金动量</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 成交量变化</div>
          <input value={card.volumeChange24h || ""} onChange={(e) => onChange(idx, "volumeChange24h", e.target.value)} placeholder="+35%" style={miniInput} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 价格变化</div>
          <input value={card.priceChange24h || ""} onChange={(e) => onChange(idx, "priceChange24h", e.target.value)} placeholder="+18%" style={miniInput} />
        </div>
      </div>
      {optBtn(MOMENTUM_OPTS, "momentumJudgment", card.momentumJudgment)}
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginTop: 10, marginBottom: 4 }}>池子强度</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>流动性</div>
          <input value={card.poolLiquidity || ""} onChange={(e) => onChange(idx, "poolLiquidity", e.target.value)} placeholder="$220K" style={miniInput} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>24h 成交量</div>
          <input value={card.poolVolume24h || ""} onChange={(e) => onChange(idx, "poolVolume24h", e.target.value)} placeholder="$180K" style={miniInput} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>Liq/Vol</div>
          <input value={card.poolLiqVol || ""} onChange={(e) => onChange(idx, "poolLiqVol", e.target.value)} placeholder="1.2" style={miniInput} />
        </div>
      </div>
      {optBtn(POOL_OPTS, "poolJudgment", card.poolJudgment)}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>备注</div>
          <input value={card.note || ""} onChange={(e) => onChange(idx, "note", e.target.value)} placeholder="简要判断..." style={{ ...miniInput, textAlign: "left" }} />
        </div>
      </div>
    </div>
  );
}

const emptyWatchRow = () => ({
  token: "",
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
  const [notePanelUi, setNotePanelUi] = useState(() => readNotePanelState());
  const [isCompactViewport, setIsCompactViewport] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 720 : false));
  const [showL1Dock, setShowL1Dock] = useState(false);

  const today = formatDateLabel(selectedDate);
  const isHydrating = useRef(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);
  const stateFlowVersion = useRef(0);
  const notePanelRef = useRef(null);
  const notePanelUiRef = useRef(notePanelUi);
  const notePanelMeasureRaf = useRef(null);
  const notePanelDrag = useRef({ active: false, pointerId: null, offsetX: 0, offsetY: 0 });

  const markDirty = useCallback(() => {
    pendingSave.current = true;
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
      let data = null;
      let source = "";
      try {
        data = await fetchMacroViaWorker();
        source = "Worker";
      } catch {
        data = await fetchMacroViaAI();
        source = "AI兜底";
      }
      if (refreshVersion !== stateFlowVersion.current) return;
      const normalized = normalizeMacroData(data);
      pendingSave.current = true;
      setMacro(normalized);
      setMacroSource(source);
      setMacroTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      if (normalized.fear_greed?.value != null) setFgVal(String(normalized.fear_greed.value));
      setCacheState({
        tone: source === "Worker" ? "ok" : "warn",
        label: source === "Worker" ? "网络成功" : "AI兜底",
        detail: source === "Worker" ? "已从 Worker 获取最新宏观数据" : "Worker 失败，已切到 AI 兜底",
      });
    } catch (e) {
      if (refreshVersion !== stateFlowVersion.current) return;
      setMacroError("❌ " + e.message);
      setCacheState({ tone: "bad", label: "刷新失败", detail: e.message || "网络请求失败" });
    } finally {
      if (refreshVersion !== stateFlowVersion.current) return;
      setMacroLoading(false);
    }
  }, [selectedDate, todayValue, macroTime]);

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
  };

  const l0Info = cycleMeta[l0Cycle] || cycleMeta.transition;
  const isTodayView = selectedDate === todayValue;
  const manualGnl = calcManualGnl(l1Manual.fed, l1Manual.tga, l1Manual.rrp);
  const hasFredAuto = !!macro?.fred?.gnl;
  const fredSource = macro?.fred?.source || "FRED";
  const fredDate = macro?.fred?.gnl?.date || macro?.fred?.fed?.date || macro?.fred?.tga?.date || macro?.fred?.rrp?.date || null;
  const fredUpdatedAt = macro?.fred?.updated_at || null;
  const dataFreshLabel = macroLoading ? "更新中" : macroTime ? "已更新" : "待更新";
  const watchActiveCount = watchlist.filter((row) => String(row?.token || "").trim()).length;
  const alphaFilledCount = alphaCards.filter((card) => String(card?.token || "").trim()).length;
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
  const macroDays = filteredHistory.filter((item) => item.hasMacro).length;
  const attackDays = filteredHistory.filter((item) => item.hero?.label === "进　攻").length;
  const selectedHistorySummary = historySummaries.find((item) => item.dateValue === selectedDate) || null;
  const historyState = historySummaries.length === 0
    ? { tone: "warn", label: "无历史记录", detail: "还没有任何按日快照" }
    : { tone: "ok", label: `${historySummaries.length} 条记录`, detail: `近 30 天内有 ${macroDays} 天宏观快照` };
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
  const contextMetricSpan = macro ? 3 : 6;

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
  const btcPanelSummary = macro
    ? btcSummary
    : "先更新宏观数据，再用 200MA 比率和 MVRV Z-Score 判断 BTC 周期位置。";

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
  })), [selectedDate, macro, macroTime, macroSource, heroSignal, l2Signal, l3Signal, fgSignal, l4Signal, l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards]);

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

  useEffect(() => {
    if (isHydrating.current) return;
    if (!pendingSave.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState({ tone: "info", label: "等待保存", detail: `${selectedDate} 检测到输入变化，800ms 后自动保存` });
    saveTimer.current = setTimeout(doSave, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedDate, macro, macroTime, macroSource, l0Cycle, l1Manual, mvrvManual, fgVal, dailyNote, watchlist, alphaCards, doSave]);

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
    <div className="lo-app">
      <div className="lo-topbar">
        <div className="lo-topbar-inner">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5, color: "#0F172A" }}>LiquidityOS</div>
            <div style={{ fontSize: 12, color: C.labelTer, marginTop: 4 }}>
              {macroTime ? `当前数据：${macroSource} · ${macroTime}` : `当前工作区：${today}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="lo-badge" style={{ background: "rgba(15,23,42,0.04)" }}>数据状态 · {dataFreshLabel}</div>
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

      <div className="lo-shell">
        <section className="lo-surface" style={{ padding: 18, marginBottom: 18, animation: "rise 0.45s both" }}>
          <div className="lo-command-strip">
            <div>
              <div className="lo-section-kicker">Control Center</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1.1, color: "#0F172A", marginTop: 6 }}>先判断今天怎么做</div>
              <div style={{ fontSize: 13, color: C.labelTer, lineHeight: 1.6, marginTop: 10 }}>
                第一屏先收主控结论，再用 BTC 主控依据确认方向，最后决定是否执行和更新数据。
              </div>
            </div>
            <div className="lo-command-strip-meta">
              <div className="lo-badge">工作区 · {isTodayView ? "今日" : "历史"}</div>
              <div className="lo-badge">数据状态 · {dataFreshLabel}</div>
              <div className="lo-badge">当前数据 · {macroTime ? `${macroSource} · ${macroTime}` : "等待更新"}</div>
            </div>
          </div>

          {macroError && (
            <div className="lo-panel-soft" style={{ padding: "12px 14px", marginBottom: 16, borderColor: "rgba(255,59,48,0.15)", background: "rgba(255,59,48,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>更新异常</div>
              <div style={{ fontSize: 12, color: C.red }}>{macroError}</div>
            </div>
          )}

          <div className={`lo-command-stage lo-command-stage-${l0Cycle}`}>
            <div className="lo-command-cockpit">
              <div className="lo-command-hero-wrap">
                <div className="lo-command-core" style={{ background: heroSignal.bg }}>
                  <div className="lo-command-core-inner">
                    <div className="lo-command-core-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lo-command-core-kicker">Hero Control</div>
                        <div className="lo-command-core-title">{heroSignal.label}</div>
                        <div className="lo-command-core-desc">{heroSignal.desc}</div>
                      </div>
                      <div className="lo-command-score">
                        <div className="lo-command-score-label">Hero 分数</div>
                        <div className="lo-command-score-value">{heroSignal.score == null ? "—" : heroSignal.score.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="lo-command-climate-row">
                      <div className="lo-command-climate-pill">
                        <span className="lo-command-climate-dot" style={{ background: l0Info.color }} />
                        <span>L0-A 环境 · {l0Info.label}</span>
                      </div>
                      <div className="lo-command-climate-note">{l0Info.hint}</div>
                      <div className="lo-command-climate-note">有效信号 {heroSignal.count}/4</div>
                    </div>

                    <div className="lo-command-cycle-switch">
                      {Object.entries(cycleMeta).map(([key, meta]) => {
                        const active = l0Cycle === key;
                        return (
                          <button
                            key={key}
                            onClick={() => { markDirty(); setL0Cycle(key); }}
                            className={`lo-command-cycle-pill${active ? " active" : ""}`}
                            style={{
                              borderColor: active ? meta.color : "rgba(255,255,255,0.18)",
                              background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                              color: active ? "#fff" : "rgba(255,255,255,0.78)",
                            }}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="lo-command-core-note">
                      L0-A 只作为主控环境，不再单独占卡；执行前再用 BTC 主控依据做最后确认。
                    </div>
                  </div>

                  <div className="lo-command-signal-strip">
                    {[[l2Signal, "稳定币"], [l3Signal, "Meme 板块"], [fgSignal, "情绪"], [l4Signal, "个股"]].map(([s, l], idx) => (
                      <div key={l} className="lo-command-signal-item" style={{ borderRight: idx === 3 ? "none" : `0.5px solid ${C.sep}` }}>
                        <div className="lo-command-signal-emoji">{s?.color ? signalEmoji[s.color] : "⚪"}</div>
                        <div className="lo-command-signal-label">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lo-command-action-panel lo-panel-soft">
                <div className="lo-command-action-head">
                  <div className="lo-section-kicker">Action Dock</div>
                  <div className="lo-command-action-title">刷新与执行位</div>
                  <div className="lo-command-action-note">操作紧贴主判断，先读 Hero 和 BTC，再决定是否更新数据。</div>
                </div>
                <div className="lo-actions-row">
                  <ActionButton
                    kind="primary"
                    onClick={() => handleMacroRefresh(false)}
                    disabled={macroLoading || !isTodayView}
                    style={{ flex: 1, minWidth: 148 }}
                  >
                    {!isTodayView ? "历史快照" : macroLoading ? "更新中…" : "更新数据"}
                  </ActionButton>
                  {isTodayView && (
                    <ActionButton
                      kind="secondary"
                      onClick={() => handleMacroRefresh(true)}
                      disabled={macroLoading}
                      style={{ minWidth: 132 }}
                    >
                      强制更新
                    </ActionButton>
                  )}
                </div>
                <div className="lo-command-edge-grid">
                  {[
                    { title: "日期", state: viewState },
                    { title: "保存", state: saveState },
                    { title: "缓存", state: cacheState },
                  ].map((item) => {
                    const tone = statusTone[item.state.tone] || statusTone.idle;
                    return (
                      <div key={item.title} className="lo-command-edge-card">
                        <div className="lo-command-edge-title">{item.title}</div>
                        <div className="lo-command-edge-value" style={{ color: tone.color }}>{item.state.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lo-command-btc-panel">
                <div className="lo-command-btc-head">
                  <div>
                    <div className="lo-section-kicker">BTC Anchor</div>
                    <div className="lo-command-btc-title">L0-B · BTC 周期位置</div>
                    <div className="lo-command-btc-note">继续保留 200MA 比率与 MVRV Z-Score，作为 Hero 之后的主控确认依据。</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage("btc-detail")}
                    style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
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
                  primaryValue={macro?.btc?.price ? fmtUsdWhole(macro.btc.price) : "—"}
                  changeLabel="200MA 比率"
                  changeValue={fmtPct(btcPositionPct)}
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
                      <div style={{ fontSize: 11, color: C.labelTer, lineHeight: 1.55 }}>保留手动输入，不接自动源，也跟随日快照保存。</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.labelTer }}>当前值 {mvrvManual.score || "—"}</div>
                  </div>
                  <div className="lo-mvrv-grid">
                    <div>
                      <div className="lo-field-label">Z-Score</div>
                      <input value={mvrvManual.score} onChange={(e) => updMvrvManual("score", e.target.value)} placeholder="2.35" style={{ ...miniInput, color: C.blue }} className="lo-input lo-input-left" inputMode="decimal" />
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
              </div>
            </div>
          </div>
        </section>

        <section className="lo-panel lo-market-stage" style={{ padding: 18, marginBottom: 16 }}>
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

          <div className="lo-context-summary-grid">
            <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: `span ${contextMetricSpan}` }}>
              <InsightMetricCard
                title="L1 · 净流动性"
                question="净流动性在扩张还是收缩？"
                statusKey={l1StatusKey}
                headAction={(
                  <button
                    type="button"
                    onClick={() => setCurrentPage("l1")}
                    style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                  >
                    详细数据 →
                  </button>
                )}
                accentColor={C.blue}
                primaryLabel="当前 GNL"
                primaryValue={l1CurrentValue == null ? "—" : `${l1CurrentValue.toFixed(3)}T`}
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
              />
              <div className="lo-context-card-foot lo-context-card-foot-action">
                <span>需要维护口径时，再进入按需维护位。</span>
                <button type="button" className="lo-context-inline-toggle" onClick={() => setShowL1Dock((v) => !v)}>
                  {showL1Dock ? "收起维护区" : "展开维护区"}
                </button>
              </div>
            </div>

            {macro && (
              <>
                <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: `span ${contextMetricSpan}` }}>
                  <InsightMetricCard
                    title="L2 · 稳定币弹药"
                    question="场内弹药在补充还是流失？"
                    statusKey={l2StatusKey}
                    headAction={(
                      <button
                        type="button"
                        onClick={() => setCurrentPage("l2")}
                        style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                      >
                        详细数据 →
                      </button>
                    )}
                    accentColor={C.teal}
                    primaryLabel="稳定币总市值"
                    primaryValue={fmtB(macro.stablecoins?.total)}
                    changeLabel="7 日净变化"
                    changeValue={macro.stablecoins?.change_7d != null ? fmtSignedFromRaw(macro.stablecoins.change_7d) : "—"}
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
                  />
                  <div className="lo-context-card-foot">L2 评分 {l2Signal.score.toFixed(2)} · {l2Signal.reason}</div>
                </div>

                <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: `span ${contextMetricSpan}` }}>
                  <InsightMetricCard
                    title="L3 · Meme 板块"
                    question="Meme 风险偏好在升温还是降温？"
                    statusKey={l3StatusKey}
                    headAction={(
                      <button
                        type="button"
                        onClick={() => setCurrentPage("l3")}
                        style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                      >
                        详细数据 →
                      </button>
                    )}
                    accentColor={C.orange}
                    primaryLabel="Meme 总市值"
                    primaryValue={macro.meme?.mcap ? fmtB(macro.meme.mcap) : "—"}
                    changeLabel="24h 变化"
                    changeValue={fmtPct(macro.meme?.mcap_change_24h)}
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
                  />
                  <div className="lo-context-card-foot">L3 评分 {l3Signal.score.toFixed(2)} · {l3Signal.reason}</div>
                </div>
              </>
            )}

            <div className="lo-panel-soft lo-decision-card lo-decision-compact lo-fg-card-compact" style={{ gridColumn: `span ${contextMetricSpan}` }}>
              <div style={{ ...secLabel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span>{signalEmoji[fgSignal.color] || "⚪"} 情绪补充 · F&G</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage("fg")}
                  style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                >
                  详细数据 →
                </button>
              </div>
              <div className="lo-fg-card-main">
                <div>
                  <div className="lo-fg-card-label">情绪刻度</div>
                  <div className="lo-fg-card-note">只做情绪辅助，不替代 L1-L3 判断。</div>
                </div>
                <input value={fgVal} onChange={(e) => { markDirty(); setFgVal(e.target.value.replace(/\D/, "")); }} maxLength={3} placeholder="—" className="lo-fg-card-input" />
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>{fgVal && <div style={{ position: "absolute", top: "50%", left: `${Math.max(2, Math.min(98, Number(fgVal) || 0))}%`, transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />}</div>
              <div className="lo-fg-card-scale">{["极惧", "恐惧", "中性", "贪婪", "极贪"].map((l) => <span key={l}>{l}</span>)}</div>
              <div className="lo-context-card-foot">F&G 评分 {fgSignal.score.toFixed(2)} · {fgSignal.reason}</div>
            </div>
          </div>

          {showL1Dock && (
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
                <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 10, padding: "8px 10px", background: C.fill, borderRadius: 10, lineHeight: 1.55 }}>净流动性由 Fed、TGA、RRP 共同决定，反映市场可用美元背景。自动数据优先来自 Worker 聚合；缺失时仍可手动录入并自动计算 GNL。</div>
                {hasFredAuto ? (
                  <>
                    <DataRow label="GNL" value={macro.fred.gnl.value_t + "T"} color={C.blue} />
                    <DataRow label="Fed" value={macro.fred.fed?.value ? (macro.fred.fed.value / 1e6).toFixed(3) + "T" : "—"} sub={macro.fred.fed?.date} />
                    <DataRow label="TGA" value={macro.fred.tga?.value ? (macro.fred.tga.value / 1e6).toFixed(3) + "T" : "—"} />
                    <DataRow label="RRP" value={macro.fred.rrp?.value ? (macro.fred.rrp.value / 1e3).toFixed(3) + "T" : "—"} />
                    <div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>来源：{fredSource} · 数据日期：{fredDate || "—"} · 更新时间：{fredUpdatedAt ? formatTimeLabel(fredUpdatedAt) : "—"}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>{macro ? "FRED Key 未设置，当前使用手动录入。单位统一按 T 输入，例如 `6.600`。" : "尚未刷新宏观数据，可先手动录入 L1。单位统一按 T 输入，例如 `6.600`。"}</div>
                )}
              </div>

              <div className="lo-context-dock-panel">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>Fed</div>
                    <input value={l1Manual.fed} onChange={(e) => updL1Manual("fed", e.target.value)} placeholder="6.600" style={miniInput} inputMode="decimal" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>TGA</div>
                    <input value={l1Manual.tga} onChange={(e) => updL1Manual("tga", e.target.value)} placeholder="0.700" style={miniInput} inputMode="decimal" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>RRP</div>
                    <input value={l1Manual.rrp} onChange={(e) => updL1Manual("rrp", e.target.value)} placeholder="0.300" style={miniInput} inputMode="decimal" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>数据日期</div>
                    <input value={l1Manual.date} onChange={(e) => updL1Manual("date", e.target.value)} placeholder="2026-03-09" style={{ ...miniInput, textAlign: "left" }} />
                  </div>
                  <div className="lo-context-dock-highlight">
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>手动 GNL</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{manualGnl == null ? "—" : manualGnl.toFixed(3) + "T"}</div>
                  </div>
                </div>
                <div className="lo-context-dock-values">
                  <div style={{ fontSize: 11, color: C.labelTer }}>Fed：{fmtTrillionsFromInput(l1Manual.fed)}</div>
                  <div style={{ fontSize: 11, color: C.labelTer }}>TGA：{fmtTrillionsFromInput(l1Manual.tga)}</div>
                  <div style={{ fontSize: 11, color: C.labelTer }}>RRP：{fmtTrillionsFromInput(l1Manual.rrp)}</div>
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        <section className="lo-panel" style={{ padding: 18, marginBottom: 16 }}>
          <div className="lo-section-head">
            <div>
              <div className="lo-section-kicker">L4 Workbench</div>
              <div className="lo-section-title">{l4Signal?.color ? signalEmoji[l4Signal.color] : "⚪"} 执行工作台</div>
              <div className="lo-section-note">进入工作台后先处理存量观测站，再在 Alpha Scanner 看新增候选，Top 50 只作为旁侧市场参考。</div>
            </div>
          </div>

          <div className="lo-l4-grid">
            <div className="lo-workbench-panel lo-panel-soft lo-l4-main-panel lo-workbench-panel-main">
              <div className="lo-workbench-subhead">
                <div>
                  <div className="lo-workbench-role-pill main">主工作区</div>
                  <div className="lo-workbench-main-title">存量观测站</div>
                  <div className="lo-workbench-main-copy">把今天最可能执行的标的集中在这里。先看状态、24h 与 V/MC，再回看筹码、池深和备注，让盯盘和执行判断保持连续。</div>
                </div>
                <ActionButton kind="secondary" onClick={addWatchRow} disabled={watchlist.length >= 10} style={{ padding: "10px 14px" }}>
                  添加行
                </ActionButton>
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
                <div className="lo-workbench-lead-note">默认先读 Token / 状态 / 24h / V/MC，次层再看 7d、1m、筹码与池深，减少无效视线跳转。</div>
              </div>

              <div className="lo-panel lo-workbench-table-shell" style={{ padding: "14px", boxShadow: "none", borderRadius: 18 }}>
                <div className="lo-watch-head-grid">
                  {["Token / 状态", "MCap", "24h / 7d / 1m", "V/MC", "筹码 / 池深 / 备注"].map((h) => <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.labelQ, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>)}
                </div>
                {watchlist.map((row, idx) => (
                  <WatchlistRow
                    key={idx}
                    row={row}
                    idx={idx}
                    onChange={updWatch}
                    onRemove={removeWatchRow}
                    canRemove={watchlist.length > 0}
                  />
                ))}
                <div style={{ fontSize: 10, color: C.labelQ, marginTop: 10, lineHeight: 1.55 }}>V/MC ≥ 0.5 🟢 活跃 · 0.2-0.5 🟡 一般 · &lt;0.2 🔴 低迷。手机端默认突出 Token、状态、24h 与 V/MC，其余字段自动下沉为次层信息。</div>
              </div>
            </div>

            <div className="lo-workbench-panel lo-panel-soft lo-l4-secondary-panel lo-workbench-panel-inc">
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
                  key={idx}
                  card={card}
                  idx={idx}
                  onChange={updAlpha}
                  autoData={alphaAutoData[idx]}
                  autoLoading={!!alphaAutoLoading[idx]}
                  onFetchAuto={loadAlphaAuto}
                />
              ))}
              {l4Signal && <div style={{ fontSize: 10, color: C.labelTer, marginTop: 2, marginBottom: 8, lineHeight: 1.5, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>L4 分数 {l4Signal.score.toFixed(2)} = 基线 0.50 + 存量 {l4Signal.stockScore.toFixed(2)} + 增量 {l4Signal.alphaAdjustment >= 0 ? "+" : ""}{l4Signal.alphaAdjustment.toFixed(2)}。上涨占比 {Math.round(l4Signal.bullRatio * 100)}% · V/MC 活跃占比 {Math.round(l4Signal.vmcActive * 100)}% · goodAlpha {l4Signal.goodAlpha} · badAlpha {l4Signal.badAlpha}</div>}
              <div style={{ fontSize: 10, color: C.labelQ, marginTop: 4, lineHeight: 1.5 }}>
                🟢 进攻：存量普涨 + V/MC高 + 新币筹码分布&承接稳<br />
                🟡 观望：头尾背离 或 新币控盘严重<br />
                🔴 防御：存量全线回撤 + 新币池浅&动量衰减
              </div>
            </div>

          </div>
        </section>

        <section className="lo-record-stage" style={{ marginBottom: 18 }}>
          <div className="lo-record-stage-head">
            <div>
              <div className="lo-section-kicker">Review & Diagnostics</div>
              <div className="lo-section-title">复盘与诊断层</div>
              <div className="lo-section-note">这一层只负责回看过去的判断并确认系统运行状态。摘要与笔记已上浮成全局记录工具，不再埋在页面最后。</div>
            </div>
            <div className="lo-record-stage-key">Workspace Key · {keyForDate(selectedDate)}</div>
          </div>

          <div className="lo-record-grid lo-record-shell">
            <div className="lo-record-panel lo-record-panel-history" style={{ gridColumn: "span 9" }}>
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
                          <div className="lo-record-timeline-meta">Hero：{item.hero?.label || "—"} · F&G：{item.fgVal === "" ? "—" : item.fgVal} · L4：{item.l4?.color ? signalEmoji[item.l4.color] : "—"}</div>
                          <div className="lo-record-timeline-note">笔记：{notePreview(item.note)} {item.hasMacro ? "" : "· 无宏观快照"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lo-record-stack" style={{ gridColumn: "span 3" }}>
              <div className="lo-record-panel lo-record-panel-diagnostics">
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

        {notePanelUi.hidden ? (
          <button className="lo-note-launcher" onClick={openNotePanel} type="button">
            <span className="lo-note-launcher-kicker">Global Note</span>
            <span className="lo-note-launcher-title">{dailyNote ? "继续记录" : "打开便签"}</span>
          </button>
        ) : (
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

        <div style={{ textAlign: "center", padding: "8px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>LiquidityOS v3.1 · L0-L4 四层框架<br />DeFiLlama · CoinGecko · Alternative.me · Binance · GMGN</div>
      </div>
    </div>
  );
}

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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

function formatTimeLabel(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildDailySnapshot({
  selectedDate, macro, macroTime, macroSource,
  heroSignal, l2Signal, l3Signal, fgSignal, l4Signal,
  l0Cycle, l1Manual, fgVal, dailyNote, watchlist, alphaCards,
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
        image: item.image || null,
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
  expansion: { label: "扩张", color: C.green, hint: "偏进攻" },
  transition: { label: "过渡", color: C.orange, hint: "控制仓位" },
  contraction: { label: "收缩", color: C.red, hint: "偏防守" },
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

function MiniTrend({ points = [], color = C.blue, fill = "rgba(0,122,255,0.08)", label = "趋势", suffix = "" }) {
  const clean = points.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return (
      <div style={{ borderRadius: 14, padding: "10px 12px", background: "rgba(15,23,42,0.04)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.labelTer }}>快照不足，暂无趋势图</div>
      </div>
    );
  }
  const pointsStr = buildSvgPoints(clean);
  const last = clean[clean.length - 1];
  const prev = clean[clean.length - 2];
  const delta = last - prev;
  const area = `${pointsStr} 220,52 0,52`;
  return (
    <div style={{ borderRadius: 14, padding: "10px 12px", background: "rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ }}>{label}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>{fmtNum(last)}{suffix}</div>
      </div>
      <svg viewBox="0 0 220 52" width="100%" height="52" preserveAspectRatio="none" role="img" aria-label={label}>
        <path d={`M${area}`} fill={fill} />
        <polyline fill="none" stroke={color} strokeWidth="2.2" points={pointsStr} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 10, color: C.labelTer, marginTop: 6 }}>近 {clean.length} 次快照</div>
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

function WatchlistRow({ row, idx, onChange }) {
  const vmc = row.vmc || "";
  const vmcN = parseFloat(vmc);
  const vmcColor = isNaN(vmcN) ? C.labelQ : vmcN >= 0.5 ? C.green : vmcN >= 0.2 ? C.orange : C.red;
  const chgColor = (v) => { const n = parseFloat(v); return isNaN(n) ? C.labelQ : n > 0 ? C.green : n < 0 ? C.red : C.labelTer; };
  const statusMeta = WATCH_STATUS_OPTS.find((opt) => opt.val === row.status);
  return (
    <div style={{ background: "rgba(255,255,255,0.68)", border: `1px solid ${C.sep}`, borderRadius: 16, padding: 12, marginBottom: 8 }}>
      <div className="lo-watch-status-row" style={{ marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>Token</div>
          <input value={row.token} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder={`#${idx + 1}`} style={{ ...miniInput, textAlign: "left", fontWeight: 700, fontSize: 13, padding: "10px 12px", borderRadius: 10 }} />
        </div>
        <div className="lo-watch-segment">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ }}>状态</div>
            <div style={{ fontSize: 10, color: statusMeta?.c || C.labelTer, fontWeight: 700 }}>{statusMeta?.label || "未设定"}</div>
          </div>
          <WatchPillGroup options={WATCH_STATUS_OPTS} current={row.status} onSelect={(val) => onChange(idx, "status", val)} tone="status" />
        </div>
      </div>

      <div className="lo-watch-metrics-row lo-watch-mobile-secondary" style={{ marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>MCap</div>
          <input value={row.mcap} onChange={(e) => onChange(idx, "mcap", e.target.value)} placeholder="MCap" style={miniInput} inputMode="decimal" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>24h</div>
          <input value={row.chg24h} onChange={(e) => onChange(idx, "chg24h", e.target.value)} placeholder="24h%" style={{ ...miniInput, color: chgColor(row.chg24h) }} inputMode="decimal" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>7d</div>
          <input value={row.chg7d} onChange={(e) => onChange(idx, "chg7d", e.target.value)} placeholder="7d%" style={{ ...miniInput, color: chgColor(row.chg7d) }} inputMode="decimal" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>1m</div>
          <input value={row.chg1m || ""} onChange={(e) => onChange(idx, "chg1m", e.target.value)} placeholder="1m%" style={{ ...miniInput, color: chgColor(row.chg1m) }} inputMode="decimal" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 4 }}>V/MC</div>
          <input value={row.vmc || ""} onChange={(e) => onChange(idx, "vmc", e.target.value)} placeholder="0.45" style={{ ...miniInput, color: vmcColor }} inputMode="decimal" />
        </div>
      </div>

      <div className="lo-watch-judgment-row">
        <div className="lo-watch-segment lo-watch-mobile-secondary">
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ }}>筹码集中度评分</div>
          <WatchPillGroup options={WATCH_CHIPS_OPTS} current={row.chipsScore} onSelect={(val) => onChange(idx, "chipsScore", val)} />
        </div>
        <div className="lo-watch-segment lo-watch-mobile-secondary">
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ }}>池子深度比</div>
          <WatchPillGroup options={WATCH_POOL_OPTS} current={row.poolDepth} onSelect={(val) => onChange(idx, "poolDepth", val)} />
        </div>
        <div className="lo-watch-segment">
          <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ }}>备注</div>
          <input value={row.note || ""} onChange={(e) => onChange(idx, "note", e.target.value)} placeholder="等回踩 / 底仓已建 / 控盘疑虑..." style={{ ...miniInput, textAlign: "left", padding: "10px 12px", borderRadius: 10 }} className="lo-watch-note" />
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
    <div style={{ background: C.fill, borderRadius: 12, padding: "12px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,rgba(175,82,222,0.3),rgba(255,149,0,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.purple, flexShrink: 0 }}>{idx + 1}</div>
        <select value={card.chain || "solana"} onChange={(e) => onChange(idx, "chain", e.target.value)} style={{ border: "none", outline: "none", background: C.fill2, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }}>
          <option value="solana">solana</option>
          <option value="bsc">bsc</option>
        </select>
        <input value={card.token} onChange={(e) => onChange(idx, "token", e.target.value)} placeholder="token address" style={{ flex: 1, border: "none", outline: "none", background: C.fill2, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} />
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
        <div style={{ background: "rgba(120,120,128,0.04)", borderRadius: 10, padding: "9px 10px", marginBottom: 10, border: `1px dashed ${C.sep}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.labelSec }}>自动支撑数据（仅参考）</div>
            <div style={{ fontSize: 10, color: C.labelQ }}>{autoLoading ? "正在从 Worker 拉取" : `更新于 ${formatTimeLabel(autoData?.updated_at)}`}</div>
          </div>
          {autoData?.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{autoData.error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
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
  const [showAllMemeTop, setShowAllMemeTop] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [saveState, setSaveState] = useState({ tone: "idle", label: "未保存", detail: "等待输入变化" });
  const [cacheState, setCacheState] = useState({ tone: "idle", label: "未读取", detail: "当天点击“更新数据”后按默认策略更新" });
  const [viewState, setViewState] = useState({ tone: "idle", label: "等待切换", detail: "切日期后会重载当日快照" });
  const [watchlist, setWatchlist] = useState(buildEmptyWatchlist);
  const [alphaCards, setAlphaCards] = useState(buildEmptyAlphaCards);
  const [alphaAutoData, setAlphaAutoData] = useState({});
  const [alphaAutoLoading, setAlphaAutoLoading] = useState({});

  const today = formatDateLabel(selectedDate);
  const isHydrating = useRef(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);
  const stateFlowVersion = useRef(0);

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
  const memeTopItems = macro?.meme_top?.items || [];
  const visibleMemeTopItems = showAllMemeTop ? memeTopItems : memeTopItems.slice(0, 8);
  const dataFreshLabel = macroLoading ? "更新中" : macroTime ? "已更新" : "待更新";
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
  const historyState = historySummaries.length === 0
    ? { tone: "warn", label: "无历史记录", detail: "还没有任何按日快照" }
    : { tone: "ok", label: `${historySummaries.length} 条记录`, detail: `近 30 天内有 ${macroDays} 天宏观快照` };

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
    fgVal,
    dailyNote,
    watchlist,
    alphaCards,
  })), [selectedDate, macro, macroTime, macroSource, heroSignal, l2Signal, l3Signal, fgSignal, l4Signal, l0Cycle, l1Manual, fgVal, dailyNote, watchlist, alphaCards]);

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
  }, [selectedDate, macro, macroTime, macroSource, l0Cycle, l1Manual, fgVal, dailyNote, watchlist, alphaCards, doSave]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system,'Helvetica Neue',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}textarea,input[type="text"]{appearance:none;-webkit-appearance:none}a{cursor:pointer}`}</style>

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
          <div className="lo-command-grid">
            <div className="lo-command-stack">
              <div className="lo-panel" style={{ padding: "18px 18px 16px" }}>
                <div className="lo-section-kicker">Command Deck</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1.1, color: "#0F172A", marginTop: 6 }}>今天是什么状态</div>
                <div style={{ fontSize: 13, color: C.labelTer, lineHeight: 1.6, marginTop: 10 }}>
                  先看数据时效，再确认仓位偏向和 BTC 位置。第一屏只保留最关键的状态、动作和依据卡。
                </div>
                <div className="lo-badge-row" style={{ marginTop: 14 }}>
                  <div className="lo-badge">工作区 · {isTodayView ? "今日" : "历史"}</div>
                  <div className="lo-badge">仓位偏向 · {l0Info.label}</div>
                  <div className="lo-badge">Hero · {heroSignal.label}</div>
                </div>
                <div className="lo-mini-stats" style={{ marginTop: 14 }}>
                  <div className="lo-mini-stat">
                    <div className="lo-mini-stat-label">当前数据</div>
                    <div className="lo-mini-stat-value">{macroTime ? `${macroSource} · ${macroTime}` : "等待更新"}</div>
                  </div>
                  <div className="lo-mini-stat">
                    <div className="lo-mini-stat-label">BTC 位置</div>
                    <div className="lo-mini-stat-value">{macro?.btc?.vs_ma_200_pct != null ? fmtPct(macro.btc.vs_ma_200_pct) : "—"}</div>
                  </div>
                </div>
              </div>

              {macroError && (
                <div className="lo-panel-soft" style={{ padding: "12px 14px", borderColor: "rgba(255,59,48,0.15)", background: "rgba(255,59,48,0.06)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>更新异常</div>
                  <div style={{ fontSize: 12, color: C.red }}>{macroError}</div>
                </div>
              )}

              <div className="lo-panel-soft" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.labelQ, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>关键状态</div>
                <div className="lo-status-summary">
                  {[
                    { title: "日期层", state: viewState },
                    { title: "保存层", state: saveState },
                    { title: "缓存层", state: cacheState },
                  ].map((item) => {
                    const tone = statusTone[item.state.tone] || statusTone.idle;
                    return (
                      <div key={item.title} className="lo-status-mini">
                        <span style={{ color: C.labelTer }}>{item.title}</span>
                        <span style={{ color: tone.color, fontWeight: 700 }}>{item.state.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lo-surface" style={{ overflow: "hidden" }}>
              <div style={{ padding: "22px 22px 18px", background: heroSignal.bg }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.72)", marginBottom: 8 }}>Hero Control</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.6, color: "#fff", lineHeight: 0.96, marginBottom: 10 }}>{heroSignal.label}</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>{heroSignal.desc}</div>
                  </div>
                  <div style={{ minWidth: 108, textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", marginBottom: 6 }}>Hero 分数</div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", letterSpacing: -1 }}>{heroSignal.score == null ? "—" : heroSignal.score.toFixed(2)}</div>
                  </div>
                </div>
                <div className="lo-badge-row" style={{ marginTop: 14 }}>
                  <div className="lo-badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>L0-A · {l0Info.label}</div>
                  <div className="lo-badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>有效信号 · {heroSignal.count}/4</div>
                </div>
                <div className="lo-status-inline" style={{ marginTop: 12 }}>
                  L0/L1 作为仓位约束单独判断。当前 L0-A：{l0Info.label} · {l0Info.hint}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.9)", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
                {[[l2Signal, "稳定币"], [l3Signal, "Meme 板块"], [fgSignal, "情绪"], [l4Signal, "个股"]].map(([s, l], idx) => (
                  <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 4px", borderRight: idx === 3 ? "none" : `0.5px solid ${C.sep}` }}>
                    <div style={{ fontSize: 18 }}>{s?.color ? signalEmoji[s.color] : "⚪"}</div>
                    <div style={{ fontSize: 10, color: C.labelTer, fontWeight: 700 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lo-command-right">
              <div className="lo-panel" style={{ padding: 18 }}>
                <div className="lo-section-kicker">Actions</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.label, marginTop: 6, marginBottom: 10 }}>现在是什么状态 · 我该点哪里</div>
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
                <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.55, marginTop: 12 }}>
                  日常使用走系统默认更新策略；需要绕过默认缓存或快照策略时，再使用强制更新。
                </div>
              </div>

              <div className="lo-panel-soft" style={{ padding: 16 }}>
                <div className="lo-command-basis">
                  <div className="lo-basis-card">
                    <div className="lo-basis-title">L0-A · 全球流动性周期</div>
                    <div className="lo-badge-row" style={{ marginBottom: 10 }}>
                      {Object.entries(cycleMeta).map(([key, meta]) => {
                        const active = l0Cycle === key;
                        return (
                          <button
                            key={key}
                            onClick={() => { markDirty(); setL0Cycle(key); }}
                            style={{
                              border: active ? `1.5px solid ${meta.color}` : `1px solid ${C.sep}`,
                              background: active ? "rgba(120,120,128,0.08)" : "rgba(255,255,255,0.78)",
                              color: active ? meta.color : C.labelSec,
                              borderRadius: 999,
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "-apple-system,sans-serif",
                            }}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="lo-basis-value" style={{ color: l0Info.color, marginBottom: 6 }}>{l0Info.label}</div>
                    <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.55 }}>全球流动性扩张或收缩决定当前仓位偏进攻还是偏防守，作为 Hero 的上层约束。</div>
                  </div>

                  {macro && (
                    <div className="lo-basis-card">
                      <div className="lo-basis-title">L0-B · BTC 位置</div>
                      <div style={{ marginBottom: 10 }}>
                        <MiniTrend points={trendSeries.btc.length > 1 ? trendSeries.btc : [macro.btc?.price && macro.btc?.change_24h != null ? macro.btc.price / (1 + macro.btc.change_24h / 100) : null, macro.btc?.ma_200, macro.btc?.price].filter((v) => v != null)} color={C.blue} fill="rgba(0,122,255,0.08)" label="BTC 位置辅助" />
                      </div>
                      <div className="lo-mini-stats">
                        <div className="lo-mini-stat">
                          <div className="lo-mini-stat-label">BTC 现价</div>
                          <div className="lo-mini-stat-value">{macro.btc?.price ? "$" + macro.btc.price.toLocaleString() : "—"}</div>
                        </div>
                        <div className="lo-mini-stat">
                          <div className="lo-mini-stat-label">200MA</div>
                          <div className="lo-mini-stat-value">{macro.btc?.ma_200 ? "$" + macro.btc.ma_200.toLocaleString() : "—"}</div>
                        </div>
                        <div className="lo-mini-stat">
                          <div className="lo-mini-stat-label">相对 200MA</div>
                          <div className="lo-mini-stat-value" style={{ color: macro.btc?.vs_ma_200_pct >= 0 ? C.green : C.red }}>{fmtPct(macro.btc?.vs_ma_200_pct)}</div>
                        </div>
                        <div className="lo-mini-stat">
                          <div className="lo-mini-stat-label">MVRV Z-Score</div>
                          <div className="lo-mini-stat-value" style={{ color: C.blue }}>{mvrvManual.score || "—"}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.labelTer, marginTop: 10, lineHeight: 1.55 }}>来源：{macro.btc?.source || "—"} · 更新时间：{macro.btc?.updated_at ? formatTimeLabel(macro.btc.updated_at) : macroTime || "—"} · MVRV：{mvrvManual.source || "—"} / {mvrvManual.date || "未填"}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lo-panel" style={{ padding: 22, marginBottom: 18 }}>
          <div className="lo-section-head">
            <div>
              <div className="lo-section-kicker">Decision Layer</div>
              <div className="lo-section-title">仓位判断依据</div>
              <div className="lo-section-note">把 L1 / L2 / L3 / F&G 收成统一决策带，数字与轻趋势图并存，帮助你更快扫读环境变化。</div>
            </div>
            <div className="lo-badge-row">
              <div className="lo-badge">L1-L3 环境判断</div>
              <div className="lo-badge">轻趋势辅助</div>
              <div className="lo-badge">情绪补充</div>
            </div>
          </div>

          <div className="lo-decision-grid">
            <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: "span 6" }}>
              <div style={secLabel}>L1 · 净流动性</div>
              <div className="lo-trend-wrap">
                <MiniTrend points={trendSeries.l1} color={C.blue} fill="rgba(0,122,255,0.08)" label="GNL 轻趋势" suffix="T" />
                <div style={{ borderRadius: 14, padding: "10px 12px", background: "rgba(15,23,42,0.04)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, marginBottom: 8 }}>自动数据状态</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.blue, letterSpacing: "-0.04em", marginBottom: 6 }}>{hasFredAuto ? `${macro.fred.gnl.value_t}T` : "—"}</div>
                  <div style={{ fontSize: 11, color: C.labelTer, lineHeight: 1.55 }}>{hasFredAuto ? `来源 ${fredSource} · ${fredDate || "—"}` : "自动数据缺失时继续保留手动兜底与自动 GNL 计算。"}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 10, padding: "8px 10px", background: C.fill, borderRadius: 10, lineHeight: 1.55 }}>净流动性由 Fed、TGA、RRP 共同决定，反映市场可用美元背景。自动数据优先来自 Worker 聚合；缺失时仍可手动录入并自动计算 GNL。</div>
              {hasFredAuto ? (
                <>
                  <DataRow label="GNL" value={macro.fred.gnl.value_t + "T"} color={C.blue} />
                  <DataRow label="Fed" value={macro.fred.fed?.value ? (macro.fred.fed.value / 1e6).toFixed(3) + "T" : "—"} sub={macro.fred.fed?.date} />
                  <DataRow label="TGA" value={macro.fred.tga?.value ? (macro.fred.tga.value / 1e6).toFixed(3) + "T" : "—"} />
                  <DataRow label="RRP" value={macro.fred.rrp?.value ? (macro.fred.rrp.value / 1e3).toFixed(3) + "T" : "—"} />
                  <div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>来源：{fredSource} · 数据日期：{fredDate || "—"} · 更新时间：{fredUpdatedAt ? formatTimeLabel(fredUpdatedAt) : "—"}</div>
                  <div style={{ height: 1, background: C.sep, margin: "10px 0" }} />
                </>
              ) : (
                <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10, marginBottom: 10 }}>{macro ? "FRED Key 未设置，当前使用手动录入。单位统一按 T 输入，例如 `6.600`。" : "尚未刷新宏观数据，可先手动录入 L1。单位统一按 T 输入，例如 `6.600`。"}</div>
              )}
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
                <div style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(0,122,255,0.08)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>手动 GNL</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{manualGnl == null ? "—" : manualGnl.toFixed(3) + "T"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: C.labelTer }}>Fed：{fmtTrillionsFromInput(l1Manual.fed)}</div>
                <div style={{ fontSize: 11, color: C.labelTer }}>TGA：{fmtTrillionsFromInput(l1Manual.tga)}</div>
                <div style={{ fontSize: 11, color: C.labelTer }}>RRP：{fmtTrillionsFromInput(l1Manual.rrp)}</div>
              </div>
            </div>

            {macro && (
              <>
                <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: "span 3" }}>
                  <div style={secLabel}>{signalEmoji[l2Signal?.color] || "⚪"} L2 · 稳定币弹药</div>
                  <div className="lo-trend-wrap">
                    <MiniTrend points={trendSeries.l2} color={C.green} fill="rgba(52,199,89,0.08)" label="稳定币总量" />
                  </div>
                  <DataRow label="稳定币总市值" value={fmtB(macro.stablecoins?.total)} />
                  <DataRow label="7日净变化" value={macro.stablecoins?.change_7d != null ? (macro.stablecoins.change_7d > 0 ? "+" : "") + fmtNum(macro.stablecoins.change_7d) : "—"} sub={fmtPct(macro.stablecoins?.change_7d_pct)} color={macro.stablecoins?.change_7d >= 0 ? C.green : C.red} />
                  <div style={{ height: 1, background: C.sep, margin: "8px 0" }} />
                  <DataRow label="Solana TVL" value={fmtB(macro.tvl?.solana)} />
                  <DataRow label="ETH TVL" value={fmtB(macro.tvl?.ethereum)} />
                  <DataRow label="BSC TVL" value={fmtB(macro.tvl?.bsc)} />
                  <div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>L2 评分 {l2Signal.score.toFixed(2)} · {l2Signal.reason}</div>
                </div>

                <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: "span 3" }}>
                  <div style={secLabel}>{signalEmoji[l3Signal?.color] || "⚪"} L3 · Meme 板块</div>
                  <div className="lo-trend-wrap">
                    <MiniTrend points={trendSeries.l3} color={C.purple} fill="rgba(175,82,222,0.08)" label="Meme 热度" />
                  </div>
                  <DataRow label="Meme 总市值" value={macro.meme?.mcap ? fmtB(macro.meme.mcap) : "—"} sub={macro.meme?.mcap_change_24h != null ? "24h " + fmtPct(macro.meme.mcap_change_24h) : null} color={macro.meme?.mcap_change_24h >= 0 ? C.green : C.red} />
                  <div style={{ height: 1, background: C.sep, margin: "8px 0" }} />
                  <DataRow label="Solana DEX 24h" value={fmtB(macro.dex_volume?.solana?.total_24h)} sub={macro.dex_volume?.solana?.change_1d_pct != null ? "1d " + fmtPct(macro.dex_volume.solana.change_1d_pct) : null} color={macro.dex_volume?.solana?.change_1d_pct >= 0 ? C.green : C.red} />
                  <DataRow label="Base DEX 24h" value={fmtB(macro.dex_volume?.base?.total_24h)} />
                  <DataRow label="BSC DEX 24h" value={fmtB(macro.dex_volume?.bsc?.total_24h)} />
                  <div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>L3 评分 {l3Signal.score.toFixed(2)} · {l3Signal.reason}</div>
                </div>
              </>
            )}

            <div className="lo-panel-soft lo-decision-card lo-decision-compact" style={{ gridColumn: "span 6" }}>
              <div style={secLabel}>{signalEmoji[fgSignal.color] || "⚪"} 情绪补充 · F&G</div>
              <div className="lo-trend-wrap" style={{ gridTemplateColumns: "1fr" }}>
                <MiniTrend points={trendSeries.fg} color={C.orange} fill="rgba(255,149,0,0.10)" label="情绪轻趋势" />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>F&G</span><input value={fgVal} onChange={(e) => { markDirty(); setFgVal(e.target.value.replace(/\D/, "")); }} maxLength={3} placeholder="—" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, color: parseInt(fgVal) >= 55 ? C.green : parseInt(fgVal) >= 30 ? C.orange : C.red, border: "none", outline: "none", background: "transparent", width: 80, textAlign: "right", fontFamily: "-apple-system,sans-serif" }} /></div>
              <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>{fgVal && <div style={{ position: "absolute", top: "50%", left: Math.max(2, Math.min(98, parseInt(fgVal) || 0)) + "%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.labelQ, marginTop: 8 }}>{["极度恐惧", "恐惧", "中性", "贪婪", "极度贪婪"].map((l) => <span key={l}>{l}</span>)}</div>
              <div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>F&G 评分 {fgSignal.score.toFixed(2)} · {fgSignal.reason}</div>
            </div>
          </div>
        </section>

        <section className="lo-panel" style={{ padding: 22, marginBottom: 18 }}>
          <div className="lo-section-head">
            <div>
              <div className="lo-section-kicker">L4 Workbench</div>
              <div className="lo-section-title">{l4Signal?.color ? signalEmoji[l4Signal.color] : "⚪"} Meme 存量与增量结构</div>
              <div className="lo-section-note">先看自动市场面板，再回到 watchlist 和 Alpha Scanner 进行手动执行判断。</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["CoinGecko Meme", "https://www.coingecko.com/en/categories/meme-token", "rgba(52,199,89,0.12)", C.green], ["DEX Screener", "https://dexscreener.com/solana", "rgba(0,122,255,0.10)", C.blue], ["GMGN", "https://gmgn.ai", "rgba(175,82,222,0.10)", C.purple]].map(([l, h, bg, c]) => <a key={l} href={h} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, background: bg, color: c, borderRadius: 999, padding: "6px 10px", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>🔗 {l}</a>)}
            </div>
          </div>

          <div className="lo-l4-grid">
            <div className="lo-workbench-panel lo-panel-soft lo-l4-main-panel" style={{ gridColumn: "span 8" }}>
              <div className="lo-workbench-subhead">
                <div>
                  <div className="lo-section-kicker">手动决策面板</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.label, marginTop: 4 }}>存量观测站</div>
                  <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.6, marginTop: 6, maxWidth: 520 }}>这里是你的主观重点跟踪币工作台，用来管理最近看好、准备建仓或已经有仓位的核心目标。</div>
                </div>
                <ActionButton kind="secondary" onClick={addWatchRow} disabled={watchlist.length >= 10} style={{ padding: "10px 14px" }}>
                  添加行
                </ActionButton>
              </div>

              <div className="lo-workbench-lead">
                <div className="lo-badge-row">
                  <div className="lo-badge">观察中 · {watchStatusCounts.watching}</div>
                  <div className="lo-badge">准备建仓 · {watchStatusCounts.ready}</div>
                  <div className="lo-badge">已有仓位 · {watchStatusCounts.position}</div>
                </div>
                <div className="lo-workbench-lead-note">优先判断 Token / 状态 / 24h / V/MC，再回看 7d、1m、筹码与池深。</div>
              </div>

              <div className="lo-panel" style={{ padding: "16px", boxShadow: "none", borderRadius: 18 }}>
                <div className="lo-watch-head-grid">
                  {["Token / 状态", "MCap", "24h / 7d / 1m", "V/MC", "筹码 / 池深 / 备注"].map((h) => <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.labelQ, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>)}
                </div>
                {watchlist.map((row, idx) => <WatchlistRow key={idx} row={row} idx={idx} onChange={updWatch} />)}
                <div style={{ fontSize: 10, color: C.labelQ, marginTop: 10, lineHeight: 1.55 }}>V/MC ≥ 0.5 🟢 活跃 · 0.2-0.5 🟡 一般 · &lt;0.2 🔴 低迷。手机端默认突出 Token、状态、24h 与 V/MC，其余字段自动下沉为次层信息。</div>
              </div>
            </div>

            <div className="lo-l4-side" style={{ gridColumn: "span 4" }}>
              <div className="lo-workbench-panel lo-panel-soft lo-l4-side-panel">
                <div className="lo-workbench-subhead">
                  <div>
                    <div className="lo-section-kicker">自动市场面板</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.label, marginTop: 4 }}>Top 50 Meme 榜单</div>
                    <div style={{ fontSize: 11, color: C.labelTer, lineHeight: 1.55, marginTop: 6 }}>作为辅助观察区使用，先看市场热度，再回到你的主观观察台执行判断。</div>
                  </div>
                  {memeTopItems.length > 8 && (
                    <ActionButton kind="text" onClick={() => setShowAllMemeTop((v) => !v)}>
                      {showAllMemeTop ? "收起" : `查看更多 (${memeTopItems.length})`}
                    </ActionButton>
                  )}
                </div>
                <div className="lo-top50-caption" style={{ marginBottom: 12 }}>来源 {macro?.meme_top?.source || "CMC"} · 更新时间 {macro?.meme_top?.updated_at ? formatTimeLabel(macro.meme_top.updated_at) : macroTime || "—"}</div>
                {memeTopItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.labelTer, padding: "10px 12px", background: C.fill, borderRadius: 10 }}>更新数据后，这里会显示 Top 50 Meme 榜单。</div>
                ) : (
                  <div className="lo-scroll-table lo-top50-table">
                    <div style={{ minWidth: 760 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "38px 150px 110px 110px 80px 80px 110px", gap: 8, padding: "0 4px 8px", borderBottom: `1px solid ${C.sep}` }}>
                        {["#", "Token", "Price", "MCap", "24h", "7d", "Vol 24h"].map((head) => (
                          <div key={head} style={{ fontSize: 10, fontWeight: 700, color: C.labelQ, textTransform: "uppercase", letterSpacing: "0.05em" }}>{head}</div>
                        ))}
                      </div>
                      {visibleMemeTopItems.map((item) => (
                        <div key={`${item.rank}-${item.token}`} style={{ display: "grid", gridTemplateColumns: "38px 150px 110px 110px 80px 80px 110px", gap: 8, padding: "9px 4px", borderBottom: `0.5px solid ${C.sep}`, alignItems: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.labelSec }}>{item.rank || "—"}</div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.label }}>{item.token || "—"}</div>
                            <div style={{ fontSize: 10, color: C.labelTer }}>{item.name || "—"}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.label }}>{item.price != null ? `$${item.price >= 1 ? item.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : item.price.toFixed(6)}` : "—"}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.label }}>{fmtB(item.market_cap)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: item.change_24h_pct >= 0 ? C.green : C.red }}>{fmtPct(item.change_24h_pct)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: item.change_7d_pct >= 0 ? C.green : C.red }}>{fmtPct(item.change_7d_pct)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.label }}>{fmtB(item.volume_24h)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lo-workbench-panel lo-panel-soft lo-l4-side-panel">
                <div className="lo-workbench-subhead">
                  <div>
                    <div className="lo-section-kicker">增量机会区</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.label, marginTop: 4 }}>Alpha Scanner</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 10 }}>自动支撑数据只作为参考层，最终判断仍由手动输入决定。</div>
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
          </div>
        </section>

        <section className="lo-record-grid" style={{ marginBottom: 18 }}>
          <div className="lo-panel" style={{ gridColumn: "span 4", padding: 18 }}>
            <div className="lo-section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="lo-section-kicker">Workspace</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.label, marginTop: 4 }}>历史回看</div>
              </div>
              <div style={{ fontSize: 11, color: C.labelTer }}>Key: {keyForDate(selectedDate)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "84px 84px 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <button onClick={() => setSelectedDate(todayValue)} style={{ border: selectedDate === todayValue ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`, background: selectedDate === todayValue ? "rgba(0,122,255,0.08)" : "transparent", color: selectedDate === todayValue ? C.blue : C.labelSec, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>今天</button>
              <button onClick={() => setSelectedDate(yesterdayValue)} style={{ border: selectedDate === yesterdayValue ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`, background: selectedDate === yesterdayValue ? "rgba(0,122,255,0.08)" : "transparent", color: selectedDate === yesterdayValue ? C.blue : C.labelSec, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>昨天</button>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...miniInput, textAlign: "left", padding: "8px 10px" }} />
            </div>
            <div style={{ fontSize: 11, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10, lineHeight: 1.55 }}>{isTodayView ? "当前是今日工作区，可更新数据" : "当前是历史快照视图，只读取本地已保存记录"}。当天点击“更新数据”会按默认策略读取缓存或请求网络；点击“强制更新”才会跳过默认缓存策略。</div>
          </div>

          <div className="lo-panel" style={{ gridColumn: "span 5", padding: 18 }}>
            <div className="lo-section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="lo-section-kicker">Journal</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.label, marginTop: 4 }}>今日交易笔记</div>
              </div>
            </div>
            <textarea placeholder="记录市场观察、入场理由、止损位..." value={dailyNote} onChange={(e) => { markDirty(); setDailyNote(e.target.value); }} style={{ width: "100%", minHeight: 180, border: "none", outline: "none", padding: "0 2px", fontFamily: "-apple-system,sans-serif", fontSize: 15, color: C.label, lineHeight: 1.65, resize: "none", background: "transparent" }} />
          </div>

          <div className="lo-record-stack" style={{ gridColumn: "span 3" }}>
            <div className="lo-panel" style={{ padding: 18 }}>
              <div className="lo-section-kicker">History</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.label, marginTop: 4, marginBottom: 12 }}>近 30 天摘要</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 10 }}>
                {[
                  { key: "all", label: "全部" },
                  { key: "macro", label: "有宏观" },
                  { key: "notes", label: "有笔记" },
                  { key: "attack", label: "进攻日" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setHistoryFilter(opt.key)}
                    style={{
                      border: historyFilter === opt.key ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`,
                      background: historyFilter === opt.key ? "rgba(0,122,255,0.08)" : "transparent",
                      color: historyFilter === opt.key ? C.blue : C.labelSec,
                      borderRadius: 10,
                      padding: "8px 6px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "-apple-system,sans-serif",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 10 }}>
                {[["记录", filteredHistory.length], ["宏观", macroDays], ["Hero", avgHeroScore == null ? "—" : avgHeroScore.toFixed(2)], ["F&G", avgFg == null ? "—" : avgFg.toFixed(0)]].map(([label, value]) => (
                  <div key={label} style={{ background: C.fill, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.label }}>{value}</div>
                  </div>
                ))}
              </div>
              {historySummaries.length === 0 ? (
                <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>还没有可展示的历史记录。</div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 10 }}>当前筛选条件下没有匹配记录。</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflow: "auto" }}>
                  {filteredHistory.map((item) => {
                    const active = item.dateValue === selectedDate;
                    return (
                      <button
                        key={item.dateValue}
                        onClick={() => setSelectedDate(item.dateValue)}
                        style={{
                          border: active ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`,
                          background: active ? "rgba(0,122,255,0.06)" : "transparent",
                          borderRadius: 10,
                          padding: "10px 12px",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "-apple-system,sans-serif",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.blue : C.label }}>{formatDateLabel(item.dateValue)}</div>
                          <div style={{ fontSize: 10, color: C.labelTer }}>{item.savedAt ? new Date(item.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                        </div>
                        <div style={{ fontSize: 11, color: C.labelSec, marginTop: 6 }}>Hero：{item.hero?.label || "—"} · F&G：{item.fgVal === "" ? "—" : item.fgVal} · L4：{item.l4?.color ? signalEmoji[item.l4.color] : "—"}</div>
                        <div style={{ fontSize: 11, color: C.labelTer, marginTop: 6 }}>笔记：{notePreview(item.note)} {item.hasMacro ? "" : "· 无宏观快照"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lo-panel" style={{ padding: "14px 16px" }}>
              <button onClick={() => setShowSystemStatus((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>
                <div>
                  <div className="lo-section-kicker">Diagnostics</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.label, marginTop: 4, textAlign: "left" }}>系统状态</div>
                </div>
                <span className="lo-btn lo-btn-text" style={{ color: C.blue }}>
                  <span className="lo-btn-token"><PatrickMark color={C.blue} size={11} /></span>
                  <span>{showSystemStatus ? "收起" : "展开"}</span>
                </span>
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 12 }}>
                {[
                  { title: "日期", state: viewState },
                  { title: "保存", state: saveState },
                  { title: "缓存", state: cacheState },
                  { title: "历史", state: historyState },
                ].map((item) => {
                  const tone = statusTone[item.state.tone] || statusTone.idle;
                  return (
                    <div key={item.title} style={{ borderRadius: 10, padding: "8px 10px", background: "rgba(120,120,128,0.06)" }}>
                      <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tone.color }}>{item.state.label}</div>
                    </div>
                  );
                })}
              </div>
              {showSystemStatus && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 12 }}>
                  {[
                    { title: "日期切换层", state: viewState },
                    { title: "快照保存层", state: saveState },
                    { title: "缓存读取层", state: cacheState },
                    { title: "历史汇总层", state: historyState },
                  ].map((item) => {
                    const tone = statusTone[item.state.tone] || statusTone.idle;
                    return (
                      <div key={item.title} style={{ borderRadius: 12, padding: "10px 12px", background: tone.bg }}>
                        <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tone.color, marginBottom: 4 }}>{item.state.label}</div>
                        <div style={{ fontSize: 11, color: C.labelSec, lineHeight: 1.45 }}>{item.state.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <div style={{ textAlign: "center", padding: "8px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>LiquidityOS v3.1 · L0-L4 四层框架<br />DeFiLlama · CoinGecko · Alternative.me · Binance · GMGN</div>
      </div>
    </div>
  );
}

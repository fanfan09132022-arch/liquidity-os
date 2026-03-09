import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// ── Macro data via Claude API direct search ──
const WORKER_URL = "https://liquidityos-data.fanfan09132022.workers.dev";

async function fetchMacroViaAI() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Search for the following current crypto market data and return ONLY a JSON object.\n\nData needed:\n1. Bitcoin current price in USD and 24h change %\n2. Crypto Fear & Greed Index value (from alternative.me)\n3. Total stablecoin market cap and 7-day change (from defillama)\n4. Solana, Ethereum, BSC TVL (from defillama)\n5. Solana and BSC stablecoin net inflow over 7d (from defillama)\n6. Meme token total market cap (from coingecko)\n7. Solana DEX 24h volume, Base DEX 24h volume, BSC DEX 24h volume (from defillama)\n\nReturn ONLY this JSON format, no other text. Start with { end with }:\n{"fear_greed":{"value":NUMBER,"label":"TEXT"},"btc":{"price":NUMBER,"change_24h":NUMBER},"meme":{"mcap":NUMBER,"mcap_change_24h":NUMBER},"tvl":{"solana":NUMBER,"ethereum":NUMBER,"bsc":NUMBER},"stablecoins":{"total":NUMBER,"change_7d":NUMBER,"change_7d_pct":NUMBER},"chain_stablecoins":{"solana":{"net_inflow_7d":NUMBER},"bsc":{"net_inflow_7d":NUMBER}},"dex_volume":{"solana":{"total_24h":NUMBER,"change_1d_pct":NUMBER},"base":{"total_24h":NUMBER,"change_1d_pct":NUMBER},"bsc":{"total_24h":NUMBER,"change_1d_pct":NUMBER}}}` }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const allText = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("\n");
  if (!allText.trim()) throw new Error("AI 未返回数据");
  const codeBlock = allText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlock) return JSON.parse(codeBlock[1]);
  const jsonMatch = allText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("未找到 JSON 数据");
  return JSON.parse(jsonMatch[0]);
}

async function fetchMacroViaWorker() {
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

function normalizeMacroData(raw = {}) {
  return {
    fear_greed: {
      value: toNum(raw.fear_greed?.value),
      label: raw.fear_greed?.label || null,
    },
    btc: {
      price: toNum(raw.btc?.price),
      change_24h: toNum(raw.btc?.change_24h),
      source: raw.btc?.source || null,
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
  if (sigScore == null) return { label: "等待数据", bg: "linear-gradient(140deg,#8E8E93,#636366)", desc: "点击「一键刷新」· 约需 10-20 秒" };
  if (sigScore >= 0.7) return { label: "进　攻", bg: "linear-gradient(140deg,#34C759,#30D158)", desc: "多层共振看涨" };
  if (sigScore >= 0.5) return { label: "积　极", bg: "linear-gradient(140deg,#007AFF,#5AC8FA)", desc: "整体偏多 · 选择性参与" };
  if (sigScore >= 0.35) return { label: "观　望", bg: "linear-gradient(140deg,#FF9500,#FFCC00)", desc: "信号分歧 · 等待确认" };
  return { label: "防　御", bg: "linear-gradient(140deg,#FF3B30,#FF6B35 60%,#FF9500)", desc: "多层偏空 · 缩减仓位" };
}

// L4 signal: watchlist + alpha scanner
function calcL4SignalDetail(watchlist, alphaCards) {
  const filled = watchlist.filter(r => r.token && r.mcap);
  const alphaFilled = alphaCards.filter(a => a.token);
  if (filled.length === 0 && alphaFilled.length === 0) return null;

  const activeCount = filled.filter(r => {
    const mcap = toNum(r.mcap);
    const vol24h = toNum(r.vol24h);
    if (mcap == null || mcap <= 0 || vol24h == null) return false;
    return (vol24h / mcap) >= 0.3;
  }).length;
  const bullCount = filled.filter(r => parseFloat(r.chg24h) > 0).length;

  const goodAlpha = alphaFilled.filter(a => (a.chips === "spread" || a.chips === "retail") && (a.momentum === "surge" || a.momentum === "stable")).length;
  const badAlpha = alphaFilled.filter(a => a.momentum === "decay" && toNum(a.poolStrength) < 0.5).length;

  const bullRatio = filled.length > 0 ? bullCount / filled.length : 0;
  const vmcActive = filled.length > 0 ? activeCount / filled.length : 0;
  const stockScore = bullRatio * 0.4 + vmcActive * 0.3;
  const alphaAdjustment = (goodAlpha > 0 ? 0.2 : 0) + (badAlpha > 0 ? -0.15 : 0);
  let score = 0.5;
  if (filled.length > 0) {
    score += stockScore;
  }
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
  const activeSignals = signals.filter(s => s && s.color);
  if (activeSignals.length === 0) return { score: null, color: null, count: 0, reason: "暂无有效信号", ...getHeroInfo(null) };
  const score = parseFloat((activeSignals.reduce((sum, s) => sum + (s.score ?? signalToScore(s.color)), 0) / activeSignals.length).toFixed(3));
  const hero = getHeroInfo(score);
  const color = score >= 0.7 ? "green" : score >= 0.5 ? "blue" : score >= 0.35 ? "yellow" : "red";
  const reason = activeSignals.map(s => s.reason).filter(Boolean).join(" | ");
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

// ── STYLES ──
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

// ── L4: WATCHLIST ROW ──
function WatchlistRow({ row, idx, onChange }) {
  const vmc = (row.mcap && row.vol24h) ? (parseFloat(row.vol24h) / parseFloat(row.mcap)).toFixed(2) : "";
  const vmcN = parseFloat(vmc);
  const vmcColor = isNaN(vmcN) ? C.labelQ : vmcN >= 0.5 ? C.green : vmcN >= 0.2 ? C.orange : C.red;
  const chgColor = (v) => { const n = parseFloat(v); return isNaN(n) ? C.labelQ : n > 0 ? C.green : n < 0 ? C.red : C.labelTer; };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px 65px 50px 50px 50px 50px", gap: 4, marginBottom: 4, alignItems: "center" }}>
      <input value={row.token} onChange={e => onChange(idx, "token", e.target.value)} placeholder={`#${idx + 1}`} style={{ ...miniInput, textAlign: "left", fontWeight: 700, fontSize: 11 }} />
      <input value={row.mcap} onChange={e => onChange(idx, "mcap", e.target.value)} placeholder="MCap" style={miniInput} inputMode="decimal" />
      <input value={row.chg24h} onChange={e => onChange(idx, "chg24h", e.target.value)} placeholder="24h%" style={{ ...miniInput, color: chgColor(row.chg24h) }} inputMode="decimal" />
      <input value={row.chg7d} onChange={e => onChange(idx, "chg7d", e.target.value)} placeholder="7d%" style={{ ...miniInput, color: chgColor(row.chg7d) }} inputMode="decimal" />
      <input value={row.vol24h || ""} onChange={e => onChange(idx, "vol24h", e.target.value)} placeholder="Vol" style={miniInput} inputMode="decimal" />
      <div style={{ ...miniInput, background: "transparent", color: vmcColor, padding: "5px 2px" }}>{vmc || "—"}</div>
    </div>
  );
}

// ── L4: ALPHA CARD ──
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

function AlphaCard({ card, idx, onChange }) {
  const optBtn = (opts, field, current) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${opts.length},1fr)`, gap: 4 }}>
      {opts.map(o => {
        const sel = current === o.val;
        return <button key={o.val} onClick={() => onChange(idx, field, sel ? "" : o.val)} style={{ border: sel ? `1.5px solid ${o.c}` : "1.5px solid rgba(60,60,67,0.15)", borderRadius: 8, padding: "6px 2px", fontSize: 10, fontWeight: 600, cursor: "pointer", background: sel ? o.b : "transparent", color: sel ? o.c : C.labelTer, transition: "all 0.15s", fontFamily: "-apple-system,sans-serif" }}>{o.label}</button>;
      })}
    </div>
  );
  return (
    <div style={{ background: C.fill, borderRadius: 12, padding: "12px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,rgba(175,82,222,0.3),rgba(255,149,0,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.purple, flexShrink: 0 }}>{idx + 1}</div>
        <input value={card.token} onChange={e => onChange(idx, "token", e.target.value)} placeholder="$TICKER 或合约" style={{ flex: 1, border: "none", outline: "none", background: C.fill2, borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>筹码集中度</div>
      {optBtn(CHIP_OPTS, "chips", card.chips)}
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginTop: 10, marginBottom: 4 }}>资金动量</div>
      {optBtn(MOMENTUM_OPTS, "momentum", card.momentum)}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>池子强度 (Liq/Vol)</div>
          <input value={card.poolStrength || ""} onChange={e => onChange(idx, "poolStrength", e.target.value)} placeholder="0.8" style={miniInput} inputMode="decimal" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>备注</div>
          <input value={card.note || ""} onChange={e => onChange(idx, "note", e.target.value)} placeholder="简要判断..." style={{ ...miniInput, textAlign: "left" }} />
        </div>
      </div>
    </div>
  );
}

// ── EMPTY WATCHLIST & ALPHA ──
const emptyWatchRow = () => ({ token: "", mcap: "", chg24h: "", chg7d: "", vol24h: "" });
const emptyAlpha = () => ({ token: "", chips: "", momentum: "", poolStrength: "", note: "" });
const buildEmptyWatchlist = () => Array.from({ length: 5 }, emptyWatchRow);
const buildEmptyAlphaCards = () => Array.from({ length: 3 }, emptyAlpha);

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
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
  const [fgVal, setFgVal] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySummaries, setHistorySummaries] = useState([]);
  const [saveState, setSaveState] = useState({ tone: "idle", label: "未保存", detail: "等待输入变化" });
  const [cacheState, setCacheState] = useState({ tone: "idle", label: "未读取", detail: "当天点击“读取缓存”后更新" });
  const [viewState, setViewState] = useState({ tone: "idle", label: "等待切换", detail: "切日期后会重载当日快照" });
  // L4
  const [watchlist, setWatchlist] = useState(buildEmptyWatchlist);
  const [alphaCards, setAlphaCards] = useState(buildEmptyAlphaCards);

  const today = formatDateLabel(selectedDate);
  const isHydrating = useRef(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);

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
    setFgVal("");
    setDailyNote("");
    setWatchlist(buildEmptyWatchlist());
    setAlphaCards(buildEmptyAlphaCards());
  }, []);

  // ── STORAGE ──
  useEffect(() => {
    (async () => {
      isHydrating.current = true;
      pendingSave.current = false;
      setViewState({ tone: "info", label: "切换中", detail: `正在读取 ${selectedDate} 的本地快照` });
      setCacheState({
        tone: selectedDate === todayValue ? "idle" : "warn",
        label: selectedDate === todayValue ? "未读取" : "历史只读",
        detail: selectedDate === todayValue ? "当天点击“读取缓存”后更新" : "历史日期不请求网络，只读本地快照",
      });
      resetDailyState();
      try {
        const r = await window.storage.get(keyForDate(selectedDate));
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.macroSnapshot) setMacro(normalizeMacroData(d.macroSnapshot));
          if (d.macroMeta?.time) setMacroTime(d.macroMeta.time);
          if (d.macroMeta?.source) setMacroSource(d.macroMeta.source);
          if (d.l0Cycle) setL0Cycle(d.l0Cycle);
          if (d.l1Manual && typeof d.l1Manual === "object") setL1Manual(prev => ({ ...prev, ...d.l1Manual }));
          if (d.fgVal != null) setFgVal(d.fgVal);
          if (d.dailyNote != null) setDailyNote(d.dailyNote);
          if (Array.isArray(d.watchlist)) setWatchlist(d.watchlist);
          if (Array.isArray(d.alphaCards)) setAlphaCards(d.alphaCards);
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
        setViewState({ tone: "bad", label: "切换失败", detail: `${selectedDate} 快照读取异常` });
        setSaveState({ tone: "bad", label: "读取失败", detail: `${selectedDate} 无法确认保存状态` });
      }
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
      } catch {}
    }
    setHistorySummaries(items);
  }, []);

  useEffect(() => {
    refreshHistorySummaries();
  }, [refreshHistorySummaries]);

  // ── MACRO REFRESH ──
  const handleMacroRefresh = useCallback(async (force = false) => {
    if (selectedDate !== todayValue) {
      setCacheState({ tone: "warn", label: "历史只读", detail: "历史日期不请求网络，只读本地快照" });
      return;
    }
    if (force) {
      setCacheState({ tone: "info", label: "强制刷新", detail: "已跳过本地缓存，准备请求网络" });
    }
    if (!force) {
      try {
        const cached = await window.storage.get(keyForDate(selectedDate));
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
        setCacheState({ tone: "bad", label: "缓存异常", detail: "本地快照读取失败，改走网络请求" });
      }
    }
    setMacroLoading(true); setMacroError("");
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
      setMacroError("❌ " + e.message);
      setCacheState({ tone: "bad", label: "刷新失败", detail: e.message || "网络请求失败" });
    }
    finally { setMacroLoading(false); }
  }, [selectedDate, todayValue, macroTime]);

  // ── L4 handlers ──
  const updWatch = (idx, field, val) => {
    markDirty();
    setWatchlist(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };
  const updAlpha = (idx, field, val) => {
    markDirty();
    setAlphaCards(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const updL1Manual = (field, val) => {
    markDirty();
    setL1Manual(prev => ({ ...prev, [field]: val }));
  };
  const addWatchRow = () => {
    if (watchlist.length < 10) {
      markDirty();
      setWatchlist(prev => [...prev, emptyWatchRow()]);
    }
  };
  const removeWatchRow = (idx) => {
    markDirty();
    setWatchlist(prev => prev.filter((_, i) => i !== idx));
  };

  // ── SIGNALS ──
  const l0Info = cycleMeta[l0Cycle] || cycleMeta.transition;
  const isTodayView = selectedDate === todayValue;
  const manualGnl = calcManualGnl(l1Manual.fed, l1Manual.tga, l1Manual.rrp);
  const hasFredAuto = !!macro?.fred?.gnl;
  const l2Signal = useMemo(() => (macro ? calcL2SignalDetail(macro) : null), [macro]);
  const l3Signal = useMemo(() => (macro ? calcL3SignalDetail(macro) : null), [macro]);
  const fgSignal = useMemo(() => calcFGSignalDetail(parseInt(fgVal) || null), [fgVal]);
  const l4Signal = useMemo(() => calcL4SignalDetail(watchlist, alphaCards), [watchlist, alphaCards]);
  const heroSignal = useMemo(() => calcHeroSignal([l2Signal, l3Signal, fgSignal, l4Signal]), [l2Signal, l3Signal, fgSignal, l4Signal]);
  const filteredHistory = historySummaries.filter(item => {
    if (historyFilter === "macro") return item.hasMacro;
    if (historyFilter === "notes") return !!item.note;
    if (historyFilter === "attack") return item.hero?.label === "进　攻";
    return true;
  });
  const historyWithHero = filteredHistory.filter(item => item.hero?.score != null);
  const avgHeroScore = historyWithHero.length > 0 ? (historyWithHero.reduce((sum, item) => sum + item.hero.score, 0) / historyWithHero.length) : null;
  const avgFg = filteredHistory.filter(item => item.fgVal !== "" && !isNaN(Number(item.fgVal))).length > 0
    ? (filteredHistory.filter(item => item.fgVal !== "" && !isNaN(Number(item.fgVal))).reduce((sum, item) => sum + Number(item.fgVal), 0) / filteredHistory.filter(item => item.fgVal !== "" && !isNaN(Number(item.fgVal))).length)
    : null;
  const macroDays = filteredHistory.filter(item => item.hasMacro).length;
  const attackDays = filteredHistory.filter(item => item.hero?.label === "进　攻").length;
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

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(242,242,247,0.88)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: "0.5px solid #C6C6C8" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>LiquidityOS</div><div style={{ fontSize: 12, color: C.labelTer, marginTop: 1 }}>{macroTime ? `${macroTime} 更新 · ${macroSource}` : today}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isTodayView && <button onClick={() => handleMacroRefresh(true)} disabled={macroLoading} style={{ background: "transparent", color: macroLoading ? C.labelQ : C.blue, border: `1px solid ${C.sep}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: macroLoading ? "default" : "pointer", fontFamily: "-apple-system,sans-serif" }}>强制刷新</button>}
            <button onClick={() => handleMacroRefresh(false)} disabled={macroLoading || !isTodayView} style={{ background: (macroLoading || !isTodayView) ? "rgba(0,122,255,0.4)" : C.blue, color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: (macroLoading || !isTodayView) ? "default" : "pointer", fontFamily: "-apple-system,sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
              {macroLoading ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> : "⚡"}{!isTodayView ? "历史快照" : macroLoading ? "搜索中…" : "读取缓存"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 0 48px" }}>
        {/* HERO */}
        <div style={{ margin: "0 16px 16px", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.07)", animation: "rise 0.45s both" }}>
          <div style={{ padding: "22px 20px 20px", background: heroSignal.bg }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>系统综合信号</div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2, color: "#fff", lineHeight: 1, marginBottom: 10 }}>{heroSignal.label}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>{heroSignal.desc}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.74)", lineHeight: 1.45 }}>L0/L1 作为仓位约束单独判断。当前 L0-A：{l0Info.label} · {l0Info.hint}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.74)" }}>Hero 分数：{heroSignal.score == null ? "—" : heroSignal.score.toFixed(2)} · 有效信号 {heroSignal.count}/4</div>
          </div>
          <div style={{ background: C.card, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[[l2Signal, "稳定币"], [l3Signal, "Meme板块"], [fgSignal, "情绪"], [l4Signal, "个股"]].map(([s, l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "12px 4px", borderRight: `0.5px solid ${C.sep}` }}>
                <div style={{ fontSize: 17 }}>{s?.color ? signalEmoji[s.color] : "⚪"}</div><div style={{ fontSize: 9, color: C.labelTer, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {macroError && <div style={{ margin: "0 16px 8px", fontSize: 13, color: C.red, padding: "8px 14px", background: "rgba(255,59,48,0.08)", borderRadius: 10 }}>{macroError}</div>}

        <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.label }}>系统状态</div>
            <div style={{ fontSize: 11, color: C.labelTer }}>预览验收时优先看这里</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {[
              { title: "日期切换层", state: viewState },
              { title: "快照保存层", state: saveState },
              { title: "缓存读取层", state: cacheState },
              { title: "历史汇总层", state: historyState },
            ].map(item => {
              const tone = statusTone[item.state.tone] || statusTone.idle;
              return (
                <div key={item.title} style={{ borderRadius: 10, padding: "10px 12px", background: tone.bg }}>
                  <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tone.color, marginBottom: 4 }}>{item.state.label}</div>
                  <div style={{ fontSize: 11, color: C.labelSec, lineHeight: 1.45 }}>{item.state.detail}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.label }}>历史回看</div>
              <div style={{ fontSize: 11, color: C.labelTer, marginTop: 2 }}>{isTodayView ? "当前是今日工作区，可刷新宏观数据" : "当前是历史快照视图，只读取本地已保存记录"}</div>
            </div>
            <div style={{ fontSize: 11, color: C.labelTer }}>Key: {keyForDate(selectedDate)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "84px 84px 1fr", gap: 8, alignItems: "center" }}>
            <button onClick={() => setSelectedDate(todayValue)} style={{ border: selectedDate === todayValue ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`, background: selectedDate === todayValue ? "rgba(0,122,255,0.08)" : "transparent", color: selectedDate === todayValue ? C.blue : C.labelSec, borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>今天</button>
            <button onClick={() => setSelectedDate(yesterdayValue)} style={{ border: selectedDate === yesterdayValue ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`, background: selectedDate === yesterdayValue ? "rgba(0,122,255,0.08)" : "transparent", color: selectedDate === yesterdayValue ? C.blue : C.labelSec, borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>昨天</button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...miniInput, textAlign: "left", padding: "8px 10px" }} />
          </div>
          <div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>切换日期后会加载该日保存的 `macroSnapshot + signalSnapshots + Hero + L0-A + L1 + F&G + L4 + 笔记`。当天点击“读取缓存”优先使用本地快照；点击“强制刷新”才会重新请求网络。</div>
        </div>

        <div style={{ ...cardStyle, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.label }}>历史摘要与筛选</div>
            <div style={{ fontSize: 11, color: C.labelTer }}>近 30 天本地记录</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            {[
              { key: "all", label: "全部" },
              { key: "macro", label: "有宏观" },
              { key: "notes", label: "有笔记" },
              { key: "attack", label: "进攻日" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setHistoryFilter(opt.key)}
                style={{
                  border: historyFilter === opt.key ? `1.5px solid ${C.blue}` : `1px solid ${C.sep}`,
                  background: historyFilter === opt.key ? "rgba(0,122,255,0.08)" : "transparent",
                  color: historyFilter === opt.key ? C.blue : C.labelSec,
                  borderRadius: 8,
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            <div style={{ background: C.fill, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>记录数</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.label }}>{filteredHistory.length}</div>
            </div>
            <div style={{ background: C.fill, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>宏观快照</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.label }}>{macroDays}</div>
            </div>
            <div style={{ background: C.fill, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>平均 Hero</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.label }}>{avgHeroScore == null ? "—" : avgHeroScore.toFixed(2)}</div>
            </div>
            <div style={{ background: C.fill, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: C.labelQ, marginBottom: 4 }}>平均 F&G</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.label }}>{avgFg == null ? "—" : avgFg.toFixed(0)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 10 }}>进攻日：{attackDays} 天 · 当前筛选：{historyFilter === "all" ? "全部" : historyFilter === "macro" ? "有宏观" : historyFilter === "notes" ? "有笔记" : "进攻日"}</div>
          {historySummaries.length === 0 ? (
            <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>还没有可展示的历史记录。先在今天录入并保存一次后，这里会出现摘要。</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ fontSize: 12, color: C.labelTer, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>当前筛选条件下没有匹配记录。</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredHistory.map(item => {
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 72px", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: C.labelSec }}>Hero：{item.hero?.label || "—"} {item.hero?.color === "green" ? "🟢" : item.hero?.color === "yellow" ? "🟡" : item.hero?.color === "red" ? "🔴" : ""}</div>
                      <div style={{ fontSize: 11, color: C.labelSec }}>F&G：{item.fgVal === "" ? "—" : item.fgVal}</div>
                      <div style={{ fontSize: 11, color: C.labelSec }}>L4：{item.l4?.color ? signalEmoji[item.l4.color] : "—"}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.labelTer, marginTop: 6 }}>笔记：{notePreview(item.note)} {item.hasMacro ? "" : "· 无宏观快照"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>L0-A · 全球流动性周期</div>
          <div style={{ ...cardStyle, padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {Object.entries(cycleMeta).map(([key, meta]) => {
                const active = l0Cycle === key;
                return (
                  <button
                    key={key}
                    onClick={() => { markDirty(); setL0Cycle(key); }}
                    style={{
                      border: active ? `1.5px solid ${meta.color}` : `1px solid ${C.sep}`,
                      background: active ? "rgba(120,120,128,0.08)" : "transparent",
                      borderRadius: 10,
                      padding: "10px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "-apple-system,sans-serif",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 4 }}>{meta.label}</div>
                    <div style={{ fontSize: 10, color: C.labelTer, lineHeight: 1.4 }}>{meta.hint}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.labelTer, marginTop: 10, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>L0-A 仅定义仓位偏见：扩张可进攻，过渡控节奏，收缩优先防守。</div>
          </div>
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>L1 · 净流动性</div>
          <div style={{ ...cardStyle, padding: "14px 16px" }}>
            {hasFredAuto ? (
              <>
                <DataRow label="GNL" value={macro.fred.gnl.value_t + "T"} color={C.blue} />
                <DataRow label="Fed" value={macro.fred.fed?.value ? (macro.fred.fed.value/1e6).toFixed(3)+"T" : "—"} sub={macro.fred.fed?.date} />
                <DataRow label="TGA" value={macro.fred.tga?.value ? (macro.fred.tga.value/1e6).toFixed(3)+"T" : "—"} />
                <DataRow label="RRP" value={macro.fred.rrp?.value ? (macro.fred.rrp.value/1e3).toFixed(3)+"T" : "—"} />
                <div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>自动数据来自 FRED；无 Key 或未刷新时可改用下方手动录入。</div>
                <div style={{ height: 1, background: C.sep, margin: "10px 0" }} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: C.labelTer, padding: "6px 8px", background: C.fill, borderRadius: 6, marginBottom: 10 }}>{macro ? "FRED Key 未设置，当前使用手动录入。单位统一按 T 输入，例如 `6.600`。" : "尚未刷新宏观数据，可先手动录入 L1。单位统一按 T 输入，例如 `6.600`。"}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>Fed</div>
                <input value={l1Manual.fed} onChange={e => updL1Manual("fed", e.target.value)} placeholder="6.600" style={miniInput} inputMode="decimal" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>TGA</div>
                <input value={l1Manual.tga} onChange={e => updL1Manual("tga", e.target.value)} placeholder="0.700" style={miniInput} inputMode="decimal" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>RRP</div>
                <input value={l1Manual.rrp} onChange={e => updL1Manual("rrp", e.target.value)} placeholder="0.300" style={miniInput} inputMode="decimal" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>数据日期</div>
                <input value={l1Manual.date} onChange={e => updL1Manual("date", e.target.value)} placeholder="2026-03-09" style={{ ...miniInput, textAlign: "left" }} />
              </div>
              <div style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(0,122,255,0.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>手动 GNL</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{manualGnl == null ? "—" : manualGnl.toFixed(3) + "T"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: C.labelTer }}>Fed：{fmtTrillionsFromInput(l1Manual.fed)}</div>
              <div style={{ fontSize: 11, color: C.labelTer }}>TGA：{fmtTrillionsFromInput(l1Manual.tga)}</div>
              <div style={{ fontSize: 11, color: C.labelTer }}>RRP：{fmtTrillionsFromInput(l1Manual.rrp)}</div>
            </div>
            <div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>参考链接：<a href="https://fred.stlouisfed.org/series/WALCL" target="_blank" rel="noreferrer" style={{ color: C.blue }}>Fed</a> · <a href="https://fred.stlouisfed.org/series/WTREGEN" target="_blank" rel="noreferrer" style={{ color: C.blue }}>TGA</a> · <a href="https://fred.stlouisfed.org/series/RRPONTSYD" target="_blank" rel="noreferrer" style={{ color: C.blue }}>RRP</a></div>
          </div>
        </div>

        {/* L0-L3 PANELS (only when macro data loaded) */}
        {macro && <>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>L0-B · BTC</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="BTC 现价" value={macro.btc?.price ? "$" + macro.btc.price.toLocaleString() : "—"} sub={macro.btc?.source} /><DataRow label="24h" value={fmtPct(macro.btc?.change_24h)} color={macro.btc?.change_24h >= 0 ? C.green : C.red} /><div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>手动查看：<a href="https://www.tradingview.com/symbols/BTCUSD/" target="_blank" rel="noreferrer" style={{ color: C.blue }}>BTC/200MA</a> · <a href="https://www.lookintobitcoin.com/charts/mvrv-zscore/" target="_blank" rel="noreferrer" style={{ color: C.blue }}>MVRV</a></div></div></div>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[l2Signal?.color]||"⚪"} L2 · 稳定币弹药</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="稳定币总市值" value={fmtB(macro.stablecoins?.total)} /><DataRow label="7日净变化" value={macro.stablecoins?.change_7d!=null?(macro.stablecoins.change_7d>0?"+":"")+fmtNum(macro.stablecoins.change_7d):"—"} sub={fmtPct(macro.stablecoins?.change_7d_pct)} color={macro.stablecoins?.change_7d>=0?C.green:C.red} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="Solana TVL" value={fmtB(macro.tvl?.solana)} /><DataRow label="ETH TVL" value={fmtB(macro.tvl?.ethereum)} /><DataRow label="BSC TVL" value={fmtB(macro.tvl?.bsc)} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="SOL 稳定币净流入(7d)" value={macro.chain_stablecoins?.solana?.net_inflow_7d!=null?fmtNum(macro.chain_stablecoins.solana.net_inflow_7d):"—"} color={macro.chain_stablecoins?.solana?.net_inflow_7d>=0?C.green:C.red} /><DataRow label="BSC 稳定币净流入(7d)" value={macro.chain_stablecoins?.bsc?.net_inflow_7d!=null?fmtNum(macro.chain_stablecoins.bsc.net_inflow_7d):"—"} color={macro.chain_stablecoins?.bsc?.net_inflow_7d>=0?C.green:C.red} /><div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>L2 评分 {l2Signal.score.toFixed(2)} · {l2Signal.reason}</div></div></div>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[l3Signal?.color]||"⚪"} L3 · Meme 板块</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="Meme 总市值" value={macro.meme?.mcap?fmtB(macro.meme.mcap):"—"} sub={macro.meme?.mcap_change_24h!=null?"24h "+fmtPct(macro.meme.mcap_change_24h):null} color={macro.meme?.mcap_change_24h>=0?C.green:C.red} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="Solana DEX 24h" value={fmtB(macro.dex_volume?.solana?.total_24h)} sub={macro.dex_volume?.solana?.change_1d_pct!=null?"1d "+fmtPct(macro.dex_volume.solana.change_1d_pct):null} color={macro.dex_volume?.solana?.change_1d_pct>=0?C.green:C.red} /><DataRow label="Base DEX 24h" value={fmtB(macro.dex_volume?.base?.total_24h)} /><DataRow label="BSC DEX 24h" value={fmtB(macro.dex_volume?.bsc?.total_24h)} /><div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>L3 评分 {l3Signal.score.toFixed(2)} · {l3Signal.reason}</div></div></div>
        </>}

        {/* F&G */}
        <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[fgSignal.color]||"⚪"} 恐惧贪婪指数</div>
          <div style={{ ...cardStyle, padding: "18px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>F&G</span><input value={fgVal} onChange={e => { markDirty(); setFgVal(e.target.value.replace(/\D/,"")); }} maxLength={3} placeholder="—" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, color: parseInt(fgVal)>=55?C.green:parseInt(fgVal)>=30?C.orange:C.red, border: "none", outline: "none", background: "transparent", width: 80, textAlign: "right", fontFamily: "-apple-system,sans-serif" }} /></div>
            <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>{fgVal && <div style={{ position: "absolute", top: "50%", left: Math.max(2,Math.min(98,parseInt(fgVal)||0))+"%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.labelQ, marginTop: 8 }}>{["极度恐惧","恐惧","中性","贪婪","极度贪婪"].map(l => <span key={l}>{l}</span>)}</div>
            <div style={{ fontSize: 10, color: C.labelTer, marginTop: 8, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>F&G 评分 {fgSignal.score.toFixed(2)} · {fgSignal.reason}</div>
          </div>
        </div>

        {/* ══════════ L4 · MEME 存量与增量结构 ══════════ */}
        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>{l4Signal?.color ? signalEmoji[l4Signal.color] : "⚪"} L4 · Meme 存量与增量结构</div>

          {/* Quick links */}
          <div style={{ margin: "0 16px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["CoinGecko Meme", "https://www.coingecko.com/en/categories/meme-token", "rgba(52,199,89,0.12)", C.green],
              ["DEX Screener", "https://dexscreener.com/solana", "rgba(0,122,255,0.10)", C.blue],
              ["GMGN", "https://gmgn.ai", "rgba(175,82,222,0.10)", C.purple]
            ].map(([l, h, bg, c]) => <a key={l} href={h} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, background: bg, color: c, borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 600, textDecoration: "none" }}>🔗 {l}</a>)}
          </div>

          {/* Watchlist */}
          <div style={{ ...cardStyle, padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.label }}>📊 存量观测站</div>
              <button onClick={addWatchRow} disabled={watchlist.length >= 10} style={{ background: C.fill2, color: C.labelSec, border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif", opacity: watchlist.length >= 10 ? 0.5 : 1 }}>+ 添加行</button>
            </div>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "60px 65px 50px 50px 50px 50px", gap: 4, marginBottom: 6 }}>
              {["Token", "MCap", "24h%", "7d%", "Vol24h", "V/MC"].map(h => <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.labelQ, textTransform: "uppercase", textAlign: "center", letterSpacing: "0.04em" }}>{h}</div>)}
            </div>
            {watchlist.map((row, idx) => <WatchlistRow key={idx} row={row} idx={idx} onChange={updWatch} />)}
            <div style={{ fontSize: 10, color: C.labelQ, marginTop: 6 }}>V/MC ≥ 0.5 🟢 活跃 · 0.2-0.5 🟡 一般 · &lt;0.2 🔴 低迷</div>
          </div>

          {/* Alpha Scanner */}
          <div style={{ ...cardStyle, marginTop: 8, padding: "14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.label, marginBottom: 10 }}>🔬 新币筛选器 (Alpha Scanner)</div>
            {alphaCards.map((card, idx) => <AlphaCard key={idx} card={card} idx={idx} onChange={updAlpha} />)}
            {l4Signal && <div style={{ fontSize: 10, color: C.labelTer, marginTop: 2, marginBottom: 8, lineHeight: 1.5, padding: "8px 10px", background: C.fill, borderRadius: 8 }}>L4 分数 {l4Signal.score.toFixed(2)} = 基线 0.50 + 存量 {l4Signal.stockScore.toFixed(2)} + 增量 {l4Signal.alphaAdjustment >= 0 ? "+" : ""}{l4Signal.alphaAdjustment.toFixed(2)}。上涨占比 {Math.round(l4Signal.bullRatio * 100)}% · V/MC 活跃占比 {Math.round(l4Signal.vmcActive * 100)}% · goodAlpha {l4Signal.goodAlpha} · badAlpha {l4Signal.badAlpha}</div>}
            <div style={{ fontSize: 10, color: C.labelQ, marginTop: 4, lineHeight: 1.5 }}>
              🟢 进攻：存量普涨 + V/MC高 + 新币筹码分布&承接稳<br />
              🟡 观望：头尾背离 或 新币控盘严重<br />
              🔴 防御：存量全线回撤 + 新币池浅&动量衰减
            </div>
          </div>
        </div>

        {/* NOTES */}
        <div style={{ marginBottom: 6 }}><div style={secLabel}>今日交易笔记</div>
          <div style={cardStyle}><div style={{ padding: "12px 16px 10px", fontSize: 13, fontWeight: 600, color: C.labelSec, borderBottom: `0.5px solid ${C.sep}` }}>📝 记录</div>
            <textarea placeholder="记录市场观察、入场理由、止损位..." value={dailyNote} onChange={e => { markDirty(); setDailyNote(e.target.value); }} style={{ width: "100%", minHeight: 100, border: "none", outline: "none", padding: "12px 16px", fontFamily: "-apple-system,sans-serif", fontSize: 15, color: C.label, lineHeight: 1.55, resize: "none", background: "transparent" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "12px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>LiquidityOS v3.1 · L0-L4 四层框架<br />DeFiLlama · CoinGecko · Alternative.me · Binance · GMGN</div>
      </div>
    </div>
  );
}

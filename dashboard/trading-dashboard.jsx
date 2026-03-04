import { useState, useCallback, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════════════════
//  LiquidityOS V2 · Phase 1 — 宏观信号仪表盘
//  @partrick2022 · 四层流动性框架 v2.1
//  数据来源：手动输入 + 快捷链接跳转核对
// ══════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#F2F2F7", card: "#fff", label: "#000", labelSec: "#3C3C43",
  labelTer: "rgba(60,60,67,0.6)", labelQ: "rgba(60,60,67,0.4)",
  sep: "rgba(60,60,67,0.16)", fill: "rgba(120,120,128,0.08)",
  fill2: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", orange: "#FF9500",
  red: "#FF3B30", yellow: "#FFCC00", purple: "#AF52DE", teal: "#30B0C7",
};

function fmtNum(n) {
  if (!n && n !== 0) return "—";
  n = parseFloat(n);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(n !== 0 && Math.abs(n) < 10 ? 2 : 0);
}

function todayKey() {
  const d = new Date();
  return `daily:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO() { return new Date().toISOString(); }

const DEFAULT_MACRO = {
  l0a: "", l0b_ratio: "", l0b_mvrv: "",
  l1_fed: "", l1_tga: "", l1_rrp: "", l1_weeks: "",
  l2_tvl_sol: "", l2_tvl_eth: "", l2_tvl_bsc: "",
  l2_stbl_change: "", l2_inflow_sol: "", l2_inflow_base: "", l2_inflow_bnb: "",
  l3_meme_mcap: "", l3_meme_trend: "",
  l3_sol_dex_vol: "", l3_sol_dex_vol_7d: "",
  l3_base_dex_trend: "", l3_bsc_dex_trend: "",
  fg_index: "",
};

// ── SIGNAL ENGINE ───────────────────────────────────────────────────────
function calcL0A(v) { return v === "expansion" ? "green" : v === "transition" ? "yellow" : v === "contraction" ? "red" : "none"; }
function calcL0B(ratio) { const r = parseFloat(ratio); if (isNaN(r)) return "none"; return r >= 1.05 ? "green" : r >= 0.95 ? "yellow" : "red"; }
function calcL1(weeks) { const w = parseInt(weeks); if (isNaN(w) || w < 0) return "none"; return w >= 3 ? "green" : w >= 1 ? "yellow" : "red"; }
function calcL2(sc, iS, iB, iN) {
  const s = parseFloat(sc), a = parseFloat(iS), b = parseFloat(iB), c = parseFloat(iN);
  if (isNaN(s) && [a, b, c].every(isNaN)) return "none";
  const sUp = !isNaN(s) && s > 0, anyUp = [a, b, c].some(v => !isNaN(v) && v > 0);
  return sUp && anyUp ? "green" : sUp || anyUp ? "yellow" : "red";
}
function calcL3(memeTrend, solVol, solVol7d, baseTrend, bscTrend) {
  // Primary 1: Meme market cap trend
  const mDir = memeTrend || null;
  // Primary 2: Solana DEX volume direction (auto from numbers)
  const v = parseFloat(solVol), v7 = parseFloat(solVol7d);
  const solDir = (!isNaN(v) && !isNaN(v7) && v7 > 0) ? (v / v7 >= 1.1 ? "up" : v / v7 <= 0.9 ? "down" : "flat") : null;
  // Need at least one primary
  if (!mDir && !solDir) return "none";
  // Score primaries: up=1, flat=0.5, down=0
  const sc = (d) => d === "up" ? 1 : d === "down" ? 0 : 0.5;
  let score = 0, count = 0;
  if (mDir) { score += sc(mDir); count++; }
  if (solDir) { score += sc(solDir); count++; }
  // Auxiliary: Base/BSC DEX trends (lower weight)
  if (baseTrend) { score += sc(baseTrend) * 0.5; count += 0.5; }
  if (bscTrend) { score += sc(bscTrend) * 0.5; count += 0.5; }
  const avg = score / count;
  return avg >= 0.7 ? "green" : avg >= 0.4 ? "yellow" : "red";
}

const SIG_META = {
  green: { color: C.green, bg: "rgba(52,199,89,0.14)", emoji: "🟢", label: "看涨", score: 1 },
  yellow: { color: C.orange, bg: "rgba(255,149,0,0.12)", emoji: "🟡", label: "中性", score: 0.5 },
  red: { color: C.red, bg: "rgba(255,59,48,0.11)", emoji: "🔴", label: "看跌", score: 0 },
  none: { color: C.labelQ, bg: C.fill2, emoji: "⚪", label: "未填", score: null },
};

function compositeSignal(sigs) {
  const sc = sigs.map(s => SIG_META[s].score).filter(v => v !== null);
  if (sc.length < 2) return { score: null, label: "数据不足", gradient: "linear-gradient(140deg,#8E8E93,#AEAEB2)", desc: "请填入更多宏观指标", emoji: "⚪" };
  const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
  if (avg >= 0.8) return { score: avg, label: "进　攻", gradient: "linear-gradient(140deg,#007AFF,#5AC8FA)", desc: `${sc.length}/5 层信号偏多 · 流动性扩张`, emoji: "🔵" };
  if (avg >= 0.6) return { score: avg, label: "积　极", gradient: "linear-gradient(140deg,#34C759,#30D158 60%,#A8E06C)", desc: "多数信号看多 · 可积极寻找机会", emoji: "🟢" };
  if (avg >= 0.4) return { score: avg, label: "观　望", gradient: "linear-gradient(140deg,#FF9500,#FF6B35 60%,#FFCC00)", desc: "信号分歧 · 等待更多确认", emoji: "🟡" };
  return { score: avg, label: "防　御", gradient: "linear-gradient(140deg,#FF3B30,#FF6B35 60%,#FF9500)", desc: "多数信号偏空 · 缩小仓位、快进快出", emoji: "🔴" };
}

// ── UI ATOMS ────────────────────────────────────────────────────────────
function SigBadge({ sig }) {
  const m = SIG_META[sig] || SIG_META.none;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: m.bg, color: m.color, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{m.emoji} {m.label}</span>;
}

function MInput({ label, unit, value, onChange, placeholder, width }) {
  return (
    <div style={{ flex: width ? `0 0 ${width}` : 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3, letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", background: C.fill2, borderRadius: 8, padding: "0 8px" }}>
        <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "—"}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 600, color: C.label, padding: "8px 0", fontFamily: "-apple-system,sans-serif", minWidth: 0 }} />
        {unit && <span style={{ fontSize: 10, color: C.labelQ, fontWeight: 600, flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  );
}

function TrendPicker({ label, value, onChange }) {
  const opts = [{ val: "up", e: "📈", l: "上升", c: C.green, b: "rgba(52,199,89,0.12)" }, { val: "flat", e: "➡️", l: "持平", c: C.orange, b: "rgba(255,149,0,0.1)" }, { val: "down", e: "📉", l: "下降", c: C.red, b: "rgba(255,59,48,0.1)" }];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
        {opts.map(o => { const s = value === o.val; return (
          <button key={o.val} onClick={() => onChange(o.val === value ? "" : o.val)}
            style={{ border: s ? `1.5px solid ${o.c}` : "1.5px solid rgba(60,60,67,0.15)", borderRadius: 8, padding: "6px 2px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: s ? o.b : "transparent", color: s ? o.c : C.labelTer, transition: "all 0.15s", fontFamily: "-apple-system,sans-serif" }}>
            {o.e} {o.l}
          </button>
        ); })}
      </div>
    </div>
  );
}

function CyclePicker({ value, onChange }) {
  const opts = [{ val: "expansion", e: "🟢", l: "扩张期", c: C.green, b: "rgba(52,199,89,0.12)" }, { val: "transition", e: "🟡", l: "过渡期", c: C.orange, b: "rgba(255,149,0,0.1)" }, { val: "contraction", e: "🔴", l: "收缩期", c: C.red, b: "rgba(255,59,48,0.1)" }];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {opts.map(o => { const s = value === o.val; return (
        <button key={o.val} onClick={() => onChange(o.val === value ? "" : o.val)}
          style={{ border: s ? `1.5px solid ${o.c}` : "1.5px solid rgba(60,60,67,0.15)", borderRadius: 10, padding: "10px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: s ? o.b : "transparent", color: s ? o.c : C.labelTer, transition: "all 0.15s", fontFamily: "-apple-system,sans-serif" }}>
          {o.e} {o.l}
        </button>
      ); })}
    </div>
  );
}

// ── DATA SOURCE LINKS ───────────────────────────────────────────────────
function SourceLinks({ links }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {links.map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(0,122,255,0.07)", color: C.blue, borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 600, textDecoration: "none", letterSpacing: -0.1 }}>
          🔗 {label}
        </a>
      ))}
    </div>
  );
}

function MacroSection({ icon, title, sig, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 2 }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", borderBottom: open ? `0.5px solid ${C.sep}` : "none" }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: C.label, letterSpacing: -0.2 }}>{title}</span>
        <SigBadge sig={sig} />
        <span style={{ fontSize: 12, color: C.labelQ, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {open && <div style={{ padding: "12px 14px" }}>{children}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  V1 COMPONENTS
// ══════════════════════════════════════════════════════════════════════════
const DIMS = [
  { key: "story", icon: "💡", bg: "rgba(255,204,0,0.14)", label: "叙事 / 题材热点", ph: "这个币的故事是什么？此刻市场为何关注？" },
  { key: "onchain", icon: "🔗", bg: "rgba(0,122,255,0.10)", label: "链上数据", ph: "LP 健康吗？换手率如何？市值合理吗？" },
  { key: "smart", icon: "🐋", bg: "rgba(52,199,89,0.10)", label: "聪明钱动向", ph: "GMGN 有没有聪明钱建仓？" },
  { key: "social", icon: "📣", bg: "rgba(175,82,222,0.10)", label: "社媒热度", ph: "Twitter 讨论量？KOL 有没有转发？" },
];
const SCORES = [{ val: "strong", label: "🟢 强" }, { val: "ok", label: "🔵 可" }, { val: "weak", label: "🟠 弱" }, { val: "bad", label: "🔴 差" }];

function extractJSON(text) {
  const cb = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (cb) { try { const p = JSON.parse(cb[1]); if (Array.isArray(p) && p.length) return p; } catch {} }
  const all = []; let d = 0, s = -1;
  for (let i = 0; i < text.length; i++) { if (text[i] === "[") { if (!d) s = i; d++; } else if (text[i] === "]") { d--; if (!d && s !== -1) { all.push(text.slice(s, i + 1)); s = -1; } } }
  all.sort((a, b) => b.length - a.length);
  for (const x of all) { try { const p = JSON.parse(x); if (Array.isArray(p) && p.length && p[0].symbol) return p; } catch {} }
  return null;
}

async function fetchTrendingFromAPI(onStatus) {
  onStatus("🔍 AI 正在搜索 Solana 热榜...");
  const P = `Search dexscreener.com for the top Solana meme tokens by 24h trading volume right now.\n\nOutput ONLY a raw JSON array. Start with [ end with ].\nFormat: [{"symbol":"TICKER","name":"Full Name","address":"contract_or_null","mcap":1234567,"vol24h":234567,"liq":123456,"lpRatio":12.3,"turnover":0.45,"change24h":15.2,"desc":"one line story in Chinese","url":"https://dexscreener.com/solana/..."}]\nRules: 8 tokens. Use null for unknowns. NO text outside the array.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: P }] }) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const allText = (data.content || []).map(b => b.type === "text" ? b.text || "" : b.type === "tool_result" ? (b.content || []).map(c => c.text || "").join("\n") : "").join("\n");
  if (!allText.trim()) throw new Error("AI 未返回内容");
  const parsed = extractJSON(allText);
  if (!parsed?.length) throw new Error("格式解析失败");
  return parsed;
}

const scoreStyle = (val, sel) => {
  const map = { strong: { bg: "rgba(52,199,89,0.15)", color: C.green }, ok: { bg: "rgba(0,122,255,0.12)", color: C.blue }, weak: { bg: "rgba(255,149,0,0.13)", color: C.orange }, bad: { bg: "rgba(255,59,48,0.11)", color: C.red } };
  const base = { border: "1.5px solid rgba(60,60,67,0.2)", borderRadius: 8, padding: "7px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", color: C.labelTer, transition: "all 0.15s" };
  return sel === val ? { ...base, ...(map[val] || {}) } : base;
};
const verdictInfo = (avg) => { if (avg === null) return null; if (avg >= 2.5) return { cls: C.green, text: "✅ 值得关注，考虑建仓" }; if (avg >= 1.8) return { cls: C.blue, text: "👀 继续观察，等更多确认" }; if (avg >= 1.0) return { cls: C.orange, text: "⚠️ 综合偏弱，暂时跳过" }; return { cls: C.red, text: "❌ 不建议介入" }; };

function CoinCard({ coin, onDelete, onScore, onNote }) {
  const d = coin.onchainData || {};
  const lpR = d.lpRatio != null ? +d.lpRatio : null, to = d.turnover != null ? +d.turnover : null;
  const mcap = d.mcap ? fmtNum(d.mcap) : "—", vol = d.vol24h ? fmtNum(d.vol24h) : "—", liq = d.liq ? fmtNum(d.liq) : "—";
  const chg = d.change != null ? (d.change > 0 ? "+" : "") + (+d.change).toFixed(1) + "%" : "—";
  const dex = d.url || (coin.address && !coin.address.startsWith("ai_") ? `https://dexscreener.com/solana/${coin.address}` : "https://dexscreener.com");
  const gmgn = coin.address && !coin.address.startsWith("ai_") ? `https://gmgn.ai/sol/token/${coin.address}` : "https://gmgn.ai";
  const tw = `https://twitter.com/search?q=${encodeURIComponent("$" + (coin.symbol || ""))}&f=live`;
  const isM = !coin.address || coin.address === "";
  const sv = { strong: 3, ok: 2, weak: 1, bad: 0 };
  const vals = Object.values(coin.scores).map(v => sv[v] || 0);
  const avg = vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const verdict = verdictInfo(avg);
  const chip = (l, v, t) => { const g = t === "lp" ? v >= 10 : v >= 0.5, w = t === "lp" ? v >= 5 : v >= 0.2; const cl = v == null ? C.labelSec : g ? C.green : w ? C.orange : C.red; const bg = v == null ? C.fill2 : g ? "rgba(52,199,89,0.12)" : w ? "rgba(255,149,0,0.12)" : "rgba(255,59,48,0.10)"; return <span style={{ background: bg, color: cl, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>{l}</span>; };
  return (
    <div style={{ margin: "0 16px 10px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", animation: "rise 0.3s both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `0.5px solid ${C.sep}` }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: verdict ? verdict.cls : C.sep, flexShrink: 0 }} />
        {isM ? <input placeholder="输入 $TICKER 或合约地址" onChange={e => onNote("_meta", e.target.value)} style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontWeight: 600, color: C.label, fontFamily: "-apple-system,sans-serif" }} />
          : <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 600 }}>${coin.symbol}</div><div style={{ fontSize: 11, color: C.labelTer, marginTop: 1 }}>{coin.name}</div></div>}
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: C.labelQ, fontSize: 20, padding: "0 2px", lineHeight: 1 }}>×</button>
      </div>
      {!isM && <div style={{ padding: "0 14px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
          <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>市值 {mcap}</span>
          <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>池 {liq}</span>
          {chip(`LP比 ${lpR != null ? lpR.toFixed(1) + "%" : "—"}`, lpR, "lp")}
          {chip(`换手 ${to != null ? to.toFixed(2) + "x" : "—"}`, to, "tv")}
          <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>Vol {vol}</span>
          <span style={{ background: d.change != null ? (d.change >= 0 ? "rgba(52,199,89,0.12)" : "rgba(255,59,48,0.10)") : C.fill2, color: d.change != null ? (d.change >= 0 ? C.green : C.red) : C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>24h {chg}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[["🐋 GMGN", gmgn, "rgba(52,199,89,0.12)", C.green], ["🐦 Twitter", tw, "rgba(0,122,255,0.10)", C.blue], ["📊 Dex", dex, "rgba(175,82,222,0.10)", C.purple]].map(([l, h, b, c]) => <a key={l} href={h} target="_blank" rel="noreferrer" style={{ background: b, color: c, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>{l}</a>)}
        </div>
      </div>}
      <div style={{ padding: "14px 14px 4px" }}>
        {DIMS.map(dim => (
          <div key={dim.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: dim.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{dim.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.labelTer, marginBottom: 4 }}>{dim.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 8 }}>
                {SCORES.map(s => <button key={s.val} onClick={() => onScore(dim.key, s.val)} style={scoreStyle(s.val, coin.scores[dim.key])}>{s.label}</button>)}
              </div>
              <textarea rows={2} placeholder={dim.ph} value={coin.notes[dim.key] || ""} onChange={e => onNote(dim.key, e.target.value)}
                style={{ width: "100%", border: "none", outline: "none", background: C.fill2, borderRadius: 8, padding: "8px 10px", fontFamily: "-apple-system,sans-serif", fontSize: 14, color: C.label, lineHeight: 1.5, resize: "none", minHeight: 40 }} />
            </div>
          </div>
        ))}
      </div>
      {verdict && <div style={{ margin: "0 14px 14px", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, background: verdict.cls + "22", color: verdict.cls }}>{verdict.text}</div>}
    </div>
  );
}

function TrendingItem({ t, added, onAdd }) {
  const lpR = t.lpRatio != null ? +t.lpRatio : null, to = t.turnover != null ? +t.turnover : null;
  const chg = t.change24h, chgC = chg > 0 ? C.green : chg < 0 ? C.red : C.labelTer;
  const chgS = chg != null ? (chg > 0 ? "+" : "") + (+chg).toFixed(1) + "%" : "";
  const chip = (l, v, tp) => { const g = tp === "lp" ? v >= 10 : v >= 0.5, w = tp === "lp" ? v >= 5 : v >= 0.2; const c = v == null ? C.labelSec : g ? C.green : w ? C.orange : C.red; const b = v == null ? C.fill2 : g ? "rgba(52,199,89,0.12)" : w ? "rgba(255,149,0,0.12)" : "rgba(255,59,48,0.10)"; return <span style={{ background: b, color: c, borderRadius: 6, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{l}</span>; };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 6, background: C.fill }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,rgba(0,122,255,0.2),rgba(175,82,222,0.2))", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.blue }}>{(t.symbol || "?").slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <span>${t.symbol}</span><span style={{ fontWeight: 400, color: C.labelTer, fontSize: 11 }}>{t.name}</span>
          {chgS && <span style={{ fontSize: 11, fontWeight: 600, color: chgC }}>{chgS}</span>}
        </div>
        <div style={{ fontSize: 11, color: C.labelTer, marginTop: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          {t.mcap && <span>市值 {fmtNum(t.mcap)}</span>}
          {t.liq && <><span>· 池 {fmtNum(t.liq)}</span>{chip(lpR != null ? lpR.toFixed(0) + "%" : "—", lpR, "lp")}</>}
          {t.vol24h && <><span>· Vol {fmtNum(t.vol24h)}</span>{chip(to != null ? to.toFixed(2) + "x" : "—", to, "tv")}</>}
        </div>
        {t.desc && <div style={{ fontSize: 10, color: C.labelTer, marginTop: 2, fontStyle: "italic" }}>{t.desc}</div>}
      </div>
      <button onClick={onAdd} disabled={added} style={{ background: added ? C.green : C.blue, color: "#fff", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: added ? 14 : 18, cursor: added ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: added ? 0.8 : 1 }}>{added ? "✓" : "＋"}</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [macro, setMacro] = useState({ ...DEFAULT_MACRO });
  const [coins, setCoins] = useState([]);
  const [dailyNote, setDailyNote] = useState("");
  const [trending, setTrending] = useState([]);
  const [fetchState, setFetchState] = useState("idle");
  const [fetchStatus, setFetchStatus] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [lastSaved, setLastSaved] = useState(null);

  const saveTimer = useRef(null);
  const isLoaded = useRef(false);
  const MAX = 5;
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const fgVal = macro.fg_index || "";

  // ── STORAGE ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(todayKey());
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.macroSignals) setMacro(prev => ({ ...prev, ...d.macroSignals }));
          if (Array.isArray(d.coins)) setCoins(d.coins);
          if (d.dailyNote) setDailyNote(d.dailyNote);
        }
      } catch {}
      isLoaded.current = true;
    })();
  }, []);

  const doSave = useCallback(async (m, c, n) => {
    try {
      await window.storage.set(todayKey(), JSON.stringify({ macroSignals: m, coins: c, dailyNote: n, generatedAt: todayISO() }));
      setLastSaved(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(macro, coins, dailyNote), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [macro, coins, dailyNote, doSave]);

  const setM = useCallback((k, v) => setMacro(prev => ({ ...prev, [k]: v })), []);

  // ── SIGNALS ───────────────────────────────────────────────────────────
  const sigL0A = calcL0A(macro.l0a), sigL0B = calcL0B(macro.l0b_ratio), sigL1 = calcL1(macro.l1_weeks);
  const sigL2 = calcL2(macro.l2_stbl_change, macro.l2_inflow_sol, macro.l2_inflow_base, macro.l2_inflow_bnb);
  const sigL3 = calcL3(macro.l3_meme_trend, macro.l3_sol_dex_vol, macro.l3_sol_dex_vol_7d, macro.l3_base_dex_trend, macro.l3_bsc_dex_trend);
  const allSigs = [sigL0A, sigL0B, sigL1, sigL2, sigL3];
  const comp = compositeSignal(allSigs);
  const fed = parseFloat(macro.l1_fed), tga = parseFloat(macro.l1_tga), rrp = parseFloat(macro.l1_rrp);
  const gnl = (!isNaN(fed) && !isNaN(tga) && !isNaN(rrp)) ? fed - tga - rrp : null;

  // ── COIN OPS ──────────────────────────────────────────────────────────
  const handleFetch = useCallback(async () => {
    setFetchState("loading"); setFetchError(""); setTrending([]);
    try { const t = await fetchTrendingFromAPI(setFetchStatus); if (!t?.length) throw new Error("未获取到数据"); setTrending(t); setFetchState("done"); }
    catch (e) { setFetchError("❌ " + e.message); setFetchState("error"); }
  }, []);
  const addFromTrending = useCallback((t) => {
    if (coins.length >= MAX) return; const addr = t.address || "ai_" + t.symbol;
    if (coins.find(c => c.address === addr)) return;
    setCoins(prev => [...prev, { id: "coin_" + Date.now(), symbol: t.symbol || "???", name: t.name || t.symbol || "???", address: addr, scores: {}, notes: {}, onchainData: { mcap: t.mcap, vol24h: t.vol24h, liq: t.liq, lpRatio: t.lpRatio, turnover: t.turnover, change: t.change24h, url: t.url } }]);
  }, [coins]);
  const addManual = () => { if (coins.length < MAX) setCoins(prev => [...prev, { id: "coin_m_" + Date.now(), symbol: "", name: "", address: "", scores: {}, notes: {}, onchainData: {} }]); };
  const delCoin = (id) => setCoins(prev => prev.filter(c => c.id !== id));
  const updScore = (id, d, v) => setCoins(prev => prev.map(c => c.id === id ? { ...c, scores: { ...c.scores, [d]: v } } : c));
  const updNote = (id, d, v) => setCoins(prev => prev.map(c => c.id === id ? { ...c, notes: { ...c.notes, [d]: v } } : c));

  // ── TWEET ─────────────────────────────────────────────────────────────
  const VL = { pass: "✅ 值得关注", watch: "👀 继续观察", skip: "⚠️ 暂时跳过", no: "❌ 不建议" };
  const SL = { strong: "🟢", ok: "🔵", weak: "🟠", bad: "🔴" };
  const sv = { strong: 3, ok: 2, weak: 1, bad: 0 };
  const sigE = allSigs.map(s => SIG_META[s].emoji).join("");
  const tLines = coins.filter(c => c.symbol || c.name).map(c => {
    const vs = Object.values(c.scores).map(v => sv[v] || 0);
    const a = vs.length >= 2 ? vs.reduce((x, y) => x + y, 0) / vs.length : null;
    const vd = a === null ? "" : a >= 2.5 ? "pass" : a >= 1.8 ? "watch" : a >= 1.0 ? "skip" : "no";
    const ss = DIMS.map(d => { const s = c.scores[d.key]; return s ? SL[s] + d.label.slice(0, 2) : null; }).filter(Boolean).join("  ");
    const n = c.notes?.story?.trim();
    return `$${c.symbol || c.name}  ${VL[vd] || ""}\n   ${ss}${n ? "\n   💡 " + n.slice(0, 55) : ""}`;
  }).join("\n\n");
  const tweet = coins.some(c => c.symbol || c.name) ? `今日热点研判 🧭 ${new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}\n\n系统信号 ${comp.emoji} ${comp.label.replace(/\s/g, "")} ${sigE}\n贪婪恐惧指数 ${fgVal || "—"} · Solana 战场\n\n${tLines}\n\n——\n四层流动性框架 | @partrick2022\n#加密货币 #Meme #Solana` : "";
  const [copied, setCopied] = useState(false);
  const copyTweet = () => { navigator.clipboard.writeText(tweet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const cardS = { margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" };
  const secL = { padding: "0 20px 7px", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.labelTer };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system,'Helvetica Neue',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        textarea,input[type="text"]{appearance:none;-webkit-appearance:none}a{cursor:pointer}
      `}</style>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(242,242,247,0.88)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: "0.5px solid #C6C6C8" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>流动性仪表盘</div><div style={{ fontSize: 12, color: C.labelTer, marginTop: 1 }}>{today}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastSaved && <span style={{ fontSize: 10, color: C.labelQ }}>已保存 {lastSaved}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(52,199,89,0.13)", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: C.green }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "blink 2s ease-in-out infinite" }} />V2
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 0 48px" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.2, padding: "10px 20px 2px" }}>LiquidityOS</div>
        <div style={{ fontSize: 13, color: C.labelTer, padding: "0 20px 16px" }}>{today} · 每日例行检查</div>

        {/* HERO */}
        <div style={{ margin: "0 16px 16px", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.07)", animation: "rise 0.45s both" }}>
          <div style={{ padding: "22px 20px 20px", background: comp.gradient, position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>系统综合信号</div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2, color: "#fff", lineHeight: 1, marginBottom: 10 }}>{comp.label}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>{comp.desc}{comp.score !== null && <><br />综合得分 {comp.score.toFixed(2)}</>}</div>
          </div>
          <div style={{ background: C.card, display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}>
            {[[sigL0A, "周期"], [sigL0B, "BTC"], [sigL1, "流动性"], [sigL2, "稳定币"], [sigL3, "Meme"]].map(([s, l], i) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "12px 4px", borderRight: i < 4 ? `0.5px solid ${C.sep}` : "none" }}>
                <div style={{ fontSize: 17 }}>{SIG_META[s].emoji}</div><div style={{ fontSize: 9, color: C.labelTer, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MACRO PANEL */}
        <div style={{ marginBottom: 6 }}>
          <div style={secL}>宏观信号面板</div>

          <div style={{ ...cardS, overflow: "visible" }}>
            {/* L0-A */}
            <MacroSection icon="🌍" title="L0-A 全球流动性周期" sig={sigL0A}>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 8, lineHeight: 1.5 }}>Howell 65个月周期 · 需人工判断</div>
              <CyclePicker value={macro.l0a} onChange={v => setM("l0a", v)} />
            </MacroSection>

            {/* L0-B */}
            <MacroSection icon="₿" title="L0-B BTC 周期位置" sig={sigL0B}>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 8, lineHeight: 1.5 }}>BTC/200MA ≥1.05 🟢 · 0.95-1.05 🟡 · &lt;0.95 🔴</div>
              <SourceLinks links={[
                ["TradingView BTCUSD", "https://www.tradingview.com/symbols/BTCUSD/"],
                ["MVRV Z-Score", "https://www.lookintobitcoin.com/charts/mvrv-zscore/"],
              ]} />
              <div style={{ display: "flex", gap: 10 }}>
                <MInput label="BTC/200MA 比率" value={macro.l0b_ratio} onChange={v => setM("l0b_ratio", v)} placeholder="1.05" />
                <MInput label="MVRV Z-Score" value={macro.l0b_mvrv} onChange={v => setM("l0b_mvrv", v)} placeholder="1.2" />
              </div>
            </MacroSection>

            {/* L1 */}
            <MacroSection icon="🏦" title="L1 全球净流动性" sig={sigL1}>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 8, lineHeight: 1.5 }}>GNL = Fed − TGA − RRP · 领先BTC约13周 · 每周四更新</div>
              <SourceLinks links={[
                ["Fed 资产负债表 WALCL", "https://fred.stlouisfed.org/series/WALCL"],
                ["TGA WTREGEN", "https://fred.stlouisfed.org/series/WTREGEN"],
                ["RRP RRPONTSYD", "https://fred.stlouisfed.org/series/RRPONTSYD"],
              ]} />
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <MInput label="Fed 资产负债表" unit="T" value={macro.l1_fed} onChange={v => setM("l1_fed", v)} placeholder="6.8" />
                <MInput label="TGA" unit="T" value={macro.l1_tga} onChange={v => setM("l1_tga", v)} placeholder="0.75" />
                <MInput label="RRP" unit="T" value={macro.l1_rrp} onChange={v => setM("l1_rrp", v)} placeholder="0.1" />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 3 }}>GNL（自动计算）</div>
                  <div style={{ background: gnl !== null ? "rgba(0,122,255,0.08)" : C.fill2, borderRadius: 8, padding: "8px 10px", fontSize: 16, fontWeight: 700, color: gnl !== null ? C.blue : C.labelQ }}>{gnl !== null ? gnl.toFixed(2) + " T" : "—"}</div>
                </div>
                <MInput label="连续扩张周数" value={macro.l1_weeks} onChange={v => setM("l1_weeks", v)} placeholder="3" width="100px" />
              </div>
              <div style={{ fontSize: 10, color: C.labelQ, marginTop: 6 }}>≥3周 🟢 · 1-2周 🟡 · 0周/收缩 🔴</div>
            </MacroSection>

            {/* L2 */}
            <MacroSection icon="💵" title="L2 稳定币弹药" sig={sigL2}>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 8, lineHeight: 1.5 }}>三维度：TVL（参考）+ 稳定币7日净变化 + 链上净流入</div>
              <SourceLinks links={[
                ["DeFiLlama 链 TVL", "https://defillama.com/chains"],
                ["稳定币总量", "https://defillama.com/stablecoins"],
                ["稳定币各链", "https://defillama.com/stablecoins/chains"],
              ]} />
              <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>TVL 总量（参考）</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <MInput label="Solana TVL" unit="B" value={macro.l2_tvl_sol} onChange={v => setM("l2_tvl_sol", v)} placeholder="8.2" />
                <MInput label="ETH TVL" unit="B" value={macro.l2_tvl_eth} onChange={v => setM("l2_tvl_eth", v)} placeholder="52" />
                <MInput label="BSC TVL" unit="B" value={macro.l2_tvl_bsc} onChange={v => setM("l2_tvl_bsc", v)} placeholder="4.3" />
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <MInput label="稳定币总量 7日净变化" unit="B" value={macro.l2_stbl_change} onChange={v => setM("l2_stbl_change", v)} placeholder="-1.2" />
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>链上稳定币 7日净流入</div>
              <div style={{ display: "flex", gap: 10 }}>
                <MInput label="Solana" unit="B" value={macro.l2_inflow_sol} onChange={v => setM("l2_inflow_sol", v)} placeholder="0.3" />
                <MInput label="Base" unit="B" value={macro.l2_inflow_base} onChange={v => setM("l2_inflow_base", v)} placeholder="-0.1" />
                <MInput label="BNBChain" unit="B" value={macro.l2_inflow_bnb} onChange={v => setM("l2_inflow_bnb", v)} placeholder="0.2" />
              </div>
              <div style={{ fontSize: 10, color: C.labelQ, marginTop: 6 }}>净增 + 目标链净流入正 🟢 · 仅一项正 🟡 · 均负 🔴</div>
            </MacroSection>

            {/* L3 */}
            <MacroSection icon="🎰" title="L3 Meme 板块流动性" sig={sigL3}>
              <div style={{ fontSize: 11, color: C.labelTer, marginBottom: 8, lineHeight: 1.5 }}>主判断：Meme市值趋势 + Solana DEX交易量变化 · 辅助：Base/BSC DEX趋势</div>
              <SourceLinks links={[
                ["CoinGecko Meme", "https://www.coingecko.com/en/categories/meme-token"],
                ["Solana DEX", "https://defillama.com/dexs/chains/solana"],
                ["Base DEX", "https://defillama.com/dexs/chains/base"],
                ["BSC DEX", "https://defillama.com/dexs/chains/bsc"],
              ]} />
              <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>数值指标</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <MInput label="Meme 总市值（全链）" unit="B" value={macro.l3_meme_mcap} onChange={v => setM("l3_meme_mcap", v)} placeholder="55" />
                <MInput label="Solana DEX 日交易量" unit="B" value={macro.l3_sol_dex_vol} onChange={v => setM("l3_sol_dex_vol", v)} placeholder="2.1" />
                <MInput label="Solana DEX 7日前" unit="B" value={macro.l3_sol_dex_vol_7d} onChange={v => setM("l3_sol_dex_vol_7d", v)} placeholder="1.8" />
              </div>
              {(() => {
                const v = parseFloat(macro.l3_sol_dex_vol), v7 = parseFloat(macro.l3_sol_dex_vol_7d);
                if (!isNaN(v) && !isNaN(v7) && v7 > 0) {
                  const pct = ((v / v7 - 1) * 100).toFixed(1);
                  const up = pct > 0;
                  return <div style={{ fontSize: 11, fontWeight: 600, color: up ? C.green : pct < 0 ? C.red : C.labelTer, background: up ? "rgba(52,199,89,0.08)" : pct < 0 ? "rgba(255,59,48,0.08)" : C.fill2, borderRadius: 6, padding: "4px 8px", marginBottom: 10, display: "inline-block" }}>Solana DEX 7日变化 {up ? "+" : ""}{pct}% {up ? "📈" : pct < 0 ? "📉" : "➡️"}</div>;
                }
                return null;
              })()}
              <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginBottom: 4 }}>趋势判断</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <TrendPicker label="Meme 市值趋势（全链）" value={macro.l3_meme_trend} onChange={v => setM("l3_meme_trend", v)} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.labelQ, marginTop: 8, marginBottom: 4 }}>辅助参照（其他链 DEX 交易量趋势）</div>
              <div style={{ display: "flex", gap: 10 }}>
                <TrendPicker label="Base DEX 交易量" value={macro.l3_base_dex_trend} onChange={v => setM("l3_base_dex_trend", v)} />
                <TrendPicker label="BSC DEX 交易量" value={macro.l3_bsc_dex_trend} onChange={v => setM("l3_bsc_dex_trend", v)} />
              </div>
              <div style={{ fontSize: 10, color: C.labelQ, marginTop: 8, lineHeight: 1.5 }}>主信号同向涨 🟢 · 分歧/持平 🟡 · 同向跌 🔴<br />辅助链趋势用于区分信号强弱</div>
            </MacroSection>
          </div>
        </div>

        {/* FEAR & GREED */}
        <div style={{ marginBottom: 6 }}>
          <div style={secL}>贪婪恐惧指数</div>
          <div style={{ ...cardS, padding: "18px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>恐惧贪婪指数</span>
              <a href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noreferrer"
                style={{ fontSize: 10, fontWeight: 600, color: C.blue, textDecoration: "none", background: "rgba(0,122,255,0.07)", borderRadius: 6, padding: "3px 8px" }}>🔗 Alternative.me</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 14 }}>
              <input value={fgVal} onChange={e => setM("fg_index", e.target.value.replace(/\D/, ""))} maxLength={3}
                style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, color: parseInt(fgVal) <= 25 ? C.red : parseInt(fgVal) <= 45 ? C.orange : parseInt(fgVal) <= 55 ? C.yellow : C.green, border: "none", outline: "none", background: "transparent", borderRadius: 8, width: 80, textAlign: "right", fontFamily: "-apple-system,sans-serif" }} />
            </div>
            <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>
              <div style={{ position: "absolute", top: "50%", left: Math.max(2, Math.min(98, parseInt(fgVal) || 0)) + "%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.labelQ, marginTop: 8 }}>
              {["极度恐惧", "恐惧", "中性", "贪婪", "极度贪婪"].map(l => <span key={l}>{l}</span>)}
            </div>
          </div>
        </div>

        {/* HOT COINS */}
        <div style={{ marginBottom: 6 }}>
          <div style={secL}>24H 热点新币研判</div>
          <div style={{ ...cardS, marginBottom: 10 }}>
            <div style={{ padding: "14px 16px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div><div style={{ fontSize: 15, fontWeight: 500 }}>① AI 搜索 Solana 热榜</div><div style={{ fontSize: 12, color: C.labelTer, marginTop: 2 }}>Claude AI + Web Search</div></div>
                <button onClick={handleFetch} disabled={fetchState === "loading"} style={{ background: fetchState === "loading" ? "rgba(0,122,255,0.5)" : C.blue, color: "#fff", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: fetchState === "loading" ? "default" : "pointer", fontFamily: "-apple-system,sans-serif" }}>{fetchState === "loading" ? "抓取中..." : "🔄 抓取热榜"}</button>
              </div>
              {fetchState === "loading" && <div style={{ textAlign: "center", padding: "16px 0" }}><div style={{ fontSize: 22, display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</div><div style={{ fontSize: 13, color: C.labelTer, marginTop: 6 }}>{fetchStatus || "🔍 搜索中..."}</div><div style={{ fontSize: 11, color: C.labelQ, marginTop: 3 }}>约需 15–25 秒</div></div>}
              {fetchState === "error" && <div style={{ fontSize: 13, color: C.red, padding: "8px 0" }}>{fetchError}</div>}
              {fetchState === "done" && trending.length > 0 && <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.labelTer, marginBottom: 8 }}>点击「＋」加入研判（最多 {MAX} 个）</div>
                {trending.map(t => { const addr = t.address || "ai_" + t.symbol; return <TrendingItem key={addr} t={t} added={!!coins.find(c => c.address === addr)} onAdd={() => addFromTrending(t)} />; })}
              </div>}
            </div>
          </div>
          <div style={{ margin: "0 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, color: C.labelTer }}>已选 <strong style={{ color: C.blue }}>{coins.length}</strong> / {MAX}</div>
            <button onClick={addManual} disabled={coins.length >= MAX} style={{ background: C.fill2, color: C.labelSec, border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif", opacity: coins.length >= MAX ? 0.5 : 1 }}>＋ 手动添加</button>
          </div>
          {!coins.length
            ? <div style={{ margin: "0 16px 8px", background: C.card, borderRadius: 14, padding: "28px 20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}><div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div><div style={{ fontSize: 15, fontWeight: 500, color: C.labelSec, marginBottom: 4 }}>还没有研判</div><div style={{ fontSize: 13, color: C.labelTer, lineHeight: 1.5 }}>点击「🔄 抓取热榜」或「＋ 手动添加」</div></div>
            : coins.map(c => <CoinCard key={c.id} coin={c} onDelete={() => delCoin(c.id)} onScore={(d, v) => updScore(c.id, d, v)} onNote={(d, v) => updNote(c.id, d, v)} />)}
          {tweet && <div style={{ margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div style={{ padding: "13px 16px", borderBottom: `0.5px solid ${C.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>🐦 今日推文草稿</span>
              <button onClick={copyTweet} style={{ background: copied ? "rgba(52,199,89,0.15)" : "rgba(0,122,255,0.1)", color: copied ? C.green : C.blue, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif" }}>{copied ? "已复制 ✓" : "复制"}</button>
            </div>
            <pre style={{ padding: "14px 16px", fontSize: 14, color: C.label, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "-apple-system,sans-serif" }}>{tweet}</pre>
          </div>}
        </div>

        {/* DAILY NOTE */}
        <div style={{ marginBottom: 6 }}>
          <div style={secL}>今日交易笔记</div>
          <div style={{ ...cardS }}>
            <div style={{ padding: "12px 16px 10px", fontSize: 13, fontWeight: 600, color: C.labelSec, borderBottom: `0.5px solid ${C.sep}` }}>📝 记录</div>
            <textarea placeholder={"记录今天的市场观察...\n例：BTC $67K 震荡，等 USDT 扩张信号..."} value={dailyNote} onChange={e => setDailyNote(e.target.value)}
              style={{ width: "100%", minHeight: 100, border: "none", outline: "none", padding: "12px 16px", fontFamily: "-apple-system,sans-serif", fontSize: 15, color: C.label, lineHeight: 1.55, resize: "none", background: "transparent" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "12px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>
          LiquidityOS V2 · 四层流动性框架 v2.1<br />数据来源：FRED · DeFiLlama · CoinGecko · DexScreener · GMGN<br />@partrick2022
        </div>
      </div>
    </div>
  );
}

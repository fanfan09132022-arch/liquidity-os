import { useState, useCallback, useEffect, useRef } from "react";

// ── Macro data via Claude API direct search ──
const WORKER_URL = "https://liquidityos-data.fanfan09132022.workers.dev";

async function fetchMacroViaAI() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Search for the following current crypto market data and return ONLY a JSON object.\n\nData needed:\n1. Bitcoin current price in USD and 24h change %\n2. Crypto Fear & Greed Index value (from alternative.me)\n3. Total stablecoin market cap and 7-day change (from defillama)\n4. Solana, Ethereum, BSC TVL (from defillama)\n5. Meme token total market cap (from coingecko)\n6. Solana DEX 24h volume, Base DEX 24h volume, BSC DEX 24h volume (from defillama)\n\nReturn ONLY this JSON format, no other text. Start with { end with }:\n{"fear_greed":{"value":NUMBER,"label":"TEXT"},"btc":{"price":NUMBER,"change_24h":NUMBER},"meme":{"mcap":NUMBER,"mcap_change_24h":NUMBER},"tvl":{"solana":NUMBER,"ethereum":NUMBER,"bsc":NUMBER},"stablecoins":{"total":NUMBER,"change_7d":NUMBER,"change_7d_pct":NUMBER},"dex_volume":{"solana":{"total_24h":NUMBER,"change_1d_pct":NUMBER},"base":{"total_24h":NUMBER,"change_1d_pct":NUMBER},"bsc":{"total_24h":NUMBER,"change_1d_pct":NUMBER}}}` }],
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

function todayKey() {
  const d = new Date();
  return `daily:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── SIGNAL LOGIC ──
function calcL2Signal(macro) {
  const stblOk = macro.stablecoins?.change_7d > 0;
  const solInflow = macro.chain_stablecoins?.solana?.net_inflow_7d > 0;
  if (stblOk && solInflow) return "green";
  if (stblOk || solInflow) return "yellow";
  return "red";
}
function calcL3Signal(macro) {
  const dex = macro.dex_volume || {};
  const dir = (v) => v == null ? 0.5 : v >= 5 ? 1 : v <= -5 ? 0 : 0.5;
  const memeDir = macro.meme?.mcap_change_24h == null ? 0.5 : macro.meme.mcap_change_24h >= 1 ? 1 : macro.meme.mcap_change_24h <= -1 ? 0 : 0.5;
  const w = ((memeDir + dir(dex.solana?.change_1d_pct)) * 1.0 + (dir(dex.base?.change_1d_pct) + dir(dex.bsc?.change_1d_pct)) * 0.5) / 3;
  return w >= 0.7 ? "green" : w >= 0.4 ? "yellow" : "red";
}
function calcFGSignal(fg) { if (fg == null) return "yellow"; return fg >= 55 ? "green" : fg >= 30 ? "yellow" : "red"; }

// L4 signal: watchlist + alpha scanner
function calcL4Signal(watchlist, alphaCards) {
  // Watchlist: count how many have vmc > 0.3 (active) and positive 24h
  const filled = watchlist.filter(r => r.token && r.mcap);
  if (filled.length === 0 && alphaCards.filter(a => a.token).length === 0) return null;
  const activeCount = filled.filter(r => parseFloat(r.vmc) >= 0.3).length;
  const bullCount = filled.filter(r => parseFloat(r.chg24h) > 0).length;
  const bearCount = filled.filter(r => parseFloat(r.chg24h) < 0).length;

  // Alpha: good = chips spread + momentum stable/surge
  const alphaFilled = alphaCards.filter(a => a.token);
  const goodAlpha = alphaFilled.filter(a => (a.chips === "spread" || a.chips === "retail") && (a.momentum === "surge" || a.momentum === "stable")).length;
  const badAlpha = alphaFilled.filter(a => a.momentum === "decay" && a.poolStrength < 0.5).length;

  let score = 0.5; // baseline
  if (filled.length > 0) {
    const bullRatio = bullCount / filled.length;
    const vmcActive = activeCount / filled.length;
    score = (bullRatio * 0.4 + vmcActive * 0.3);
  }
  if (goodAlpha > 0) score += 0.2;
  if (badAlpha > 0) score -= 0.15;

  return score >= 0.6 ? "green" : score >= 0.35 ? "yellow" : "red";
}

const signalEmoji = { green: "🟢", yellow: "🟡", red: "🔴" };

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

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [macro, setMacro] = useState(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState("");
  const [macroTime, setMacroTime] = useState("");
  const [fgVal, setFgVal] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  // L4
  const [watchlist, setWatchlist] = useState(Array.from({ length: 5 }, emptyWatchRow));
  const [alphaCards, setAlphaCards] = useState(Array.from({ length: 3 }, emptyAlpha));

  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const isLoaded = useRef(false);
  const saveTimer = useRef(null);

  // ── STORAGE ──
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(todayKey());
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.fgVal) setFgVal(d.fgVal);
          if (d.dailyNote) setDailyNote(d.dailyNote);
          if (Array.isArray(d.watchlist)) setWatchlist(d.watchlist);
          if (Array.isArray(d.alphaCards)) setAlphaCards(d.alphaCards);
        }
      } catch {}
      isLoaded.current = true;
    })();
  }, []);

  const doSave = useCallback(async () => {
    try {
      await window.storage.set(todayKey(), JSON.stringify({ fgVal, dailyNote, watchlist, alphaCards, savedAt: new Date().toISOString() }));
    } catch {}
  }, [fgVal, dailyNote, watchlist, alphaCards]);

  useEffect(() => {
    if (!isLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [fgVal, dailyNote, watchlist, alphaCards, doSave]);

  // ── MACRO REFRESH ──
  const handleMacroRefresh = useCallback(async () => {
    setMacroLoading(true); setMacroError("");
    try {
      const data = await fetchMacroViaAI();
      setMacro(data);
      setMacroTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      if (data.fear_greed?.value != null) setFgVal(String(data.fear_greed.value));
    } catch (e) { setMacroError("❌ " + e.message); }
    finally { setMacroLoading(false); }
  }, []);

  // ── L4 handlers ──
  const updWatch = (idx, field, val) => setWatchlist(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const updAlpha = (idx, field, val) => setAlphaCards(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  const addWatchRow = () => { if (watchlist.length < 10) setWatchlist(prev => [...prev, emptyWatchRow()]); };
  const removeWatchRow = (idx) => setWatchlist(prev => prev.filter((_, i) => i !== idx));

  // ── SIGNALS ──
  const l2Signal = macro ? calcL2Signal(macro) : null;
  const l3Signal = macro ? calcL3Signal(macro) : null;
  const fgSignal = calcFGSignal(parseInt(fgVal) || null);
  const l4Signal = calcL4Signal(watchlist, alphaCards);
  const signals = [l2Signal, l3Signal, fgSignal, l4Signal].filter(Boolean);
  const sigScore = signals.length > 0 ? signals.reduce((s, v) => s + (v === "green" ? 1 : v === "yellow" ? 0.5 : 0), 0) / signals.length : null;
  const heroInfo = sigScore === null ? { label: "等待数据", bg: "linear-gradient(140deg,#8E8E93,#636366)", desc: "点击「一键刷新」· 约需 10-20 秒" }
    : sigScore >= 0.7 ? { label: "进　攻", bg: "linear-gradient(140deg,#34C759,#30D158)", desc: "多层共振看涨" }
    : sigScore >= 0.5 ? { label: "积　极", bg: "linear-gradient(140deg,#007AFF,#5AC8FA)", desc: "整体偏多 · 选择性参与" }
    : sigScore >= 0.35 ? { label: "观　望", bg: "linear-gradient(140deg,#FF9500,#FFCC00)", desc: "信号分歧 · 等待确认" }
    : { label: "防　御", bg: "linear-gradient(140deg,#FF3B30,#FF6B35 60%,#FF9500)", desc: "多层偏空 · 缩减仓位" };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system,'Helvetica Neue',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}textarea,input[type="text"]{appearance:none;-webkit-appearance:none}a{cursor:pointer}`}</style>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(242,242,247,0.88)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: "0.5px solid #C6C6C8" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>LiquidityOS</div><div style={{ fontSize: 12, color: C.labelTer, marginTop: 1 }}>{macroTime ? macroTime + " 更新" : today}</div></div>
          <button onClick={handleMacroRefresh} disabled={macroLoading} style={{ background: macroLoading ? "rgba(0,122,255,0.4)" : C.blue, color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: macroLoading ? "default" : "pointer", fontFamily: "-apple-system,sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            {macroLoading ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> : "⚡"}{macroLoading ? "搜索中…" : "一键刷新"}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 0 48px" }}>
        {/* HERO */}
        <div style={{ margin: "0 16px 16px", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.07)", animation: "rise 0.45s both" }}>
          <div style={{ padding: "22px 20px 20px", background: heroInfo.bg }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>系统综合信号</div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2, color: "#fff", lineHeight: 1, marginBottom: 10 }}>{heroInfo.label}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>{heroInfo.desc}</div>
          </div>
          <div style={{ background: C.card, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[[l2Signal, "稳定币"], [l3Signal, "Meme板块"], [fgSignal, "情绪"], [l4Signal, "个股"]].map(([s, l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "12px 4px", borderRight: `0.5px solid ${C.sep}` }}>
                <div style={{ fontSize: 17 }}>{s ? signalEmoji[s] : "⚪"}</div><div style={{ fontSize: 9, color: C.labelTer, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {macroError && <div style={{ margin: "0 16px 8px", fontSize: 13, color: C.red, padding: "8px 14px", background: "rgba(255,59,48,0.08)", borderRadius: 10 }}>{macroError}</div>}

        {/* L0-L3 PANELS (only when macro data loaded) */}
        {macro && <>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>L0-B · BTC</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="BTC 现价" value={macro.btc?.price ? "$" + macro.btc.price.toLocaleString() : "—"} sub={macro.btc?.source} /><DataRow label="24h" value={fmtPct(macro.btc?.change_24h)} color={macro.btc?.change_24h >= 0 ? C.green : C.red} /><div style={{ fontSize: 11, color: C.labelTer, marginTop: 8, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>手动查看：<a href="https://www.tradingview.com/symbols/BTCUSD/" target="_blank" rel="noreferrer" style={{ color: C.blue }}>BTC/200MA</a> · <a href="https://www.lookintobitcoin.com/charts/mvrv-zscore/" target="_blank" rel="noreferrer" style={{ color: C.blue }}>MVRV</a></div></div></div>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>L1 · 净流动性</div><div style={{ ...cardStyle, padding: "14px 16px" }}>{macro.fred?.gnl ? <><DataRow label="GNL" value={macro.fred.gnl.value_t + "T"} color={C.blue} /><DataRow label="Fed" value={macro.fred.fed?.value ? (macro.fred.fed.value/1e6).toFixed(3)+"T" : "—"} sub={macro.fred.fed?.date} /><DataRow label="TGA" value={macro.fred.tga?.value ? (macro.fred.tga.value/1e6).toFixed(3)+"T" : "—"} /><DataRow label="RRP" value={macro.fred.rrp?.value ? (macro.fred.rrp.value/1e3).toFixed(3)+"T" : "—"} /></> : <div style={{ fontSize: 12, color: C.labelTer, padding: "6px 8px", background: C.fill, borderRadius: 6 }}>FRED Key 未设置 · <a href="https://fred.stlouisfed.org/series/WALCL" target="_blank" rel="noreferrer" style={{ color: C.blue }}>Fed</a> · <a href="https://fred.stlouisfed.org/series/WTREGEN" target="_blank" rel="noreferrer" style={{ color: C.blue }}>TGA</a> · <a href="https://fred.stlouisfed.org/series/RRPONTSYD" target="_blank" rel="noreferrer" style={{ color: C.blue }}>RRP</a></div>}</div></div>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[l2Signal]||"⚪"} L2 · 稳定币弹药</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="稳定币总市值" value={fmtB(macro.stablecoins?.total)} /><DataRow label="7日净变化" value={macro.stablecoins?.change_7d!=null?(macro.stablecoins.change_7d>0?"+":"")+fmtNum(macro.stablecoins.change_7d):"—"} sub={fmtPct(macro.stablecoins?.change_7d_pct)} color={macro.stablecoins?.change_7d>=0?C.green:C.red} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="Solana TVL" value={fmtB(macro.tvl?.solana)} /><DataRow label="ETH TVL" value={fmtB(macro.tvl?.ethereum)} /><DataRow label="BSC TVL" value={fmtB(macro.tvl?.bsc)} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="SOL 稳定币净流入(7d)" value={macro.chain_stablecoins?.solana?.net_inflow_7d!=null?fmtNum(macro.chain_stablecoins.solana.net_inflow_7d):"—"} color={macro.chain_stablecoins?.solana?.net_inflow_7d>=0?C.green:C.red} /><DataRow label="BSC 稳定币净流入(7d)" value={macro.chain_stablecoins?.bsc?.net_inflow_7d!=null?fmtNum(macro.chain_stablecoins.bsc.net_inflow_7d):"—"} color={macro.chain_stablecoins?.bsc?.net_inflow_7d>=0?C.green:C.red} /></div></div>
          <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[l3Signal]||"⚪"} L3 · Meme 板块</div><div style={{ ...cardStyle, padding: "14px 16px" }}><DataRow label="Meme 总市值" value={macro.meme?.mcap?fmtB(macro.meme.mcap):"—"} sub={macro.meme?.mcap_change_24h!=null?"24h "+fmtPct(macro.meme.mcap_change_24h):null} color={macro.meme?.mcap_change_24h>=0?C.green:C.red} /><div style={{ height: 1, background: C.sep, margin: "8px 0" }} /><DataRow label="Solana DEX 24h" value={fmtB(macro.dex_volume?.solana?.total_24h)} sub={macro.dex_volume?.solana?.change_1d_pct!=null?"1d "+fmtPct(macro.dex_volume.solana.change_1d_pct):null} color={macro.dex_volume?.solana?.change_1d_pct>=0?C.green:C.red} /><DataRow label="Base DEX 24h" value={fmtB(macro.dex_volume?.base?.total_24h)} /><DataRow label="BSC DEX 24h" value={fmtB(macro.dex_volume?.bsc?.total_24h)} /></div></div>
        </>}

        {/* F&G */}
        <div style={{ marginBottom: 6 }}><div style={secLabel}>{signalEmoji[fgSignal]||"⚪"} 恐惧贪婪指数</div>
          <div style={{ ...cardStyle, padding: "18px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>F&G</span><input value={fgVal} onChange={e => setFgVal(e.target.value.replace(/\D/,""))} maxLength={3} placeholder="—" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, color: parseInt(fgVal)>=55?C.green:parseInt(fgVal)>=30?C.orange:C.red, border: "none", outline: "none", background: "transparent", width: 80, textAlign: "right", fontFamily: "-apple-system,sans-serif" }} /></div>
            <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>{fgVal && <div style={{ position: "absolute", top: "50%", left: Math.max(2,Math.min(98,parseInt(fgVal)||0))+"%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.labelQ, marginTop: 8 }}>{["极度恐惧","恐惧","中性","贪婪","极度贪婪"].map(l => <span key={l}>{l}</span>)}</div>
          </div>
        </div>

        {/* ══════════ L4 · MEME 存量与增量结构 ══════════ */}
        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>{l4Signal ? signalEmoji[l4Signal] : "⚪"} L4 · Meme 存量与增量结构</div>

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
            <textarea placeholder="记录市场观察、入场理由、止损位..." value={dailyNote} onChange={e => setDailyNote(e.target.value)} style={{ width: "100%", minHeight: 100, border: "none", outline: "none", padding: "12px 16px", fontFamily: "-apple-system,sans-serif", fontSize: 15, color: C.label, lineHeight: 1.55, resize: "none", background: "transparent" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "12px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>LiquidityOS v2 · L0-L4 四层框架<br />DeFiLlama · CoinGecko · Alternative.me · Binance · GMGN</div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef } from "react";

const C = {
  bg: "#F2F2F7", card: "#fff", label: "#000", labelSec: "#3C3C43",
  labelTer: "rgba(60,60,67,0.6)", labelQ: "rgba(60,60,67,0.4)",
  sep: "rgba(60,60,67,0.16)", fill: "rgba(120,120,128,0.08)",
  fill2: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", orange: "#FF9500",
  red: "#FF3B30", yellow: "#FFCC00", purple: "#AF52DE", teal: "#30B0C7",
};

function fmtNum(n) {
  if (!n) return "—";
  n = parseFloat(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
}

const DIMS = [
  { key: "story",   icon: "💡", bg: "rgba(255,204,0,0.14)",   label: "叙事 / 题材热点",  ph: "这个币的故事是什么？此刻市场为何关注？热点是真实的还是炒作的？" },
  { key: "onchain", icon: "🔗", bg: "rgba(0,122,255,0.10)",   label: "链上数据",          ph: "LP 健康吗？换手率如何？市值合理吗？" },
  { key: "smart",   icon: "🐋", bg: "rgba(52,199,89,0.10)",   label: "聪明钱动向",        ph: "GMGN 有没有聪明钱建仓？KOL 大户持仓情况？" },
  { key: "social",  icon: "📣", bg: "rgba(175,82,222,0.10)", label: "社媒热度",           ph: "Twitter 讨论量？TG 活跃度？KOL 有没有转发？" },
];
const SCORES = [
  { val: "strong", label: "🟢 强" },
  { val: "ok",     label: "🔵 可" },
  { val: "weak",   label: "🟠 弱" },
  { val: "bad",    label: "🔴 差" },
];

// ── FETCH TRENDING ──────────────────────────────────────────────────────
function extractJSON(text) {
  // 1. ```json ... ``` 代码块
  const codeBlock = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (codeBlock) { try { const p = JSON.parse(codeBlock[1]); if (Array.isArray(p) && p.length) return p; } catch {} }
  // 2. 找所有 [...] 块，从最长的开始尝试
  const allBrackets = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "]") { depth--; if (depth === 0 && start !== -1) { allBrackets.push(text.slice(start, i + 1)); start = -1; } }
  }
  allBrackets.sort((a, b) => b.length - a.length);
  for (const s of allBrackets) {
    try { const p = JSON.parse(s); if (Array.isArray(p) && p.length && p[0].symbol) return p; } catch {}
  }
  return null;
}

async function fetchTrendingFromAPI(onStatus) {
  onStatus("🔍 AI 正在搜索 Solana 热榜...");

  const PROMPT = `Search dexscreener.com for the top Solana meme tokens by 24h trading volume right now.

After searching, output ONLY a raw JSON array with no markdown fences, no explanation, no extra text. Start your response with [ and end with ].

Format:
[{"symbol":"TICKER","name":"Full Name","address":"contract_or_null","mcap":1234567,"vol24h":234567,"liq":123456,"lpRatio":12.3,"turnover":0.45,"change24h":15.2,"desc":"one line story in Chinese","url":"https://dexscreener.com/solana/..."}]

Rules: 8 tokens. mcap/vol24h/liq = USD numbers. lpRatio = liq/mcap*100. turnover = vol24h/mcap. change24h = % change. Use null for unknowns. NO text before or after the JSON array.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: PROMPT }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API 请求失败 HTTP ${res.status}${errText ? "：" + errText.slice(0, 100) : ""}`);
  }

  const data = await res.json();
  const content = data.content || [];

  // 收集所有 text block 的内容（web_search 后模型会在 text block 里返回结果）
  const allText = content
    .map((b) => {
      if (b.type === "text") return b.text || "";
      if (b.type === "tool_result") return (b.content || []).map((c) => c.text || "").join("\n");
      return "";
    })
    .join("\n");

  if (!allText.trim()) {
    const stopReason = data.stop_reason || "unknown";
    throw new Error(`AI 未返回内容（stop_reason: ${stopReason}），请重试`);
  }

  const parsed = extractJSON(allText);
  if (!parsed || !parsed.length) {
    throw new Error("格式解析失败，AI回复片段：" + allText.slice(0, 150).replace(/\n/g, " "));
  }

  return parsed;
}

// ── SCORE COLORS ──────────────────────────────────────────────────────
const scoreStyle = (val, sel) => {
  const map = {
    strong: { bg: "rgba(52,199,89,0.15)", border: C.green, color: C.green },
    ok:     { bg: "rgba(0,122,255,0.12)", border: C.blue,  color: C.blue  },
    weak:   { bg: "rgba(255,149,0,0.13)", border: C.orange, color: C.orange },
    bad:    { bg: "rgba(255,59,48,0.11)", border: C.red,   color: C.red   },
  };
  const base = {
    border: `1.5px solid rgba(60,60,67,0.2)`, borderRadius: 8,
    padding: "7px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    background: "transparent", color: C.labelTer, transition: "all 0.15s",
  };
  if (sel === val) return { ...base, ...(map[val] || {}) };
  return base;
};

const verdictInfo = (avg) => {
  if (avg === null) return null;
  if (avg >= 2.5) return { cls: C.green,  text: "✅ 值得关注，考虑建仓" };
  if (avg >= 1.8) return { cls: C.blue,   text: "👀 继续观察，等更多确认" };
  if (avg >= 1.0) return { cls: C.orange, text: "⚠️ 综合偏弱，暂时跳过" };
  return            { cls: C.red,    text: "❌ 不建议介入" };
};

// ── COIN CARD ──────────────────────────────────────────────────────────
function CoinCard({ coin, onDelete, onScore, onNote }) {
  const d = coin.onchainData || {};
  const lpRatio  = d.lpRatio  != null ? +d.lpRatio  : null;
  const turnover = d.turnover != null ? +d.turnover : null;
  const mcap     = d.mcap  ? fmtNum(d.mcap)  : "—";
  const vol      = d.vol24h ? fmtNum(d.vol24h) : "—";
  const liq      = d.liq   ? fmtNum(d.liq)   : "—";
  const change   = d.change != null ? (d.change > 0 ? "+" : "") + (+d.change).toFixed(1) + "%" : "—";
  const dexUrl   = d.url || (coin.address && !coin.address.startsWith("ai_") ? `https://dexscreener.com/solana/${coin.address}` : "https://dexscreener.com");
  const gmgnUrl  = coin.address && !coin.address.startsWith("ai_") ? `https://gmgn.ai/sol/token/${coin.address}` : "https://gmgn.ai";
  const twUrl    = `https://twitter.com/search?q=${encodeURIComponent("$" + (coin.symbol || ""))}& f=live`;
  const isManual = !coin.address || coin.address === "";

  const sv = { strong: 3, ok: 2, weak: 1, bad: 0 };
  const vals = Object.values(coin.scores).map((v) => sv[v] || 0);
  const avg = vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const verdict = verdictInfo(avg);

  const chip = (label, val, type) => {
    const isGood = type === "lp" ? val >= 10 : val >= 0.5;
    const isWarn = type === "lp" ? val >= 5  : val >= 0.2;
    const color = val == null ? C.labelSec : isGood ? C.green : isWarn ? C.orange : C.red;
    const bg    = val == null ? C.fill2 : isGood ? "rgba(52,199,89,0.12)" : isWarn ? "rgba(255,149,0,0.12)" : "rgba(255,59,48,0.10)";
    return (
      <span style={{ background: bg, color, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ margin: "0 16px 10px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", animation: "rise 0.3s both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `0.5px solid ${C.sep}` }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: verdict ? verdict.cls : C.sep, flexShrink: 0, transition: "background 0.3s" }} />
        {isManual
          ? <input placeholder="输入 $TICKER 或合约地址" onChange={e => onNote("_meta", e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontWeight: 600, color: C.label, letterSpacing: -0.3, fontFamily: "-apple-system,sans-serif" }} />
          : <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>${coin.symbol}</div>
              <div style={{ fontSize: 11, color: C.labelTer, marginTop: 1 }}>{coin.name}</div>
            </div>
        }
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: C.labelQ, fontSize: 20, padding: "0 2px", lineHeight: 1 }}>×</button>
      </div>

      {/* onchain strip */}
      {!isManual && (
        <div style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 8px" }}>
            <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>市值 {mcap}</span>
            <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>池 {liq}</span>
            {chip(`LP比 ${lpRatio != null ? lpRatio.toFixed(1) + "%" : "—"}`, lpRatio, "lp")}
            {chip(`换手 ${turnover != null ? turnover.toFixed(2) + "x" : "—"}`, turnover, "tv")}
            <span style={{ background: C.fill2, color: C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>Vol {vol}</span>
            <span style={{ background: d.change != null ? (d.change >= 0 ? "rgba(52,199,89,0.12)" : "rgba(255,59,48,0.10)") : C.fill2, color: d.change != null ? (d.change >= 0 ? C.green : C.red) : C.labelSec, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>24h {change}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {[["🐋 GMGN 聪明钱", gmgnUrl, "rgba(52,199,89,0.12)", C.green], ["🐦 Twitter 热度", twUrl, "rgba(0,122,255,0.10)", C.blue], ["📊 DexScreener", dexUrl, "rgba(175,82,222,0.10)", C.purple]].map(([label, href, bg, color]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{ background: bg, color, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>{label}</a>
            ))}
          </div>
        </div>
      )}

      {/* dimensions */}
      <div style={{ padding: "14px 14px 4px" }}>
        {DIMS.map((dim) => (
          <div key={dim.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: dim.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginTop: 1 }}>{dim.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.labelTer, marginBottom: 4 }}>{dim.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 8 }}>
                {SCORES.map((s) => (
                  <button key={s.val} onClick={() => onScore(dim.key, s.val)} style={scoreStyle(s.val, coin.scores[dim.key])}>{s.label}</button>
                ))}
              </div>
              <textarea rows={2} placeholder={dim.ph} onChange={e => onNote(dim.key, e.target.value)}
                style={{ width: "100%", border: "none", outline: "none", background: C.fill2, borderRadius: 8, padding: "8px 10px", fontFamily: "-apple-system,sans-serif", fontSize: 14, color: C.label, lineHeight: 1.5, resize: "none", minHeight: 40 }} />
            </div>
          </div>
        ))}
      </div>

      {/* verdict */}
      {verdict && (
        <div style={{ margin: "0 14px 14px", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, background: verdict.cls + "22", color: verdict.cls }}>
          {verdict.text}
        </div>
      )}
    </div>
  );
}

// ── TRENDING ITEM ──────────────────────────────────────────────────────
function TrendingItem({ t, added, onAdd }) {
  const lpRatio  = t.lpRatio  != null ? +t.lpRatio  : null;
  const turnover = t.turnover != null ? +t.turnover : null;
  const change   = t.change24h;
  const changeColor = change > 0 ? C.green : change < 0 ? C.red : C.labelTer;
  const changeStr   = change != null ? (change > 0 ? "+" : "") + (+change).toFixed(1) + "%" : "";

  const chip = (label, val, type) => {
    const isGood = type === "lp" ? val >= 10 : val >= 0.5;
    const isWarn = type === "lp" ? val >= 5  : val >= 0.2;
    const color = val == null ? C.labelSec : isGood ? C.green : isWarn ? C.orange : C.red;
    const bg    = val == null ? C.fill2 : isGood ? "rgba(52,199,89,0.12)" : isWarn ? "rgba(255,149,0,0.12)" : "rgba(255,59,48,0.10)";
    return <span style={{ background: bg, color, borderRadius: 6, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{label}</span>;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 6, background: C.fill, transition: "background 0.12s" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,rgba(0,122,255,0.2),rgba(175,82,222,0.2))", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.blue }}>
        {(t.symbol || "?").slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <span>${t.symbol}</span>
          <span style={{ fontWeight: 400, color: C.labelTer, fontSize: 11 }}>{t.name}</span>
          {changeStr && <span style={{ fontSize: 11, fontWeight: 600, color: changeColor }}>{changeStr}</span>}
        </div>
        <div style={{ fontSize: 11, color: C.labelTer, marginTop: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          {t.mcap  && <span>市值 {fmtNum(t.mcap)}</span>}
          {t.liq   && <><span>· 池 {fmtNum(t.liq)}</span>{chip(lpRatio != null ? lpRatio.toFixed(0) + "%" : "—", lpRatio, "lp")}</>}
          {t.vol24h && <><span>· Vol {fmtNum(t.vol24h)}</span>{chip(turnover != null ? turnover.toFixed(2) + "x" : "—", turnover, "tv")}</>}
        </div>
        {t.desc && <div style={{ fontSize: 10, color: C.labelTer, marginTop: 2, fontStyle: "italic" }}>{t.desc}</div>}
      </div>
      <button onClick={onAdd} disabled={added}
        style={{ background: added ? C.green : C.blue, color: "#fff", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: added ? 14 : 18, cursor: added ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s", opacity: added ? 0.8 : 1 }}>
        {added ? "✓" : "＋"}
      </button>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [trending, setTrending]     = useState([]);
  const [fetchState, setFetchState] = useState("idle"); // idle | loading | done | error
  const [fetchStatus, setFetchStatus] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [coins, setCoins]           = useState([]);
  const [fgVal, setFgVal]           = useState("16");

  const MAX = 5;
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // fetch trending
  const handleFetch = useCallback(async () => {
    setFetchState("loading");
    setFetchError("");
    setTrending([]);
    try {
      const tokens = await fetchTrendingFromAPI(setFetchStatus);
      if (!Array.isArray(tokens) || !tokens.length) throw new Error("未获取到热榜数据，请重试");
      setTrending(tokens);
      setFetchState("done");
    } catch (e) {
      setFetchError("❌ " + e.message);
      setFetchState("error");
    }
  }, []);

  const addFromTrending = useCallback((t) => {
    if (coins.length >= MAX) return;
    const addr = t.address || "ai_" + t.symbol;
    if (coins.find((c) => c.address === addr)) return;
    setCoins(prev => [...prev, {
      id: "coin_" + Date.now(),
      symbol: t.symbol || "???",
      name: t.name || t.symbol || "???",
      address: addr,
      scores: {}, notes: {},
      onchainData: { mcap: t.mcap, vol24h: t.vol24h, liq: t.liq, lpRatio: t.lpRatio, turnover: t.turnover, change: t.change24h, url: t.url },
    }]);
  }, [coins]);

  const addManual = () => {
    if (coins.length >= MAX) return;
    setCoins(prev => [...prev, { id: "coin_m_" + Date.now(), symbol: "", name: "", address: "", scores: {}, notes: {}, onchainData: {} }]);
  };

  const deleteCoin  = (id) => setCoins(prev => prev.filter(c => c.id !== id));
  const updateScore = (id, dim, val) => setCoins(prev => prev.map(c => c.id === id ? { ...c, scores: { ...c.scores, [dim]: val } } : c));
  const updateNote  = (id, dim, val) => setCoins(prev => prev.map(c => c.id === id ? { ...c, notes:  { ...c.notes,  [dim]: val } } : c));

  // tweet draft
  const VLABEL = { pass: "✅ 值得关注", watch: "👀 继续观察", skip: "⚠️ 暂时跳过", no: "❌ 不建议" };
  const SLABEL = { strong: "🟢", ok: "🔵", weak: "🟠", bad: "🔴" };
  const sv = { strong: 3, ok: 2, weak: 1, bad: 0 };

  const tweetLines = coins.filter(c => c.symbol || c.name).map(c => {
    const vals = Object.values(c.scores).map(v => sv[v] || 0);
    const avg = vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const verdict = avg === null ? "" : avg >= 2.5 ? "pass" : avg >= 1.8 ? "watch" : avg >= 1.0 ? "skip" : "no";
    const scoreStr = DIMS.map(d => { const s = c.scores[d.key]; return s ? SLABEL[s] + d.label.slice(0, 2) : null; }).filter(Boolean).join("  ");
    const note = c.notes?.story?.trim();
    return `$${c.symbol || c.name}  ${VLABEL[verdict] || ""}\n   ${scoreStr}${note ? "\n   💡 " + note.slice(0, 55) : ""}`;
  }).join("\n\n");

  const tweet = coins.some(c => c.symbol || c.name)
    ? `今日热点研判 🧭 ${new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}\n\n贪婪恐惧指数 ${fgVal} · Solana 战场\n\n${tweetLines}\n\n——\n四层流动性框架 | @partrick2022\n#加密货币 #Meme #Solana`
    : "";

  const [copied, setCopied] = useState(false);
  const copyTweet = () => {
    navigator.clipboard.writeText(tweet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // styles
  const cardStyle = { margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" };
  const secLabel = { padding: "0 20px 7px", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.labelTer };
  const pillStyle = (color, bg) => ({ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "3px 9px", fontSize: 12, fontWeight: 600, background: bg, color });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "-apple-system,'Helvetica Neue',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        textarea { appearance:none; -webkit-appearance:none; }
        a { cursor:pointer; }
      `}</style>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(242,242,247,0.88)", backdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid #C6C6C8` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 20px" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>流动性仪表盘</div>
            <div style={{ fontSize: 12, color: C.labelTer, marginTop: 1 }}>{today}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(52,199,89,0.13)", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: C.green }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "blink 2s ease-in-out infinite" }} />
            实时
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 0 48px" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.2, padding: "10px 20px 2px" }}>LiquidityOS</div>
        <div style={{ fontSize: 13, color: C.labelTer, padding: "0 20px 16px" }}>{today} · 每日例行检查</div>

        {/* HERO */}
        <div style={{ margin: "0 16px 16px", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.07)", animation: "rise 0.45s both" }}>
          <div style={{ padding: "22px 20px 20px", background: "linear-gradient(140deg,#FF3B30 0%,#FF6B35 60%,#FF9500 100%)", position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.72)", marginBottom: 6 }}>系统综合信号</div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2, color: "#fff", lineHeight: 1, marginBottom: 10 }}>观　望</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>3/4 层信号偏空 · 极度恐惧<br />等待 USDT 重新扩张是核心入场信号</div>
          </div>
          <div style={{ background: C.card, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[["🟡","宏观"],["🔴","稳定币"],["🟡","链上"],["🔴","情绪"]].map(([e,l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "14px 4px", borderRight: `0.5px solid ${C.sep}` }}>
                <div style={{ fontSize: 19 }}>{e}</div>
                <div style={{ fontSize: 10, color: C.labelTer }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FEAR GREED */}
        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>贪婪恐惧指数</div>
          <div style={{ ...cardStyle, padding: "18px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>恐惧贪婪指数</span>
              <input value={fgVal} onChange={e => setFgVal(e.target.value.replace(/\D/,""))} maxLength={3}
                style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, color: C.red, border: "none", outline: "none", background: "transparent", width: 80, textAlign: "right", fontFamily: "-apple-system,sans-serif" }} />
            </div>
            <div style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg,#FF3B30 0%,#FF9500 38%,#FFCC00 58%,#34C759 100%)", position: "relative" }}>
              <div style={{ position: "absolute", top: "50%", left: Math.max(2, Math.min(98, parseInt(fgVal) || 0)) + "%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", border: "1.5px solid rgba(0,0,0,0.07)", transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.labelQ, marginTop: 8 }}>
              {["极度恐惧","恐惧","中性","贪婪","极度贪婪"].map(l => <span key={l}>{l}</span>)}
            </div>
          </div>
        </div>

        {/* HOT COINS */}
        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>24H 热点新币研判</div>

          {/* fetch panel */}
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ padding: "14px 16px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>① AI 搜索 Solana 热榜</div>
                  <div style={{ fontSize: 12, color: C.labelTer, marginTop: 2 }}>Claude AI + Web Search 实时抓取 · 无 CORS 限制</div>
                </div>
                <button onClick={handleFetch} disabled={fetchState === "loading"}
                  style={{ background: fetchState === "loading" ? "rgba(0,122,255,0.5)" : C.blue, color: "#fff", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: fetchState === "loading" ? "default" : "pointer", whiteSpace: "nowrap", letterSpacing: -0.1, fontFamily: "-apple-system,sans-serif", transition: "background 0.2s" }}>
                  {fetchState === "loading" ? "抓取中..." : "🔄 抓取热榜"}
                </button>
              </div>

              {fetchState === "loading" && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ fontSize: 22, display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</div>
                  <div style={{ fontSize: 13, color: C.labelTer, marginTop: 6 }}>{fetchStatus || "🔍 AI 正在搜索 Solana 热榜..."}</div>
                  <div style={{ fontSize: 11, color: C.labelQ, marginTop: 3 }}>由 Claude AI + Web Search 驱动，约需 15–25 秒</div>
                </div>
              )}

              {fetchState === "error" && (
                <div style={{ fontSize: 13, color: C.red, padding: "8px 0" }}>{fetchError}</div>
              )}

              {fetchState === "done" && trending.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.labelTer, marginBottom: 8 }}>
                    点击「＋」加入研判（最多 {MAX} 个）
                  </div>
                  {trending.map(t => {
                    const addr = t.address || "ai_" + t.symbol;
                    const added = !!coins.find(c => c.address === addr);
                    return <TrendingItem key={addr} t={t} added={added} onAdd={() => addFromTrending(t)} />;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* coin count + manual add */}
          <div style={{ margin: "0 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, color: C.labelTer }}>
              已选 <strong style={{ color: C.blue }}>{coins.length}</strong> / {MAX} 个
            </div>
            <button onClick={addManual} disabled={coins.length >= MAX}
              style={{ background: C.fill2, color: C.labelSec, border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif", opacity: coins.length >= MAX ? 0.5 : 1 }}>
              ＋ 手动添加
            </button>
          </div>

          {/* coin cards */}
          {coins.length === 0
            ? <div style={{ margin: "0 16px 8px", background: C.card, borderRadius: 14, padding: "28px 20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.labelSec, marginBottom: 4 }}>还没有研判</div>
                <div style={{ fontSize: 13, color: C.labelTer, lineHeight: 1.5 }}>点击「🔄 抓取热榜」让 AI 自动搜索最新热点<br />或点「＋ 手动添加」输入合约地址</div>
              </div>
            : coins.map(c => (
                <CoinCard key={c.id} coin={c}
                  onDelete={() => deleteCoin(c.id)}
                  onScore={(dim, val) => updateScore(c.id, dim, val)}
                  onNote={(dim, val) => updateNote(c.id, dim, val)} />
              ))
          }

          {/* tweet draft */}
          {tweet && (
            <div style={{ margin: "0 16px 8px", background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <div style={{ padding: "13px 16px", borderBottom: `0.5px solid ${C.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.labelSec }}>🐦 今日推文草稿</span>
                <button onClick={copyTweet} style={{ background: copied ? "rgba(52,199,89,0.15)" : "rgba(0,122,255,0.1)", color: copied ? C.green : C.blue, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "-apple-system,sans-serif", transition: "all 0.2s" }}>
                  {copied ? "已复制 ✓" : "复制"}
                </button>
              </div>
              <pre style={{ padding: "14px 16px", fontSize: 14, color: C.label, lineHeight: 1.65, letterSpacing: -0.1, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "-apple-system,sans-serif" }}>{tweet}</pre>
            </div>
          )}
        </div>

        {/* NOTES */}
        <div style={{ marginBottom: 6 }}>
          <div style={secLabel}>今日交易笔记</div>
          <div style={{ ...cardStyle }}>
            <div style={{ padding: "12px 16px 10px", fontSize: 13, fontWeight: 600, color: C.labelSec, borderBottom: `0.5px solid ${C.sep}` }}>📝 记录</div>
            <textarea placeholder={"记录今天的市场观察、候选项目、入场理由、止损位...\n\n例：BTC 今日 $67K 震荡，等 USDT 扩张信号..."}
              style={{ width: "100%", minHeight: 100, border: "none", outline: "none", padding: "12px 16px", fontFamily: "-apple-system,sans-serif", fontSize: 15, color: C.label, letterSpacing: -0.2, lineHeight: 1.55, resize: "none", background: "transparent" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "12px 20px 28px", fontSize: 11, color: C.labelQ, lineHeight: 1.7 }}>
          LiquidityOS · 私人使用<br />
          数据来源：macromicro · defillama · dexscreener · gmgn
        </div>
      </div>
    </div>
  );
}

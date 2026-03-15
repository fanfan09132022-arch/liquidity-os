import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WORKER } from "./config.js";

const C = {
  bg: "#F2F2F7", card: "#fff", label: "#000", labelSec: "#3C3C43",
  labelTer: "rgba(60,60,67,0.6)", labelQ: "rgba(60,60,67,0.4)",
  sep: "rgba(60,60,67,0.16)", fill: "rgba(120,120,128,0.08)",
  fill2: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", orange: "#FF9500",
  red: "#FF3B30", yellow: "#FFCC00", purple: "#AF52DE", teal: "#30B0C7",
};

const FNG_ENDPOINT = `${WORKER}/api/fg?limit=365`;
const FUNDING_ENDPOINT = `${WORKER}/api/funding`;
const OPEN_INTEREST_ENDPOINT = `${WORKER}/api/oi`;

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

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: C.labelSec,
  marginBottom: 6,
};

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

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getFngLabel(value) {
  const numeric = toNumber(value);
  if (numeric == null) return "未知";
  if (numeric <= 25) return "极度恐惧";
  if (numeric <= 45) return "恐惧";
  if (numeric <= 55) return "中性";
  if (numeric <= 75) return "贪婪";
  return "极度贪婪";
}

function getFngColor(value) {
  const numeric = toNumber(value);
  if (numeric == null) return C.labelQ;
  if (numeric <= 25) return "#FF3B30";
  if (numeric <= 45) return "#FF9500";
  if (numeric <= 55) return "#FFCC00";
  if (numeric <= 75) return "#34C759";
  return "#30D158";
}

function normalizeFngLabel(label, value) {
  const mapping = {
    "Extreme Fear": "极度恐惧",
    "Fear": "恐惧",
    "Neutral": "中性",
    "Greed": "贪婪",
    "Extreme Greed": "极度贪婪",
  };
  return mapping[label] || getFngLabel(value);
}

function buildTrendComment(current, previousWeek, previousMonth) {
  if (current == null) return "情绪数据暂缺，先等待今日指数更新。";
  if (current <= 25) {
    return previousWeek != null && current > previousWeek
      ? "恐惧仍在，但指数较上周回升，市场正在从极端悲观中缓慢修复。"
      : "近期持续偏恐惧，市场可能处于情绪压缩区，留意超卖后的修复机会。";
  }
  if (current <= 45) {
    return previousWeek != null && current < previousWeek
      ? "情绪比上周更谨慎，资金风险偏好正在收缩。"
      : "市场仍偏谨慎，情绪没有完全修复，适合继续观察确认。";
  }
  if (current <= 55) {
    return "情绪回到中性带，市场暂时缺乏单边共识。";
  }
  if (current <= 75) {
    return previousMonth != null && current > previousMonth
      ? "情绪明显回暖，风险偏好高于上月，市场正在偏向进攻。"
      : "市场处于贪婪区间，资金更愿意追逐弹性，但仍未到极端。";
  }
  return "情绪已进入极度贪婪区，短线过热风险正在累积，追高需要更谨慎。";
}

function timestampToMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1e12 ? numeric : numeric * 1000;
}

function findClosestEntry(entries, targetMs) {
  if (!Array.isArray(entries) || !entries.length) return null;
  let best = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const diff = Math.abs((entry.timeMs || 0) - targetMs);
    if (diff < bestDiff) {
      best = entry;
      bestDiff = diff;
    }
  }
  return best;
}

function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleRadians)),
    y: centerY + (radius * Math.sin(angleRadians)),
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
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

function Gauge({ value }) {
  const numeric = Math.max(0, Math.min(100, toNumber(value) ?? 0));
  const angle = -90 + (numeric / 100) * 180;
  const pointer = polarToCartesian(140, 140, 84, angle);
  const segments = [
    { start: -90, end: -45, color: "#FF3B30" },
    { start: -45, end: -9, color: "#FF9500" },
    { start: -9, end: 9, color: "#FFCC00" },
    { start: 9, end: 45, color: "#34C759" },
    { start: 45, end: 90, color: "#30D158" },
  ];

  return (
    <svg viewBox="0 0 280 170" style={{ width: "100%", maxWidth: 360, display: "block" }}>
      {segments.map((segment) => (
        <path
          key={`${segment.start}-${segment.end}`}
          d={describeArc(140, 140, 108, segment.start, segment.end)}
          fill="none"
          stroke={segment.color}
          strokeWidth="18"
          strokeLinecap="round"
        />
      ))}
      <line
        x1="140"
        y1="140"
        x2={pointer.x}
        y2={pointer.y}
        stroke="#111827"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="140" cy="140" r="11" fill="#111827" />
      <circle cx="140" cy="140" r="5" fill="#fff" />
    </svg>
  );
}

function DataStateCard({ title, subtitle, loading, error, onRetry, children }) {
  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: -0.2 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.55, marginTop: 4 }}>{subtitle}</div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          <SkeletonLine width="36%" height={14} />
          <SkeletonLine width="100%" height={180} radius={20} />
          <SkeletonLine width="54%" height={12} />
          <SkeletonLine width="68%" height={12} />
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

function UnavailableCard({ title, subtitle }) {
  return (
    <section style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.labelTer, lineHeight: 1.55, marginBottom: 14 }}>{subtitle}</div>
      <div style={{ fontSize: 13, color: C.labelTer }}>数据暂时不可用</div>
    </section>
  );
}

export default function FGDetailPage({ onBack }) {
  const [fngState, setFngState] = useState({ loading: true, error: "", entries: [] });
  const [fundingState, setFundingState] = useState({ loading: true, data: null });
  const [oiState, setOiState] = useState({ loading: true, data: null });

  const loadFng = useCallback(async () => {
    setFngState({ loading: true, error: "", entries: [] });
    try {
      const response = await fetch(FNG_ENDPOINT);
      if (!response.ok) throw new Error("F&G 数据请求失败");
      const payload = await response.json();
      const entries = (payload?.data || []).map((entry) => {
        const numericValue = toNumber(entry?.value);
        const timeMs = timestampToMs(entry?.timestamp);
        return {
          value: numericValue,
          label: normalizeFngLabel(entry?.value_classification, numericValue),
          timeMs,
        };
      }).filter((entry) => entry.value != null && entry.timeMs != null);
      if (!entries.length) throw new Error("F&G 数据为空");
      setFngState({ loading: false, error: "", entries });
    } catch {
      setFngState({ loading: false, error: "情绪数据加载失败，请稍后重试。", entries: [] });
    }
  }, []);

  const loadOkxFutures = useCallback(async () => {
    setFundingState({ loading: true, data: null });
    setOiState({ loading: true, data: null });

    const fundingResult = await fetch(FUNDING_ENDPOINT)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("funding"))))
      .then((payload) => toNumber(payload?.data?.[0]?.fundingRate))
      .catch(() => null);

    setFundingState({ loading: false, data: fundingResult != null ? { fundingRate: fundingResult } : null });

    const oiResult = await fetch(OPEN_INTEREST_ENDPOINT)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("oi"))))
      .then((payload) => {
        const currentOiUsd = toNumber(payload?.data?.[0]?.oiUsd);
        return currentOiUsd != null ? { openInterestUsd: currentOiUsd } : null;
      })
      .catch(() => null);

    setOiState({ loading: false, data: oiResult });
  }, []);

  useEffect(() => {
    loadFng();
    loadOkxFutures();
  }, [loadFng, loadOkxFutures]);

  const fngDerived = useMemo(() => {
    const [today, yesterday] = fngState.entries;
    const now = Date.now();
    const week = findClosestEntry(fngState.entries, now - (7 * 86400000));
    const month = findClosestEntry(fngState.entries, now - (30 * 86400000));
    const year = findClosestEntry(fngState.entries, now - (365 * 86400000));
    const currentValue = today?.value ?? null;
    return {
      today,
      currentValue,
      currentLabel: today?.label || getFngLabel(currentValue),
      trendComment: buildTrendComment(currentValue, week?.value ?? null, month?.value ?? null),
      comparisons: [
        { title: "今天", entry: today },
        { title: "昨天", entry: yesterday || null },
        { title: "上周", entry: week || null },
        { title: "上月", entry: month || null },
        { title: "去年", entry: year || null },
      ],
    };
  }, [fngState.entries]);

  const fundingInterpretation = useMemo(() => {
    const fundingRate = fundingState.data?.fundingRate;
    if (fundingRate == null) return "数据暂时不可用";
    const percent = fundingRate * 100;
    if (percent > 0.1) return "⚠️ 多头过热";
    if (percent >= 0.01) return "多头为主";
    if (percent <= -0.01) return "空头为主";
    return "情绪中性";
  }, [fundingState.data]);

  const oiInterpretation = useMemo(() => {
    const oiData = oiState.data;
    if (!oiData) return "数据暂时不可用";
    return "仅展示当前未平仓合约规模";
  }, [oiState.data]);

  return (
    <div className="lo-btc-detail-page" style={pageBodyStyle}>
      <header className="lo-btc-detail-topbar">
        <div className="lo-btc-detail-topbar-inner">
          <button type="button" className="lo-btc-detail-back" onClick={onBack}>
            ← 返回
          </button>
          <div className="lo-btc-detail-heading">
            <h1 className="lo-btc-detail-title">F&amp;G · 市场情绪</h1>
            <p className="lo-btc-detail-subtitle">恐惧贪婪指数 · 资金费率 · 多空结构</p>
          </div>
        </div>
      </header>

      <main style={contentWrapStyle}>
        <DataStateCard
          title="情绪仪表盘"
          subtitle="自动读取 Fear & Greed 历史，先看情绪位置，再看过去一年里相同位置曾出现在哪些时段。"
          loading={fngState.loading}
          error={fngState.error}
          onRetry={loadFng}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: 18, alignItems: "center" }}>
              <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
                <Gauge value={fngDerived.currentValue} />
                <div style={{ fontSize: 42, fontWeight: 760, letterSpacing: -1.5, color: "#111827" }}>
                  {fngDerived.currentValue ?? "—"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: getFngColor(fngDerived.currentValue) }}>
                  {fngDerived.currentLabel}
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(15,23,42,0.04)" }}>
                  <div style={labelStyle}>AI 趋势简评</div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: "#111827" }}>{fngDerived.trendComment}</div>
                </div>

                <div>
                  <div style={{ ...labelStyle, marginBottom: 10 }}>历史对比</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {fngDerived.comparisons.map((item) => (
                      <div
                        key={item.title}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "72px 10px 54px minmax(0, 1fr)",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "rgba(120,120,128,0.05)",
                        }}
                      >
                        <div style={{ fontSize: 12, color: C.labelTer }}>{item.title}</div>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: getFngColor(item.entry?.value) }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{item.entry?.value ?? "—"}</div>
                        <div style={{ fontSize: 12, color: C.labelTer }}>{item.entry?.label || "无数据"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DataStateCard>

        {fundingState.loading ? (
          <DataStateCard title="BTC 永续合约资金费率（全市场加权）" subtitle="读取 OKX 永续资金费率快照。" loading />
        ) : fundingState.data ? (
          <section style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>BTC 永续合约资金费率（全市场加权）</div>
            <div style={{ fontSize: 12, color: C.labelTer, marginTop: 4, marginBottom: 14 }}>数据来源：OKX Futures</div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 38, fontWeight: 760, letterSpacing: -1.2, color: fundingState.data.fundingRate > 0 ? C.green : fundingState.data.fundingRate < 0 ? C.red : C.labelTer }}>
                {fmtPct(fundingState.data.fundingRate * 100, 4)}
              </div>
              <div style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "7px 12px", background: "rgba(120,120,128,0.08)", fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {fundingInterpretation}
              </div>
            </div>
          </section>
        ) : (
          <UnavailableCard title="BTC 永续合约资金费率（全市场加权）" subtitle="数据来源：OKX Futures" />
        )}

        {oiState.loading ? (
          <DataStateCard title="BTC 未平仓合约（OI）" subtitle="观察杠杆是否在跟随价格方向扩张。" loading />
        ) : oiState.data ? (
          <section style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>BTC 未平仓合约（OI）</div>
            <div style={{ fontSize: 12, color: C.labelTer, marginTop: 4, marginBottom: 14 }}>数据来源：OKX Futures</div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 38, fontWeight: 760, letterSpacing: -1.2, color: "#111827" }}>{fmtNum(oiState.data.openInterestUsd)}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.labelTer }}>
                  OKX 返回的是 `oiUsd`，已为 USD 口径，不再做价格换算。
                </div>
              </div>
              <div style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "7px 12px", background: "rgba(120,120,128,0.08)", fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {oiInterpretation}
              </div>
            </div>
          </section>
        ) : (
          <UnavailableCard title="BTC 未平仓合约（OI）" subtitle="数据来源：OKX Futures" />
        )}

        <section style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>BTC 多空比</div>
          <div style={{ fontSize: 12, color: C.labelTer, marginTop: 4, marginBottom: 14 }}>数据来源：暂无可用数据源</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: C.labelTer }}>
              主流交易所多空比接口均限制浏览器直连，该指标暂时停用。
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: C.labelTer }}>
              可前往 CoinGlass 网站手动查询。
            </div>
            <a
              href="https://www.coinglass.com/LongShortRatio"
              target="_blank"
              rel="noreferrer"
              style={{
                width: "fit-content",
                borderRadius: 10,
                background: "rgba(15,23,42,0.05)",
                color: "#6B7280",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 12px",
                textDecoration: "none",
              }}
            >
              🔗 CoinGlass
            </a>
          </div>
        </section>

        <div style={{ fontSize: 11, color: C.labelTer, padding: "6px 20px 0" }}>
          数据来源：Alternative.me · OKX Futures · 每日自动更新
        </div>
      </main>
    </div>
  );
}

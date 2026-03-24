import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WORKER } from "./config.js";
import { NewsStrip } from "./components/NewsStrip.jsx";
import SkeletonLine from "./components/shared/SkeletonLine";
import DataStateCard from "./components/shared/DataStateCard";
import { fmtNum, fmtPct, toNum } from "./lib/utils";

const FNG_ENDPOINT = `${WORKER}/api/fg?limit=365`;
const FUNDING_ENDPOINT = `${WORKER}/api/funding`;
const OPEN_INTEREST_ENDPOINT = `${WORKER}/api/oi`;

const gaugePointerAnimation = `
  @keyframes loFgPointerSwingIn {
    0% { transform: rotate(-90deg); }
    78% { transform: rotate(calc(var(--fg-pointer-rotation) + 6deg)); }
    100% { transform: rotate(var(--fg-pointer-rotation)); }
  }
`;

function getFngLabel(value) {
  const numeric = toNum(value);
  if (numeric == null) return "未知";
  if (numeric <= 25) return "极度恐惧";
  if (numeric <= 45) return "恐惧";
  if (numeric <= 55) return "中性";
  if (numeric <= 75) return "贪婪";
  return "极度贪婪";
}

function getFngColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-muted)";
  if (numeric <= 25) return "var(--lo-signal-bear)";
  if (numeric <= 45) return "var(--lo-signal-neutral)";
  if (numeric <= 55) return "var(--lo-signal-neutral)";
  if (numeric <= 75) return "var(--lo-signal-bull)";
  return "var(--lo-signal-bull)";
}

function getFngSignalColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "none";
  if (numeric >= 55) return "green";
  if (numeric >= 30) return "yellow";
  return "red";
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

function SignalDot({ color = "none", size = 10, glow = false }) {
  const colorMap = {
    green: "var(--lo-signal-bull)",
    red: "var(--lo-signal-bear)",
    yellow: "var(--lo-signal-neutral)",
    blue: "var(--lo-brand)",
    none: "var(--lo-text-muted)",
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

function getFngBorderColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-border)";
  if (numeric < 30) return "color-mix(in srgb, var(--lo-signal-bear) 40%, transparent)";
  if (numeric < 55) return "color-mix(in srgb, var(--lo-yellow) 35%, transparent)";
  return "color-mix(in srgb, var(--lo-signal-bull) 35%, transparent)";
}

function getComparisonDirection(entryValue, todayValue) {
  const entry = toNum(entryValue);
  const today = toNum(todayValue);
  if (entry == null || today == null) return { symbol: "=", color: "var(--lo-text-muted)" };
  if (entry > today) return { symbol: "↑", color: "var(--lo-signal-bull)" };
  if (entry < today) return { symbol: "↓", color: "var(--lo-signal-bear)" };
  return { symbol: "=", color: "var(--lo-signal-neutral)" };
}

function Gauge({ value }) {
  const numeric = Math.max(0, Math.min(100, toNum(value) ?? 0));
  const angle = -90 + (numeric / 100) * 180;
  const segments = [
    { start: -90, end: -45, color: "var(--lo-signal-bear)" },
    { start: -45, end: -9, color: "var(--lo-signal-neutral)" },
    { start: -9, end: 9, color: "var(--lo-signal-neutral)" },
    { start: 9, end: 45, color: "var(--lo-signal-bull)" },
    { start: 45, end: 90, color: "var(--lo-signal-bull)" },
  ];

  return (
    <svg
      viewBox="0 0 280 170"
      style={{
        width: "100%",
        maxWidth: 360,
        display: "block",
        "--fg-pointer-rotation": `${angle}deg`,
      }}
    >
      <style>{gaugePointerAnimation}</style>
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
      <g
        style={{
          transformOrigin: "140px 140px",
          transform: `rotate(${angle}deg)`,
          animation: "loFgPointerSwingIn 1200ms cubic-bezier(0.34, 1.56, 0.64, 1) 1 both",
        }}
      >
        <line
          x1="140"
          y1="140"
          x2="140"
          y2="56"
          stroke="var(--lo-text-primary)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="140" cy="140" r="11" fill="var(--lo-text-primary)" />
        <circle cx="140" cy="140" r="5" fill="var(--lo-bg-card)" />
      </g>
    </svg>
  );
}

function UnavailableCard({ title, subtitle }) {
  return (
    <section className="lo-detail-card">
      <div className="lo-dsc__title" style={{ marginBottom: 4 }}>{title}</div>
      <div className="lo-text-footnote" style={{ marginBottom: 14 }}>{subtitle}</div>
      <div className="lo-dsc__error-text" style={{ color: "var(--lo-text-muted)" }}>数据暂时不可用</div>
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
        const numericValue = toNum(entry?.value);
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
      .then((payload) => toNum(payload?.data?.[0]?.fundingRate))
      .catch(() => null);

    setFundingState({ loading: false, data: fundingResult != null ? { fundingRate: fundingResult } : null });

    const oiResult = await fetch(OPEN_INTEREST_ENDPOINT)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("oi"))))
      .then((payload) => {
        const currentOiUsd = toNum(payload?.data?.[0]?.oiUsd);
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
    if (percent > 0.001) return "多头付息，多头情绪偏强";
    if (percent < -0.001) return "空头付息，空头情绪偏强";
    return "多空均衡";
  }, [fundingState.data]);

  const oiInterpretation = useMemo(() => {
    const oiData = oiState.data;
    if (!oiData) return "数据暂时不可用";
    return "仅展示当前未平仓合约规模";
  }, [oiState.data]);

  return (
    <div className="lo-btc-detail-page lo-detail-page" style={{ borderTop: `2px solid ${getFngBorderColor(fngDerived.currentValue)}` }}>
      <main className="lo-detail-content">
        <NewsStrip panel="fg" />
        <DataStateCard
          title="情绪仪表盘"
          subtitle="自动读取 Fear & Greed 历史，先看情绪位置，再看过去一年里相同位置曾出现在哪些时段。"
          loading={fngState.loading}
          error={fngState.error}
          onRetry={loadFng}
        >
          <div className="lo-d-grid" style={{ gap: 18 }}>
            <div className="lo-fg-gauge-layout">
              <div className="lo-fg-gauge-center">
                <Gauge value={fngDerived.currentValue} />
                <div className="lo-metric lo-metric--xl" style={{ letterSpacing: -1.5, color: "var(--lo-text-primary)" }}>
                  {fngDerived.currentValue ?? "—"}
                </div>
                <div className="lo-text-label-primary" style={{ color: getFngColor(fngDerived.currentValue) }}>
                  {fngDerived.currentLabel}
                </div>
              </div>

              <div className="lo-d-grid" style={{ gap: 14 }}>
                <div className="lo-inset-panel">
                  <div className="lo-fg-label">AI 趋势简评</div>
                  <div className="lo-text-label-primary" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--lo-text-primary)" }}>{fngDerived.trendComment}</div>
                </div>

                <div>
                  <div className="lo-fg-label" style={{ marginBottom: 10 }}>历史对比</div>
                  <div className="lo-d-grid" style={{ gap: 8 }}>
                    {fngDerived.comparisons.map((item) => (
                      (() => {
                        const direction = getComparisonDirection(item.entry?.value, fngDerived.currentValue);
                        return (
                      <div key={item.title} className="lo-fg-compare">
                        <div className="lo-text-footnote" style={{ lineHeight: 1 }}>{item.title}</div>
                        <SignalDot color={getFngSignalColor(item.entry?.value)} size={10} />
                        <div className="lo-d-flex-wrap" style={{ alignItems: "center", gap: 6 }}>
                          <div className="lo-metric lo-metric--xs" style={{ color: "var(--lo-text-primary)" }}>{item.entry?.value ?? "—"}</div>
                          <div className="lo-metric lo-metric--secondary" style={{ color: direction.color }}>{direction.symbol}</div>
                        </div>
                        <div className="lo-text-footnote" style={{ lineHeight: 1 }}>{item.entry?.label || "无数据"}</div>
                      </div>
                        );
                      })()
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
          <section className="lo-detail-card">
            <div className="lo-dsc__title">BTC 永续合约资金费率（全市场加权）</div>
            <div className="lo-dsc__subtitle" style={{ marginBottom: 14 }}>数据来源：OKX Futures</div>
            <div className="lo-dsc__grid">
              <div className="lo-metric" style={{
                fontSize: 38,
                fontWeight: 760,
                letterSpacing: -1.2,
                color: fundingState.data.fundingRate > 0 ? "var(--lo-signal-bull)" : fundingState.data.fundingRate < 0 ? "var(--lo-signal-bear)" : "var(--lo-text-muted)",
              }}>
                {fmtPct(fundingState.data.fundingRate * 100, 4)}
              </div>
              <div className="lo-text-meta-muted" style={{ lineHeight: 1.6 }}>
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
          <section className="lo-detail-card">
            <div className="lo-dsc__title">BTC 未平仓合约（OI）</div>
            <div className="lo-dsc__subtitle" style={{ marginBottom: 14 }}>数据来源：OKX Futures</div>
            <div className="lo-dsc__grid">
              <div className="lo-metric" style={{ fontSize: 38, fontWeight: 760, letterSpacing: -1.2, color: "var(--lo-text-primary)" }}>{fmtNum(oiState.data.openInterestUsd)}</div>
              <div className="lo-d-flex-wrap" style={{ gap: 10, alignItems: "center" }}>
                <div className="lo-text-footnote" style={{ fontSize: 13 }}>
                  OKX 返回的是 `oiUsd`，已为 USD 口径，不再做价格换算。
                </div>
              </div>
              <div className="lo-stat-pill" style={{ color: "var(--lo-text-primary)" }}>
                {oiInterpretation}
              </div>
            </div>
          </section>
        ) : (
          <UnavailableCard title="BTC 未平仓合约（OI）" subtitle="数据来源：OKX Futures" />
        )}

        <section className="lo-detail-card">
          <div className="lo-dsc__title">BTC 多空比</div>
          <div className="lo-dsc__subtitle" style={{ marginBottom: 14 }}>数据来源：暂无可用数据源</div>
          <div className="lo-dsc__grid">
            <div className="lo-text-footnote" style={{ fontSize: 14, lineHeight: 1.7 }}>
              主流交易所多空比接口均限制浏览器直连，该指标暂时停用。
            </div>
            <div className="lo-text-footnote" style={{ fontSize: 14, lineHeight: 1.7 }}>
              可前往 CoinGlass 网站手动查询。
            </div>
            <a
              href="https://www.coinglass.com/LongShortRatio"
              target="_blank"
              rel="noreferrer"
              className="lo-link-btn"
            >
              🔗 CoinGlass
            </a>
          </div>
        </section>

        <div className="lo-text-footnote" style={{ fontSize: 11, padding: "6px 20px 0" }}>
          数据来源：Alternative.me · OKX Futures · 每日自动更新
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TabBar } from "../components/TabBar";
import { SignalBadge } from "../components/shared/SignalBadge";
import { listDailySnapshotSummaries } from "../lib/storage";
import { fmtB, fmtPct, formatDateLabel, formatTimeLabel, getDateValue, notePreview } from "../lib/utils";
import { useWorkerData } from "../lib/useWorkerData";

function labelFromHero(score) {
  if (score == null || score === "") return "观望";
  if (typeof score === "number") {
    if (score >= 0.7) return "进攻";
    if (score >= 0.5) return "积极";
    if (score >= 0.35) return "观望";
    return "防御";
  }
  return String(score);
}

function signalFromHero(score) {
  const label = labelFromHero(score);
  if (label.includes("进攻") || label.includes("积极")) return "bull";
  if (label.includes("防御")) return "bear";
  return "neutral";
}

function calcAlignment(data) {
  const signals = [
    { label: "L0", bull: (data?.btc?.vs_ma_200_pct ?? 0) >= 0 },
    { label: "L1", bull: (data?.fred?.gnl?.change_7d ?? 0) >= 0 },
    { label: "L2", bull: (data?.stablecoins?.change_7d ?? 0) >= 0 },
    { label: "L3", bull: (data?.meme?.mcap_change_24h ?? 0) >= 0 },
    { label: "FG", bull: (data?.fear_greed?.value ?? 0) >= 50 },
  ];
  const bullCount = signals.filter((signal) => signal.bull).length;
  return { bullCount, total: signals.length, signals };
}

function buildDashboardVerdict(bullCount, total, data) {
  const bearParts = [];
  const bullParts = [];

  if ((data?.btc?.vs_ma_200_pct ?? 0) < 0) bearParts.push("L0 周期收缩");
  else bullParts.push("L0 周期扩张");

  if ((data?.stablecoins?.change_7d ?? 0) < 0) bearParts.push("L2 弹药流出");
  else bullParts.push("L2 弹药流入");

  if ((data?.meme?.mcap_change_24h ?? 0) < 0) bearParts.push("L3 热度偏弱");
  else bullParts.push("L3 热度偏强");

  const fg = data?.fear_greed?.value;
  if (fg != null && fg < 30) bearParts.push("F&G 恐惧");
  else if (fg != null && fg >= 55) bullParts.push("F&G 贪婪");

  if (bullCount >= 4) {
    return {
      verdict: `${bullCount}/${total} 信号对齐，${bullParts.join(" + ") || "多层共振"}，具备进攻条件`,
      action: "可积极筛选新标的 · 提高候选转化率 · 适当放大仓位",
    };
  }
  if (bullCount >= 3) {
    return {
      verdict: `${bullCount}/${total} 信号对齐，${bullParts.join(" + ") || "整体偏多"}，可选择性参与`,
      action: "选择性参与优质标的 · 不追高 · 控制单笔仓位",
    };
  }
  if (bullCount >= 2) {
    return {
      verdict: `${bullCount}/${total} 信号对齐，${[...bearParts, ...bullParts].join("，") || "信号分歧"}，等待确认`,
      action: "不开新仓 · 观察已有持仓变化 · 等待信号进一步明确",
    };
  }
  return {
    verdict: `${bullCount}/${total} 信号对齐，${bearParts.join(" + ") || "多层偏空"}，不具备进攻条件`,
    action: "不开新仓 · 缩减观察列表 · 等待环境改善",
  };
}

function elapsedMinutes(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

function statusTone(tone) {
  if (tone === "ok") return { color: "var(--lo-signal-bull)", bg: "rgba(16,185,129,0.08)" };
  if (tone === "warn") return { color: "var(--lo-signal-neutral)", bg: "rgba(245,158,11,0.10)" };
  return { color: "var(--lo-text-secondary)", bg: "rgba(120,120,128,0.08)" };
}

function SignalRow({ layer, label, signal, signalLabel, metric, reason, route }) {
  const navigate = useNavigate();
  return (
    <div
      className="lo-signal-row"
      onClick={route ? () => navigate(route) : undefined}
      style={{ cursor: route ? "pointer" : "default" }}
    >
      <span className="lo-signal-row__layer">{layer}</span>
      <span className="lo-signal-row__label">{label}</span>
      <SignalBadge signal={signal} label={signalLabel} />
      <span className="lo-signal-row__metric">{metric}</span>
      <span className="lo-signal-row__reason">{reason}</span>
      {route && <span className="lo-signal-row__arrow">›</span>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, lastUpdated } = useWorkerData();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySummaries, setHistorySummaries] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(getDateValue());
  const [historyFilter, setHistoryFilter] = useState("all");
  const retryCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoading(true);
      const items = await listDailySnapshotSummaries(30);
      if (cancelled) return;
      setHistorySummaries(items);
      setSelectedHistoryDate((prev) => {
        if (prev && items.some((item) => item.dateValue === prev)) return prev;
        return items[0]?.dateValue || getDateValue();
      });
      setHistoryLoading(false);
    };

    const handleFocus = () => {
      loadHistory();
    };

    loadHistory();
    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const btc = data?.btc;
  const fg = data?.fear_greed;
  const fred = data?.fred;
  const stable = data?.stablecoins;
  const chainStable = data?.chain_stablecoins;
  const meme = data?.meme;
  const dex = data?.dex_volume;
  const heroScore = data?.hero_score || data?.heroScore || null;

  const heroLabel = labelFromHero(heroScore);
  const heroSignal = signalFromHero(heroScore);
  const { bullCount, total } = calcAlignment(data);
  const verdict = useMemo(() => buildDashboardVerdict(bullCount, total, data), [bullCount, data, total]);
  const elapsed = elapsedMinutes(lastUpdated);
  const filteredHistory = useMemo(() => historySummaries.filter((item) => {
    if (historyFilter === "macro") return item.hasMacro;
    if (historyFilter === "notes") return !!item.note;
    if (historyFilter === "attack") return item.hero?.label === "进　攻";
    return true;
  }), [historyFilter, historySummaries]);
  const selectedHistory = useMemo(
    () => historySummaries.find((item) => item.dateValue === selectedHistoryDate) || null,
    [historySummaries, selectedHistoryDate]
  );
  const historyWithHero = filteredHistory.filter((item) => item.hero?.score != null);
  const avgHeroScore = historyWithHero.length > 0
    ? historyWithHero.reduce((sum, item) => sum + item.hero.score, 0) / historyWithHero.length
    : null;
  const fgHistoryItems = filteredHistory.filter((item) => item.fgVal !== "" && !Number.isNaN(Number(item.fgVal)));
  const avgFg = fgHistoryItems.length > 0
    ? fgHistoryItems.reduce((sum, item) => sum + Number(item.fgVal), 0) / fgHistoryItems.length
    : null;
  const macroDays = filteredHistory.filter((item) => item.hasMacro).length;
  const attackDays = filteredHistory.filter((item) => item.hero?.label === "进　攻").length;
  const latestSavedAt = historySummaries.find((item) => item.savedAt)?.savedAt || null;
  const diagnostics = [
    {
      title: "日期",
      label: selectedHistory ? formatDateLabel(selectedHistory.dateValue) : "今日空白",
      tone: selectedHistory ? "ok" : "warn",
      detail: selectedHistory ? `已定位到 ${selectedHistory.dateValue}` : "当前日期还没有本地快照",
    },
    {
      title: "保存",
      label: latestSavedAt ? formatTimeLabel(latestSavedAt) : "未保存",
      tone: latestSavedAt ? "ok" : "warn",
      detail: latestSavedAt ? `最近写入 ${latestSavedAt}` : "L4 工作台尚未写入任何日快照",
    },
    {
      title: "缓存",
      label: historySummaries.length > 0 ? "localStorage" : "空",
      tone: historySummaries.length > 0 ? "ok" : "warn",
      detail: historySummaries.length > 0 ? "Dashboard 直接从本地快照只读加载" : "还没有可读取的本地记录",
    },
    {
      title: "历史",
      label: `${historySummaries.length} 条`,
      tone: historySummaries.length > 0 ? "ok" : "warn",
      detail: `近 30 天宏观快照 ${macroDays} 天`,
    },
  ];

  return (
    <div className="lo-page">
      <TabBar />

      {error ? (
        <div className="lo-hero">
          <div className="lo-hero__error">
            <span className="lo-hero__error-text">⚠ 数据获取失败</span>
            <button
              type="button"
              onClick={() => {
                retryCount.current += 1;
                window.location.reload();
              }}
              className="lo-hero__retry"
            >
              重试
            </button>
            {elapsed != null && (
              <span className="lo-hero__elapsed">上次成功：{elapsed} 分钟前</span>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="lo-verdict-hero">
            <div className="lo-verdict-hero__label">{loading ? "加载中" : heroLabel}</div>
            <div className="lo-verdict-hero__verdict">
              {loading ? "正在读取最新信号…" : verdict.verdict}
            </div>
            <div className="lo-verdict-hero__action">
              {loading ? "稍后将给出建议动作" : verdict.action}
            </div>
          </div>

          <div className="lo-signal-panel">
            <SignalRow
              layer="L0"
              label="市场周期"
              signal={btc?.vs_ma_200_pct >= 0 ? "bull" : "bear"}
              signalLabel={btc?.vs_ma_200_pct >= 0 ? "扩张" : "收缩"}
              metric={btc?.price ? `$${Number(btc.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              reason={`vs 200MA ${btc?.vs_ma_200_pct != null ? fmtPct(btc.vs_ma_200_pct, 1) : "—"}`}
              route="/macro"
            />
            <SignalRow
              layer="L1"
              label="净流动性"
              signal={fred?.gnl?.change_7d >= 0 ? "bull" : "bear"}
              signalLabel={fred?.gnl?.change_7d >= 0 ? "流入" : "流出"}
              metric={fred?.gnl?.value_t != null ? `${Number(fred.gnl.value_t).toFixed(2)}T` : "—"}
              reason={`7日 ${fred?.gnl?.change_7d != null ? `${Number(fred.gnl.change_7d) >= 0 ? "+" : ""}${Number(fred.gnl.change_7d).toFixed(3)}T` : "—"}`}
              route="/liquidity"
            />
            <SignalRow
              layer="L2"
              label="稳定币弹药"
              signal={stable?.change_7d >= 0 ? "bull" : "bear"}
              signalLabel={stable?.change_7d >= 0 ? "扩张" : "收缩"}
              metric={fmtB(stable?.total)}
              reason={`7日 ${stable?.change_7d != null ? fmtB(stable.change_7d) : "—"} · SOL ${chainStable?.solana?.net_inflow_7d != null ? fmtB(chainStable.solana.net_inflow_7d) : "—"}`}
              route="/stablecoins"
            />
            <SignalRow
              layer="L3"
              label="Meme 板块"
              signal={meme?.mcap_change_24h >= 0 ? "bull" : "bear"}
              signalLabel={meme?.mcap_change_24h >= 0 ? "热" : "冷"}
              metric={dex?.solana?.total_24h != null || dex?.base?.total_24h != null || dex?.bsc?.total_24h != null
                ? fmtB((Number(dex?.solana?.total_24h) || 0) + (Number(dex?.base?.total_24h) || 0) + (Number(dex?.bsc?.total_24h) || 0))
                : "—"}
              reason={`SOL ${dex?.solana?.total_24h != null ? fmtB(dex.solana.total_24h) : "—"}`}
              route="/meme"
            />
            <SignalRow
              layer="FG"
              label="市场情绪"
              signal={(fg?.value ?? 0) >= 55 ? "bull" : (fg?.value ?? 0) < 30 ? "bear" : "neutral"}
              signalLabel={fg?.value == null ? "—" : `${fg.value}`}
              metric={fg?.value == null ? "—" : `F&G ${fg.value}`}
              reason={fg?.value == null ? "等待数据" : fg.value < 30 ? "恐惧" : fg.value >= 55 ? "贪婪" : "中性"}
              route={null}
            />
          </div>

          <div className="lo-l4-cta" onClick={() => navigate("/workbench")}>
            <span className="lo-l4-cta__title">进入 L4 工作台</span>
            <span className="lo-l4-cta__arrow">→</span>
          </div>
        </>
      )}

      <div style={{ padding: "0 48px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <button type="button" className="lo-collapse-trigger" onClick={() => setHistoryOpen((prev) => !prev)}>
          <span className="lo-collapse-trigger__title">历史回看 & 系统状态</span>
          <span className="lo-collapse-trigger__hint">{historySummaries.length} 条记录 · {historyOpen ? "收起" : "展开"}</span>
        </button>
        {historyOpen && (
          <div className="lo-collapse-body lo-collapse-body--open" style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 16 }}>
              <div className="lo-panel" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <div className="lo-section-kicker">Archive</div>
                    <div className="lo-section-title">历史回看</div>
                    <div className="lo-section-note">只读展示 L4 写入的本地日快照。切日期和筛选不会触发网络请求。</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" onClick={() => setSelectedHistoryDate(getDateValue())} className={`lo-record-switch-btn${selectedHistoryDate === getDateValue() ? " active" : ""}`}>今天</button>
                    <input
                      type="date"
                      value={selectedHistoryDate}
                      onChange={(e) => setSelectedHistoryDate(e.target.value)}
                      className="lo-record-date-input"
                      style={{ padding: "8px 10px", textAlign: "left" }}
                    />
                  </div>
                </div>

                <div className="lo-record-history-banner">
                  <div className="lo-record-history-banner-title">
                    {selectedHistory ? "当前在本地快照视图" : "当前日期没有本地快照"}
                  </div>
                  <div className="lo-record-history-banner-copy">
                    {selectedHistory ? "这里读取的是 L4 工作台已保存的数据，用于复盘，不会覆盖当前工作区。" : "先去 L4 工作台保存日快照，再回这里查看。"}
                  </div>
                </div>

                <div className="lo-record-summary-grid">
                  {[["记录", filteredHistory.length], ["宏观", macroDays], ["进攻日", attackDays], ["Hero 均值", avgHeroScore == null ? "—" : avgHeroScore.toFixed(2)], ["F&G 均值", avgFg == null ? "—" : avgFg.toFixed(0)], ["当前笔记", selectedHistory?.note ? "已记录" : "未留痕"]].map(([label, value]) => (
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
                      type="button"
                      onClick={() => setHistoryFilter(opt.key)}
                      className={`lo-record-filter-btn${historyFilter === opt.key ? " active" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {historyLoading ? (
                  <div className="lo-record-empty">正在读取本地快照…</div>
                ) : historySummaries.length === 0 ? (
                  <div className="lo-record-empty">还没有任何可回看的历史记录。等你在 L4 保存日快照后，这里会逐步形成复盘档案。</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="lo-record-empty">当前筛选下没有匹配记录，可以切回全部记录继续回看。</div>
                ) : (
                  <div className="lo-record-timeline">
                    {filteredHistory.map((item) => {
                      const active = item.dateValue === selectedHistoryDate;
                      return (
                        <button
                          key={item.dateValue}
                          type="button"
                          onClick={() => setSelectedHistoryDate(item.dateValue)}
                          className={`lo-record-timeline-item${active ? " active" : ""}`}
                        >
                          <div className="lo-record-timeline-dot" />
                          <div className="lo-record-timeline-body">
                            <div className="lo-record-timeline-head">
                              <div className="lo-record-timeline-date">{formatDateLabel(item.dateValue)}</div>
                              <div className="lo-record-timeline-time">{item.savedAt ? formatTimeLabel(item.savedAt) : "—"}</div>
                            </div>
                            <div className="lo-record-timeline-meta">
                              Hero：{item.hero?.label || "—"} · F&G：{item.fgVal === "" ? "—" : item.fgVal} · L4：
                              {item.l4?.color ? (
                                <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      display: "inline-block",
                                      background: item.l4.color === "green" ? "var(--lo-signal-bull)" : item.l4.color === "red" ? "var(--lo-signal-bear)" : "var(--lo-signal-neutral)",
                                    }}
                                  />
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

              <div className="lo-panel" style={{ padding: 20 }}>
                <div className="lo-section-kicker">Diagnostics</div>
                <div className="lo-section-title">系统状态</div>
                <div className="lo-section-note">只用于确认 Dashboard 读到的本地快照是否正常。</div>

                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {diagnostics.map((item) => {
                    const tone = statusTone(item.tone);
                    return (
                      <div key={item.title} style={{ padding: 12, borderRadius: 12, background: tone.bg, border: "1px solid var(--lo-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 12, color: "var(--lo-text-muted)", fontWeight: 600 }}>{item.title}</div>
                          <div style={{ fontSize: 13, color: tone.color, fontWeight: 700 }}>{item.label}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--lo-text-secondary)", lineHeight: 1.55, marginTop: 6 }}>{item.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

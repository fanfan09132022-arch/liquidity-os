import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BTCDetailPage from "../BTCDetailPage";
import { TabBar } from "../components/TabBar";
import { MetricBlock } from "../components/shared/MetricBlock";
import { SignalBadge } from "../components/shared/SignalBadge";
import { SparkLine } from "../components/shared/SparkLine";
import { fmtPct } from "../lib/utils";
import { useWorkerData } from "../lib/useWorkerData";

function mvrvZone(z) {
  if (z == null) return { label: "—", color: "var(--lo-text-muted)" };
  const n = Number(z);
  if (n > 7) return { label: "高估区（顶部风险）", color: "var(--lo-signal-bear)" };
  if (n > 3) return { label: "中性偏高", color: "var(--lo-signal-neutral)" };
  if (n > 0) return { label: "健康区间", color: "var(--lo-signal-bull)" };
  return { label: "低估区（底部机会）", color: "var(--lo-brand)" };
}

export default function L0MacroPage() {
  const navigate = useNavigate();
  const { data } = useWorkerData();
  const [sparkData, setSparkData] = useState([]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("lo-btc-spark-v1");
      if (cached) {
        const { prices } = JSON.parse(cached);
        if (prices?.length) setSparkData(prices);
      }
    } catch {
      // ignore invalid spark cache
    }
  }, []);

  const btc = data?.btc;
  const mvrv = data?.mvrv_z_score;
  const signal = btc?.vs_ma_200_pct >= 0 ? "bull" : "bear";
  const signalLabel = btc?.vs_ma_200_pct >= 0 ? "扩张" : "收缩";
  const mvrvInfo = mvrvZone(mvrv);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--lo-bg-deep)",
      color: "var(--lo-text-primary)",
      fontFamily: "var(--lo-font-ui)",
      minWidth: 1024,
    }}>
      <TabBar />

      <div style={{
        borderTop: `4px solid var(--lo-${signal === "bull" ? "signal-bull" : "signal-bear"})`,
        padding: "32px 48px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ fontSize: "var(--lo-text-label)", color: "var(--lo-text-secondary)", marginBottom: 8 }}>L0 · 市场周期</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <MetricBlock
                value={btc?.price ? `$${Number(btc.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                label="BTC 当前价"
                size="hero"
              />
              <SignalBadge signal={signal} label={signalLabel} />
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <MetricBlock value={fmtPct(btc?.vs_ma_200_pct, 1)} label="vs 200MA" size="primary" />
              <div>
                <MetricBlock value={mvrv ?? "—"} label="MVRV Z-Score" size="primary" />
                <div style={{ fontSize: "var(--lo-text-meta)", color: mvrvInfo.color, marginTop: 2 }}>{mvrvInfo.label}</div>
              </div>
            </div>
          </div>
          <div style={{ flex: "0 0 280px" }}>
            <SparkLine data={sparkData} color="var(--lo-brand)" height={80} loading={!sparkData.length} />
            <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-muted)", textAlign: "center", marginTop: 4 }}>BTC 7 日走势</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 48px 48px" }}>
        <BTCDetailPage onBack={() => navigate(-1)} embedded={true} />
      </div>
    </div>
  );
}

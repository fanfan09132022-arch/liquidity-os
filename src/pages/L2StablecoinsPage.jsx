import React from "react";
import { useNavigate } from "react-router-dom";
import { TabBar } from "../components/TabBar";
import { SignalBadge } from "../components/shared/SignalBadge";
import { MetricBlock } from "../components/shared/MetricBlock";
import { fmtB, fmtPct } from "../lib/utils";
import { useWorkerData } from "../lib/useWorkerData";
import L2DetailPage from "../L2DetailPage";

export default function L2StablecoinsPage() {
  const navigate = useNavigate();
  const { data } = useWorkerData();
  const stable = data?.stablecoins;
  const chainStable = data?.chain_stablecoins;

  const change7d = stable?.change_7d;
  const signal = change7d >= 0 ? "bull" : "bear";
  const signalLabel = change7d >= 0 ? "扩张" : "收缩";
  const arrow = change7d == null ? "—" : change7d >= 0 ? "↑" : "↓";
  const arrowColor = change7d == null
    ? "var(--lo-text-muted)"
    : change7d >= 0 ? "var(--lo-signal-bull)" : "var(--lo-signal-bear)";

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
        <div style={{ fontSize: "var(--lo-text-label)", color: "var(--lo-text-secondary)", marginBottom: 8 }}>L2 · 稳定币弹药</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{
              fontSize: "var(--lo-metric-hero)",
              fontWeight: "var(--lo-weight-bold)",
              fontFamily: "var(--lo-num-font)",
              color: "var(--lo-text-primary)",
              lineHeight: 1.1,
            }}>
              {fmtB(stable?.total)}
            </span>
            <span style={{
              fontSize: "var(--lo-text-value)",
              fontWeight: "var(--lo-weight-bold)",
              color: arrowColor,
            }}>
              {arrow}
            </span>
          </div>
          <SignalBadge signal={signal} label={signalLabel} />
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <MetricBlock value={fmtB(change7d)} label="7日净变化" size="primary" />
          <MetricBlock value={fmtPct(stable?.change_7d_pct, 2)} label="7日变化%" size="primary" />
          <MetricBlock
            value={chainStable?.solana?.net_inflow_7d != null ? fmtB(chainStable.solana.net_inflow_7d) : "—"}
            label="SOL 链净流入"
            size="primary"
          />
        </div>
      </div>

      <div style={{ padding: "0 48px 48px" }}>
        <L2DetailPage onBack={() => navigate(-1)} embedded={true} />
      </div>
    </div>
  );
}

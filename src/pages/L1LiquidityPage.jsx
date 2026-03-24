import React from "react";
import { useNavigate } from "react-router-dom";
import L1DetailPage from "../L1DetailPage";
import { TabBar } from "../components/TabBar";
import { MetricBlock } from "../components/shared/MetricBlock";
import { SignalBadge } from "../components/shared/SignalBadge";
import { useWorkerData } from "../lib/useWorkerData";

export default function L1LiquidityPage() {
  const navigate = useNavigate();
  const { data } = useWorkerData();
  const fred = data?.fred;

  const gnlChange = fred?.gnl?.change_7d;
  const signal = gnlChange >= 0 ? "bull" : "bear";
  const signalLabel = gnlChange >= 0 ? "流入" : "流出";

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
        <div style={{ fontSize: "var(--lo-text-label)", color: "var(--lo-text-secondary)", marginBottom: 8 }}>L1 · 净流动性</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <MetricBlock
            value={fred?.gnl?.value_t != null ? `${Number(fred.gnl.value_t).toFixed(2)}T` : "—"}
            label="GNL 当前值"
            size="hero"
          />
          <SignalBadge signal={signal} label={signalLabel} />
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {["fed", "tga", "rrp"].map((key) => (
            <MetricBlock
              key={key}
              value={fred?.[key]?.value_t != null ? `${Number(fred[key].value_t).toFixed(1)}T` : "—"}
              label={key.toUpperCase()}
              size="primary"
            />
          ))}
        </div>
      </div>

      <div style={{ padding: "0 48px 48px" }}>
        <L1DetailPage onBack={() => navigate(-1)} embedded={true} />
      </div>
    </div>
  );
}

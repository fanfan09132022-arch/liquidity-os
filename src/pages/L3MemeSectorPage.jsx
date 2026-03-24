import React from "react";
import { useNavigate } from "react-router-dom";
import { TabBar } from "../components/TabBar";
import { SignalBadge } from "../components/shared/SignalBadge";
import { MetricBlock } from "../components/shared/MetricBlock";
import { fmtB, fmtPct } from "../lib/utils";
import { useWorkerData } from "../lib/useWorkerData";
import L3DetailPage from "../L3DetailPage";

export default function L3MemeSectorPage() {
  const navigate = useNavigate();
  const { data } = useWorkerData();
  const meme = data?.meme;
  const dex = data?.dex_volume;
  const memeTop = data?.meme_top ?? null;

  const signal = meme?.mcap_change_24h >= 0 ? "bull" : "bear";
  const signalLabel = meme?.mcap_change_24h >= 0 ? "热" : "冷";
  const dexChains = [
    { label: "SOL", value: dex?.solana?.total_24h },
    { label: "Base", value: dex?.base?.total_24h },
    { label: "BSC", value: dex?.bsc?.total_24h },
  ];
  const maxDex = Math.max(...dexChains.map((c) => Number(c.value) || 0), 1);

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
        <div style={{ fontSize: "var(--lo-text-label)", color: "var(--lo-text-secondary)", marginBottom: 8 }}>L3 · Meme 板块</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <MetricBlock value={fmtB(meme?.mcap)} label="Meme 总市值" size="hero" />
          <SignalBadge signal={signal} label={signalLabel} />
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
          <MetricBlock value={fmtPct(meme?.mcap_change_24h, 1)} label="24h 变化" size="primary" />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)", marginBottom: 4 }}>DEX 成交量分布</div>
            {dexChains.map((c) => {
              const pct = ((Number(c.value) || 0) / maxDex) * 100;
              return (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--lo-text-meta)", color: "var(--lo-text-secondary)", width: 32 }}>{c.label}</span>
                  <div style={{ width: 120, height: 4, background: "var(--lo-border)", borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--lo-signal-bull)", borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: "var(--lo-text-meta)", fontFamily: "var(--lo-num-font)", color: "var(--lo-text-primary)" }}>
                    {c.value != null ? fmtB(c.value) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 48px 48px" }}>
        <L3DetailPage onBack={() => navigate(-1)} memeTopData={memeTop} embedded={true} />
      </div>
    </div>
  );
}

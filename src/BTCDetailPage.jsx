import React, { useEffect, useRef, useState } from "react";
import { NewsStrip } from "./components/NewsStrip.jsx";
import TradingViewWidget from "./components/shared/TradingViewWidget";

const DETAIL_CHARTS = [
  {
    key: "btc",
    title: "BTC/USDT 周线 K 线图",
    symbol: "BINANCE:BTCUSDT",
    interval: "W",
    height: 440,
    featured: true,
  },
  {
    key: "total",
    title: "加密总市值",
    symbol: "CRYPTOCAP:TOTAL",
    interval: "W",
    height: 300,
  },
  {
    key: "btcd",
    title: "BTC 市值占比",
    symbol: "CRYPTOCAP:BTC.D",
    interval: "W",
    height: 300,
  },
  {
    key: "total3",
    title: "山寨币总市值",
    symbol: "CRYPTOCAP:TOTAL3",
    interval: "W",
    height: 300,
  },
];

function ChartCard({ chart, onOpenFullscreen }) {
  return (
    <section className={`lo-btc-detail-card${chart.featured ? " is-featured" : ""}`}>
      <div className="lo-btc-detail-card-head">
        <div>
          <div className="lo-btc-detail-card-title">{chart.title}</div>
          <div className="lo-btc-detail-card-meta">{chart.symbol} · {chart.interval === "W" ? "周线" : chart.interval}</div>
        </div>
        <button type="button" className="lo-btc-detail-fullscreen-btn" onClick={() => onOpenFullscreen(chart.key)}>
          ⛶ 全屏
        </button>
      </div>

      <TradingViewWidget symbol={chart.symbol} interval={chart.interval} height={chart.height} />
    </section>
  );
}

export default function BTCDetailPage({ onBack }) {
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [mainChart, totalChart, btcDominanceChart, total3Chart] = DETAIL_CHARTS;
  const activeFullscreenChart = DETAIL_CHARTS.find((chart) => chart.key === fullscreenChart) || null;

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        setFullscreenChart(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="lo-btc-detail-page">
      <main className="lo-btc-detail-shell">
        <NewsStrip panel="l0" />
        <ChartCard chart={mainChart} onOpenFullscreen={setFullscreenChart} />

        <div className="lo-btc-detail-grid">
          <ChartCard chart={totalChart} onOpenFullscreen={setFullscreenChart} />
          <ChartCard chart={btcDominanceChart} onOpenFullscreen={setFullscreenChart} />
          <ChartCard chart={total3Chart} onOpenFullscreen={setFullscreenChart} />
        </div>
      </main>

      {activeFullscreenChart && (
        <div className="lo-btc-detail-overlay">
          <div className="lo-btc-detail-overlay-bar">
            <span className="lo-btc-detail-overlay-title">{activeFullscreenChart.title}</span>
            <button type="button" className="lo-btc-detail-overlay-close" onClick={() => setFullscreenChart(null)}>
              ✕ 关闭
            </button>
          </div>
          <div className="lo-btc-detail-overlay-body">
            <TradingViewWidget
              symbol={activeFullscreenChart.symbol}
              interval={activeFullscreenChart.interval}
              height="100%"
            />
          </div>
        </div>
      )}
    </div>
  );
}

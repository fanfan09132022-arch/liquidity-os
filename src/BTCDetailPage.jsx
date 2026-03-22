import React, { useEffect, useRef, useState } from "react";

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

function TradingViewWidget({ symbol, interval, height = "100%" }) {
  const chartRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!chartRef.current) return undefined;

    const host = chartRef.current;
    host.innerHTML = "";
    setStatus("loading");

    const container = document.createElement("div");
    container.className = "tradingview-widget-container__widget";
    container.style.height = "100%";
    container.style.width = "100%";

    const observer = new MutationObserver(() => {
      if (host.querySelector("iframe")) {
        setStatus("ready");
      }
    });

    observer.observe(host, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.onerror = () => setStatus("error");
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Shanghai",
      theme: "light",
      style: "1",
      locale: "zh_CN",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    host.appendChild(container);
    host.appendChild(script);

    return () => {
      observer.disconnect();
      host.innerHTML = "";
    };
  }, [interval, symbol]);

  return (
    <div className="lo-btc-detail-chart-shell" style={{ height }}>
      <div
        ref={chartRef}
        className="tradingview-widget-container lo-btc-detail-widget"
        style={{ height: "100%", width: "100%" }}
      />
      {status !== "ready" && (
        <div className={`lo-btc-detail-chart-state${status === "error" ? " is-error" : ""}`}>
          {status === "error" ? "图表加载失败，请稍后重试" : "图表加载中..."}
        </div>
      )}
    </div>
  );
}

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
      <header className="lo-btc-detail-topbar">
        <div className="lo-btc-detail-topbar-inner">
          <button type="button" className="lo-btc-detail-back" onClick={onBack}>
            ← 返回
          </button>
          <div className="lo-btc-detail-heading">
            <h1 className="lo-btc-detail-title">L0-B · BTC 周期详细数据</h1>
            <p className="lo-btc-detail-subtitle">判断 BTC 所处周期位置，以及 BTC 与山寨币的相对结构</p>
          </div>
        </div>
      </header>

      <main className="lo-btc-detail-shell">
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

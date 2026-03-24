import React, { useEffect, useRef, useState } from "react";

export default function TradingViewWidget({ symbol, interval, height = "100%" }) {
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
      theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
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

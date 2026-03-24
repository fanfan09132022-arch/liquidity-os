import React from "react";
import ChartSkeleton from "./ChartSkeleton";

export default function ChartStateBlock({ loading, error, onRetry, height, children }) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) {
    return (
      <div className="lo-chart-state" style={{ minHeight: height }}>
        <div className="lo-chart-state__inner">
          <div className="lo-chart-state__msg">数据暂时不可用</div>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="lo-chart-state__retry">
              重试
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return children;
}

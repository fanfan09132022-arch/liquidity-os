import React from "react";
import SkeletonLine from "./SkeletonLine";
import ChartSkeleton from "./ChartSkeleton";

export default function DataStateCard({ title, subtitle, loading, error, onRetry, action, children }) {
  return (
    <section className="lo-detail-card">
      <div className="lo-dsc__header">
        <div>
          <div className="lo-dsc__title">{title}</div>
          {subtitle ? <div className="lo-dsc__subtitle">{subtitle}</div> : null}
        </div>
        {action || null}
      </div>

      {loading ? (
        <div className="lo-dsc__grid">
          <SkeletonLine width="34%" height={14} />
          <SkeletonLine width="26%" height={40} radius={12} />
          <ChartSkeleton height={200} />
        </div>
      ) : error ? (
        <div className="lo-dsc__grid">
          <div className="lo-dsc__error-text">{error}</div>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="lo-dsc__retry">
              重试
            </button>
          ) : null}
        </div>
      ) : children}
    </section>
  );
}

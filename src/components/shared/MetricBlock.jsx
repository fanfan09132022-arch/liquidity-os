import React from "react";

const SIZE_MAP = {
  hero: "lo-metric-block__value--hero",
  primary: "lo-metric-block__value--primary",
  secondary: "lo-metric-block__value--secondary",
};

export function MetricBlock({ value = "—", label = "", size = "primary", mono = true }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.primary;

  return (
    <div className="lo-metric-block">
      <div
        className={`lo-metric-block__value ${sizeClass}${mono ? "" : " lo-metric-block__value--ui"}`}
      >
        {value}
      </div>
      {label && (
        <div className="lo-metric-block__label">{label}</div>
      )}
    </div>
  );
}

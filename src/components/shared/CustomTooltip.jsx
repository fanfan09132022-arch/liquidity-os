import React from "react";

export default function CustomTooltip({ active, label, payload, formatters = {} }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="lo-chart-tooltip">
      <div className="lo-chart-tooltip__label">{label}</div>
      <div className="lo-chart-tooltip__items">
        {payload.map((item) => (
          <div key={`${item.dataKey}-${item.name}`} className="lo-chart-tooltip__row">
            <span className="lo-chart-tooltip__dot" style={{ background: item.color }} />
            <span className="lo-chart-tooltip__text">
              {item.name}: {(formatters[item.dataKey] || ((v) => v))(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

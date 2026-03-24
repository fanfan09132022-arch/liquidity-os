import React from "react";
import {
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_MARGIN = { top: 8, right: 56, left: 4, bottom: 12 };
const GRID_STROKE = "var(--lo-border)";
const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: "var(--lo-text-muted)",
  fontFamily: "var(--lo-font-mono)",
};

export const LO_CHART_DEFAULTS = {
  DEFAULT_MARGIN,
  GRID_STROKE,
  AXIS_TICK_STYLE,
};

export function LOTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="lo-tooltip">
      <div className="lo-tooltip__label">{label}</div>
      <div className="lo-tooltip__grid">
        {payload.map((item, index) => (
          <div key={`${item.dataKey || item.name || "series"}-${index}`} className="lo-tooltip__item">
            <span
              className="lo-tooltip__dot"
              style={{ background: item.color }}
            />
            <span className="lo-tooltip__name">
              {item.name || item.dataKey}:
            </span>
            <span className="lo-tooltip__value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LOChart({
  data,
  height = 220,
  xDataKey = "axisLabel",
  xInterval = "auto",
  yDomain = ["auto", "auto"],
  yTickFormatter,
  yWidth = 48,
  tooltipContent,
  tooltipLabelFormatter,
  margin,
  children,
}) {
  return (
    <div className="lo-chart-container" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={margin || DEFAULT_MARGIN}>
          <CartesianGrid
            stroke={GRID_STROKE}
            vertical={false}
            strokeDasharray=""
          />
          <XAxis
            dataKey={xDataKey}
            tickLine={false}
            axisLine={false}
            interval={xInterval}
            tick={AXIS_TICK_STYLE}
          />
          <YAxis
            domain={yDomain}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK_STYLE}
            tickFormatter={yTickFormatter}
            width={yWidth}
            orientation="right"
          />
          <Tooltip
            content={tooltipContent || <LOTooltip />}
            labelFormatter={tooltipLabelFormatter}
          />
          {children}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

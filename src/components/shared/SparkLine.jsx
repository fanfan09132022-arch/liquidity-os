import React from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function SparkLine({ data = [], color = "var(--lo-signal-bull)", height = 48, loading = false }) {
  if (loading || !data.length) {
    return (
      <div style={{
        height,
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
      }}>
        <div style={{
          width: "100%",
          height: 1,
          background: "var(--lo-border)",
          borderRadius: 1,
        }} />
      </div>
    );
  }

  const normalized = data.map((d) => (typeof d === "number" ? { value: d } : d));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={normalized} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

import React from "react";

export default function SkeletonLine({ width = "100%", height = 12, radius = 999 }) {
  return <div className="lo-skeleton-line" style={{ width, height, borderRadius: radius }} />;
}

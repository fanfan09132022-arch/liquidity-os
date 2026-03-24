import React from "react";

const SIGNAL_MODIFIER = {
  bull: "lo-signal-badge--bull",
  neutral: "lo-signal-badge--neutral",
  bear: "lo-signal-badge--bear",
};

export function SignalBadge({ signal = null, label = "" }) {
  const modifier = signal ? SIGNAL_MODIFIER[signal] : "";

  return (
    <span className={`lo-signal-badge ${modifier}`.trim()}>
      <span className="lo-signal-badge__dot" />
      {label}
    </span>
  );
}

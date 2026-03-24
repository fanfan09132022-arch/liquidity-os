import React from "react";

export default function PeriodButtons({ options, active, onChange }) {
  return (
    <div className="lo-period-group">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`lo-period-btn ${option === active ? "lo-period-btn--active" : ""}`.trim()}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

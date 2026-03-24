import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../context/AppStateProvider";

const TABS = [
  { label: "Dashboard", path: "/" },
  { label: "L0 宏观", path: "/macro" },
  { label: "L1 流动性", path: "/liquidity" },
  { label: "L2 稳定币", path: "/stablecoins" },
  { label: "L3 Meme", path: "/meme" },
  { label: "L4 工作台", path: "/workbench" },
];

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useAppState();

  return (
    <nav className="lo-tabbar">
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={`lo-tabbar__item ${isActive ? "lo-tabbar__item--active" : ""}`.trim()}
          >
            {isActive && <span className="lo-tabbar__accent" />}
            {tab.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={toggleTheme}
        className="lo-tabbar__theme-toggle"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </nav>
  );
}

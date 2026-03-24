import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMemeRadar } from "../lib/api";

const AppStateContext = createContext({});

export function AppStateProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.localStorage.getItem("lo-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [memeRadarItems, setMemeRadarItems] = useState([]);
  const [memeRadarLoading, setMemeRadarLoading] = useState(false);
  const [memeRadarError, setMemeRadarError] = useState(null);
  const [memeRadarUpdatedAt, setMemeRadarUpdatedAt] = useState(null);
  const [expandedAlphaCards, setExpandedAlphaCards] = useState(() => new Set());
  const [decisionFlashIdx, setDecisionFlashIdx] = useState(null);
  const [briefCopied, setBriefCopied] = useState(false);
  const [watchAutoRefreshEnabled, setWatchAutoRefreshEnabled] = useState(false);
  const [alphaAutoData, setAlphaAutoData] = useState({});
  const [alphaAutoLoading, setAlphaAutoLoading] = useState({});
  const [watchAutoData, setWatchAutoData] = useState({});
  const [watchAutoLoading, setWatchAutoLoading] = useState({});

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [theme]);

  useEffect(() => {
    setMemeRadarLoading(true);
    fetchMemeRadar()
      .then((d) => {
        if (d?.error) {
          setMemeRadarError(d.error);
          setMemeRadarItems([]);
          setMemeRadarUpdatedAt(d?.updatedAt ?? null);
          return;
        }
        setMemeRadarItems(Array.isArray(d?.items) ? d.items : []);
        setMemeRadarUpdatedAt(d?.updatedAt ?? null);
        setMemeRadarError(null);
      })
      .catch(() => {
        setMemeRadarError("Meme 雷达数据加载失败");
        setMemeRadarItems([]);
        setMemeRadarUpdatedAt(null);
      })
      .finally(() => setMemeRadarLoading(false));
  }, []);

  const toggleAlphaCard = useCallback((cardKey) => {
    setExpandedAlphaCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("lo-theme", next);
        } catch {
          // ignore theme persistence failures
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    memeRadarItems,
    memeRadarLoading,
    memeRadarError,
    memeRadarUpdatedAt,
    expandedAlphaCards,
    setExpandedAlphaCards,
    toggleAlphaCard,
    decisionFlashIdx,
    setDecisionFlashIdx,
    briefCopied,
    setBriefCopied,
    watchAutoRefreshEnabled,
    setWatchAutoRefreshEnabled,
    alphaAutoData,
    setAlphaAutoData,
    alphaAutoLoading,
    setAlphaAutoLoading,
    watchAutoData,
    setWatchAutoData,
    watchAutoLoading,
    setWatchAutoLoading,
  }), [
    theme,
    toggleTheme,
    memeRadarItems,
    memeRadarLoading,
    memeRadarError,
    memeRadarUpdatedAt,
    expandedAlphaCards,
    toggleAlphaCard,
    decisionFlashIdx,
    briefCopied,
    watchAutoRefreshEnabled,
    alphaAutoData,
    alphaAutoLoading,
    watchAutoData,
    watchAutoLoading,
  ]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  return useContext(AppStateContext);
}

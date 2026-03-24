import React, { useEffect, useState } from "react";
import { fetchNewsflash } from "../lib/api.js";

function fmtNewsTime(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() / 1000 - ts) / 60);
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

export function NewsStrip({ panel }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewsflash(panel)
      .then((d) => { setItems(d?.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [panel]);

  if (loading) {
    return (
      <div style={{ padding: "6px 0", color: "var(--lo-text-muted)", fontSize: "var(--lo-text-meta)" }}>
        📰 快讯加载中…
      </div>
    );
  }
  if (!items.length) return null;

  return (
    <div style={{
      borderBottom: "1px solid var(--lo-border)",
      marginBottom: 16,
      paddingBottom: 8,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", padding: "4px 0",
          cursor: "pointer", color: "var(--lo-text-secondary)",
          fontSize: 12, width: "100%",
        }}
      >
        <span>📰 相关快讯 ({items.length})</span>
        <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▾"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                gap: 8, textDecoration: "none", padding: "4px 0",
                borderBottom: "1px solid var(--lo-border)",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--lo-text-primary)", flex: 1, lineHeight: 1.5 }}>
                {item.title}
              </span>
              <span style={{ fontSize: 10, color: "var(--lo-text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                {fmtNewsTime(item.time)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

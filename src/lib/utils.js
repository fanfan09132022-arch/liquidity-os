export function fmtNum(n) {
  if (n == null || isNaN(n)) return "—";
  n = parseFloat(n);
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(n !== 0 && Math.abs(n) < 10 ? 2 : 0);
}

export function fmtB(n) { return n != null ? (n / 1e9).toFixed(2) + "B" : "—"; }
export function fmtPct(n) { return n != null ? (n > 0 ? "+" : "") + parseFloat(n).toFixed(2) + "%" : "—"; }
export function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(v >= 10 ? 2 : 4)}`;
}

export function fmtUsdWhole(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Math.round(Number(n)).toLocaleString("en-US")}`;
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function fmtTop50Price(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (Math.abs(v) >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (Math.abs(v) >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

export function pickTop50Icon(item = {}) {
  const candidates = [
    item.image,
    item.logo,
    item.thumb,
    item.icon,
    item.icon_url,
    item.logo_url,
    item.image_url,
    item.small,
  ];
  const chosen = candidates.find((value) => typeof value === "string" && value.trim());
  return chosen ? chosen.trim() : null;
}

export const TOP50_FALLBACK_PALETTES = [
  { bgTop: "rgba(37, 99, 235, 0.18)", bgBottom: "rgba(191, 219, 254, 0.82)", core: "rgba(37, 99, 235, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(16, 185, 129, 0.18)", bgBottom: "rgba(209, 250, 229, 0.84)", core: "rgba(5, 150, 105, 0.78)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(245, 158, 11, 0.18)", bgBottom: "rgba(254, 240, 138, 0.86)", core: "rgba(217, 119, 6, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
  { bgTop: "rgba(168, 85, 247, 0.18)", bgBottom: "rgba(233, 213, 255, 0.86)", core: "rgba(147, 51, 234, 0.82)", mark: "rgba(255, 255, 255, 0.94)" },
];

export function getTop50FallbackPalette(seed = "") {
  const score = Array.from(String(seed || "token")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TOP50_FALLBACK_PALETTES[score % TOP50_FALLBACK_PALETTES.length];
}

export function fmtRatio(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}

export function fmtCount(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("zh-CN");
}

export function shortAddr(v) {
  if (!v) return "—";
  const s = String(v);
  return s.length > 14 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
}

export function getDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function storageKeyForDate(dateValue) {
  return `daily:${dateValue}`;
}

export function keyForDate(dateValue) {
  return storageKeyForDate(dateValue);
}

export function formatDateLabel(dateValue) {
  if (!dateValue) return "—";
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return dateValue;
  return new Date(year, month - 1, day).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

export function parseDateValue(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function getRecentDateValues(days = 7, startDate = new Date()) {
  return Array.from({ length: days }, (_, idx) => getDateValue(new Date(startDate.getTime() - idx * 86400000)));
}

export function notePreview(text) {
  if (!text) return "无笔记";
  return text.length > 32 ? text.slice(0, 32) + "…" : text;
}

export function clampNum(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatTimeLabel(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fmtBillions(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(digits)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  return n.toFixed(digits);
}

export function fmtTrillions(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(3);
}

export function fmtTrillionsFromInput(v) {
  const n = toNum(v);
  return n == null ? "—" : n.toFixed(3) + "T";
}

export function calcManualGnl(fed, tga, rrp) {
  const fedVal = toNum(fed);
  const tgaVal = toNum(tga);
  const rrpVal = toNum(rrp);
  if (fedVal == null || tgaVal == null || rrpVal == null) return null;
  return parseFloat((fedVal - tgaVal - rrpVal).toFixed(3));
}

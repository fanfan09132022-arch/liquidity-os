import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NewsStrip } from "./components/NewsStrip.jsx";
import {
  Label,
  Legend,
  Line,
  ReferenceDot,
} from "recharts";
import { WORKER } from "./config.js";
import { LOChart } from "./components/shared/LOChart";
import SkeletonLine from "./components/shared/SkeletonLine";
import ChartSkeleton from "./components/shared/ChartSkeleton";
import DataStateCard from "./components/shared/DataStateCard";
import PeriodButtons from "./components/shared/PeriodButtons";
import ChartStateBlock from "./components/shared/ChartStateBlock";
import CustomTooltip from "./components/shared/CustomTooltip";
import TradingViewWidget from "./components/shared/TradingViewWidget";
import { fmtNum, fmtTrillions, toNum } from "./lib/utils";

const FRED_ENDPOINTS = {
  fed: `${WORKER}/api/fred/WALCL`,
  tga: `${WORKER}/api/fred/WTREGEN`,
  rrp: `${WORKER}/api/fred/RRPONTSYD`,
};

const FRED_FALLBACK_HISTORY = [{"date":"2024-01-03","timestamp":1704240000000,"fed":7.681024,"tga":0.758448,"rrp":0.00072,"gnl":6.921856},{"date":"2024-01-10","timestamp":1704844800000,"fed":7.68671,"tga":0.747565,"rrp":0.00068,"gnl":6.938465},{"date":"2024-01-17","timestamp":1705449600000,"fed":7.673741,"tga":0.748883,"rrp":0.00059,"gnl":6.924268},{"date":"2024-01-24","timestamp":1706054400000,"fed":7.67723,"tga":0.799358,"rrp":0.00064,"gnl":6.877232},{"date":"2024-01-31","timestamp":1706659200000,"fed":7.630124,"tga":0.84155,"rrp":0.000615,"gnl":6.787959},{"date":"2024-02-07","timestamp":1707264000000,"fed":7.6313,"tga":0.802135,"rrp":0.000553,"gnl":6.828612},{"date":"2024-02-14","timestamp":1707868800000,"fed":7.633874,"tga":0.838005,"rrp":0.000575,"gnl":6.795294},{"date":"2024-02-21","timestamp":1708473600000,"fed":7.581683,"tga":0.785465,"rrp":0.000575,"gnl":6.795643},{"date":"2024-02-28","timestamp":1709078400000,"fed":7.567807,"tga":0.785821,"rrp":0.00057,"gnl":6.781416},{"date":"2024-03-06","timestamp":1709683200000,"fed":7.538857,"tga":0.767733,"rrp":0.000457,"gnl":6.770667},{"date":"2024-03-13","timestamp":1710288000000,"fed":7.541969,"tga":0.768369,"rrp":0.000522,"gnl":6.773078},{"date":"2024-03-20","timestamp":1710892800000,"fed":7.514348,"tga":0.809298,"rrp":0.000496,"gnl":6.704554},{"date":"2024-03-27","timestamp":1711497600000,"fed":7.484739,"tga":0.802233,"rrp":0.000518,"gnl":6.681988},{"date":"2024-04-03","timestamp":1712102400000,"fed":7.439558,"tga":0.768651,"rrp":0.000437,"gnl":6.67047},{"date":"2024-04-10","timestamp":1712707200000,"fed":7.438176,"tga":0.704971,"rrp":0.000446,"gnl":6.732759},{"date":"2024-04-17","timestamp":1713312000000,"fed":7.405506,"tga":0.796535,"rrp":0.000441,"gnl":6.60853},{"date":"2024-04-24","timestamp":1713916800000,"fed":7.402434,"tga":0.94143,"rrp":0.000441,"gnl":6.460563},{"date":"2024-05-01","timestamp":1714521600000,"fed":7.362474,"tga":0.917177,"rrp":0.000438,"gnl":6.444859},{"date":"2024-05-08","timestamp":1715126400000,"fed":7.353408,"tga":0.851591,"rrp":0.000493,"gnl":6.501324},{"date":"2024-05-15","timestamp":1715731200000,"fed":7.304272,"tga":0.787133,"rrp":0.000444,"gnl":6.516695},{"date":"2024-05-22","timestamp":1716336000000,"fed":7.299566,"tga":0.725376,"rrp":0.000496,"gnl":6.573694},{"date":"2024-05-29","timestamp":1716940800000,"fed":7.284319,"tga":0.704335,"rrp":0.000459,"gnl":6.579525},{"date":"2024-06-05","timestamp":1717545600000,"fed":7.255687,"tga":0.710309,"rrp":0.000372,"gnl":6.545006},{"date":"2024-06-12","timestamp":1718150400000,"fed":7.258974,"tga":0.673573,"rrp":0.000448,"gnl":6.584953},{"date":"2024-06-26","timestamp":1719360000000,"fed":7.231163,"tga":0.765417,"rrp":0.00049,"gnl":6.465256},{"date":"2024-07-03","timestamp":1719964800000,"fed":7.22152,"tga":0.761373,"rrp":0.000426,"gnl":6.459721},{"date":"2024-07-10","timestamp":1720569600000,"fed":7.224079,"tga":0.736402,"rrp":0.000422,"gnl":6.487255},{"date":"2024-07-17","timestamp":1721174400000,"fed":7.208247,"tga":0.751593,"rrp":0.000399,"gnl":6.456255},{"date":"2024-07-24","timestamp":1721779200000,"fed":7.205455,"tga":0.774315,"rrp":0.000399,"gnl":6.430741},{"date":"2024-07-31","timestamp":1722384000000,"fed":7.178391,"tga":0.786486,"rrp":0.000413,"gnl":6.391492},{"date":"2024-08-07","timestamp":1722988800000,"fed":7.175256,"tga":0.770931,"rrp":0.000287,"gnl":6.404038},{"date":"2024-08-14","timestamp":1723593600000,"fed":7.177688,"tga":0.79412,"rrp":0.000328,"gnl":6.38324},{"date":"2024-08-21","timestamp":1724198400000,"fed":7.139952,"tga":0.736494,"rrp":0.000321,"gnl":6.403137},{"date":"2024-08-28","timestamp":1724803200000,"fed":7.123238,"tga":0.745851,"rrp":0.000389,"gnl":6.376998},{"date":"2024-09-04","timestamp":1725408000000,"fed":7.112567,"tga":0.733959,"rrp":0.000337,"gnl":6.378271},{"date":"2024-09-11","timestamp":1726012800000,"fed":7.115001,"tga":0.755958,"rrp":0.000279,"gnl":6.358764},{"date":"2024-09-18","timestamp":1726617600000,"fed":7.109137,"tga":0.771194,"rrp":0.000306,"gnl":6.337637},{"date":"2024-09-25","timestamp":1727222400000,"fed":7.080059,"tga":0.806771,"rrp":0.000416,"gnl":6.272872},{"date":"2024-10-02","timestamp":1727827200000,"fed":7.046925,"tga":0.798277,"rrp":0.000383,"gnl":6.248265},{"date":"2024-10-09","timestamp":1728432000000,"fed":7.04684,"tga":0.802115,"rrp":0.000343,"gnl":6.244382},{"date":"2024-10-16","timestamp":1729036800000,"fed":7.039284,"tga":0.791792,"rrp":0.000272,"gnl":6.24722},{"date":"2024-10-23","timestamp":1729641600000,"fed":7.029408,"tga":0.829991,"rrp":0.000271,"gnl":6.199146},{"date":"2024-10-30","timestamp":1730246400000,"fed":7.01349,"tga":0.835237,"rrp":0.000229,"gnl":6.178024},{"date":"2024-11-06","timestamp":1730851200000,"fed":6.994299,"tga":0.842051,"rrp":0.000178,"gnl":6.15207},{"date":"2024-11-13","timestamp":1731456000000,"fed":6.967108,"tga":0.832186,"rrp":0.000238,"gnl":6.134684},{"date":"2024-11-20","timestamp":1732060800000,"fed":6.923731,"tga":0.751873,"rrp":0.000218,"gnl":6.17164},{"date":"2024-11-27","timestamp":1732665600000,"fed":6.90514,"tga":0.77525,"rrp":0.00017,"gnl":6.12972},{"date":"2024-12-04","timestamp":1733270400000,"fed":6.895827,"tga":0.789516,"rrp":0.000163,"gnl":6.106148},{"date":"2024-12-11","timestamp":1733875200000,"fed":6.897485,"tga":0.775067,"rrp":0.00018,"gnl":6.122238},{"date":"2024-12-18","timestamp":1734480000000,"fed":6.889332,"tga":0.767932,"rrp":0.000132,"gnl":6.121268},{"date":"2025-01-08","timestamp":1736294400000,"fed":6.853554,"tga":0.652636,"rrp":0.000185,"gnl":6.200733},{"date":"2025-01-15","timestamp":1736899200000,"fed":6.83407,"tga":0.641225,"rrp":0.00012,"gnl":6.192725},{"date":"2025-01-22","timestamp":1737504000000,"fed":6.83176,"tga":0.677282,"rrp":0.000124,"gnl":6.154354},{"date":"2025-01-29","timestamp":1738108800000,"fed":6.818186,"tga":0.784206,"rrp":0.000122,"gnl":6.033858},{"date":"2025-02-05","timestamp":1738713600000,"fed":6.810935,"tga":0.805593,"rrp":0.000079,"gnl":6.005263},{"date":"2025-02-12","timestamp":1739318400000,"fed":6.813513,"tga":0.828102,"rrp":0.000068,"gnl":5.985343},{"date":"2025-02-19","timestamp":1739923200000,"fed":6.782332,"tga":0.790062,"rrp":0.000073,"gnl":5.992197},{"date":"2025-02-26","timestamp":1740528000000,"fed":6.766101,"tga":0.681161,"rrp":0.000126,"gnl":6.084814},{"date":"2025-03-05","timestamp":1741132800000,"fed":6.756764,"tga":0.548331,"rrp":0.000139,"gnl":6.208294},{"date":"2025-03-12","timestamp":1741737600000,"fed":6.759571,"tga":0.512581,"rrp":0.000131,"gnl":6.246859},{"date":"2025-03-19","timestamp":1742342400000,"fed":6.755982,"tga":0.435936,"rrp":0.000193,"gnl":6.319853},{"date":"2025-03-26","timestamp":1742947200000,"fed":6.740253,"tga":0.360177,"rrp":0.000241,"gnl":6.379835},{"date":"2025-04-02","timestamp":1743552000000,"fed":6.723452,"tga":0.313326,"rrp":0.000233,"gnl":6.409893},{"date":"2025-04-09","timestamp":1744156800000,"fed":6.727416,"tga":0.306049,"rrp":0.000168,"gnl":6.421199},{"date":"2025-04-16","timestamp":1744761600000,"fed":6.727113,"tga":0.422983,"rrp":0.000055,"gnl":6.304075},{"date":"2025-04-23","timestamp":1745366400000,"fed":6.72693,"tga":0.606632,"rrp":0.000172,"gnl":6.120126},{"date":"2025-04-30","timestamp":1745971200000,"fed":6.709277,"tga":0.595741,"rrp":0.000251,"gnl":6.113285},{"date":"2025-05-07","timestamp":1746576000000,"fed":6.710889,"tga":0.583727,"rrp":0.000155,"gnl":6.127007},{"date":"2025-05-14","timestamp":1747180800000,"fed":6.71327,"tga":0.575846,"rrp":0.000165,"gnl":6.137259},{"date":"2025-05-21","timestamp":1747785600000,"fed":6.688726,"tga":0.503055,"rrp":0.000163,"gnl":6.185508},{"date":"2025-05-28","timestamp":1748390400000,"fed":6.673244,"tga":0.467204,"rrp":0.000174,"gnl":6.205866},{"date":"2025-06-04","timestamp":1748995200000,"fed":6.672885,"tga":0.378947,"rrp":0.000169,"gnl":6.293769},{"date":"2025-06-11","timestamp":1749600000000,"fed":6.677155,"tga":0.332907,"rrp":0.000205,"gnl":6.344043},{"date":"2025-06-18","timestamp":1750204800000,"fed":6.681056,"tga":0.337762,"rrp":0.000205,"gnl":6.343089},{"date":"2025-06-25","timestamp":1750809600000,"fed":6.6622,"tga":0.364375,"rrp":0.000211,"gnl":6.297614},{"date":"2025-07-02","timestamp":1751414400000,"fed":6.659598,"tga":0.359516,"rrp":0.000237,"gnl":6.299845},{"date":"2025-07-09","timestamp":1752019200000,"fed":6.661912,"tga":0.319889,"rrp":0.000227,"gnl":6.341796},{"date":"2025-07-16","timestamp":1752624000000,"fed":6.659273,"tga":0.296247,"rrp":0.000197,"gnl":6.362829},{"date":"2025-07-23","timestamp":1753228800000,"fed":6.657715,"tga":0.323176,"rrp":0.00019,"gnl":6.334349},{"date":"2025-07-30","timestamp":1753833600000,"fed":6.642578,"tga":0.370507,"rrp":0.000155,"gnl":6.271916},{"date":"2025-08-06","timestamp":1754438400000,"fed":6.640843,"tga":0.421043,"rrp":0.000092,"gnl":6.219708},{"date":"2025-08-13","timestamp":1755043200000,"fed":6.643615,"tga":0.504304,"rrp":0.000057,"gnl":6.139254},{"date":"2025-08-20","timestamp":1755648000000,"fed":6.618415,"tga":0.519534,"rrp":0.000035,"gnl":6.098846},{"date":"2025-08-27","timestamp":1756252800000,"fed":6.603384,"tga":0.589998,"rrp":0.000035,"gnl":6.013351},{"date":"2025-09-03","timestamp":1756857600000,"fed":6.602071,"tga":0.597513,"rrp":0.000018,"gnl":6.00454},{"date":"2025-09-10","timestamp":1757462400000,"fed":6.605962,"tga":0.672274,"rrp":0.000029,"gnl":5.933659},{"date":"2025-09-17","timestamp":1758067200000,"fed":6.608597,"tga":0.756376,"rrp":0.000014,"gnl":5.852207},{"date":"2025-09-24","timestamp":1758672000000,"fed":6.608395,"tga":0.804856,"rrp":0.000029,"gnl":5.80351},{"date":"2025-10-01","timestamp":1759276800000,"fed":6.587119,"tga":0.805139,"rrp":0.00001,"gnl":5.78197},{"date":"2025-10-08","timestamp":1759881600000,"fed":6.590815,"tga":0.807428,"rrp":0.000005,"gnl":5.783382},{"date":"2025-10-15","timestamp":1760486400000,"fed":6.596454,"tga":0.809593,"rrp":0.000005,"gnl":5.786856},{"date":"2025-10-22","timestamp":1761091200000,"fed":6.589533,"tga":0.908001,"rrp":0.000004,"gnl":5.681528},{"date":"2025-10-29","timestamp":1761696000000,"fed":6.587034,"tga":0.95799,"rrp":0.00002,"gnl":5.629024},{"date":"2025-11-05","timestamp":1762300800000,"fed":6.572732,"tga":0.940979,"rrp":0.000013,"gnl":5.63174},{"date":"2025-11-12","timestamp":1762905600000,"fed":6.580462,"tga":0.953816,"rrp":0.000006,"gnl":5.62664},{"date":"2025-11-19","timestamp":1763510400000,"fed":6.555283,"tga":0.941926,"rrp":0.000001,"gnl":5.613356},{"date":"2025-11-26","timestamp":1764115200000,"fed":6.552419,"tga":0.903394,"rrp":0.000002,"gnl":5.649023},{"date":"2025-12-03","timestamp":1764720000000,"fed":6.535781,"tga":0.937167,"rrp":0.000003,"gnl":5.598611},{"date":"2025-12-10","timestamp":1765324800000,"fed":6.539303,"tga":0.858946,"rrp":0.000005,"gnl":5.680352},{"date":"2025-12-17","timestamp":1765929600000,"fed":6.556861,"tga":0.833093,"rrp":0.00001,"gnl":5.723758},{"date":"2025-12-24","timestamp":1766534400000,"fed":6.581231,"tga":0.83712,"rrp":0.000005,"gnl":5.744106},{"date":"2025-12-31","timestamp":1767139200000,"fed":6.640618,"tga":0.837306,"rrp":0.000106,"gnl":5.803206},{"date":"2026-01-07","timestamp":1767744000000,"fed":6.573602,"tga":0.796148,"rrp":0.000005,"gnl":5.777449},{"date":"2026-01-14","timestamp":1768348800000,"fed":6.5817,"tga":0.779175,"rrp":0.000003,"gnl":5.802522},{"date":"2026-01-21","timestamp":1768953600000,"fed":6.58458,"tga":0.869261,"rrp":0.000003,"gnl":5.715316},{"date":"2026-01-28","timestamp":1769558400000,"fed":6.587568,"tga":0.923042,"rrp":0.000001,"gnl":5.664525},{"date":"2026-02-04","timestamp":1770163200000,"fed":6.605909,"tga":0.908773,"rrp":0.000002,"gnl":5.697134},{"date":"2026-02-11","timestamp":1770768000000,"fed":6.622382,"tga":0.915306,"rrp":0.000001,"gnl":5.707075},{"date":"2026-02-18","timestamp":1771372800000,"fed":6.613395,"tga":0.912727,"rrp":0.000001,"gnl":5.700667},{"date":"2026-02-25","timestamp":1771977600000,"fed":6.613797,"tga":0.887612,"rrp":0.000001,"gnl":5.726184},{"date":"2026-03-04","timestamp":1772582400000,"fed":6.628894,"tga":0.832053,"rrp":0.000001,"gnl":5.79684},{"date":"2026-03-11","timestamp":1773187200000,"fed":6.646344,"tga":0.838186,"rrp":0.000001,"gnl":5.808157}];

const GNL_PERIOD_DAYS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "2Y": 730, ALL: null };
const CHART_HEIGHT = 220;
const COMPONENT_HEIGHT = 200;

function getGnlAccentColor(value) {
  const numeric = toNum(value);
  if (numeric == null) return "var(--lo-text-primary)";
  if (numeric > 0.1) return "var(--lo-signal-bull)";
  if (numeric < -0.1) return "var(--lo-signal-bear)";
  return "var(--lo-signal-neutral)";
}

function formatDateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatMonthDay(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatShortYearMonth(value) {
  if (!value) return "";
  const date = new Date(value);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

function getXAxisInterval(period) {
  if (period === "1W") return 1;
  if (period === "1M") return 4;
  if (period === "3M") return 11;
  if (period === "6M") return 18;
  if (period === "1Y") return 28;
  if (period === "2Y") return 40;
  if (period === "ALL") return 40;
  return 0;
}

function getPaddedDomain(rows, keys, paddingRatio = 0.1) {
  const values = [];
  for (const row of rows || []) {
    for (const key of keys) {
      const value = Number(row?.[key]);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padding = range > 0 ? range * paddingRatio : Math.max(Math.abs(max) * paddingRatio, 0.25);
  return [min - padding, max + padding];
}

function getWindowRangeStats(points, key, windowDays) {
  const windowed = clampToRecentDays(points || [], windowDays).filter((point) => Number.isFinite(Number(point?.[key])));
  if (windowed.length < 4) return null;
  const values = windowed.map((point) => Number(point[key]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: max - min };
}

function getSeriesExtrema(points, key) {
  const valid = (points || []).filter((point) => Number.isFinite(Number(point?.[key])));
  if (!valid.length) return { minPoint: null, maxPoint: null };
  let minPoint = valid[0];
  let maxPoint = valid[0];
  for (const point of valid) {
    if (Number(point[key]) < Number(minPoint[key])) minPoint = point;
    if (Number(point[key]) > Number(maxPoint[key])) maxPoint = point;
  }
  return { minPoint, maxPoint };
}

function sortByTimestampAsc(points) {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
}

function clampToRecentDays(points, days) {
  if (!Array.isArray(points) || !points.length) return [];
  const sorted = sortByTimestampAsc(points);
  const latest = sorted[sorted.length - 1].timestamp;
  const start = latest - ((days - 1) * 24 * 60 * 60 * 1000);
  return sorted.filter((point) => point.timestamp >= start);
}

async function fetchJSON(url, timeout = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseFredObservations(payload, divisor) {
  return (payload?.observations || [])
    .filter((entry) => entry?.value !== ".")
    .map((entry) => {
      const value = toNum(entry?.value);
      const timestamp = new Date(`${entry?.date}T00:00:00Z`).getTime();
      if (value == null || !Number.isFinite(timestamp) || !entry?.date) return null;
      return {
        date: entry.date,
        timestamp,
        valueT: value / divisor,
      };
    })
    .filter(Boolean)
    .reverse();
}

function buildAlignedHistory(seriesMap) {
  const fedMap = new Map((seriesMap.fed || []).map((item) => [item.date, item]));
  const tgaMap = new Map((seriesMap.tga || []).map((item) => [item.date, item]));
  const rrpMap = new Map((seriesMap.rrp || []).map((item) => [item.date, item]));

  return Array.from(fedMap.keys())
    .filter((date) => tgaMap.has(date) && rrpMap.has(date))
    .map((date) => {
      const fed = fedMap.get(date);
      const tga = tgaMap.get(date);
      const rrp = rrpMap.get(date);
      return {
        date,
        timestamp: fed.timestamp,
        label: date,
        gnl: fed.valueT - tga.valueT - rrp.valueT,
        fed: fed.valueT,
        tga: tga.valueT,
        rrp: rrp.valueT,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getFallbackFredData() {
  const history = FRED_FALLBACK_HISTORY.map((item) => ({ ...item, label: item.date }));
  const latest = history.at(-1) || null;
  if (!latest) return null;
  return {
    current: {
      gnl: latest.gnl,
      fed: { valueT: latest.fed, date: latest.date, timestamp: latest.timestamp },
      tga: { valueT: latest.tga, date: latest.date, timestamp: latest.timestamp },
      rrp: { valueT: latest.rrp, date: latest.date, timestamp: latest.timestamp },
      updatedAt: latest.timestamp,
    },
    history,
  };
}

function getChartLabelFill(lineColor) {
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark") {
    return "rgba(255,255,255,0.50)";
  }
  return lineColor || "rgba(15,23,42,0.55)";
}

function formatTrillionsCompact(value) {
  const numeric = toNum(value);
  if (numeric == null) return "—";
  return `${numeric.toFixed(2)}T`;
}

function renderLineEndLabel(data, lineName, lineColor, formatter = formatTrillionsCompact) {
  return function EndLabel(props) {
    const { x, y, index, value } = props || {};
    if (!Array.isArray(data) || data.length < 2 || index !== data.length - 1 || x == null || y == null) return null;
    const renderedValue = formatter(value);
    if (!renderedValue || renderedValue === "—") return null;
    return (
      <text
        x={x + 8}
        y={y}
        fill={getChartLabelFill(lineColor)}
        fontSize={10}
        fontFamily="var(--lo-num-font)"
        textAnchor="start"
        dominantBaseline="middle"
      >
        {lineName} {renderedValue}
      </text>
    );
  };
}

export default function L1DetailPage({ onBack }) {
  const [summaryState, setSummaryState] = useState({ loading: true, error: "", data: null });
  const [historyPeriod, setHistoryPeriod] = useState("1Y");
  const [showComponents, setShowComponents] = useState(true);

  const loadFredData = useCallback(async () => {
    setSummaryState({ loading: true, error: "", data: null });
    try {
      const [fedJson, tgaJson, rrpJson] = await Promise.all([
        fetchJSON(FRED_ENDPOINTS.fed),
        fetchJSON(FRED_ENDPOINTS.tga),
        fetchJSON(FRED_ENDPOINTS.rrp),
      ]);

      const series = {
        fed: parseFredObservations(fedJson, 1000000),
        tga: parseFredObservations(tgaJson, 1000000),
        rrp: parseFredObservations(rrpJson, 1000),
      };

      const latestFed = series.fed.at(-1) || null;
      const latestTga = series.tga.at(-1) || null;
      const latestRrp = series.rrp.at(-1) || null;
      const history = buildAlignedHistory(series);
      if (!latestFed || !latestTga || !latestRrp || !history.length) {
        throw new Error("fred empty");
      }

      setSummaryState({
        loading: false,
        error: "",
        data: {
          current: {
            gnl: latestFed.valueT - latestTga.valueT - latestRrp.valueT,
            fed: latestFed,
            tga: latestTga,
            rrp: latestRrp,
            updatedAt: [latestFed.timestamp, latestTga.timestamp, latestRrp.timestamp].sort((a, b) => b - a)[0],
          },
          history,
        },
      });
    } catch {
      const fallback = getFallbackFredData();
      if (fallback) {
        setSummaryState({ loading: false, error: "", data: fallback });
      } else {
        setSummaryState({ loading: false, error: "数据暂时不可用", data: null });
      }
    }
  }, []);

  useEffect(() => {
    loadFredData();
  }, [loadFredData]);

  const gnlChartData = useMemo(() => {
    const history = summaryState.data?.history || [];
    const scoped = historyPeriod === "ALL"
      ? history
      : clampToRecentDays(history, GNL_PERIOD_DAYS[historyPeriod] || 365);
    return scoped.map((item) => ({
      ...item,
      axisLabel: historyPeriod === "2Y" || historyPeriod === "ALL"
        ? formatShortYearMonth(item.timestamp)
        : formatMonthDay(item.timestamp),
    }));
  }, [historyPeriod, summaryState.data]);

  const current = summaryState.data?.current || null;
  const gnlDomain = useMemo(() => getPaddedDomain(gnlChartData, ["gnl"]), [gnlChartData]);
  const componentDomain = useMemo(() => getPaddedDomain(gnlChartData, ["fed", "tga", "rrp"]), [gnlChartData]);
  const gnlRangeAnchor = useMemo(() => {
    const stats = getWindowRangeStats(summaryState.data?.history || [], "gnl", 365);
    const currentGnl = toNum(current?.gnl);
    if (!stats || currentGnl == null) return null;
    const percentile = stats.range > 0
      ? Math.max(0, Math.min(100, ((currentGnl - stats.min) / stats.range) * 100))
      : 50;
    return {
      min: stats.min,
      max: stats.max,
      percentile,
    };
  }, [current?.gnl, summaryState.data]);
  const gnlExtrema = useMemo(() => getSeriesExtrema(gnlChartData, "gnl"), [gnlChartData]);
  const shouldAnnotateGnl = gnlChartData.length >= 4;

  return (
    <div className="lo-btc-detail-page lo-detail-page" style={{ borderTop: "2px solid color-mix(in srgb, var(--lo-brand) 30%, transparent)" }}>
      <main className="lo-detail-content">
        <NewsStrip panel="l1" />
        <DataStateCard
          title="GNL 当前数值"
          subtitle="数据来源：FRED"
          loading={summaryState.loading}
          error={summaryState.error}
          onRetry={loadFredData}
        >
          <div className="lo-d-grid" style={{ gap: 18 }}>
            <div className="lo-metric lo-metric--xl" style={{ color: getGnlAccentColor(current?.gnl) }}>
              {fmtTrillions(current?.gnl)}
            </div>
            {gnlRangeAnchor ? (
              <div className="lo-text-meta-muted" style={{ lineHeight: 1.6 }}>
                近 52 周区间 [{fmtTrillions(gnlRangeAnchor.min)} — {fmtTrillions(gnlRangeAnchor.max)}] · 当前位于区间 {gnlRangeAnchor.percentile.toFixed(0)}%
              </div>
            ) : null}
            <div className="lo-d-grid--3col">
              {[
                { key: "fed", label: "Fed 资产负债表", value: current?.fed?.valueT, date: current?.fed?.date, color: "var(--lo-brand)" },
                { key: "tga", label: "TGA", value: current?.tga?.valueT, date: current?.tga?.date, color: "var(--lo-signal-bear)" },
                { key: "rrp", label: "RRP", value: current?.rrp?.valueT, date: current?.rrp?.date, color: "var(--lo-signal-neutral)" },
              ].map((item) => (
                <div key={item.key} className="lo-inset-panel">
                  <div className="lo-inset-panel__label">{item.label}</div>
                  <div className="lo-metric lo-metric--md" style={{ color: item.color, marginBottom: 6 }}>
                    {fmtTrillions(item.value)}
                  </div>
                  <div className="lo-inset-panel__date">
                    {formatDateLabel(item.date)}
                  </div>
                </div>
              ))}
            </div>
            <div className="lo-text-footnote">
              GNL 领先 BTC 约 13 周，每周四更新
            </div>
          </div>
        </DataStateCard>

        <DataStateCard
          title="GNL 历史走势"
          subtitle="单线观察净流动性的趋势斜率，周期切换只过滤本地数据。"
          loading={summaryState.loading}
          error={summaryState.error}
          onRetry={loadFredData}
          action={<PeriodButtons options={Object.keys(GNL_PERIOD_DAYS)} active={historyPeriod} onChange={setHistoryPeriod} />}
        >
          <ChartStateBlock loading={false} error={gnlChartData.length ? "" : "数据暂时不可用"} onRetry={loadFredData} height={CHART_HEIGHT}>
            <LOChart
              data={gnlChartData}
              height={CHART_HEIGHT}
              xDataKey="axisLabel"
              xInterval={getXAxisInterval(historyPeriod)}
              yDomain={gnlDomain}
              yTickFormatter={(value) => `${Number(value).toFixed(1)}T`}
              yWidth={48}
              tooltipContent={<CustomTooltip formatters={{ gnl: (value) => fmtTrillions(value) }} />}
              tooltipLabelFormatter={(_, payload) => formatDateLabel(payload?.[0]?.payload?.date)}
              margin={{ top: 8, right: 60, left: -12, bottom: 12 }}
            >
              <Line
                type="monotone"
                dataKey="gnl"
                name="GNL"
                stroke={"var(--lo-brand)"}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                label={renderLineEndLabel(gnlChartData, "GNL", "var(--lo-brand)", formatTrillionsCompact)}
              />
              {shouldAnnotateGnl && gnlExtrema.maxPoint ? (
                <ReferenceDot
                  x={gnlExtrema.maxPoint.axisLabel}
                  y={gnlExtrema.maxPoint.gnl}
                  r={4}
                  fill={"var(--lo-brand)"}
                  stroke="none"
                >
                  <Label
                    value={`${fmtTrillions(gnlExtrema.maxPoint.gnl)} · ${formatMonthDay(gnlExtrema.maxPoint.date)}`}
                    position="top"
                    offset={10}
                    style={{ fontSize: 10, fill: "var(--lo-text-muted)", fontFamily: "var(--lo-num-font)" }}
                  />
                </ReferenceDot>
              ) : null}
              {shouldAnnotateGnl && gnlExtrema.minPoint && gnlExtrema.minPoint !== gnlExtrema.maxPoint ? (
                <ReferenceDot
                  x={gnlExtrema.minPoint.axisLabel}
                  y={gnlExtrema.minPoint.gnl}
                  r={4}
                  fill={"var(--lo-signal-bear)"}
                  stroke="none"
                >
                  <Label
                    value={`${fmtTrillions(gnlExtrema.minPoint.gnl)} · ${formatMonthDay(gnlExtrema.minPoint.date)}`}
                    position="bottom"
                    offset={10}
                    style={{ fontSize: 10, fill: "var(--lo-text-muted)", fontFamily: "var(--lo-num-font)" }}
                  />
                </ReferenceDot>
              ) : null}
            </LOChart>
          </ChartStateBlock>
        </DataStateCard>

        <DataStateCard
          title="Fed / TGA / RRP 历史分量"
          subtitle="Fed 扩张 + TGA/RRP 下降 = GNL 上升 = 流动性宽松"
          loading={summaryState.loading}
          error={summaryState.error}
          onRetry={loadFredData}
          action={(
            <div className="lo-d-flex-end-wrap">
              <PeriodButtons options={Object.keys(GNL_PERIOD_DAYS)} active={historyPeriod} onChange={setHistoryPeriod} />
              <button
                type="button"
                onClick={() => setShowComponents((value) => !value)}
                className="lo-toggle-btn"
              >
                {showComponents ? "收起" : "展开"}
              </button>
            </div>
          )}
        >
          {showComponents ? (
            <ChartStateBlock loading={false} error={gnlChartData.length ? "" : "数据暂时不可用"} onRetry={loadFredData} height={COMPONENT_HEIGHT}>
              <LOChart
                data={gnlChartData}
                height={COMPONENT_HEIGHT}
                xDataKey="axisLabel"
                xInterval={getXAxisInterval(historyPeriod)}
                yDomain={componentDomain}
                yTickFormatter={(value) => `${Number(value).toFixed(1)}T`}
                yWidth={48}
                tooltipContent={(
                  <CustomTooltip
                    formatters={{
                      fed: (value) => fmtTrillions(value),
                      tga: (value) => fmtTrillions(value),
                      rrp: (value) => fmtTrillions(value),
                    }}
                  />
                )}
                tooltipLabelFormatter={(_, payload) => formatDateLabel(payload?.[0]?.payload?.date)}
                margin={{ top: 8, right: 60, left: -12, bottom: 12 }}
              >
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                <Line type="monotone" dataKey="fed" name="Fed" stroke={"var(--lo-brand)"} strokeWidth={2.2} dot={false} label={renderLineEndLabel(gnlChartData, "Fed", "var(--lo-brand)", formatTrillionsCompact)} />
                <Line type="monotone" dataKey="tga" name="TGA" stroke={"var(--lo-signal-bear)"} strokeWidth={2.2} dot={false} label={renderLineEndLabel(gnlChartData, "TGA", "var(--lo-signal-bear)", formatTrillionsCompact)} />
                <Line type="monotone" dataKey="rrp" name="RRP" stroke={"var(--lo-signal-neutral)"} strokeWidth={2.2} dot={false} label={renderLineEndLabel(gnlChartData, "RRP", "var(--lo-signal-neutral)", formatTrillionsCompact)} />
              </LOChart>
            </ChartStateBlock>
          ) : (
            <div className="lo-text-footnote" style={{ padding: "6px 0 2px" }}>分量图已收起，按需展开查看联储扩表与资金回笼结构。</div>
          )}
        </DataStateCard>

        <section className="lo-detail-card">
          <div className="lo-manual-card__header">
            <div>
              <div className="lo-dsc__title">DXY 美元指数（周线）</div>
              <div className="lo-dsc__subtitle">
                DXY 下降通常对加密有利，上升压制风险资产
              </div>
            </div>
          </div>
          <TradingViewWidget symbol="INDEX:DXY" interval="W" height={350} />
        </section>

        <div className="lo-text-footnote" style={{ margin: "14px 16px 0" }}>
          数据来源：FRED (Federal Reserve) · TradingView · 每周四更新
        </div>
      </main>
    </div>
  );
}

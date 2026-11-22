import { Bar, Cell, LabelList } from "recharts";
import { useDashboard } from "../useDashboard.jsx";

export const COLORS = {
  yes: "#1f6b45",
  no: "#a72e25",
  tbc: "#a6843d",
  navy: "#243e5a",
  teal: "#3e7c8a",
  gray: "#d4cdc3",
};

export function useHighlight() {
  const { filters } = useDashboard();
  const status = filters.status;
  const unit = filters.unit;
  const category = filters.category;
  const q = filters.q.trim();
  return {
    status,
    unit,
    category,
    q,
    statusOn(key) {
      return status === "all" || status === key;
    },
    rowOn(row, { unitKey, categoryKey, textKey } = {}) {
      if (unit !== "all" && unitKey && row[unitKey] !== unit) return false;
      if (category !== "all" && categoryKey && row[categoryKey] !== category) return false;
      if (q && textKey && !String(row[textKey] ?? "").includes(q)) return false;
      return true;
    },
  };
}

export function tone(active, color) {
  return active ? color : COLORS.gray;
}

export function formatNumber(value, digits) {
  const n = Number(value);
  const places = digits ?? (Number.isInteger(n) ? 0 : 2);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

export function ChartCard({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function SeriesLegend() {
  const { statusOn } = useHighlight();
  const items = [
    { key: "yes", color: COLORS.yes, label: "مستوفي" },
    { key: "no", color: COLORS.no, label: "غير مستوفي" },
  ];
  return (
    <div className="legend">
      {items.map((item) => {
        const on = statusOn(item.key);
        return (
          <span key={item.key} className={on ? undefined : "is-muted"}>
            <i className="swatch" style={{ background: on ? item.color : COLORS.gray }} />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

const STATUS_SERIES = [
  { status: "yes", part: "On", name: "مستوفي", color: COLORS.yes },
  { status: "yes", part: "Off", name: "غير مطابق", color: COLORS.gray },
  { status: "no", part: "On", name: "غير مستوفي", color: COLORS.no },
  { status: "no", part: "Off", name: "غير مطابق", color: COLORS.gray },
];

const STATUS_KEYS = ["yesOn", "yesOff", "noOn", "noOff"];

export function useStatusBars({ rows, categoryKey, onPick, rowActive }) {
  const { statusOn } = useHighlight();
  const colored = (row, item) => item.part === "On" && statusOn(item.status) && (!rowActive || rowActive(row));
  return STATUS_SERIES.map((item) => {
    const dataKey = `${item.status}${item.part}`;
    return (
      <Bar
        key={dataKey}
        dataKey={dataKey}
        name={item.name}
        stackId="s"
        fill={item.color}
        radius={dataKey === "noOff" ? [3, 3, 0, 0] : undefined}
        isAnimationActive={false}
        onClick={(row) => onPick(row, item.status)}
      >
        {rows.map((row, index) => (
          <Cell key={`${row[categoryKey] ?? index}-${dataKey}`} fill={tone(colored(row, item), item.color)} />
        ))}
        <LabelList
          dataKey={dataKey}
          content={SplitLabel({
            rows,
            keys: STATUS_KEYS,
            outside: "top",
            dataKey,
            isActive: (row, key) => {
              const match = STATUS_SERIES.find((series) => `${series.status}${series.part}` === key);
              return Boolean(match && colored(row, match));
            },
          })}
        />
      </Bar>
    );
  });
}

export function sharePercent(value, total) {
  const base = Number(total) || 0;
  if (!base) return "0";
  const rounded = Math.round((100 * (Number(value) || 0)) / base);
  if (rounded === 0 && Number(value) > 0) return "<1";
  return String(rounded);
}

export function Tip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((item) => Number(item.value));
  if (!visible.length) return null;
  const stack = visible.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const base = visible.length > 1 ? stack : (total || stack);
  return (
    <div className="tip">
      {label ? <strong>{label}</strong> : null}
      {visible.map((item) => (
        <div key={item.dataKey}>
          {item.name}: {formatNumber(item.value)} ({sharePercent(item.value, base)}%)
        </div>
      ))}
    </div>
  );
}

export function SplitLabel({ rows, keys, isActive, dataKey, outside = "top" }) {
  return function renderSplit(props) {
    const row = rows?.[props.index];
    const box = props.viewBox;
    const key = dataKey || props.dataKey;
    if (!row || !box) return null;
    const value = key && row[key] != null ? Number(row[key]) || 0 : Number(props.value) || 0;
    const total = keys.reduce((sum, keyName) => sum + (Number(row[keyName]) || 0), 0);
    if (!value || !total) return null;
    if (isActive && !isActive(row, key)) return null;
    const { x, y, width, height } = box;
    const count = formatNumber(value);
    const pct = `${sharePercent(value, total)}%`;
    const line = `${count} (${pct})`;
    const wideEnough = width >= line.length * 6.6 + 8 && height >= 14;
    const tallEnough = height >= 26 && width >= Math.max(count.length, pct.length) * 6.4 + 6;
    if (wideEnough || tallEnough) {
      return (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={14}
          fontWeight={700}
        >
          {wideEnough ? line : (
            <>
              <tspan x={x + width / 2} dy="-6">{count}</tspan>
              <tspan x={x + width / 2} dy="13">{pct}</tspan>
            </>
          )}
        </text>
      );
    }
    const later = keys.slice(keys.indexOf(key) + 1).some((name) => Number(row[name]) > 0);
    if (later) return null;
    const atEnd = outside === "end";
    return (
      <text
        x={atEnd ? x + width + 4 : x + width / 2}
        y={atEnd ? y + height / 2 : y - 4}
        textAnchor={atEnd ? "start" : "middle"}
        dominantBaseline={atEnd ? "central" : "auto"}
        fill="#243e5a"
        fontSize={14}
        fontWeight={700}
      >
        {line}
      </text>
    );
  };
}

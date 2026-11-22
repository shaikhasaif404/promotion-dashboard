import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { COLORS, ChartCard, formatNumber, sharePercent, useHighlight } from "./chartUi.jsx";
import { useDashboard } from "../useDashboard.jsx";

const fill = { yes: COLORS.yes, no: COLORS.no, tbc: COLORS.tbc };
const RADIAN = Math.PI / 180;

function SliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  return (
    <text
      x={cx + radius * Math.cos(-midAngle * RADIAN)}
      y={cy + radius * Math.sin(-midAngle * RADIAN)}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={16}
      fontWeight={700}
    >
      {sharePercent(percent * 100, 100)}%
    </text>
  );
}

function OutcomeTip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value) || 0;
  const name = item.name || item.payload?.name;
  const key = item.payload?.key;
  const muted = Boolean(item.payload?.muted);
  const pct = sharePercent(value, total);
  return (
    <div className="tip">
      <strong>
        <i className="swatch" style={{ background: muted ? COLORS.gray : fill[key] }} />
        {name}
      </strong>
      <div>{formatNumber(value)}</div>
      <div>{pct}% من العدد الكلي</div>
    </div>
  );
}

function pieSlices(slices, statusOn) {
  const items = [];
  for (const slice of slices) {
    const matched = Math.min(slice.matched ?? slice.value, slice.value);
    const rest = slice.value - matched;
    if (!statusOn(slice.key)) {
      if (slice.value) items.push({ ...slice, id: slice.key, muted: true });
      continue;
    }
    if (matched) items.push({ ...slice, id: `${slice.key}-on`, value: matched, muted: false });
    if (rest) items.push({ ...slice, id: `${slice.key}-off`, value: rest, muted: true });
  }
  return items;
}

export default function OutcomeChart() {
  const { view, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const [activeKey, setActiveKey] = useState(null);
  const slices = pieSlices(view.slices, statusOn);
  return (
    <ChartCard
      title="نسبة الاستيفاء"
    >
      <div className="outcome-layout">
        <div className="outcome-chart" style={{ height: 210 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={84}
                paddingAngle={2}
                stroke="#fffcf8"
                isAnimationActive={false}
                label={SliceLabel}
                labelLine={false}
                onMouseEnter={(slice) => setActiveKey(slice?.key ?? slice?.payload?.key ?? null)}
                onMouseLeave={() => setActiveKey(null)}
                onClick={(slice) => {
                  const status = slice?.key ?? slice?.payload?.key;
                  const name = slice?.name ?? slice?.payload?.name;
                  if (status) pick({ title: name, status });
                }}
              >
                {slices.map((slice) => (
                  <Cell
                    key={slice.id}
                    fill={slice.muted ? COLORS.gray : fill[slice.key]}
                    opacity={activeKey && activeKey !== slice.key ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<OutcomeTip total={view.shown} />}
                isAnimationActive={false}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 20, outline: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="outcome-list">
          {view.slices.map((slice) => (
            <li
              key={slice.key}
              className={[
                activeKey === slice.key ? "is-active" : "",
                statusOn(slice.key) ? "" : "is-muted",
              ].filter(Boolean).join(" ") || undefined}
              onMouseEnter={() => setActiveKey(slice.key)}
              onMouseLeave={() => setActiveKey(null)}
            >
              <span>
                <i className="swatch" style={{ background: statusOn(slice.key) ? fill[slice.key] : COLORS.gray }} />
                {slice.name}
              </span>
              <b>
                {formatNumber(slice.value)}
                <span className="pct">({sharePercent(slice.value, view.shown)}%)</span>
              </b>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

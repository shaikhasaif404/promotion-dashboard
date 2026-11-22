import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, ChartCard, formatNumber, useHighlight } from "./chartUi.jsx";
import { useDashboard } from "../useDashboard.jsx";

function endLabel(props, rows, dataKey) {
  const row = rows[props.index];
  const box = props.viewBox;
  if (!row?.count || !box) return null;
  const isEnd = dataKey === "countOff" ? row.countOff > 0 : row.countOff === 0;
  if (!isEnd) return null;
  return (
    <text x={box.x + box.width + 6} y={box.y + box.height / 2} dominantBaseline="central" fill="#5e6874" fontSize={15} fontWeight={700}>
      {formatNumber(row.count)}
    </text>
  );
}

function BlockerTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((item) => Number(item.value));
  if (!visible.length) return null;
  return (
    <div className="tip">
      {label ? <strong>{label}</strong> : null}
      {visible.map((item) => (
        <div key={item.dataKey}>{item.name}: {formatNumber(item.value)}</div>
      ))}
    </div>
  );
}

function ReasonTick({ x, y, payload }) {
  const text = String(payload?.value ?? "");
  const splitAfter = text.startsWith("عدم استكمال ")
    ? "عدم استكمال"
    : text.startsWith("التقييم السنوي ")
      ? "التقييم السنوي"
      : "";
  const breakAt = splitAfter ? splitAfter.length : text.indexOf(" (");
  const lines = breakAt > 0
    ? [text.slice(0, breakAt), text.slice(breakAt + 1)]
    : [text];
  const start = lines.length > 1 ? -10 : 5;
  return (
    <text x={x} y={y} textAnchor="end" fill="#1b2430" fontSize={15}>
      {lines.map((line, index) => (
        <tspan key={line} x={x - 8} dy={index === 0 ? start : 18}>{line}</tspan>
      ))}
    </text>
  );
}

export default function BlockerChart() {
  const { view, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const barColor = statusOn("no") ? COLORS.no : COLORS.gray;
  return (
    <ChartCard title="أسباب عدم الاستيفاء (دون استكمال المدة المطلوبة للترقية)">
      <div style={{ height: Math.max(240, view.blockers.length * 64 + 16) }}>
        <ResponsiveContainer>
          <BarChart
            data={view.blockers}
            layout="vertical"
            margin={{ top: 4, right: 52, left: 8, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 15 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={248}
              tick={ReasonTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<BlockerTip />} />
            <Bar
              dataKey="countOn"
              name="غير مستوفي"
              stackId="b"
              fill={barColor}
              barSize={16}
              isAnimationActive={false}
              onClick={(row) => pick({ title: row.label, status: "no", reasonGroup: row.key })}
            >
              <LabelList content={(props) => endLabel(props, view.blockers, "countOn")} />
            </Bar>
            <Bar
              dataKey="countOff"
              name="غير مطابق"
              stackId="b"
              fill={COLORS.gray}
              radius={[0, 4, 4, 0]}
              barSize={16}
              isAnimationActive={false}
              onClick={(row) => pick({ title: row.label, status: "no", reasonGroup: row.key })}
            >
              <LabelList content={(props) => endLabel(props, view.blockers, "countOff")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="blocker-note">عدة أسباب (التقييم السنوي، الساعات التدريبية، جزاء، وصول السقف الوظيفي)</p>
    </ChartCard>
  );
}

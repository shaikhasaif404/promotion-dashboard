import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, ChartCard, Tip, formatNumber, sharePercent, useHighlight } from "./chartUi.jsx";
import { useDashboard } from "../useDashboard.jsx";

function endLabel(props, rows, total, dataKey) {
  const row = rows[props.index];
  const box = props.viewBox;
  if (!row?.count || !box) return null;
  const isEnd = dataKey === "countOff" ? row.countOff > 0 : row.countOff === 0;
  if (!isEnd) return null;
  return (
    <text x={box.x + box.width + 6} y={box.y + box.height / 2} dominantBaseline="central" fill="#5e6874" fontSize={11} fontWeight={700}>
      {`${formatNumber(row.count)} (${sharePercent(row.count, total)}%)`}
    </text>
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
  const start = lines.length > 1 ? -7 : 4;
  return (
    <text x={x} y={y} textAnchor="end" fill="#1b2430" fontSize={11}>
      {lines.map((line, index) => (
        <tspan key={line} x={x - 8} dy={index === 0 ? start : 14}>{line}</tspan>
      ))}
    </text>
  );
}

export default function BlockerChart() {
  const { view, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const total = view.blockers.reduce((sum, row) => sum + row.count, 0);
  const barColor = statusOn("no") ? COLORS.no : COLORS.gray;
  return (
    <ChartCard title="أسباب عدم الاستيفاء">
      <p className="blocker-note">عدة أسباب (التقييم السنوي، الساعات التدريبية، المدة المطلوبة، جزاء، الوصول إلى السقف الوظيفي)</p>
      <div style={{ height: Math.max(220, view.blockers.length * 52 + 16) }}>
        <ResponsiveContainer>
          <BarChart
            data={view.blockers}
            layout="vertical"
            margin={{ top: 4, right: 72, left: 8, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={210}
              tick={ReasonTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<Tip total={total} />} />
            <Bar
              dataKey="countOn"
              name="غير مستوفي"
              stackId="b"
              fill={barColor}
              barSize={16}
              isAnimationActive={false}
              onClick={(row) => pick({ title: row.label, status: "no", reasonGroup: row.key })}
            >
              <LabelList content={(props) => endLabel(props, view.blockers, total, "countOn")} />
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
              <LabelList content={(props) => endLabel(props, view.blockers, total, "countOff")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

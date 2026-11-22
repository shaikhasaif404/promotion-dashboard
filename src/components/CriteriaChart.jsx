import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, ChartCard, SplitLabel, Tip } from "./chartUi.jsx";
import { useDashboard } from "../useDashboard.jsx";

const CHECK_LABEL = { met: "مستوفى", notMet: "غير مستوفى", open: "قيد المراجعة" };

const CHECK_KEYS = ["metOn", "metOff", "notMetOn", "notMetOff", "openOn", "openOff"];

export default function CriteriaChart() {
  const { view, pick } = useDashboard();
  const choose = (criterionState) => (row) => pick({
    title: `${row.label} · ${CHECK_LABEL[criterionState]}`,
    criterion: row.key ?? row.label,
    criterionState,
  });
  return (
    <ChartCard
      title="معايير الاستيفاء"
    >
      <div className="legend">
        <span><i className="swatch" style={{ background: COLORS.yes }} />مستوفى</span>
        <span><i className="swatch" style={{ background: COLORS.no }} />غير مستوفى</span>
        <span><i className="swatch" style={{ background: COLORS.tbc }} />قيد المراجعة</span>
      </div>
      <div style={{ height: 250 }}>
        <ResponsiveContainer>
          <BarChart data={view.criteria} layout="vertical" margin={{ top: 4, right: 72, left: 4, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={168}
              tick={{ fontSize: 12, fill: "#1b2430" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<Tip />} />
            <Bar dataKey="metOn" name="مستوفى" stackId="c" fill={COLORS.yes} isAnimationActive={false} onClick={choose("met")}>
              <LabelList dataKey="metOn" content={SplitLabel({ rows: view.criteria, keys: CHECK_KEYS, dataKey: "metOn", outside: "end" })} />
            </Bar>
            <Bar dataKey="metOff" name="غير مطابق" stackId="c" fill={COLORS.gray} isAnimationActive={false} onClick={choose("met")} />
            <Bar dataKey="notMetOn" name="غير مستوفى" stackId="c" fill={COLORS.no} isAnimationActive={false} onClick={choose("notMet")}>
              <LabelList dataKey="notMetOn" content={SplitLabel({ rows: view.criteria, keys: CHECK_KEYS, dataKey: "notMetOn", outside: "end" })} />
            </Bar>
            <Bar dataKey="notMetOff" name="غير مطابق" stackId="c" fill={COLORS.gray} isAnimationActive={false} onClick={choose("notMet")} />
            <Bar dataKey="openOn" name="قيد المراجعة" stackId="c" fill={COLORS.tbc} isAnimationActive={false} onClick={choose("open")}>
              <LabelList dataKey="openOn" content={SplitLabel({ rows: view.criteria, keys: CHECK_KEYS, dataKey: "openOn", outside: "end" })} />
            </Bar>
            <Bar dataKey="openOff" name="غير مطابق" stackId="c" fill={COLORS.gray} radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={choose("open")} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { employees } from "../data/employees.js";
import { COLORS, ChartCard, Tip, formatNumber, sharePercent, tone, useHighlight } from "./chartUi.jsx";
import { personInCohort, useDashboard } from "../useDashboard.jsx";

const RANK = ["D", "G", "P", "E", "A"];

function classParts(label) {
  const match = String(label).match(/^([A-Z])\.(\d+)$/i);
  if (!match) return [RANK.length, Number.MAX_SAFE_INTEGER];
  const letter = RANK.indexOf(match[1].toUpperCase());
  return [letter === -1 ? RANK.length : letter, Number(match[2])];
}

function PayLabel(rows, dataKey) {
  return function render(props) {
    const row = rows[props.index];
    const box = props.viewBox;
    if (!row || !box || row[dataKey] == null) return null;
    const amount = formatNumber(row[dataKey], 0);
    const above = dataKey === "total";
    return (
      <text
        x={box.x + box.width / 2}
        y={box.y - (above ? 4 : 16)}
        textAnchor="middle"
        fill="#243e5a"
        fontSize={10}
        fontWeight={700}
      >
        {above ? `${amount} (${row.share}%)` : amount}
      </text>
    );
  };
}

function mean(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export default function PayChart() {
  const { filters, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const active = statusOn("yes");
  const rows = useMemo(() => {
    const map = new Map();
    for (const person of employees) {
      if (person.status !== "yes") continue;
      const grade = person.category;
      if (!grade || grade === "غير محدد") continue;
      if (!map.has(grade)) map.set(grade, { grade, basic: [], total: [], matched: false });
      const row = map.get(grade);
      if (person.basicDelta != null) row.basic.push(person.basicDelta);
      if (person.cost != null) row.total.push(person.cost);
      if (personInCohort(person, filters)) row.matched = true;
    }
    const counted = [...map.values()];
    const people = counted.reduce((sum, row) => sum + row.basic.length, 0);
    return counted
      .map((row) => ({
        grade: row.grade,
        basic: mean(row.basic),
        total: mean(row.total),
        share: sharePercent(row.basic.length, people),
        matched: row.matched,
      }))
      .filter((row) => row.basic != null || row.total != null)
      .sort((a, b) => {
        const [letterA, numberA] = classParts(a.grade);
        const [letterB, numberB] = classParts(b.grade);
        return letterA - letterB || numberA - numberB;
      });
  }, [filters]);
  const choose = (row) => pick({ title: `المستوفيون · ${row.grade}`, category: row.grade, status: "yes" });

  return (
    <ChartCard
      title="أثر الراتب للموظفين المستوفيين"
    >
      <div className="legend">
        <span><i className="swatch" style={{ background: COLORS.navy }} />متوسط زيادة الراتب الأساسي</span>
        <span><i className="swatch" style={{ background: COLORS.teal }} />متوسط زيادة الإجمالي</span>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 36, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="grade" interval={0} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="basic" name="متوسط زيادة الأساسي" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={choose}>
              {rows.map((row) => <Cell key={`basic-${row.grade}`} fill={tone(active && row.matched, COLORS.navy)} />)}
              <LabelList content={PayLabel(rows, "basic")} />
            </Bar>
            <Bar dataKey="total" name="متوسط زيادة الإجمالي" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={choose}>
              {rows.map((row) => <Cell key={`total-${row.grade}`} fill={tone(active && row.matched, COLORS.teal)} />)}
              <LabelList content={PayLabel(rows, "total")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

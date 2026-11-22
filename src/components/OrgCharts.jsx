import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, ChartCard, SeriesLegend, Tip, formatNumber, sharePercent, useHighlight, useStatusBars } from "./chartUi.jsx";
import { STATUS_LABEL, useDashboard } from "../useDashboard.jsx";

export function OrgTypeChart() {
  const { view, pick } = useDashboard();
  const bars = useStatusBars({
    rows: view.orgTypes,
    categoryKey: "label",
    onPick: (row, status) => pick({
      title: `${row.label} · ${STATUS_LABEL[status]}`,
      orgType: row.label,
      status,
    }),
  });
  return (
    <ChartCard
      title="الاستيفاء حسب نوع الوحدة"
    >
      <SeriesLegend />
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={view.orgTypes} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<Tip />} />
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function horizontalEndLabel(rows, total, dataKey) {
  return function render(props) {
    const row = rows[props.index];
    const box = props.viewBox;
    if (!row?.yes || !box) return null;
    const isEnd = dataKey === "yesOff" ? row.yesOff > 0 : row.yesOff === 0;
    if (!isEnd) return null;
    return (
      <text x={box.x + box.width + 6} y={box.y + box.height / 2} dominantBaseline="central" fill="#5e6874" fontSize={11} fontWeight={700}>
        {`${formatNumber(row.yes)} (${sharePercent(row.yes, total)}%)`}
      </text>
    );
  };
}

export function UnitChart() {
  const { view, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const unitTotal = view.units.reduce((sum, row) => sum + row.yes, 0);
  const yesColor = statusOn("yes") ? COLORS.yes : COLORS.gray;
  return (
    <ChartCard
      title="حسب القطاع / الإدارة"
    >
      <div style={{ height: Math.max(140, view.units.length * 26 + 16) }}>
        <ResponsiveContainer>
          <BarChart data={view.units} layout="vertical" margin={{ top: 4, right: 78, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="unit"
              width={230}
              tick={{ fontSize: 11, fill: "#1b2430" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<Tip total={unitTotal} />} />
            <Bar
              dataKey="yesOn"
              name="مستوفي"
              stackId="u"
              fill={yesColor}
              barSize={12}
              isAnimationActive={false}
              onClick={(row) => pick({ title: row.unit, unit: row.unit, status: "yes" })}
            >
              <LabelList content={horizontalEndLabel(view.units, unitTotal, "yesOn")} />
            </Bar>
            <Bar
              dataKey="yesOff"
              name="غير مطابق"
              stackId="u"
              fill={COLORS.gray}
              radius={[0, 4, 4, 0]}
              barSize={12}
              isAnimationActive={false}
              onClick={(row) => pick({ title: row.unit, unit: row.unit, status: "yes" })}
            >
              <LabelList content={horizontalEndLabel(view.units, unitTotal, "yesOff")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const UNIT_KEYS = ["yesOn", "yesOff", "noOn", "noOff"];

function UnitTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <strong>{label || row.unit}</strong>
      <div>مستوفي: {formatNumber(row.yes)}</div>
      <div>غير مستوفي: {formatNumber(row.no)}</div>
      <div>المجموع: {formatNumber(row.yes + row.no)}</div>
    </div>
  );
}

function unitBarLabel(rows, dataKey) {
  return function render(props) {
    const row = rows[props.index];
    const box = props.viewBox;
    const value = Number(row?.[dataKey]) || 0;
    if (!row || !box || !value) return null;
    const { x, y, width, height } = box;
    const text = formatNumber(value);
    const fits = width >= text.length * 7 + 4 && height >= 12;
    const later = UNIT_KEYS.slice(UNIT_KEYS.indexOf(dataKey) + 1).some((name) => Number(row[name]) > 0);
    const total = row.yes + row.no;
    return (
      <g>
        {fits ? (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={dataKey.endsWith("Off") ? "#1b2430" : "#fff"}
            fontSize={10}
            fontWeight={700}
          >
            {text}
          </text>
        ) : null}
        {!later && total ? (
          <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" fill="#5e6874" fontSize={11} fontWeight={700}>
            {formatNumber(total)}
          </text>
        ) : null}
      </g>
    );
  };
}

export function UnitTable() {
  const { view, pick } = useDashboard();
  const { statusOn } = useHighlight();
  const rows = view.units;
  const choose = (status) => (row) => pick({
    title: `${row.unit} · ${STATUS_LABEL[status]}`,
    unit: row.unit,
    status,
  });
  return (
    <ChartCard title="حسب القطاع / الإدارة / البعثة">
      <SeriesLegend />
      <div style={{ height: Math.max(180, rows.length * 28 + 24) }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="unit"
              width={230}
              tick={{ fontSize: 11, fill: "#1b2430" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<UnitTip />} />
            <Bar dataKey="yesOn" name="مستوفي" stackId="d" fill={statusOn("yes") ? COLORS.yes : COLORS.gray} barSize={14} isAnimationActive={false} onClick={choose("yes")}>
              <LabelList content={unitBarLabel(rows, "yesOn")} />
            </Bar>
            <Bar dataKey="yesOff" name="غير مطابق" stackId="d" fill={COLORS.gray} barSize={14} isAnimationActive={false} onClick={choose("yes")}>
              <LabelList content={unitBarLabel(rows, "yesOff")} />
            </Bar>
            <Bar dataKey="noOn" name="غير مستوفي" stackId="d" fill={statusOn("no") ? COLORS.no : COLORS.gray} barSize={14} isAnimationActive={false} onClick={choose("no")}>
              <LabelList content={unitBarLabel(rows, "noOn")} />
            </Bar>
            <Bar dataKey="noOff" name="غير مطابق" stackId="d" fill={COLORS.gray} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} onClick={choose("no")}>
              <LabelList content={unitBarLabel(rows, "noOff")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function yearLabel(props, rows, total, dataKey) {
  const row = rows[props.index];
  const box = props.viewBox;
  if (!row?.count || !box || box.height < 16) return null;
  const isTop = dataKey === "countOff" ? row.countOff > 0 : row.countOff === 0;
  if (!isTop) return null;
  return (
    <text x={box.x + box.width / 2} y={box.y - 4} textAnchor="middle" fill="#5e6874" fontSize={10} fontWeight={700}>
      {`${formatNumber(row.count)} (${sharePercent(row.count, total)}%)`}
    </text>
  );
}

export function ExpectedYearChart() {
  const { view, pick } = useDashboard();
  const dated = view.expectedYear.reduce((sum, row) => sum + row.count, 0);
  return (
    <ChartCard
      title="سنة الترقية المفترضة"
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={view.expectedYear} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<Tip total={dated} />} />
            <Bar
              dataKey="countOn"
              name="موظفون"
              stackId="y"
              fill={COLORS.navy}
              isAnimationActive={false}
              onClick={(row) => pick({ title: `سنة ${row.year}`, year: row.year })}
            >
              <LabelList content={(props) => yearLabel(props, view.expectedYear, dated, "countOn")} />
            </Bar>
            <Bar
              dataKey="countOff"
              name="غير مطابق"
              stackId="y"
              fill={COLORS.gray}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              onClick={(row) => pick({ title: `سنة ${row.year}`, year: row.year })}
            >
              <LabelList content={(props) => yearLabel(props, view.expectedYear, dated, "countOff")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

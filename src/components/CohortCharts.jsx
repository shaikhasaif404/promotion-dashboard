import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { employees } from "../data/employees.js";
import { COLORS, ChartCard, SeriesLegend, Tip, formatNumber, sharePercent, tone, useHighlight, useStatusBars } from "./chartUi.jsx";
import { STATUS_LABEL, categoryName, personInCohort, useDashboard } from "../useDashboard.jsx";

function Stacked({ data, categoryKey, height, onPick, rowActive, dense, tick, tooltip }) {
  const bars = useStatusBars({
    rows: data,
    categoryKey,
    rowActive,
    onPick: (row, status) => onPick(row[categoryKey], status),
  });
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: tick ? 28 : (dense ? 8 : 0) }}>
          <XAxis
            dataKey={categoryKey}
            interval={dense ? 0 : undefined}
            tick={tick ?? { fontSize: dense ? 11 : 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={tooltip ?? <Tip />} />
          {bars}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CATEGORY_RANK = ["D", "G", "P", "E", "A"];

function classParts(label) {
  const match = String(label).match(/^([A-Z])\.(\d+)$/i);
  if (!match) return [CATEGORY_RANK.length, Number.MAX_SAFE_INTEGER];
  const letter = CATEGORY_RANK.indexOf(match[1].toUpperCase());
  return [letter === -1 ? CATEGORY_RANK.length : letter, Number(match[2])];
}

function GradeTick({ x, y, payload }) {
  const [code, ...rest] = categoryName(payload.value).split(" ");
  return (
    <text x={x} y={y} textAnchor="middle" fill="#1b2430" fontSize={11}>
      <tspan x={x} dy="14">{code}</tspan>
      <tspan x={x} dy="14">{rest.join(" ")}</tspan>
    </text>
  );
}

function GradeTip(props) {
  return <Tip {...props} label={categoryName(props.label)} />;
}

function mergedGrade(person) {
  if (person.category && person.category !== "غير محدد") return person.category;
  return person.grade || "";
}

export function GradeChart() {
  const { pick, filters } = useDashboard();
  const { rowOn } = useHighlight();
  const grades = useMemo(() => {
    const map = new Map();
    for (const person of employees) {
      const label = mergedGrade(person);
      if (!label) continue;
      if (!map.has(label)) {
        map.set(label, {
          grade: label,
          category: person.category,
          yes: 0,
          no: 0,
          tbc: 0,
          yesOn: 0,
          yesOff: 0,
          noOn: 0,
          noOff: 0,
          tbcOn: 0,
          tbcOff: 0,
        });
      }
      const row = map.get(label);
      if (person.status !== "yes" && person.status !== "no" && person.status !== "tbc") continue;
      const on = personInCohort(person, filters);
      row[person.status] += 1;
      row[`${person.status}${on ? "On" : "Off"}`] += 1;
    }
    return [...map.values()].sort((a, b) => {
      const [letterA, numberA] = classParts(a.grade);
      const [letterB, numberB] = classParts(b.grade);
      return letterA - letterB || numberA - numberB;
    });
  }, [filters]);
  return (
    <ChartCard
      title="الاستيفاء حسب الدرجة الحالية"
    >
      <SeriesLegend />
      <Stacked
        data={grades}
        categoryKey="grade"
        height={320}
        dense
        tick={<GradeTick />}
        tooltip={<GradeTip />}
        rowActive={(row) => rowOn(row, { categoryKey: "category" })}
        onPick={(grade, status) => {
          const combined = String(grade).match(/^([A-Z])\.(\d+)$/i);
          pick({
            title: `${categoryName(grade)} · ${STATUS_LABEL[status]}`,
            category: combined ? grade : undefined,
            grade: combined ? combined[2] : grade,
            status,
          });
        }}
      />
    </ChartCard>
  );
}

export function TenureChart() {
  const { view, pick } = useDashboard();
  return (
    <ChartCard
      title="المدة من آخر ترقية"
    >
      <SeriesLegend />
      <Stacked
        data={view.yearsSince}
        categoryKey="label"
        height={240}
        onPick={(tenure, status) => pick({ title: `المدة ${tenure} · ${STATUS_LABEL[status]}`, tenure, status })}
      />
    </ChartCard>
  );
}

function MissionLabel({ rows, status }) {
  return function render(props) {
    const row = rows[props.index];
    const box = props.viewBox;
    if (!row || !box) return null;
    const count = row[status];
    if (!count) return null;
    const share = status === "yes" ? row.yesShare : row.noShare;
    return (
      <text
        x={box.x + box.width / 2}
        y={box.y - 6}
        textAnchor="middle"
        fill="#243e5a"
        fontSize={11}
        fontWeight={700}
      >
        {`${formatNumber(count)} (${share}%)`}
      </text>
    );
  };
}

function MissionTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <strong>{row.label}</strong>
      <div>مستوفي: {formatNumber(row.yes)} ({row.yesShare}% من {formatNumber(row.yesTotal)})</div>
      <div>غير مستوفي: {formatNumber(row.no)} ({row.noShare}% من {formatNumber(row.noTotal)})</div>
    </div>
  );
}

export function MissionChart() {
  const { pick, filters } = useDashboard();
  const { statusOn } = useHighlight();
  const model = useMemo(() => {
    const groups = [
      { label: "البعثة", mission: true, yes: 0, no: 0 },
      { label: "مقر الوزارة", mission: false, yes: 0, no: 0 },
    ];
    for (const person of employees) {
      if ((person.status !== "yes" && person.status !== "no") || !personInCohort(person, filters)) continue;
      const row = groups[person.orgType === "بعثة" ? 0 : 1];
      row[person.status] += 1;
    }
    const yesTotal = groups[0].yes + groups[1].yes;
    const noTotal = groups[0].no + groups[1].no;
    return {
      yesTotal,
      noTotal,
      rows: groups.map((row) => ({
        ...row,
        yesTotal,
        noTotal,
        yesShare: sharePercent(row.yes, yesTotal),
        noShare: sharePercent(row.no, noTotal),
      })),
    };
  }, [filters]);
  const choose = (status) => (row) => pick({
    title: `${row.label} · ${STATUS_LABEL[status]}`,
    mission: row.mission,
    status,
  });
  return (
    <ChartCard
      title="الاستيفاء حسب مقر العمل"
    >
      <div className="legend">
        <span className={statusOn("yes") ? undefined : "is-muted"}>
          <i className="swatch" style={{ background: statusOn("yes") ? COLORS.yes : COLORS.gray }} />
          مستوفي · من {formatNumber(model.yesTotal)}
        </span>
        <span className={statusOn("no") ? undefined : "is-muted"}>
          <i className="swatch" style={{ background: statusOn("no") ? COLORS.no : COLORS.gray }} />
          غير مستوفي · من {formatNumber(model.noTotal)}
        </span>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={model.rows} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<MissionTip />} />
            <Bar dataKey="yes" name="مستوفي" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={choose("yes")}>
              {model.rows.map((row) => (
                <Cell key={`${row.label}-yes`} fill={tone(statusOn("yes"), COLORS.yes)} />
              ))}
              <LabelList dataKey="yes" content={MissionLabel({ rows: model.rows, status: "yes" })} />
            </Bar>
            <Bar dataKey="no" name="غير مستوفي" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={choose("no")}>
              {model.rows.map((row) => (
                <Cell key={`${row.label}-no`} fill={tone(statusOn("no"), COLORS.no)} />
              ))}
              <LabelList dataKey="no" content={MissionLabel({ rows: model.rows, status: "no" })} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

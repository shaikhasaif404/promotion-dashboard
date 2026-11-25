import { createContext, useContext, useMemo, useState } from "react";
import { employees } from "./data/employees.js";
import {
  appraisal,
  categories,
  criteria,
  expectedYear,
  grades,
  orgTypes,
  outcome,
  pay,
  units,
  yearsSince,
} from "./data/promotions.js";

export const STATUS_LABEL = { yes: "مستوفي", no: "غير مستوفي", tbc: "قيد المراجعة" };

export const CATEGORY_NAMES = {
  "D.1": "D.1 ملحق دبلوماسي",
  "D.2": "D.2 سكرتير ثالث",
  "D.3": "D.3 سكرتير ثاني",
  "D.4": "D.4 سكرتير أول",
  "D.5": "D.5 مستشار ب",
  "D.6": "D.6 مستشار أ",
  "D.7": "D.7 وزير مفوض",
};

export function categoryName(code) {
  return CATEGORY_NAMES[code] ?? code;
}

const CEILING_LABEL = "وصول السقف الوظيفي";

export function displayText(value) {
  return String(value ?? "")
    .replaceAll("تجاوز السقف الوظيفي", CEILING_LABEL)
    .replaceAll("الوصول إلى السقف الوظيفي", CEILING_LABEL)
    .replaceAll("الوصول إلى السقف", CEILING_LABEL)
    .replaceAll("وصل السقف الوظيفي", CEILING_LABEL);
}

export const REASON_GROUPS = [
  { key: "training", label: "عدم استكمال الساعات التدريبية" },
  { key: "appraisal", label: "التقييم السنوي أقل من جيد" },
  { key: "penalty", label: "جزاء فقط" },
  { key: "multi", label: "عدة أسباب" },
];

const SEVERAL_REASONS = new Set([
  "جزاء او إنذار / الساعات التدريبية",
  "وصل السقف الوظيفي",
  "وصول السقف الوظيفي",
  "التقييم السنوي / الساعات التدريبية",
  "إجازة من غير راتب",
  "انهاء خدمة",
  "وصل السقف الوظيفي / الساعات التدريبية",
  "وصول السقف الوظيفي / الساعات التدريبية",
  "تجاوز السقف الوظيفي / إنهاء خدمة",
  "وصول السقف الوظيفي / إنهاء خدمة",
  "الساعات التدريبية / تجاوز السقف الوظيفي",
  "الساعات التدريبية / وصول السقف الوظيفي",
]);

/** أسباب عدم الاستيفاء: BQ = No only, and the reason text is column BS. */
export function reasonGroup(person) {
  if (person.decision !== "no") return null;
  const text = String(person.hrRemark ?? "").trim();
  if (!text) return null;
  if (text === "الساعات التدريبية") return "training";
  if (text === "التقييم السنوي") return "appraisal";
  if (SEVERAL_REASONS.has(text)) return "multi";
  return null;
}

function shownYear(year) {
  const value = Number(year);
  if (!Number.isFinite(value)) return "";
  return String(value < 2026 ? 2026 : value);
}

function personMatches(person, filters, picked) {
  if (filters.status !== "all" && person.status !== filters.status) return false;
  if (filters.unit !== "all" && person.unit !== filters.unit) return false;
  if (filters.category !== "all" && person.category !== filters.category) return false;
  const query = filters.q.trim();
  if (query && !`${person.name} ${person.unit} ${person.job} ${person.reason ?? ""} ${person.hrRemark ?? ""}`.includes(query)) return false;
  if (picked.status && person.status !== picked.status) return false;
  if (picked.grade && person.grade !== picked.grade) return false;
  if (picked.category && person.category !== picked.category) return false;
  if (picked.unit && person.unit !== picked.unit) return false;
  if (picked.orgType && person.orgType !== picked.orgType) return false;
  if (picked.mission === true && person.orgType !== "بعثة") return false;
  if (picked.mission === false && person.orgType === "بعثة") return false;
  if (picked.tenure && person.tenure !== picked.tenure) return false;
  if (picked.appraisal && person.appraisal !== picked.appraisal) return false;
  if (picked.year && shownYear(person.year) !== String(picked.year)) return false;
  if (picked.reason && !String(person.reason ?? "").split("//").some((part) => part.trim() === picked.reason)) return false;
  if (picked.reasonGroup && reasonGroup(person) !== picked.reasonGroup) return false;
  if (picked.criterion && person.checks[picked.criterion] !== picked.criterionState) return false;
  return true;
}

const EMPTY_FILTERS = { q: "", status: "all", unit: "all", category: "all" };

const DashboardContext = createContext(null);

export function personInCohort(person, filters) {
  if (filters.unit !== "all" && person.unit !== filters.unit) return false;
  if (filters.category !== "all" && person.category !== filters.category) return false;
  const query = filters.q.trim();
  if (query && !`${person.name} ${person.unit} ${person.job} ${person.reason ?? ""} ${person.hrRemark ?? ""}`.includes(query)) return false;
  return true;
}

export function cohortActive(filters) {
  return filters.unit !== "all" || filters.category !== "all" || Boolean(filters.q.trim());
}

function cohortTitle(filters) {
  const parts = [];
  if (filters.q.trim()) parts.push(filters.q.trim());
  if (filters.unit !== "all") parts.push(filters.unit);
  if (filters.category !== "all") parts.push(categoryName(filters.category));
  if (filters.status !== "all") parts.push(STATUS_LABEL[filters.status]);
  return parts.join(" · ");
}

function blankStatus(extra) {
  return {
    yes: 0,
    no: 0,
    tbc: 0,
    yesOn: 0,
    yesOff: 0,
    noOn: 0,
    noOff: 0,
    tbcOn: 0,
    tbcOff: 0,
    ...extra,
  };
}

function addStatus(row, status, on) {
  if (!row || (status !== "yes" && status !== "no" && status !== "tbc")) return;
  row[status] += 1;
  row[`${status}${on ? "On" : "Off"}`] += 1;
}

function buildView(filters) {
  const yes = outcome.entitled;
  const no = outcome.notEntitled;
  const tbc = outcome.tbc;
  const categoryRows = new Map(categories.map((row) => [row.label, blankStatus({ label: row.label })]));
  const orgRows = new Map(orgTypes.map((row) => [row.label, blankStatus({ label: row.label })]));
  const tenureRows = new Map(yearsSince.map((row) => [row.label, blankStatus({ label: row.label })]));
  const appraisalRows = new Map(appraisal.map((row) => [row.label, blankStatus({ label: row.label })]));
  const unitRows = new Map();
  const blockerRows = new Map(REASON_GROUPS.map((group) => [group.key, { ...group, count: 0, countOn: 0, countOff: 0 }]));
  const criteriaRows = new Map();
  const yearRows = new Map(expectedYear.map((row) => [String(row.year), { year: String(row.year), count: 0, countOn: 0, countOff: 0 }]));
  const outcomeOn = { yes: 0, no: 0, tbc: 0 };
  const payMatch = {};

  for (const person of employees) {
    const on = personInCohort(person, filters);
    if (on) outcomeOn[person.status] += 1;
    addStatus(categoryRows.get(person.category), person.status, on);
    addStatus(orgRows.get(person.orgType), person.status, on);
    addStatus(tenureRows.get(person.tenure), person.status, on);
    addStatus(appraisalRows.get(person.appraisal), person.status, on);
    if (!unitRows.has(person.unit)) unitRows.set(person.unit, blankStatus({ unit: person.unit }));
    addStatus(unitRows.get(person.unit), person.status, on);
    const group = reasonGroup(person);
    if (group) {
      const row = blockerRows.get(group);
      row.count += 1;
      row[on ? "countOn" : "countOff"] += 1;
    }
    for (const [label, state] of Object.entries(person.checks ?? {})) {
      if (state !== "met" && state !== "notMet" && state !== "open") continue;
      if (!criteriaRows.has(label)) {
        criteriaRows.set(label, {
          label,
          met: 0,
          notMet: 0,
          open: 0,
          metOn: 0,
          metOff: 0,
          notMetOn: 0,
          notMetOff: 0,
          openOn: 0,
          openOff: 0,
        });
      }
      const row = criteriaRows.get(label);
      row[state] += 1;
      row[`${state}${on ? "On" : "Off"}`] += 1;
    }
    const year = shownYear(person.year);
    if (year && yearRows.has(year)) {
      const row = yearRows.get(year);
      row.count += 1;
      row[on ? "countOn" : "countOff"] += 1;
    }
    if (person.status === "yes" && person.grade) payMatch[person.grade] = Boolean(payMatch[person.grade] || on);
  }

  const kpi = { yes: 0, no: 0, tbc: 0, entitledCost: 0 };
  for (const person of employees) {
    if (!personInCohort(person, filters)) continue;
    if (filters.status !== "all" && person.status !== filters.status) continue;
    if (person.status === "yes" || person.status === "no" || person.status === "tbc") kpi[person.status] += 1;
    if (person.cost == null) continue;
    if (person.status === "yes") kpi.entitledCost += person.cost;
  }
  kpi.entitledCost = Math.round((kpi.entitledCost + Number.EPSILON) * 100) / 100;
  kpi.shown = kpi.yes + kpi.no + kpi.tbc;

  const unitOrder = new Map(units.map((row, index) => [row.unit, index]));
  return {
    yes,
    no,
    tbc,
    shown: yes + no + tbc,
    cohortActive: cohortActive(filters),
    slices: [
      { key: "yes", name: "مستوفي", value: yes, matched: outcomeOn.yes },
      { key: "no", name: "غير مستوفي", value: no, matched: outcomeOn.no },
    ],
    units: [...unitRows.values()]
      .filter((row) => row.yes > 0)
      .sort((a, b) => b.yes - a.yes || (unitOrder.get(a.unit) ?? 999) - (unitOrder.get(b.unit) ?? 999)),
    categories: categories.map((row) => categoryRows.get(row.label)),
    grades,
    orgTypes: orgTypes.map((row) => orgRows.get(row.label)),
    yearsSince: yearsSince.map((row) => tenureRows.get(row.label)),
    appraisal: appraisal.map((row) => appraisalRows.get(row.label)),
    blockers: REASON_GROUPS.map((group) => blockerRows.get(group.key)).sort((a, b) => b.count - a.count),
    criteria: criteria
      .filter((row) => row.label !== "الالتحاق خلال 2026" && row.label !== "مكافأة خلال العام")
      .map((row) => {
        const counted = criteriaRows.get(row.label);
        if (!counted) return null;
        const label = row.label === "تجاوز السقف الوظيفي" ? "وصول السقف الوظيفي" : row.label;
        return { ...counted, label, key: row.label };
      })
      .filter(Boolean),
    expectedYear: expectedYear
      .filter((row) => Number(row.year) >= 2026)
      .map((row) => yearRows.get(String(row.year))),
    kpi,
    pay: { ...pay, basicSum: kpi.entitledCost },
    payMatch,
  };
}

export function DashboardProvider({ children }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [picked, setPicked] = useState(null);
  const view = useMemo(() => buildView(filters), [filters]);
  const filtering = cohortActive(filters);
  const people = useMemo(
    () => (picked || filtering ? employees.filter((person) => personMatches(person, filters, picked ?? {})) : []),
    [filters, picked, filtering],
  );

  const value = useMemo(() => ({
    filters,
    setFilters,
    view,
    units,
    categories,
    picked,
    people,
    showPeople: Boolean(picked) || filtering,
    listTitle: picked?.title || cohortTitle(filters),
    pick: (next) => setPicked(next),
    clearPick: () => setPicked(null),
    resetFilters: () => {
      setFilters(EMPTY_FILTERS);
      setPicked(null);
    },
  }), [filters, view, picked, people]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  return useContext(DashboardContext);
}

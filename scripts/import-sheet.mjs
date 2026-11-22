/**
 * Rebuild src/data/employees.js and src/data/promotions.js from DSO_Data.xlsx.
 * Sheet: الكشف (2). Names stay; CPR and employee ID are not copied.
 *
 * Run from the project folder:
 *   powershell -File scripts/import-data.ps1
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workbookPath = path.join(root, "src", "data", "DSO_Data.xlsx");
const SHEET_NAME = "الكشف (2)";

const CHECKS = [
  { match: "الساعات التدريبية", label: "الساعات التدريبية" },
  { match: "المدة المطلوبة", label: "المدة المطلوبة" },
  { match: "التقييم السنوي", label: "التقييم السنوي" },
  { match: "تجاوز السقف الوظيفي", label: "تجاوز السقف الوظيفي" },
  { match: "حصل على مكافأة", label: "مكافأة خلال العام" },
  { match: "جزاء أو إنذار", label: "جزاء أو إنذار" },
  { match: "الالتحاق", label: "الالتحاق خلال 2026" },
];

const CRITERIA_ORDER = [
  "المدة المطلوبة",
  "تجاوز السقف الوظيفي",
  "الساعات التدريبية",
  "التقييم السنوي",
  "جزاء أو إنذار",
];

const CATEGORY_ORDER = ["D", "G", "P", "E", "A", "غير محدد"];
const ORG_ORDER = ["قطاع", "إدارة", "مكتب", "بعثة", "أخرى"];
const TENURE_ORDER = ["0–2", "2–4", "4–6", "6–8", "8+"];
const APPRAISAL_ORDER = ["ممتاز", "جيد جداً", "جيد", "متوسط", "ضعيف"];
const RATINGS = new Set(APPRAISAL_ORDER);
const BUCKETS = ["decrease", "0", "1–50", "51–150", "151–300", "301–500", "500+"];

function decode(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function unzip(xlsx) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promo-import-"));
  const zip = path.join(dir, "book.zip");
  const dest = path.join(dir, "unzipped");
  fs.copyFileSync(xlsx, zip);
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
    { stdio: "inherit" },
  );
  return path.join(dest, "xl");
}

function sharedStrings(xml) {
  const strings = [];
  const cleaned = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").replace(/<phoneticPr\b[^>]*\/>/g, "");
  for (const match of cleaned.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(decode([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
  }
  return strings;
}

function cellValue(attrs, inner, strings) {
  const type = /(?:^|\s)t="([^"]+)"/.exec(attrs)?.[1];
  if (type === "inlineStr") {
    return decode([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")).trim();
  }
  const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (raw == null) return "";
  if (type === "s") return (strings[Number(raw)] ?? "").trim();
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  return decode(raw).trim();
}

function readRows(sheetXml, strings) {
  const rows = [];
  // A self-closing cell ends in "/>". Treating that slash as part of the attributes
  // makes the next cell's contents look like they belong to the empty cell, which dropped BQ.
  const cellRe = /<c\b([^>/]*?)\br="([A-Z]+)(\d+)"([^>/]*?)(\/>|>([\s\S]*?)<\/c>)/g;
  for (const row of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cell of row[2].matchAll(cellRe)) {
      const inner = cell[5] === "/>" ? "" : cell[6] || "";
      cells[cell[2]] = inner ? cellValue(`${cell[1]} ${cell[4]}`, inner, strings) : "";
    }
    rows.push({ index: Number(row[1]), cells });
  }
  return rows;
}

function sheetPath(xlDir) {
  const workbook = fs.readFileSync(path.join(xlDir, "workbook.xml"), "utf8");
  const rels = fs.readFileSync(path.join(xlDir, "_rels", "workbook.xml.rels"), "utf8");
  const sheet = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*>/g)].find((match) => match[1] === SHEET_NAME);
  if (!sheet) {
    const names = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map((match) => match[1]);
    throw new Error(`Sheet ${SHEET_NAME} was not found. Sheets: ${names.join(", ")}`);
  }
  const relId = /r:id="([^"]+)"/.exec(sheet[0])?.[1];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].find((match) => match[0].includes(`Id="${relId}"`));
  const target = /Target="([^"]+)"/.exec(rel?.[0] ?? "")?.[1];
  if (!target) throw new Error(`Could not locate the worksheet file for ${SHEET_NAME}.`);
  return path.join(xlDir, target.replace(/^\/?xl\//, ""));
}

function colIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function headerMap(rows) {
  const header = rows
    .filter((row) => row.index <= 8)
    .find((row) => Object.values(row.cells).some((value) => String(value).includes("الإسم")));
  if (!header) throw new Error("Could not find the header row (الإسم) in the first 8 rows.");
  return { index: header.index, cells: header.cells };
}

function columnsOf(cells, test) {
  return Object.entries(cells)
    .filter(([, value]) => test(String(value).replace(/\s+/g, " ").trim()))
    .sort((a, b) => colIndex(a[0]) - colIndex(b[0]))
    .map(([col]) => col);
}

function requireColumn(cols, label) {
  if (!cols[0]) throw new Error(`Missing column: ${label}`);
  return cols[0];
}

function yesNoScore(rows, headerIndex, col) {
  let hits = 0;
  for (const row of rows) {
    if (row.index <= headerIndex) continue;
    const value = String(row.cells[col] || "").trim().toLowerCase();
    if (value === "yes" || value === "no" || value === "tbc" || value === "نعم" || value === "لا") hits += 1;
  }
  return hits;
}

function resolveColumns(cells, rows, headerIndex) {
  const text = (value) => String(value).replace(/\s+/g, " ").trim();
  const byHeader = (test) => columnsOf(cells, (value) => test(text(value)));
  const basics = byHeader((value) => value.includes("الراتب الأساسي"));
  const totals = byHeader((value) => /^total\d*$/i.test(value));
  const categories = byHeader((value) => value.toLowerCase() === "grade category");
  const checks = {};
  for (const check of CHECKS) {
    const cols = byHeader((value) => value.includes(check.match));
    if (!cols.length) throw new Error(`Missing column: ${check.label}`);
    checks[check.label] = cols
      .slice()
      .sort((a, b) => yesNoScore(rows, headerIndex, b) - yesNoScore(rows, headerIndex, a) || colIndex(b) - colIndex(a))[0];
  }
  const columns = {
    name: requireColumn(byHeader((value) => value.includes("الإسم")), "الإسم"),
    service: requireColumn(byHeader((value) => value.includes("سنوات الخدمة")), "سنوات الخدمة"),
    unit: requireColumn(byHeader((value) => value.includes("القطاع")), "القطاع / الإدارة / البعثة"),
    job: requireColumn(byHeader((value) => value.includes("الوظيفة الحالية")), "الوظيفة الحالية"),
    appraisal: requireColumn(byHeader((value) => value.includes("تقييم")), "تقييم"),
    tenure: requireColumn(
      byHeader((value) => value.includes("المدة من آخر") && value.includes("ترقية") && !value.includes("المفترضة")),
      "المدة من آخر ترقية",
    ),
    year: requireColumn(byHeader((value) => value.includes("تاريخ الترقية المفترضة")), "تاريخ الترقية المفترضة"),
    category: requireColumn(categories, "Grade Category"),
    grade: requireColumn(byHeader((value) => value.includes("الدرجة الحالية")), "الدرجة الحالية"),
    basicNow: requireColumn(basics, "الراتب الأساسي"),
    basicNext: basics[1],
    totalNow: requireColumn(totals, "total"),
    totalNext: totals[1],
    decision: "BQ",
    reason: requireColumn(byHeader((value) => value.includes("سبب عدم الاستحقاق")), "سبب عدم الاستحقاق"),
    checks,
  };
  if (!columns.basicNext || !columns.totalNext) {
    throw new Error("The sheet needs both the current and promoted salary columns (الراتب الأساسي and total).");
  }
  const decisionHeader = text(cells.BQ || "");
  if (!decisionHeader.includes("مستحق")) {
    throw new Error(`Column BQ header is "${decisionHeader}". Expected مستحق نعم / لا.`);
  }
  if (!/^total\d*$/i.test(text(cells.AM || ""))) {
    throw new Error(`Column AM header is "${text(cells.AM || "")}". Expected the current total.`);
  }
  if (!/^total\d*$/i.test(text(cells.BC || ""))) {
    throw new Error(`Column BC header is "${text(cells.BC || "")}". Expected the total after promotion.`);
  }
  return columns;
}

function decisionOf(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "yes" || text === "نعم") return "yes";
  if (text === "no" || text === "لا") return "no";
  return "";
}

function statusOf(value) {
  return decisionOf(value) === "yes" ? "yes" : "no";
}

function checkState(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "yes" || text === "نعم") return "met";
  if (text === "no" || text === "لا") return "notMet";
  return "open";
}

function tenureBand(value) {
  const match = String(value || "").match(/(\d+)\s*Years?\s*(\d+)\s*Months?/i);
  if (!match) return "";
  const years = Number(match[1]) + Number(match[2]) / 12;
  if (years < 2) return "0–2";
  if (years < 4) return "2–4";
  if (years < 6) return "4–6";
  if (years < 8) return "6–8";
  return "8+";
}

function excelYear(value) {
  const text = String(value || "").trim();
  if (/^(19|20)\d{2}$/.test(text)) return text;
  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return "";
  const year = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).getUTCFullYear();
  if (year < 1990 || year > 2100) return "";
  return String(year);
}

function unitName(value) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("#")) return "أخرى";
  return text.split("/")[0].trim() || "أخرى";
}

function orgType(unit) {
  if (unit.startsWith("قطاع")) return "قطاع";
  if (unit.startsWith("إدارة")) return "إدارة";
  if (unit.startsWith("مكتب")) return "مكتب";
  if (unit.startsWith("بعثة")) return "بعثة";
  return "أخرى";
}

function cleanText(value) {
  const text = String(value || "").trim();
  return text.startsWith("#") ? "" : text;
}

/** Grade Category plus الدرجة الحالية, written D.1, D.2, and so on. */
function gradeClass(categoryRaw, gradeRaw) {
  const category = String(categoryRaw || "").trim();
  const grade = cleanText(gradeRaw);
  const already = category.match(/^([A-Za-z])\s*\.\s*0*(\d+)$/);
  if (already) return `${already[1].toUpperCase()}.${Number(already[2])}`;
  const letter = category.match(/^([A-Za-z])$/)?.[1];
  const number = grade.match(/^0*(\d+)$/)?.[1];
  if (letter && number) return `${letter.toUpperCase()}.${Number(number)}`;
  if (!category || /^no$/i.test(category) || category.startsWith("#")) return "غير محدد";
  return category;
}

function gradeClassRank(label) {
  if (label === "غير محدد") return [CATEGORY_ORDER.length, 0];
  const match = String(label).match(/^([A-Za-z])\.(\d+)$/);
  if (!match) return [CATEGORY_ORDER.length - 1, 0];
  const letterIndex = CATEGORY_ORDER.indexOf(match[1].toUpperCase());
  return [letterIndex === -1 ? CATEGORY_ORDER.length - 1 : letterIndex, Number(match[2])];
}

const PENALTY_REASON = "جزاء أو إنذار كتابي";

const BLOCKER_LABEL = {
  "المدة المطلوبة": "المدة المطلوبة",
  "تجاوز السقف الوظيفي": "تجاوز السقف الوظيفي",
  "الساعات التدريبية": "الساعات التدريبية",
  "التقييم السنوي": "التقييم السنوي",
  "مكافأة خلال العام": "حصل على مكافأة خلال العام",
  "جزاء أو إنذار": PENALTY_REASON,
  "الالتحاق خلال 2026": "الالتحاق خلال 2026",
};

function reasonPart(value) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("#")) return "";
  if (/جزاء|إنذار|انذار/.test(text)) return PENALTY_REASON;
  if (text.includes("مكافأة")) return BLOCKER_LABEL["مكافأة خلال العام"];
  return text;
}

function numberOf(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  if (sorted.length % 2) return round2(sorted[mid]);
  return round2((sorted[mid - 1] + sorted[mid]) / 2);
}

function tally(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.label)) map.set(row.label, { label: row.label, yes: 0, no: 0, tbc: 0 });
    map.get(row.label)[row.status] += 1;
  }
  return map;
}

function orderMap(map, order) {
  const rows = [...map.values()];
  const rank = (label) => {
    const index = order.indexOf(label);
    return index === -1 ? order.length : index;
  };
  return rows.sort((a, b) => rank(a.label) - rank(b.label) || b.yes + b.no + b.tbc - (a.yes + a.no + a.tbc));
}

function bucketOf(value) {
  if (value < 0) return "decrease";
  if (value === 0) return "0";
  if (value <= 50) return "1–50";
  if (value <= 150) return "51–150";
  if (value <= 300) return "151–300";
  if (value <= 500) return "301–500";
  return "500+";
}

function isHidden(value) {
  const text = String(value ?? "").trim();
  return text === "1" || Number(text) === 1;
}

function build(rows, columns) {
  const dataRows = rows.filter((row) => row.index > columns.headerIndex);
  const named = dataRows.filter((row) => String(row.cells[columns.name] || "").trim());
  const hiddenRows = named.filter((row) => isHidden(row.cells.BT)).length;
  const employees = named.filter((row) => !isHidden(row.cells.BT)).map((row) => {
    const cells = row.cells;
    const status = statusOf(cells[columns.decision]);
    const checks = {};
    for (const check of CHECKS) checks[check.label] = checkState(cells[columns.checks[check.label]]);
    const grade = cleanText(cells[columns.grade]);
    const category = gradeClass(cells[columns.category], grade);
    const unit = unitName(cells[columns.unit]);
    const appraisal = String(cells[columns.appraisal] || "").trim();
    const failedChecks = Object.entries(checks)
      .filter(([, state]) => state === "notMet")
      .map(([label]) => BLOCKER_LABEL[label] || label);
    return {
      name: String(cells[columns.name]).trim(),
      unit,
      orgType: orgType(unit),
      job: cleanText(cells[columns.job]),
      grade: /^\d+$/.test(grade) ? grade : "",
      category,
      status,
      decision: decisionOf(cells[columns.decision]),
      reason: status === "yes"
        ? ""
        : [...new Set([
          ...String(cells[columns.reason] || "").split("//").map(reasonPart).filter(Boolean),
          ...failedChecks,
        ])].join(" // "),
      /** HR remark: column BS on الكشف (2). */
      hrRemark: cleanText(cells.BS),
      /** Written penalty: column N, جزاء أو إنذار كتابي. */
      penaltyNote: cleanText(cells.N),
      service: cleanText(cells[columns.service]),
      appraisal: RATINGS.has(appraisal) ? appraisal : "",
      tenure: tenureBand(cells[columns.tenure]),
      year: excelYear(cells[columns.year]),
      checks,
      basicDelta: (() => {
        const now = numberOf(cells[columns.basicNow]);
        const next = numberOf(cells[columns.basicNext]);
        return now == null || next == null ? null : next - now;
      })(),
      totalDelta: (() => {
        const now = numberOf(cells[columns.totalNow]);
        const next = numberOf(cells[columns.totalNext]);
        return now == null || next == null ? null : next - now;
      })(),
      /** Promotion cost: column BC (after) minus column AM (before). */
      cost: (() => {
        const before = numberOf(cells.AM);
        const after = numberOf(cells.BC);
        return before == null || after == null ? null : round2(after - before);
      })(),
    };
  });

  const outcome = { entitled: 0, notEntitled: 0, tbc: 0 };
  for (const person of employees) {
    if (person.status === "yes") outcome.entitled += 1;
    else if (person.status === "no") outcome.notEntitled += 1;
    else outcome.tbc += 1;
  }

  const blockerCounts = new Map([[PENALTY_REASON, 0]]);
  for (const person of employees) {
    if (person.status !== "no") continue;
    for (const label of new Set(person.reason.split("//").map((part) => part.trim()).filter(Boolean))) {
      blockerCounts.set(label, (blockerCounts.get(label) || 0) + 1);
    }
  }
  const blockers = [...blockerCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"));

  const criteriaMap = new Map(CRITERIA_ORDER.map((label) => [label, { label, met: 0, notMet: 0, open: 0 }]));
  for (const person of employees) {
    for (const [label, state] of Object.entries(person.checks)) {
      if (!criteriaMap.has(label)) criteriaMap.set(label, { label, met: 0, notMet: 0, open: 0 });
      criteriaMap.get(label)[state] += 1;
    }
  }
  const criteria = CRITERIA_ORDER.map((label) => criteriaMap.get(label));

  const gradeMap = new Map();
  for (const person of employees) {
    if (!person.grade) continue;
    if (!gradeMap.has(person.grade)) {
      gradeMap.set(person.grade, { grade: person.grade, headcount: 0, yes: 0, no: 0, tbc: 0, basic: [], total: [] });
    }
    const row = gradeMap.get(person.grade);
    row.headcount += 1;
    row[person.status] += 1;
    if (person.status === "yes") {
      if (person.basicDelta != null) row.basic.push(person.basicDelta);
      if (person.totalDelta != null) row.total.push(person.totalDelta);
    }
  }
  const grades = [...gradeMap.values()]
    .sort((a, b) => Number(a.grade) - Number(b.grade))
    .map((row) => ({
      grade: row.grade,
      headcount: row.headcount,
      yes: row.yes,
      no: row.no,
      tbc: row.tbc,
      meanBasic: row.basic.length ? round2(row.basic.reduce((sum, n) => sum + n, 0) / row.basic.length) : null,
      meanTotal: row.total.length ? round2(row.total.reduce((sum, n) => sum + n, 0) / row.total.length) : null,
    }));

  const categories = [...tally(employees.filter((person) => person.category).map((person) => ({ label: person.category, status: person.status }))).values()]
    .sort((a, b) => {
      const [letterA, numberA] = gradeClassRank(a.label);
      const [letterB, numberB] = gradeClassRank(b.label);
      return letterA - letterB || numberA - numberB || a.label.localeCompare(b.label, "en");
    });
  const orgTypes = orderMap(
    tally(employees.map((person) => ({ label: person.orgType, status: person.status }))),
    ORG_ORDER,
  );
  const unitMap = tally(employees.map((person) => ({ label: person.unit, status: person.status })));
  const units = [...unitMap.values()]
    .filter((row) => row.yes > 0)
    .map((row) => ({ unit: row.label, yes: row.yes, no: row.no, tbc: row.tbc, total: row.yes + row.no + row.tbc }))
    .sort((a, b) => b.yes - a.yes || b.total - a.total || a.unit.localeCompare(b.unit, "ar"));

  const yearsSince = orderMap(
    tally(employees.filter((person) => person.tenure).map((person) => ({ label: person.tenure, status: person.status }))),
    TENURE_ORDER,
  );
  const appraisal = orderMap(
    tally(employees.filter((person) => person.appraisal).map((person) => ({ label: person.appraisal, status: person.status }))),
    APPRAISAL_ORDER,
  );
  const yearCounts = new Map();
  for (const person of employees) {
    const yearValue = Number(person.year);
    if (!Number.isFinite(yearValue)) continue;
    const year = yearValue < 2026 ? "2026" : String(person.year);
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
  }
  const expectedYear = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const entitledPay = employees.filter((person) => person.status === "yes" && person.basicDelta != null && person.totalDelta != null);
  const basics = entitledPay.map((person) => person.basicDelta);
  const totals = entitledPay.map((person) => person.totalDelta);
  const costs = employees.filter((person) => person.status === "yes" && person.cost != null).map((person) => person.cost);
  const bucketCounts = new Map(BUCKETS.map((label) => [label, 0]));
  for (const value of totals) bucketCounts.set(bucketOf(value), bucketCounts.get(bucketOf(value)) + 1);
  const pay = {
    entitledCount: entitledPay.length,
    basicSum: round2(costs.reduce((sum, n) => sum + n, 0)),
    basicMean: basics.length ? round2(basics.reduce((sum, n) => sum + n, 0) / basics.length) : null,
    basicMedian: median(basics),
    basicMin: basics.length ? round2(Math.min(...basics)) : null,
    basicMax: basics.length ? round2(Math.max(...basics)) : null,
    totalSum: round2(totals.reduce((sum, n) => sum + n, 0)),
    totalMean: totals.length ? round2(totals.reduce((sum, n) => sum + n, 0) / totals.length) : null,
    totalMedian: median(totals),
    totalMin: totals.length ? round2(Math.min(...totals)) : null,
    totalMax: totals.length ? round2(Math.max(...totals)) : null,
    totalBuckets: BUCKETS.filter((label) => bucketCounts.get(label) > 0).map((label) => ({ label, count: bucketCounts.get(label) })),
  };

  const published = employees.map(({ totalDelta, ...person }) => person);
  return {
    blankNameRowsExcluded: dataRows.length - named.length,
    hiddenRows,
    employees: published,
    outcome,
    blockers,
    criteria,
    grades,
    categories,
    orgTypes,
    units,
    yearsSince,
    appraisal,
    expectedYear,
    pay,
  };
}

function writePromotions(result) {
  const { outcome } = result;
  const body = `/** Aggregates from DSO_Data.xlsx, sheet ${SHEET_NAME}. Regenerated by scripts/import-data.ps1. */

export const source = ${JSON.stringify({
    file: "DSO_Data.xlsx",
    sheet: SHEET_NAME,
    namedEmployees: result.employees.length,
    blankNameRowsExcluded: result.blankNameRowsExcluded,
    hiddenRows: result.hiddenRows,
  }, null, 2)};

export const outcome = ${JSON.stringify(outcome, null, 2)};

export const outcomeSlices = ${JSON.stringify([
    { key: "yes", name: "مستوفي", value: outcome.entitled },
    { key: "no", name: "غير مستوفي", value: outcome.notEntitled },
  ], null, 2)};

/** Mentions inside سبب عدم الاستيفاء, split on //. One person can carry more than one reason. */
export const blockers = ${JSON.stringify(result.blockers, null, 2)};

/** Criterion columns. met = Yes, notMet = No, open = TBC or an Excel error. */
export const criteria = ${JSON.stringify(result.criteria, null, 2)};

export const grades = ${JSON.stringify(result.grades, null, 2)};

export const categories = ${JSON.stringify(result.categories, null, 2)};

export const orgTypes = ${JSON.stringify(result.orgTypes, null, 2)};

/** First segment of القطاع / الإدارة / البعثة, only units with at least one entitled employee. */
export const units = ${JSON.stringify(result.units, null, 2)};

/** المدة من آخر ترقية, parsed into year bands. */
export const yearsSince = ${JSON.stringify(result.yearsSince, null, 2)};

export const appraisal = ${JSON.stringify(result.appraisal, null, 2)};

/** Year of تاريخ الترقية المفترضة. */
export const expectedYear = ${JSON.stringify(result.expectedYear, null, 2)};

export const pay = ${JSON.stringify(result.pay, null, 2)};
`;
  fs.writeFileSync(path.join(root, "src", "data", "promotions.js"), body);
}

function main() {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Put the workbook at ${workbookPath}`);
  }
  const xlDir = unzip(workbookPath);
  const strings = sharedStrings(fs.readFileSync(path.join(xlDir, "sharedStrings.xml"), "utf8"));
  const rows = readRows(fs.readFileSync(sheetPath(xlDir), "utf8"), strings);
  const header = headerMap(rows);
  const columns = { ...resolveColumns(header.cells, rows, header.index), headerIndex: header.index };
  const result = build(rows, columns);
  fs.writeFileSync(
    path.join(root, "src", "data", "employees.js"),
    `/** Named staff from DSO_Data.xlsx, sheet ${SHEET_NAME}. No CPR or employee ID. Regenerated by scripts/import-data.ps1. */\nexport const employees = ${JSON.stringify(result.employees)};\n`,
  );
  writePromotions(result);
  const penaltyNo = result.employees.filter((person) => person.checks["جزاء أو إنذار"] === "notMet").length;
  console.log(
    `Imported ${result.employees.length} named employees (${result.outcome.entitled} entitled, ${result.outcome.notEntitled} not entitled, ${result.outcome.tbc} TBC). Skipped ${result.blankNameRowsExcluded} blank-name rows and hid ${result.hiddenRows} rows where column BT is 1.`,
  );
  console.log(`Penalty requirement is not met for ${penaltyNo} employees.`);
}

main();

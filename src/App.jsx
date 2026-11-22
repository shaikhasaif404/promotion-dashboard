import { formatNumber } from "./components/chartUi.jsx";
import OutcomeChart from "./components/OutcomeChart.jsx";
import BlockerChart from "./components/BlockerChart.jsx";
import CriteriaChart from "./components/CriteriaChart.jsx";
import { GradeChart, MissionChart } from "./components/CohortCharts.jsx";
import { ExpectedYearChart, UnitTable } from "./components/OrgCharts.jsx";
import PeopleList from "./components/PeopleList.jsx";
import { categoryName, useDashboard } from "./useDashboard.jsx";

export default function App() {
  const { filters, setFilters, view, units, categories, resetFilters } = useDashboard();
  const { yes, no, shown } = view.kpi;
  const promotionShare = shown ? String(Math.round((100 * yes) / shown)) : "0";

  function patch(partial) {
    setFilters((current) => ({ ...current, ...partial }));
  }

  function muted(key) {
    return filters.status !== "all" && filters.status !== key;
  }

  return (
    <main className="app">
      <header className="banner">
        <div className="banner-copy">
          <p className="banner-kicker">لجنة شؤون أعضاء السلك الدبلوماسي والقنصلي</p>
          <h1>احصائيات مقترح الترقيات لسنة 2026</h1>
          <p className="banner-note">*حتى وزير مفوض دون مديري الإدارات ورؤساء القطاعات</p>
        </div>
        <img className="banner-logo" src={`${import.meta.env.BASE_URL}mofa-logo.png`} alt="وزارة الخارجية" />
      </header>

      <section className="filters" aria-label="تصفية">
        <label className="filter filter-search">
          <span>بحث</span>
          <input
            type="search"
            value={filters.q}
            placeholder="الاسم، الرقم، الإدارة، الوظيفة، سبب عدم الاستيفاء، أو ملاحظة الموارد البشرية"
            onChange={(event) => patch({ q: event.target.value })}
          />
        </label>
        <label className="filter filter-status">
          <span>الاستيفاء</span>
          <select value={filters.status} onChange={(event) => patch({ status: event.target.value })}>
            <option value="all">الكل</option>
            <option value="yes">مستوفي</option>
            <option value="no">غير مستوفي</option>
          </select>
        </label>
        <label className="filter">
          <span>الإدارة</span>
          <select value={filters.unit} onChange={(event) => patch({ unit: event.target.value })}>
            <option value="all">كل الإدارات</option>
            {units.map((row) => (
              <option key={row.unit} value={row.unit}>{row.unit}</option>
            ))}
          </select>
        </label>
        <label className="filter filter-category">
          <span>فئة الدرجة</span>
          <select value={filters.category} onChange={(event) => patch({ category: event.target.value })}>
            <option value="all">كل الفئات</option>
            {categories.map((row) => (
              <option key={row.label} value={row.label}>{categoryName(row.label)}</option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button type="button" className="btn btn-clear" onClick={resetFilters}>مسح التصفية</button>
          <button type="button" className="btn btn-pdf" onClick={() => window.print()}>تنزيل PDF</button>
        </div>
      </section>

      <section className="kpis">
        <article className="kpi">
          <span>العدد الكلي</span>
          <strong>{formatNumber(shown)}</strong>
        </article>
        <article className={`kpi kpi-yes${muted("yes") ? " is-muted" : ""}`}>
          <span>مستوفي</span>
          <strong>{formatNumber(yes)}</strong>
        </article>
        <article className={`kpi kpi-no${muted("no") ? " is-muted" : ""}`}>
          <span>غير مستوفي</span>
          <strong>{formatNumber(no)}</strong>
        </article>
        <article className="kpi">
          <span>نسبة الترقيات</span>
          <strong>{promotionShare}%</strong>
        </article>
        <article className={`kpi kpi-yes${muted("yes") ? " is-muted" : ""}`}>
          <span>تكلفة المستوفيين</span>
          <strong>{formatNumber(view.kpi.entitledCost, 0)}</strong>
        </article>
      </section>

      <PeopleList />

      <div className="grid-2">
        <OutcomeChart />
        <BlockerChart />
      </div>

      <div className="stack">
        <CriteriaChart />
        <GradeChart />
        <div className="grid-2">
          <MissionChart />
          <ExpectedYearChart />
        </div>
        <UnitTable />
      </div>
    </main>
  );
}

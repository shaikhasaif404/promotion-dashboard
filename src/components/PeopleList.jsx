import { useEffect, useRef } from "react";
import { formatNumber } from "./chartUi.jsx";
import { STATUS_LABEL, categoryName, useDashboard } from "../useDashboard.jsx";

export default function PeopleList() {
  const { picked, people, clearPick, showPeople, listTitle } = useDashboard();
  const panel = useRef(null);

  useEffect(() => {
    if (picked) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [picked]);

  if (!showPeople) return null;

  return (
    <section className="people" ref={panel}>
      <div className="people-head">
        <h2>{listTitle}</h2>
        <span>{formatNumber(people.length)} موظفاً</span>
        {picked ? <button type="button" className="btn btn-clear" onClick={clearPick}>إغلاق</button> : null}
      </div>
      {people.length === 0 ? <p className="empty">لا يوجد موظفون مطابقون.</p> : (
        <div className="people-scroll">
          <table className="people-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الإدارة</th>
                <th>الوظيفة</th>
                <th>الدرجة</th>
                <th>الفئة</th>
                <th>الاستيفاء</th>
                <th>سنوات الخدمة</th>
                <th>ملاحظة الموارد البشرية</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => (
                <tr key={`${person.name}-${person.unit}-${index}`}>
                  <td>{person.name}</td>
                  <td>{person.unit}</td>
                  <td>{person.job || "—"}</td>
                  <td className="num">{person.grade || "—"}</td>
                  <td>{person.category ? categoryName(person.category) : "—"}</td>
                  <td className={`status status-${person.status}`}>{STATUS_LABEL[person.status]}</td>
                  <td className="ltr" dir="ltr">{person.service || "—"}</td>
                  <td className="remark">{person.hrRemark || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

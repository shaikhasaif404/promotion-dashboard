import { lazy, Suspense, useState } from "react";
import { grantAccess, hasAccess } from "./access.js";

const Dashboard = lazy(() => import("./Dashboard.jsx"));

export default function Gate() {
  const [allowed, setAllowed] = useState(hasAccess);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  function submit(event) {
    event.preventDefault();
    setPending(true);
    const ok = grantAccess(code);
    setPending(false);
    setError(!ok);
    if (ok) setAllowed(true);
  }

  if (allowed) {
    return (
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    );
  }

  return (
    <main className="app gate">
      <form className="gate-card" onSubmit={submit}>
        <img className="gate-logo" src={`${import.meta.env.BASE_URL}mofa-logo.png`} alt="وزارة الخارجية" />
        <p className="banner-kicker">لجنة شؤون أعضاء السلك الدبلوماسي والقنصلي</p>
        <h1>احصائيات مقترح الترقيات لسنة 2026</h1>
        <label className="filter">
          <span>آخر 6 أرقام من الرقم الشخصي</span>
          <input
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="000000"
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError(false);
            }}
          />
        </label>
        {error ? <p className="gate-error">غير مصرح بالدخول</p> : null}
        <button className="btn btn-pdf" type="submit" disabled={pending || code.length !== 6}>دخول</button>
      </form>
    </main>
  );
}

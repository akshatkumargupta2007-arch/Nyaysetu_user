// Build map #D2 — the persistent top bar: app name, Home / My Complaints,
// and the हिं | EN toggle, visible on every screen (Bible §2.1).
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";

const BAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

export function TopBar() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header style={BAR_STYLE}>
      <Link
        to="/"
        style={{
          fontWeight: 700,
          fontSize: "var(--text-body-lg)",
          color: "var(--color-brand)",
          textDecoration: "none",
        }}
      >
        {t("app.name")}
      </Link>

      <nav style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <Link to="/" style={{ color: "var(--color-text)", textDecoration: "none" }}>
          {t("nav.home")}
        </Link>
        <Link to="/my" style={{ color: "var(--color-text)", textDecoration: "none" }}>
          {t("nav.myComplaints")}
        </Link>

        <div
          role="group"
          aria-label="Language"
          style={{
            display: "flex",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-full)",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setLang("hi")}
            aria-pressed={lang === "hi"}
            style={toggleButtonStyle(lang === "hi")}
          >
            {t("lang.toggle.hi")}
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            style={toggleButtonStyle(lang === "en")}
          >
            {t("lang.toggle.en")}
          </button>
        </div>
      </nav>
    </header>
  );
}

function toggleButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    padding: "var(--space-1) var(--space-2)",
    minHeight: 40,
    fontWeight: active ? 700 : 500,
    background: active ? "var(--color-brand)" : "transparent",
    color: active ? "var(--color-action-text)" : "var(--color-text)",
    cursor: "pointer",
  };
}

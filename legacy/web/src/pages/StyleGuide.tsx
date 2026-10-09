// Build map #D1 — dev-only route rendering every token, both scripts, and
// every icon, so a design regression is visible at a glance. Not linked
// from the nav; only reachable at /styleguide, and only built in dev.
//
// D2 note: all visible text goes through t() so the language toggle is
// testable on this page just like every other screen.
import { ALL_ICON_NAMES, CategoryIcon } from "../components/CategoryIcon.js";
import { useLanguage } from "../i18n/LanguageContext.js";

const swatch = (varName: string, label: string) => (
  <div key={varName} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: `var(${varName})`,
        border: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    />
    <code style={{ fontSize: 14 }}>
      {varName} — {label}
    </code>
  </div>
);

export default function StyleGuide() {
  const { t, lang, setLang } = useLanguage();
  return (
    <main style={{ padding: "var(--space-4)", maxWidth: 720, margin: "0 auto" }}>
      <h1>NyaySetu Style Guide — {lang === "hi" ? "हिंदी मोड" : "English mode"}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Dev-only route (build map #D1). Not linked from navigation.
      </p>

      {/* D2 — verify t() works on this page by echoing live translations */}
      <section style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-brand-light)", borderRadius: "var(--radius-md)" }}>
        <h2 style={{ marginBottom: "var(--space-2)" }}>D2 toggle test</h2>
        <p>
          <strong>{t("app.name")}</strong> · {t("nav.home")} · {t("nav.myComplaints")}
        </p>
        <p>{t("home.heading")} / {t("home.submit")}</p>
        <p style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
          {t("status.beingHandled")} · {t("status.teamDispatched")} · {t("status.resolved")} · {t("status.reopened")}
        </p>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <button
            type="button"
            onClick={() => setLang("hi")}
            style={{
              padding: "var(--space-1) var(--space-2)",
              minHeight: "var(--tap-target-min)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: lang === "hi" ? "var(--color-brand)" : "var(--color-border)",
              color: lang === "hi" ? "#fff" : "var(--color-text)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            हिं
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            style={{
              padding: "var(--space-1) var(--space-2)",
              minHeight: "var(--tap-target-min)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: lang === "en" ? "var(--color-brand)" : "var(--color-border)",
              color: lang === "en" ? "#fff" : "var(--color-text)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            EN
          </button>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2>Brand &amp; surface</h2>
        {swatch("--color-brand", "brand")}
        {swatch("--color-brand-light", "brand-light")}
        {swatch("--color-bg", "background")}
        {swatch("--color-surface", "surface")}
        {swatch("--color-text", "text")}
        {swatch("--color-text-muted", "text-muted")}
        {swatch("--color-border", "border")}
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2>Status colours (exactly 4, per Bible §9)</h2>
        {swatch("--color-status-amber", "being handled")}
        {swatch("--color-status-blue", "team dispatched")}
        {swatch("--color-status-green", "resolved")}
        {swatch("--color-status-red", "reopened (outline only)")}
        {swatch("--color-urgent", "urgent (priority badge)")}
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2>Typography — both scripts</h2>
        <p style={{ fontSize: "var(--text-heading-lg)", fontWeight: 700, fontFamily: "var(--font-devanagari)" }}>
          क्या परेशानी है?
        </p>
        <p style={{ fontSize: "var(--text-heading-lg)", fontWeight: 700, fontFamily: "var(--font-latin)" }}>
          What went wrong?
        </p>
        <p style={{ fontSize: "var(--text-heading)", fontWeight: 700 }}>Heading — 32px / 2rem</p>
        <p style={{ fontSize: "var(--text-body)" }}>
          पूरी गली में तीन दिन से स्ट्रीटलाइट बंद है। Body — 18px / 1.125rem
        </p>
        <p style={{ fontSize: "var(--text-body)", fontFamily: "var(--font-latin)" }}>
          The streetlight in the whole lane has been off for three days. Body — 18px / 1.125rem
        </p>
        <p style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
          small / muted — 0.95rem
        </p>
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2>Icons ({ALL_ICON_NAMES.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 16 }}>
          {ALL_ICON_NAMES.map((name) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <CategoryIcon name={name} size={28} className="" />
              <code style={{ fontSize: 11, textAlign: "center" }}>{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2>Tap targets</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-small)" }}>
          All interactive elements must be ≥ 56px tall on mobile.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
          <button
            type="button"
            style={{
              minHeight: "var(--tap-target-min)",
              minWidth: "var(--tap-target-min)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--color-action)",
              color: "var(--color-action-text)",
              padding: "0 var(--space-3)",
            }}
          >
            56px min
          </button>
          <button
            type="button"
            style={{
              minHeight: "var(--tap-target-primary)",
              minWidth: "var(--tap-target-primary)",
              borderRadius: "var(--radius-full)",
              border: "none",
              background: "var(--color-brand)",
              color: "var(--color-action-text)",
              padding: "0 var(--space-4)",
            }}
          >
            72px primary
          </button>
          <button
            type="button"
            style={{
              minHeight: "var(--tap-target-min)",
              borderRadius: "var(--radius-md)",
              border: "2px solid var(--color-status-red)",
              background: "transparent",
              color: "var(--color-status-red)",
              padding: "0 var(--space-3)",
            }}
          >
            Reopened (outline)
          </button>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <h2>Status pills</h2>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {(
            [
              ["--color-status-amber", "--color-status-amber-bg", "status.beingHandled"],
              ["--color-status-blue", "--color-status-blue-bg", "status.teamDispatched"],
              ["--color-status-green", "--color-status-green-bg", "status.resolved"],
              ["--color-status-red", "--color-status-red-bg", "status.reopened"],
            ] as const
          ).map(([fg, bg, key]) => (
            <span
              key={key}
              style={{
                background: `var(${bg})`,
                color: `var(${fg})`,
                padding: "var(--space-1) var(--space-2)",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
                fontSize: "var(--text-small)",
                border: key === "status.reopened" ? `2px solid var(${fg})` : "none",
              }}
            >
              {t(key)}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

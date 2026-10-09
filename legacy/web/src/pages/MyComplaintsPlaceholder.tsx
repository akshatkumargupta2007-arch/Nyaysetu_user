// Build map #D8 stub — "Your complaints" list screen.
// Full implementation is in #D8; this placeholder satisfies the D2
// requirement that the /my route exists and renders fully translated.
import { useLanguage } from "../i18n/LanguageContext.js";

export default function MyComplaintsPlaceholder() {
  const { t } = useLanguage();
  return (
    <main style={{ padding: "var(--space-4)", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--text-heading)" }}>{t("home.complaints.heading")}</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
        {t("home.complaints.empty")}
      </p>
    </main>
  );
}

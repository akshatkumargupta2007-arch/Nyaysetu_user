// Build map #D8 — "Your complaints" list screen (/my)
//
// Shows all complaints registered under the anonymous device token.
// Uses ComplaintCard with Bible §9 status badges and relative time.

import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { useSession } from "../features/session/useSession.js";
import { ComplaintCard } from "../components/ComplaintCard.js";
import { VoiceAssistant } from "../components/VoiceAssistant.js";
import { Plus } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8080`;

export default function MyComplaints() {
  const { t, lang } = useLanguage();
  const { reports, isLoading, refreshReports, token } = useSession(API_URL);

  return (
    <main
      id="my-complaints-page"
      style={{
        padding: "var(--space-4) var(--space-3)",
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "calc(100dvh - 56px)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "var(--text-heading)", fontWeight: 700, margin: 0 }}>
          {t("home.complaints.heading")}
        </h1>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "var(--text-small)",
            color: "var(--color-brand)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <Plus size={16} />
          <span>{lang === "hi" ? "नई शिकायत" : "New Report"}</span>
        </Link>
      </div>

      {isLoading && reports.length === 0 ? (
        <div style={{ padding: "var(--space-5) 0", textAlign: "center", color: "var(--color-text-muted)" }}>
          {lang === "hi" ? "शिकायतें लोड हो रही हैं..." : "Loading your complaints..."}
        </div>
      ) : reports.length === 0 ? (
        <div
          style={{
            padding: "var(--space-5) var(--space-3)",
            textAlign: "center",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--color-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: 32 }}>📋</span>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-body)", margin: 0 }}>
            {t("home.complaints.empty")}
          </p>
          <Link
            to="/"
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-brand)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--text-body)",
            }}
          >
            {lang === "hi" ? "शिकायत दर्ज करें" : "File a Complaint"}
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {reports.map((report) => (
            <Link key={report.id} to={`/c/${report.ticketId}`} style={{ textDecoration: "none", display: "block" }}>
              <ComplaintCard item={report} lang={lang} />
            </Link>
          ))}
        </div>
      )}

      {/* #G4 - Voice Assistant */}
      <VoiceAssistant />
    </main>
  );
}

// Build map #D8 — Complaint card component for Home and /my screens
//
// Shows:
// - Category icon in accent circle
// - Public ticket code (e.g. BHI-26-001041)
// - Citizen summary
// - Status pill following Bible §9 4-status scheme:
//   1. Amber: SUBMITTED / ACKNOWLEDGED ("संभाला जा रहा है / Being handled")
//   2. Blue: DISPATCHED ("टीम रास्ते में है / Team dispatched")
//   3. Green: RESOLVED ("ठीक हो गया / Resolved")
//   4. Red outline: REOPENED ("फिर से खोला गया / Reopened")
// - Formatted relative time

import { CategoryIcon } from "./CategoryIcon.js";
import type { ComplaintItem } from "../features/session/useSession.js";

interface ComplaintCardProps {
  item: ComplaintItem;
  lang: "hi" | "en";
  onClick?: () => void;
}

function formatRelativeTime(dateStr: string, lang: "hi" | "en"): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));

    if (diffMins < 60) {
      return lang === "hi" ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return lang === "hi" ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return lang === "hi" ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
  } catch {
    return "";
  }
}

export function ComplaintCard({ item, lang, onClick }: ComplaintCardProps) {
  const relativeTime = formatRelativeTime(item.createdAt, lang);

  // Status mapping per Bible §9
  let statusText = lang === "hi" ? "संभाला जा रहा है" : "Being handled";
  let statusBg = "var(--color-status-amber-bg, #fef3c7)";
  let statusColor = "var(--color-status-amber, #d97706)";
  let statusBorder = "transparent";

  if (item.state === "DISPATCHED") {
    statusText = lang === "hi" ? "टीम रास्ते में है" : "Team dispatched";
    statusBg = "var(--color-status-blue-bg, #eff6ff)";
    statusColor = "var(--color-status-blue, #2563eb)";
  } else if (item.state === "RESOLVED" || item.state === "CLOSED_CONFIRMED") {
    statusText = lang === "hi" ? "ठीक हो गया" : "Resolved";
    statusBg = "var(--color-status-green-bg, #ecfdf5)";
    statusColor = "var(--color-status-green, #15803d)";
  } else if (item.state === "REOPENED") {
    statusText = lang === "hi" ? "फिर से खोला गया" : "Reopened";
    statusBg = "transparent";
    statusColor = "var(--color-danger, #dc2626)";
    statusBorder = "1.5px solid var(--color-danger, #dc2626)";
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3)",
        border: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.1s, box-shadow 0.15s",
      }}
    >
      {/* Top row: Ticket Code & Status Pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-brand-light)",
              color: "var(--color-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CategoryIcon name="alert-triangle" size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: "var(--text-small)", color: "var(--color-text)" }}>
            {item.ticketCode}
          </span>
        </div>

        {/* Status Pill */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: statusBg,
            color: statusColor,
            border: statusBorder,
            fontSize: "var(--text-small)",
            fontWeight: 600,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* Summary */}
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-body)",
          color: "var(--color-text)",
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {item.summary}
      </p>

      {/* Bottom row: Time */}
      {relativeTime && (
        <span style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
          {relativeTime}
        </span>
      )}
    </div>
  );
}

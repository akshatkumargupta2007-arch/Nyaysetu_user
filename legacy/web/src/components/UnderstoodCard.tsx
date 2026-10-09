// Build map #D7 — "What we understood" card + clarify sheet (Bible §2.2 Screen 2)
//
// Displays:
// - Photo as darkened card background (or clean modern gradient if no photo)
// - Category icon + translated category title
// - "ज़रूरी / Urgent" badge ONLY for High / Critical priority
// - Assigned Agency and Department
// - Resolved location and landmark
// - The citizen's own words verbatim
// - If clustered: "N और लोगों ने यही बताया है — आपकी आवाज़ जोड़ दी गई"
// - Two actions only: "हाँ, सही है / Looks right" and "बदलें / Change"
// - Clarify variant if confidence requires citizen disambiguation

import { useState, useEffect } from "react";
import { CategoryIcon } from "./CategoryIcon.js";
import { AlertTriangle, Users, Volume2, ArrowLeft, Check, Sparkles } from "lucide-react";

export interface UnderstandPayload {
  draftId: string;
  gate: "card" | "amber_card" | "clarify";
  confidence: number;
  understanding: {
    category_code: string;
    is_civic_issue: boolean;
    hazards: string[];
    entities: {
      landmark: string | null;
      duration_text: string | null;
      duration_days: number | null;
      people_affected_hint: string | null;
    };
    severity_0_100: number;
    summary_citizen: string;
    summary_officer_en: string;
    clarifying_question: string | null;
    model_confidence: number;
  };
  routing: {
    agencyId: string;
    departmentId: string | null;
    matchedRuleId: string | null;
    isFallback: boolean;
  };
  priority: {
    score_0_100: number;
    level: "low" | "medium" | "high" | "critical";
    isHazardOverride: boolean;
    reason: string;
  };
  duplicateOf: {
    ticketId: string;
    ticketCode: string;
    clusterSize?: number;
    similarity: number;
    distanceM: number;
  } | null;
  tenantId: string | null;
  boundaryId: string | null;
  ttsUrl?: string | null;
}

interface UnderstoodCardProps {
  data: UnderstandPayload;
  originalText: string;
  photoUrl: string | null;
  locationLabel: string;
  lang: "hi" | "en";
  onConfirm: (draftId: string) => void;
  onChange: () => void;
  onClarifyReply?: (answer: string) => void;
}

// Category code to display details mapping
const CATEGORY_NAMES: Record<string, { hi: string; en: string; icon: string }> = {
  ROAD_POTHOLE: { hi: "सड़क पर गड्ढा", en: "Road Pothole", icon: "road" },
  GARBAGE_DUMP: { hi: "कचरे का ढेर", en: "Garbage Dump", icon: "trash" },
  STREETLIGHT_OUT: { hi: "स्ट्रीट लाइट बंद", en: "Streetlight Out", icon: "lamp" },
  WATER_LEAK: { hi: "पानी का लीकेज", en: "Water Pipeline Leak", icon: "droplet" },
  DRAIN_BLOCKED: { hi: "नाली जाम / पानी भराव", en: "Blocked Drain / Waterlogging", icon: "waves" },
  OPEN_MANHOLE: { hi: "खुला मैनहोल", en: "Open Manhole", icon: "alert-triangle" },
  STRAY_ANIMALS: { hi: "आवारा मवेशी", en: "Stray Animals", icon: "alert-triangle" },
  ELECTRIC_SPARK: { hi: "बिजली तार में स्पार्क", en: "Electric Wire Spark", icon: "zap" },
  PARK_MAINTENANCE: { hi: "पार्क की सफाई", en: "Park Maintenance", icon: "trees" },
  MOSQUITO_FOGGING: { hi: "मच्छर / फॉगिंग", en: "Mosquito Fogging", icon: "bug" },
  OTHER_CIVIC: { hi: "अन्य नागरिक समस्या", en: "Civic Issue", icon: "help-circle" },
};

const AGENCY_NAMES: Record<string, { hi: string; en: string }> = {
  bmc: { hi: "भिलाई नगर निगम", en: "Bhilai Municipal Corp" },
  "bsp-town": { hi: "बीएसपी नगर सेवाएं", en: "BSP Town Services" },
  cspdcl: { hi: "छत्तीसगढ़ विद्युत वितरण (CSPDCL)", en: "CSPDCL Electricity" },
  phed: { hi: "लोक स्वास्थ्य यांत्रिकी (PHED)", en: "PHED Water Dept" },
  nhai: { hi: "राष्ट्रीय राजमार्ग (NHAI)", en: "NHAI Highway Authority" },
  pwd: { hi: "लोक निर्माण विभाग (PWD)", en: "Public Works Dept (PWD)" },
};

export function UnderstoodCard({
  data,
  originalText,
  photoUrl,
  locationLabel,
  lang,
  onConfirm,
  onChange,
  onClarifyReply,
}: UnderstoodCardProps) {
  const [clarifyInput, setClarifyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data.ttsUrl) {
      const audio = new Audio(data.ttsUrl);
      audio.play().catch(err => {
        console.error("Failed to autoplay UnderstoodCard TTS:", err);
      });
    }
  }, [data.ttsUrl]);

  const { understanding, priority, routing, duplicateOf, gate } = data;
  const isUrgent = priority.level === "high" || priority.level === "critical";

  const catMeta = CATEGORY_NAMES[understanding.category_code] ?? {
    hi: understanding.category_code.replace(/_/g, " "),
    en: understanding.category_code.replace(/_/g, " "),
    icon: "alert-triangle",
  };

  const agencyMeta = AGENCY_NAMES[routing.agencyId.toLowerCase()] ?? {
    hi: routing.agencyId.toUpperCase(),
    en: routing.agencyId.toUpperCase(),
  };

  const categoryTitle = lang === "hi" ? catMeta.hi : catMeta.en;
  const agencyTitle = lang === "hi" ? agencyMeta.hi : agencyMeta.en;

  // ── Variant: Clarify Sheet ──────────────────────────────────────────────────
  if (gate === "clarify" && understanding.clarifying_question) {
    return (
      <div
        id="clarify-sheet"
        style={{
          minHeight: "100dvh",
          background: "var(--color-bg)",
          padding: "var(--space-4) var(--space-3)",
          display: "flex",
          flexDirection: "column",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={onChange}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-brand)",
            fontSize: "var(--text-body)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            cursor: "pointer",
            padding: 0,
            marginBottom: "var(--space-4)",
          }}
        >
          <ArrowLeft size={20} />
          <span>{lang === "hi" ? "वापस जाएं" : "Go back"}</span>
        </button>

        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4)",
            border: "1.5px solid var(--color-status-amber)",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: 24 }}>🤔</span>
            <h2 style={{ fontSize: "var(--text-body-lg)", fontWeight: 700, margin: 0 }}>
              {lang === "hi" ? "एक छोटा सवाल" : "One quick question"}
            </h2>
          </div>

          <p
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: 600,
              color: "var(--color-text)",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            "{understanding.clarifying_question}"
          </p>

          <textarea
            value={clarifyInput}
            onChange={(e) => setClarifyInput(e.target.value)}
            placeholder={lang === "hi" ? "यहाँ जवाब लिखें..." : "Type your answer here..."}
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-border)",
              padding: "var(--space-2) var(--space-3)",
              fontFamily: "inherit",
              fontSize: "var(--text-body)",
              resize: "none",
              outline: "none",
            }}
          />

          <button
            type="button"
            disabled={clarifyInput.trim().length === 0}
            onClick={() => {
              if (onClarifyReply && clarifyInput.trim().length > 0) {
                onClarifyReply(clarifyInput.trim());
              }
            }}
            style={{
              minHeight: "var(--tap-target-min)",
              background: clarifyInput.trim().length > 0 ? "var(--color-brand)" : "var(--color-border)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontFamily: "inherit",
              fontSize: "var(--text-body)",
              fontWeight: 700,
              cursor: clarifyInput.trim().length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {lang === "hi" ? "जवाब भेजें" : "Submit Answer"}
          </button>
        </div>
      </div>
    );
  }

  // ── Standard "What we understood" Card (Screen 2) ─────────────────────────
  return (
    <div
      id="understood-card-screen"
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        padding: "var(--space-4) var(--space-3)",
        paddingBottom: "calc(var(--tap-target-primary) * 2 + var(--space-6))",
      }}
    >
      {/* Top title */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <Sparkles size={20} color="var(--color-brand)" />
        <h1 style={{ fontSize: "var(--text-heading)", fontWeight: 700, margin: 0 }}>
          {lang === "hi" ? "हमने यह समझा" : "Here's what we understood"}
        </h1>
      </div>

      {/* Main card */}
      <div
        id="confirmation-card"
        style={{
          position: "relative",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
          border: isUrgent ? "2px solid var(--color-danger)" : "1.5px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Photo header if available */}
        {photoUrl && (
          <div
            style={{
              height: 180,
              width: "100%",
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${photoUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "flex",
              alignItems: "flex-end",
              padding: "var(--space-3)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: "var(--text-small)",
                background: "rgba(0,0,0,0.5)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              📷 {lang === "hi" ? "संलग्न फ़ोटो" : "Attached Photo"}
            </span>
          </div>
        )}

        <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Category Header Row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-brand-light)",
                  color: "var(--color-brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CategoryIcon name={catMeta.icon} size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "var(--text-heading)", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  {categoryTitle}
                </h2>
                <span style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
                  {agencyTitle}
                </span>
              </div>
            </div>

            {/* Urgent Badge if High or Critical */}
            {isUrgent && (
              <span
                id="urgent-badge"
                style={{
                  background: "var(--color-danger)",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-small)",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <AlertTriangle size={14} />
                {lang === "hi" ? "ज़रूरी" : "Urgent"}
              </span>
            )}
          </div>

          {/* Location Chip Row */}
          {locationLabel && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                color: "var(--color-text-muted)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
              }}
            >
              <span>📍 {locationLabel}</span>
            </div>
          )}

          {/* Citizen's own words */}
          <div
            style={{
              background: "var(--color-bg)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3)",
              borderLeft: "3px solid var(--color-brand)",
            }}
          >
            <div style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)", marginBottom: 4 }}>
              {lang === "hi" ? "आपकी शिकायत:" : "Your report:"}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-body)",
                color: "var(--color-text)",
                lineHeight: "var(--line-height-body)",
                fontStyle: "italic",
              }}
            >
              "{originalText}"
            </p>
          </div>

          {/* Clustered duplicate badge if applicable */}
          {duplicateOf && (
            <div
              id="cluster-notice"
              style={{
                background: "var(--color-status-blue-bg, #eff6ff)",
                border: "1px solid var(--color-status-blue, #3b82f6)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-2) var(--space-3)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--text-small)",
                color: "var(--color-text)",
              }}
            >
              <Users size={18} color="#2563eb" />
              <span>
                {lang === "hi"
                  ? `${duplicateOf.clusterSize ?? 2} और लोगों ने यही बताया है — आपकी आवाज़ जोड़ दी गई.`
                  : `${duplicateOf.clusterSize ?? 2} other people reported this — your voice has been added.`}
              </span>
            </div>
          )}

          {/* Amber gate notice if confidence was moderate */}
          {gate === "amber_card" && (
            <div
              style={{
                background: "var(--color-status-amber-bg)",
                border: "1px solid var(--color-status-amber)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--text-small)",
                color: "var(--color-status-amber)",
                fontWeight: 600,
              }}
            >
              ℹ️ {lang === "hi" ? "कृपया विवरण की पुष्टि करें" : "Please confirm these details"}
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom buttons ───────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--color-bg)",
          borderTop: "1px solid var(--color-border)",
          padding: "var(--space-3)",
          paddingBottom: "calc(var(--space-3) + env(safe-area-inset-bottom, 0px))",
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {/* Primary confirm: हाँ, सही है / Looks right */}
          <button
            type="button"
            id="looks-right-btn"
            disabled={isSubmitting}
            onClick={() => {
              setIsSubmitting(true);
              onConfirm(data.draftId);
            }}
            style={{
              width: "100%",
              minHeight: "var(--tap-target-primary)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--color-brand)",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "var(--text-body-lg)",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Check size={20} />
            <span>{isSubmitting ? (lang === "hi" ? "दर्ज हो रहा है..." : "Submitting...") : (lang === "hi" ? "हाँ, सही है" : "Looks right")}</span>
          </button>

          {/* Secondary change: बदलें / Change */}
          <button
            type="button"
            id="change-btn"
            disabled={isSubmitting}
            onClick={onChange}
            style={{
              width: "100%",
              minHeight: "var(--tap-target-min)",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "inherit",
              fontSize: "var(--text-body)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {lang === "hi" ? "बदलें" : "Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

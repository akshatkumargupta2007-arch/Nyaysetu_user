import { authHeaders } from "../features/auth/token.js";
// Build map #D3 — Home / Report screen (B§§2.2 Screen 1).
// D4 — real usePushToTalk wired in; stub removed.
//
// Remaining stubs (ticket references in comments):
//   • usePhotoInput  → #D5 (EXIF read + Cloudinary direct upload)
//   • useLocation    → #D6 (Geolocation + boundary reverse-label)
//   • complaints list → #D8 (anonymous device token + API)
//
// Minimalism contract (Phase D intro):
//   ✗ No category pickers, dropdowns, or login wall.
//   ✗ Submit is the ONLY primary button.
//   ✓ Mic and photo are big but visually secondary once content exists.

import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { usePushToTalk } from "../features/voice/usePushToTalk.js";
import type { RecordingState } from "../features/voice/usePushToTalk.js";
import { usePhotoUpload } from "../features/photo/usePhotoUpload.js";
import { useLocation, DEFAULT_BHILAI_COORDS } from "../features/location/useLocation.js";
import type { LocationState } from "../features/location/useLocation.js";
import { LocationPickerModal } from "../components/LocationPickerModal.js";
import { UnderstoodCard, type UnderstandPayload } from "../components/UnderstoodCard.js";
import { useSession, type ComplaintItem } from "../features/session/useSession.js";
import { ComplaintCard } from "../components/ComplaintCard.js";
import { useOfflineDraft } from "../features/offline/useOfflineDraft.js";

// ─── sub-components ───────────────────────────────────────────────────────────

function MicButton({
  recordingState,
  hasContent,
  onPointerDown,
  onPointerUp,
  label,
  recordingLabel,
  transcribingLabel,
  errorLabel,
}: {
  recordingState: RecordingState;
  hasContent: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  label: string;
  recordingLabel: string;
  transcribingLabel: string;
  errorLabel: string;
}) {
  const isRecording    = recordingState === "recording";
  const isTranscribing = recordingState === "transcribing";
  const isError        = recordingState === "error";
  const active         = isRecording || isTranscribing;

  // The button shrinks slightly once the citizen has typed/spoken content,
  // so Submit can become the visual hero.
  const size = hasContent ? 64 : 88;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: hasContent ? "var(--space-2) 0" : "var(--space-3) 0",
        transition: "padding 0.25s ease",
      }}
    >
      {/* Ripple ring — visible only while recording */}
      <div style={{ position: "relative", width: size, height: size }}>
        {isRecording && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "var(--color-brand)",
              animation: "mic-ripple 1s ease-out infinite",
            }}
          />
        )}

        <button
          type="button"
          id="mic-btn"
          aria-label={active ? recordingLabel : label}
          aria-pressed={active}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp} // cancel if finger slides off
          style={{
            position: "relative",
            width: size,
            height: size,
            borderRadius: "50%",
            border: "none",
            background: active
              ? "var(--color-brand-dark)"
              : "var(--color-brand)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.38,
            boxShadow: active
              ? "0 0 0 4px var(--color-brand-light)"
              : "var(--shadow-elevated)",
            animation: isRecording
              ? "mic-pulse 0.9s ease-in-out infinite"
              : "none",
            transition:
              "background 0.15s, box-shadow 0.15s, width 0.25s ease, height 0.25s ease, font-size 0.25s ease",
            flexShrink: 0,
          }}
        >
          {isTranscribing ? "⏳" : isError ? "❌" : "🎤"}
        </button>
      </div>

      <span
        style={{
          fontSize: "var(--text-small)",
          color: isError
            ? "var(--color-danger)"
            : active
            ? "var(--color-brand)"
            : "var(--color-text-muted)",
          fontWeight: active || isError ? 600 : 400,
          transition: "color 0.15s",
        }}
      >
        {isError ? errorLabel : isTranscribing ? transcribingLabel : active ? recordingLabel : label}
      </span>
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded || value.length > 0;

  return (
    <div style={{ width: "100%" }}>
      {!show ? (
        // Collapsed: a tappable single-line hint
        <button
          type="button"
          id="text-expand-btn"
          onClick={() => setExpanded(true)}
          style={{
            width: "100%",
            minHeight: "var(--tap-target-min)",
            background: "var(--color-surface)",
            border: "1.5px dashed var(--color-border)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-text-muted)",
            fontFamily: "inherit",
            fontSize: "var(--text-body)",
            textAlign: "left",
            padding: "0 var(--space-3)",
            cursor: "text",
          }}
        >
          {placeholder}
        </button>
      ) : (
        <textarea
          id="complaint-text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: 96,
            resize: "vertical",
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-brand)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-text)",
            fontFamily: "inherit",
            fontSize: "var(--text-body)",
            lineHeight: "var(--line-height-body)",
            padding: "var(--space-2) var(--space-3)",
            outline: "none",
            animation: "expand-in 0.2s ease",
          }}
        />
      )}
    </div>
  );
}

function PhotoButton({
  photoDataUrl,
  isUploading,
  uploadProgress,
  onOpenSheet,
  onRemove,
  cta,
  removeLabel,
}: {
  photoDataUrl: string | null;
  isUploading: boolean;
  uploadProgress: number;
  onOpenSheet: () => void;
  onRemove: () => void;
  cta: string;
  removeLabel: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      {photoDataUrl ? (
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <img
            src={photoDataUrl}
            alt="Complaint attachment"
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-md)",
              border: "2px solid var(--color-brand)",
              objectFit: "cover",
              display: "block",
            }}
          />
          {isUploading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "var(--radius-md)",
                background: "rgba(0, 0, 0, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {uploadProgress}%
            </div>
          )}
          <button
            type="button"
            id="photo-remove-btn"
            onClick={onRemove}
            aria-label={removeLabel}
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "2px solid var(--color-bg)",
              background: "var(--color-danger)",
              color: "#fff",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          id="photo-add-btn"
          onClick={onOpenSheet}
          style={{
            minHeight: "var(--tap-target-min)",
            padding: "0 var(--space-3)",
            borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontFamily: "inherit",
            fontSize: "var(--text-body)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
          }}
        >
          <span aria-hidden="true">📷</span>
          {cta}
        </button>
      )}
    </div>
  );
}

function PhotoOptionSheet({
  isOpen,
  onClose,
  onCamera,
  onGallery,
  cameraLabel,
  galleryLabel,
  cancelLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  cameraLabel: string;
  galleryLabel: string;
  cancelLabel: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      id="photo-sheet-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        id="photo-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--color-surface)",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          padding: "var(--space-4) var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.12)",
        }}
      >
        <button
          type="button"
          id="photo-camera-btn"
          onClick={() => {
            onClose();
            onCamera();
          }}
          style={{
            width: "100%",
            minHeight: "var(--tap-target-min)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            fontFamily: "inherit",
            fontSize: "var(--text-body-lg)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
          }}
        >
          <span>📷</span>
          <span>{cameraLabel}</span>
        </button>

        <button
          type="button"
          id="photo-gallery-btn"
          onClick={() => {
            onClose();
            onGallery();
          }}
          style={{
            width: "100%",
            minHeight: "var(--tap-target-min)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            fontFamily: "inherit",
            fontSize: "var(--text-body-lg)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
          }}
        >
          <span>🖼️</span>
          <span>{galleryLabel}</span>
        </button>

        <button
          type="button"
          id="photo-sheet-cancel-btn"
          onClick={onClose}
          style={{
            width: "100%",
            minHeight: "var(--tap-target-min)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--color-text-muted)",
            fontFamily: "inherit",
            fontSize: "var(--text-body)",
            cursor: "pointer",
            marginTop: "var(--space-1)",
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

function LocationChip({
  locState,
  label,
  onRequest,
  idleLabel,
  detectingLabel,
  deniedLabel,
}: {
  locState: LocationState;
  label: string;
  onRequest: () => void;
  idleLabel: string;
  detectingLabel: string;
  deniedLabel: string;
}) {
  const isPoor   = locState === "poor";
  const isDenied = locState === "denied";

  const chipColor = isDenied || isPoor
    ? "var(--color-status-amber)"
    : locState === "ok"
    ? "var(--color-brand)"
    : "var(--color-text-muted)";

  const chipBg = isDenied || isPoor
    ? "var(--color-status-amber-bg)"
    : locState === "ok"
    ? "var(--color-brand-light)"
    : "var(--color-surface)";

  const text =
    locState === "detecting" ? detectingLabel :
    locState === "denied"    ? deniedLabel :
    locState === "ok" || locState === "poor" ? `📍 ${label}` :
    idleLabel;

  return (
    <button
      type="button"
      id="location-chip-btn"
      onClick={onRequest}
      style={{
        minHeight: "var(--tap-target-min)",
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-full)",
        border: `1.5px solid ${chipColor}`,
        background: chipBg,
        color: chipColor,
        fontFamily: "inherit",
        fontSize: "var(--text-small)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "background 0.2s, color 0.2s, border-color 0.2s",
      }}
    >
      {locState === "detecting" ? "⏳" : locState === "ok" ? "" : "📍"}{" "}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </button>
  );
}

function ComplaintsBelow({
  heading,
  empty,
  reports,
  lang,
}: {
  heading: string;
  empty: string;
  reports: ComplaintItem[];
  lang: "hi" | "en";
}) {
  const topThree = reports.slice(0, 3);

  return (
    <section
      style={{
        marginTop: "var(--space-5)",
        paddingTop: "var(--space-4)",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {heading}
        </h2>
        {reports.length > 3 && (
          <Link
            to="/my"
            style={{
              fontSize: "var(--text-small)",
              color: "var(--color-brand)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {lang === "hi" ? "सब देखें →" : "View all →"}
          </Link>
        )}
      </div>

      {topThree.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-body)", margin: 0 }}>
          {empty}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {topThree.map((item) => (
            <ComplaintCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8080`;

export default function Home() {
  const { t, lang } = useLanguage();

  // draft state
  const [text, setText] = useState("");
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  // D8 — session
  const session = useSession(API_URL);

  // D4 — real push-to-talk
  const mic = usePushToTalk({
    apiUrl: API_URL,
    lang,
    onTranscript: useCallback((transcript: string) => {
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }, []),
    // errors surface via mic.state === "error" + the errorLabel prop on MicButton
    onError: useCallback(() => { /* intentionally empty */ }, []),
  });

  // D6 — real location hook with jurisdiction reverse-labeling
  const loc = useLocation({ apiUrl: API_URL, lang });
  const [showLocationModal, setShowLocationModal] = useState(false);

  // D5 — real photo upload with EXIF and client resize
  const photo = usePhotoUpload({
    apiUrl: API_URL,
    onExifLocation: useCallback(
      ({ lat, lng }: { lat: number; lng: number }) => {
        if (loc.source !== "pin") {
          void loc.setManualLocation(lat, lng, "exif");
        }
      },
      [loc],
    ),
  });

  const hasContent = text.trim().length > 0 || photo.state.previewUrl !== null;
  const canSubmit = text.trim().length > 0;

  const [understoodData, setUnderstoodData] = useState<UnderstandPayload | null>(null);
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // D10 — offline draft queue
  const offline = useOfflineDraft({
    apiUrl: API_URL,
    onAutoSubmitSuccess: (payload, draft) => {
      setText(draft.text);
      setUnderstoodData(payload);
    },
  });

  const handleSubmit = async () => {
    if (!canSubmit || isUnderstanding) return;

    const coords = loc.coords ?? DEFAULT_BHILAI_COORDS;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await offline.queueDraft({
        text: text.trim(),
        lang,
        lat: coords.lat,
        lng: coords.lng,
        photoPreviewUrl: photo.state.previewUrl,
      });
      return;
    }

    setIsUnderstanding(true);
    try {
      const res = await fetch(`${API_URL}/reports/understand`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          text: text.trim(),
          lang,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as UnderstandPayload;
        setUnderstoodData(data);
      } else {
        alert(t("home.error.generic"));
      }
    } catch {
      // Network failure while submitting -> save draft to queue
      await offline.queueDraft({
        text: text.trim(),
        lang,
        lat: coords.lat,
        lng: coords.lng,
        photoPreviewUrl: photo.state.previewUrl,
      });
    } finally {
      setIsUnderstanding(false);
    }
  };

  const handleFinalConfirm = async (draftId: string) => {
    setIsUnderstanding(true);
    try {
      const res = await fetch(`${API_URL}/reports/confirm`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`
        },
        body: JSON.stringify({
          draftId,
          text,
          lang,
          lat: loc.coords?.lat ?? DEFAULT_BHILAI_COORDS.lat,
          lng: loc.coords?.lng ?? DEFAULT_BHILAI_COORDS.lng,
          categoryCode: understoodData?.understanding.category_code,
          summaryCitizen: understoodData?.understanding.summary_citizen,
          summaryOfficerEn: understoodData?.understanding.summary_officer_en,
          boundaryId: understoodData?.boundaryId,
          agencyId: understoodData?.routing.agencyId,
          department: understoodData?.understanding.entities.landmark ? { hi: understoodData.understanding.entities.landmark, en: understoodData.understanding.entities.landmark } : undefined,
          priorityScore: understoodData?.priority.score_0_100,
          priorityBand: understoodData?.priority.level === "low" ? "Low" : understoodData?.priority.level === "medium" ? "Medium" : understoodData?.priority.level === "high" ? "High" : "Critical",
          severity: understoodData?.understanding.severity_0_100,
          hazards: understoodData?.understanding.hazards,
          confidence: understoodData?.understanding.model_confidence,
          tenantId: understoodData?.tenantId ?? "cg.bhilai",
        }),
      });

      if (res.ok) {
        setSubmitSuccess(draftId);
        setUnderstoodData(null);
        setText("");
        photo.clearPhoto();
        void session.refreshReports();
      } else {
        alert(t("home.error.generic"));
      }
    } catch {
      alert(t("home.error.generic"));
    } finally {
      setIsUnderstanding(false);
    }
  };

  const handleClarifyReply = async (answer: string) => {
    const augmentedText = `${text} — ${answer}`;
    setText(augmentedText);
    setIsUnderstanding(true);
    try {
      const coords = loc.coords ?? DEFAULT_BHILAI_COORDS;
      const res = await fetch(`${API_URL}/reports/understand`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          text: augmentedText,
          lang,
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as UnderstandPayload;
        setUnderstoodData(data);
      }
    } catch {
      // Keep existing data
    } finally {
      setIsUnderstanding(false);
    }
  };

  if (understoodData) {
    return (
      <UnderstoodCard
        data={understoodData}
        originalText={text}
        photoUrl={photo.state.previewUrl}
        locationLabel={loc.label}
        lang={lang}
        onConfirm={handleFinalConfirm}
        onChange={() => setUnderstoodData(null)}
        onClarifyReply={handleClarifyReply}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
      }}
    >
      {/* ── scrollable content area ─────────────────────────────────── */}
      <main
        id="home-report-screen"
        style={{
          flex: 1,
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-4) var(--space-3)",
          paddingBottom: "calc(var(--tap-target-primary) + var(--space-5))",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {/* Offline banner if draft was queued (#D10) */}
        {offline.showOfflineBanner && (
          <div
            id="offline-banner"
            style={{
              background: "var(--color-status-amber-bg, #fef3c7)",
              color: "var(--color-status-amber, #d97706)",
              border: "1.5px solid var(--color-status-amber, #d97706)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "var(--text-small)",
              fontWeight: 600,
            }}
          >
            <span>
              📡 {lang === "hi" ? "नेटवर्क नहीं है — आते ही भेज देंगे" : "No network — will send as soon as connected"}
            </span>
            <button
              type="button"
              onClick={() => offline.setShowOfflineBanner(false)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Success banner if previous draft confirmed */}
        {submitSuccess && (
          <div
            id="submit-success-banner"
            style={{
              background: "var(--color-status-green-bg, #ecfdf5)",
              color: "var(--color-status-green, #15803d)",
              border: "1.5px solid var(--color-status-green, #15803d)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              ✅ {lang === "hi" ? "आपकी शिकायत दर्ज कर ली गई है!" : "Your complaint has been submitted!"}
            </span>
            <button
              type="button"
              onClick={() => setSubmitSuccess(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Heading */}
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: 700,
            lineHeight: "var(--line-height-heading)",
            marginBottom: "var(--space-1)",
          }}
        >
          {t("home.heading")}
        </h1>

        {/* ── Mic button ─────────────────────────────────────────────── */}
        <MicButton
          recordingState={mic.state}
          hasContent={hasContent}
          onPointerDown={mic.onPointerDown}
          onPointerUp={mic.onPointerUp}
          label={t("home.mic.hold")}
          recordingLabel={t("home.mic.recording")}
          transcribingLabel={t("home.mic.transcribing")}
          errorLabel={t("home.mic.error")}
        />

        {/* ── Text box ───────────────────────────────────────────────── */}
        <TextArea
          value={text}
          onChange={setText}
          placeholder={t("home.text.placeholder")}
        />

        {/* ── Photo + Location row ───────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <PhotoButton
            photoDataUrl={photo.state.previewUrl}
            isUploading={photo.state.isUploading}
            uploadProgress={photo.state.uploadProgress}
            onOpenSheet={() => setShowPhotoSheet(true)}
            onRemove={photo.clearPhoto}
            cta={t("home.photo.cta")}
            removeLabel={t("home.photo.remove")}
          />
          <LocationChip
            locState={loc.state}
            label={loc.label || (loc.coords ? `${loc.coords.lat.toFixed(4)}, ${loc.coords.lng.toFixed(4)}` : "")}
            onRequest={() => setShowLocationModal(true)}
            idleLabel={t("home.location.label")}
            detectingLabel={t("home.location.detecting")}
            deniedLabel={t("home.location.denied")}
          />
        </div>

        {/* ── Below fold: complaints list ────────────────────────────── */}
        <ComplaintsBelow
          heading={t("home.complaints.heading")}
          empty={t("home.complaints.empty")}
          reports={session.reports}
          lang={lang}
        />
      </main>

      {/* ── Photo camera / gallery sheet (#D5) ──────────────────────── */}
      <PhotoOptionSheet
        isOpen={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onCamera={photo.openCamera}
        onGallery={photo.openGallery}
        cameraLabel={t("home.photo.camera")}
        galleryLabel={t("home.photo.gallery")}
        cancelLabel={lang === "hi" ? "रद्द करें" : "Cancel"}
      />

      {/* ── Location picker map modal (#D6) ────────────────────────── */}
      <LocationPickerModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        initialCoords={loc.coords}
        onConfirm={(lat, lng) => void loc.setManualLocation(lat, lng, "pin")}
        lang={lang}
        hintDenied={loc.state === "denied" || loc.state === "poor"}
      />

      {/* Hidden file inputs for camera & gallery */}
      <input
        ref={photo.cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={photo.handleInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />
      <input
        ref={photo.galleryInputRef}
        type="file"
        accept="image/*"
        onChange={photo.handleInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* ── Submit bar — sticky at bottom of viewport ───────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "var(--space-2) var(--space-3)",
          paddingBottom: "calc(var(--space-2) + env(safe-area-inset-bottom, 0px))",
          background: "var(--color-bg)",
          borderTop: canSubmit ? "1px solid var(--color-brand-light)" : "1px solid var(--color-border)",
          zIndex: 20,
          animation: "slide-up 0.3s ease",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <button
            type="button"
            id="submit-btn"
            disabled={!canSubmit || isUnderstanding}
            aria-disabled={!canSubmit || isUnderstanding}
            onClick={handleSubmit}
            style={{
              width: "100%",
              minHeight: "var(--tap-target-primary)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: canSubmit && !isUnderstanding ? "var(--color-brand)" : "var(--color-border)",
              color: canSubmit && !isUnderstanding ? "var(--color-action-text)" : "var(--color-text-muted)",
              fontFamily: "inherit",
              fontSize: "var(--text-body-lg)",
              fontWeight: 700,
              cursor: canSubmit && !isUnderstanding ? "pointer" : "not-allowed",
              transition: "background 0.2s, color 0.2s, transform 0.1s",
              transform: "scale(1)",
            }}
            onPointerDown={(e) => {
              if (canSubmit && !isUnderstanding) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            {isUnderstanding ? t("home.submit.sending") : t("home.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}


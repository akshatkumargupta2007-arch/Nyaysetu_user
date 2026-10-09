import { authHeaders } from "../features/auth/token.js";
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "../i18n/LanguageContext.js";
import { CategoryIcon } from "../components/CategoryIcon.js";
import { useTicketStream } from "../features/tracking/useTicketStream.js";
import { useSession } from "../features/session/useSession.js";
import type { TrackingView, CitizenStage, TimelineEntry } from "../features/tracking/useTicketStream.js";

// Re-export so other modules can still reference the types from this page
export type { TrackingView, CitizenStage, TimelineEntry };

// Leaflet custom dot icon for the DISPATCHED map
const dotSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="8" cy="8" r="6" /></svg>`;
const customDotIcon = L.divIcon({
  html: `<div style="color: #2563eb;">${dotSvg}</div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});


// Map internal stages to Stepper steps
const STEPPER_STAGES: CitizenStage[] = [
  "RECEIVED",
  "VERIFIED",
  "ASSIGNED",
  "DISPATCHED",
  "CLOSED", // Represents "Resolved?"
];

export default function Tracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiUrl = import.meta.env.VITE_API_URL as string;

  // Get the device token from session so the SSE stream can auth itself
  const { token } = useSession(apiUrl);

  // #E5 — live stream replaces the one-shot fetch
  const { data, connected } = useTicketStream(id, token);
  const loading = data === null && connected === "connecting";

  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (data?.stage === "DISPATCHED" && mapRef.current) {
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false,
        }).setView([data.lat, data.lng], 15);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: "OSM",
        }).addTo(mapInstance.current);
        markerRef.current = L.marker([data.lat, data.lng], { icon: customDotIcon }).addTo(mapInstance.current);
      } else {
        markerRef.current?.setLatLng([data.lat, data.lng]);
        mapInstance.current.panTo([data.lat, data.lng], { animate: true, duration: 1.5 });
      }
    }
  }, [data?.stage, data?.lat, data?.lng]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const handleConfirm = async (confirmed: boolean) => {
    try {
      const payload = {
        confirmed,
        note: confirmed ? undefined : rejectNote,
      };
      const res = await fetch(`${apiUrl}/reports/${data?.id}/confirm-closure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to confirm");
      }
      if (!confirmed) {
        setShowRejectForm(false);
        setRejectNote("");
      }
    } catch (e) {
      console.error(e);
      alert("Error confirming closure");
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center text-gray-500 text-lg">Loading...</div>;
  }
  if (!data) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-4 text-gray-700">
        <p className="text-xl">Ticket not found</p>
        <button className="bg-gray-200 px-6 py-3 rounded-full font-medium" onClick={() => navigate("/")}>
          Go Home
        </button>
      </div>
    );
  }

  // Determine active step index
  let activeIndex = STEPPER_STAGES.indexOf(data.stage);
  if (data.stage === "RESOLVED_PROMPT") activeIndex = 4; // Same as CLOSED visually for stepper end

  // Helper for formatting durations
  const formatDuration = (ms: number | null) => {
    if (ms === null) return null;
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-gray-50 pb-24">
      <div className="bg-white p-4 shadow-sm border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center shrink-0">
            <CategoryIcon name="alert-triangle" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {data.summary}
            </h1>
            <p className="text-sm text-gray-500 font-mono mt-1">
              ID: {data.publicCode}
            </p>
          </div>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              connected === "open"
                ? "bg-green-500 animate-pulse"
                : connected === "connecting"
                ? "bg-yellow-400 animate-pulse"
                : "bg-gray-300"
            }`}
          />
          <span className="hidden sm:inline">
            {connected === "open"
              ? lang === "hi" ? "लाइव" : "Live"
              : connected === "connecting"
              ? lang === "hi" ? "जुड़ रहे हैं" : "Connecting"
              : lang === "hi" ? "ऑफलाइन" : "Offline"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Top Status Line */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-blue-900 flex flex-col gap-1">
          <p className="text-lg font-medium">
            {data.timeline.length > 0 ? data.timeline[data.timeline.length - 1].label[lang] : ""}
          </p>
          {data.etaText && (
            <p className="text-sm text-blue-700 opacity-90">
              {data.etaText}
            </p>
          )}
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-6">
            {STEPPER_STAGES.map((stepStage, index) => {
              const isCompleted = index <= activeIndex;
              const isCurrent = index === activeIndex;
              const stepTimelineEntries = data.timeline.filter((ev) => {
                // Approximate mapping for stepper
                if (stepStage === "RECEIVED") return ev.icon === "inbox";
                if (stepStage === "VERIFIED") return ev.icon === "check-circle";
                if (stepStage === "ASSIGNED") return ev.icon === "briefcase" || ev.icon === "arrow-right-left" || ev.icon === "alert-circle";
                if (stepStage === "DISPATCHED") return ev.icon === "truck";
                if (stepStage === "CLOSED") return ev.icon === "image" || ev.icon === "check-circle-2" || ev.icon === "check" || ev.icon === "x-circle";
                return false;
              });

              // Labels for stepper
              const labelHi = stepStage === "RECEIVED" ? "मिल गई"
                : stepStage === "VERIFIED" ? "जाँच हो गई"
                : stepStage === "ASSIGNED" ? "विभाग को सौंपी"
                : stepStage === "DISPATCHED" ? "टीम रवाना"
                : "ठीक हुआ?";
              const labelEn = stepStage === "RECEIVED" ? "Received"
                : stepStage === "VERIFIED" ? "Verified"
                : stepStage === "ASSIGNED" ? "Assigned"
                : stepStage === "DISPATCHED" ? "Team dispatched"
                : "Resolved?";

              // Is this step red? (e.g. Reopened)
              const hasRed = stepTimelineEntries.some(ev => ev.isRed);

              return (
                <div key={stepStage} className="flex relative">
                  {/* Line */}
                  {index < STEPPER_STAGES.length - 1 && (
                    <div className={`absolute top-8 bottom-[-24px] left-[15px] w-0.5 ${index < activeIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 shrink-0 ${
                        hasRed && isCurrent ? "bg-red-100 text-red-600 border-2 border-red-500" :
                        isCompleted ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {isCompleted && !hasRed ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-lg font-medium ${isCompleted ? (hasRed && isCurrent ? 'text-red-700' : 'text-gray-900') : 'text-gray-400'}`}>
                          {lang === "hi" ? labelHi : labelEn}
                        </span>
                        {stepStage === "ASSIGNED" && isCompleted && data.department && (
                          <span className="text-sm text-gray-500 mt-0.5 leading-tight">
                            {data.department[lang]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expandable Journey Timeline */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <button 
            onClick={() => setTimelineExpanded(!timelineExpanded)}
            className="w-full p-4 flex items-center justify-between text-left focus:outline-none bg-gray-50"
          >
            <span className="font-medium text-gray-800">
              {lang === "hi" ? "पूरा सफ़र देखें" : "View full journey"}
            </span>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${timelineExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {timelineExpanded && (
            <div className="p-4 border-t border-gray-100 flex flex-col gap-4">
              {data.timeline.map((entry, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="w-8 flex flex-col items-center shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.isRed ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {/* Simple dot fallback for icons */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                    </div>
                    {idx < data.timeline.length - 1 && (
                      <div className="w-px h-full bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex flex-col pb-4 flex-grow">
                    <span className={`font-medium ${entry.isRed ? 'text-red-700' : 'text-gray-900'}`}>
                      {entry.label[lang]}
                    </span>
                    {entry.actorLabel && (
                      <span className="text-gray-500 mt-0.5">{entry.actorLabel[lang]}</span>
                    )}
                    <div className="flex justify-between items-center mt-1 text-gray-400 text-xs">
                      <span>{new Date(entry.timestamp).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-US', {hour: '2-digit', minute:'2-digit'})}</span>
                      {entry.durationMs && (
                        <span>+{formatDuration(entry.durationMs)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map (Only if DISPATCHED) */}
        {data.stage === "DISPATCHED" && (
          <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-48 relative">
            <div ref={mapRef} className="absolute inset-0 z-0" />
            <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm border border-gray-100 pointer-events-none">
              {lang === "hi" ? "लाइव लोकेशन" : "Live location"}
            </div>
          </div>
        )}

        {/* Closure Prompt (Only if RESOLVED_PROMPT) */}
        {data.stage === "RESOLVED_PROMPT" && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-200 mt-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">
              {lang === "hi" ? "क्या समस्या सच में ठीक हो गई?" : "Is the problem actually fixed?"}
            </h2>
            
            {/* Before / After Split View */}
            <div className="flex gap-2 h-40">
              <div className="flex-1 relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                {data.beforePhotoUrl ? (
                  <img src={data.beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400">No Photo</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center font-medium">
                  {lang === "hi" ? "पहले (Before)" : "Before"}
                </div>
              </div>
              <div className="flex-1 relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                {data.afterPhotoUrl ? (
                  <img src={data.afterPhotoUrl} alt="After" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400">No Photo</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center font-medium">
                  {lang === "hi" ? "बाद में (After)" : "After"}
                </div>
              </div>
            </div>

            {!showRejectForm ? (
              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={() => handleConfirm(true)}
                  className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  ✅ {lang === "hi" ? "हाँ, ठीक हो गई" : "Yes, it's fixed"}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="w-full bg-red-500 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  ❌ {lang === "hi" ? "नहीं, अभी भी है" : "No, it's still there"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  placeholder={lang === "hi" ? "क्या दिक्कत है, बताइए..." : "What's the issue?..."}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
                <button
                  onClick={() => handleConfirm(false)}
                  className="w-full bg-red-500 text-white py-4 rounded-xl text-lg font-bold flex items-center justify-center shadow-sm"
                >
                  {lang === "hi" ? "शिकायत दोबारा खोलें" : "Reopen complaint"}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="w-full text-gray-500 py-2 font-medium"
                >
                  {lang === "hi" ? "रद्द करें" : "Cancel"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-xs text-gray-400 py-2">
          {lang === "hi" ? "अंतिम अपडेट:" : "Last updated:"} {new Date(data.lastUpdated).toLocaleString()}
        </div>
      </div>

      {/* Fixed Bottom Voice Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <button className="w-full bg-gray-900 text-white rounded-2xl py-4 font-medium text-lg shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
            {lang === "hi" ? "अपनी शिकायत के बारे में पूछिए" : "Ask about my complaint"}
          </button>
        </div>
      </div>
    </div>
  );
}

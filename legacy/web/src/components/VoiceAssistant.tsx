import { useState, useRef, useEffect } from "react";
import { Mic, X } from "lucide-react";
import { usePushToTalk } from "../features/voice/usePushToTalk.js";
import { useLanguage } from "../i18n/LanguageContext.js";

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8080`;

export function VoiceAssistant() {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // We reuse the audio capturing logic but point it to /voice/ask manually
  // Actually, usePushToTalk currently hardcodes /voice/transcribe. 
  // Let's modify our own push-to-talk logic for the voice assistant, or just use MediaRecorder.
  // Since we want this to be simple, let's implement a basic MediaRecorder here.
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const mime = mediaRecorder.current?.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        
        setIsRecording(false);
        setTranscript("...");
        setAnswer("");
        
        const form = new FormData();
        form.append("audio", blob, "audio.webm");

        try {
          const res = await fetch(`${API_URL}/voice/ask`, {
            method: "POST",
            body: form,
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("nyaysetu_citizen_token") || ""}`
            }
          });
          
          if (!res.ok) throw new Error("Voice ask failed");
          
          const data = await res.json();
          setAnswer(data.answer);
          setTranscript("Voice query processed.");
          setAudioUrl(data.ttsUrl);
        } catch (err) {
          console.error(err);
          setAnswer(lang === "hi" ? "क्षमा करें, त्रुटि हुई।" : "Sorry, an error occurred.");
          setTranscript("");
        }
        
        stream.getTracks().forEach(t => t.stop());
      };

      chunksRef.current = [];
      mediaRecorder.current.start();
      setIsRecording(true);
      setTranscript(lang === "hi" ? "सुन रहे हैं..." : "Listening...");
      setAnswer("");
    } catch (err) {
      console.error(err);
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
  };

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [audioUrl]);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "var(--color-brand)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 1000
          }}
        >
          <Mic size={32} />
        </button>
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          backgroundColor: "var(--color-surface)",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          padding: "1.5rem",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem"
        }}>
          <button 
            onClick={() => setIsOpen(false)}
            style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none" }}
          >
            <X size={24} />
          </button>

          <h3 className="h3">
            {lang === "hi" ? "अपनी शिकायत के बारे में पूछें" : "Ask about your complaint"}
          </h3>

          <div style={{ minHeight: "4rem", textAlign: "center" }}>
            {transcript && (
              <p style={{ color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: "0.5rem" }}>
                "{transcript}"
              </p>
            )}
            {answer && (
              <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--color-text)" }}>
                {answer}
              </p>
            )}
          </div>

          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: isRecording ? "var(--color-danger)" : "var(--color-brand)",
              color: "white",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: isRecording ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.2s, background-color 0.2s"
            }}
          >
            <Mic size={40} />
          </button>
          
          <p className="label" style={{ margin: 0 }}>
            {lang === "hi" ? "(बोलने के लिए दबाए रखें)" : "(Hold to speak)"}
          </p>

          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} controls />
          )}
        </div>
      )}
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficerAuth } from "../features/officer/useOfficerAuth.js";
import { CategoryIcon } from "../components/CategoryIcon.js";

interface Job {
  id: string;
  publicCode: string;
  state: string;
  categoryName: { en: string; hi: string };
  categoryIcon: string;
  geom: { type: "Point"; coordinates: [number, number] };
  slaDueAt: string;
  summaryOfficerEn: string;
}

export default function FieldApp() {
  const { token, isAuthenticated } = useOfficerAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  const wakeLockRef = useRef<any>(null);
  const locationIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/officer/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/field/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setJobs(data.jobs || []))
      .catch(console.error);
    }
  }, [token]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.error("Wake Lock error:", err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const startTrip = async (job: Job) => {
    if (!token) return;
    
    // Transition to DISPATCHED
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/tickets/${job.id}/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          toState: "DISPATCHED",
          actor: { type: "FIELD", id: "demo-field-worker" },
          payload: {}
        })
      });
      
      setActiveJobId(job.id);
      await requestWakeLock();

      // Start sending GPS every 15s
      // Mocking GPS start point based on job coordinates, then slightly changing it
      let currentLat = job.geom?.coordinates[1] - 0.01;
      let currentLng = job.geom?.coordinates[0] - 0.01;

      const sendLocation = () => {
        currentLat += 0.001; // simulate moving
        currentLng += 0.001;

        fetch(`${import.meta.env.VITE_API_URL}/field/tickets/${job.id}/location`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ lat: currentLat, lng: currentLng })
        }).catch(console.error);
      };

      sendLocation(); // initial send
      locationIntervalRef.current = setInterval(sendLocation, 15000);

    } catch (err) {
      console.error(err);
      alert("Failed to start trip");
    }
  };

  const stopTrip = async () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    await releaseWakeLock();
    setActiveJobId(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleWorkDoneClick = (job: Job) => {
    // Trigger file picker
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeJobId || !token) return;

    // Read as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      const mime = file.type;

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/field/tickets/${activeJobId}/work-done`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            lat: 21.19, // mock gps
            lng: 81.35,
            photoBase64: base64,
            photoMime: mime,
            exifTakenAt: new Date().toISOString()
          })
        });

        const data = await res.json();
        if (!res.ok) {
          alert(`Rejected by Proof Gates: ${data.error}`);
        } else {
          alert(`Success! Work submitted. Flags: ${data.flags.join(", ") || "None"}`);
          // Remove job from list
          setJobs(prev => prev.filter(j => j.id !== activeJobId));
          stopTrip();
        }
      } catch (err) {
        console.error(err);
        alert("Failed to submit work");
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isAuthenticated) return null;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem" }}>
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={onPhotoSelected}
      />
      <header style={{ marginBottom: "2rem" }}>
        <h1 className="h1">Field App</h1>
        <p className="label">Your assigned jobs</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {jobs.length === 0 && <div>No assigned jobs.</div>}
        
        {jobs.map(job => {
          const isActive = activeJobId === job.id;
          
          return (
            <div 
              key={job.id} 
              style={{ 
                border: isActive ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", 
                borderRadius: "12px", 
                padding: "1.5rem",
                backgroundColor: "var(--color-surface)",
                boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.1)" : "none"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <CategoryIcon name={job.categoryIcon || "circle"} className="icon-lg" />
                <div style={{ textAlign: "right" }}>
                  <div className="label" style={{ color: new Date(job.slaDueAt) < new Date() ? "var(--color-danger)" : "inherit" }}>
                    Deadline: {new Date(job.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontWeight: 600 }}>{job.publicCode}</div>
                </div>
              </div>
              
              <h3 className="h3" style={{ marginBottom: "0.5rem" }}>{job.summaryOfficerEn || job.categoryName?.en}</h3>
              
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                {!isActive ? (
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1, padding: "1rem", fontSize: "1.1rem" }}
                    onClick={() => startTrip(job)}
                    disabled={activeJobId !== null} // disable if another trip is active
                  >
                    ▶ Start trip
                  </button>
                ) : (
                  <>
                    <button 
                      className="btn-primary" 
                      style={{ flex: 1, padding: "1rem", fontSize: "1.1rem", backgroundColor: "var(--color-success)" }}
                      onClick={() => handleWorkDoneClick(job)}
                    >
                      📷 Work done
                    </button>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: "1rem" }}
                      onClick={stopTrip}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

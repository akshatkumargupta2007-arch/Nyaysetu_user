import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOfficerAuth } from "../features/officer/useOfficerAuth.js";
import { CategoryIcon } from "../components/CategoryIcon.js";

// Helper to colour markers by priority band
function getPriorityColor(band: string) {
  switch (band) {
    case "CRITICAL": return "#dc2626"; // red
    case "HIGH": return "#f59e0b"; // amber
    case "MEDIUM": return "#2563eb"; // blue
    default: return "#10b981"; // green
  }
}

function createDotIcon(color: string) {
  const dotSvg = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="8" cy="8" r="6" /></svg>`;
  return L.divIcon({
    html: `<div style="color: ${color};">${dotSvg}</div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function OfficerConsole() {
  const { token, officer, logout, isAuthenticated } = useOfficerAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<any>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/officer/login");
    }
  }, [isAuthenticated, navigate]);

  const fetchDashboard = async () => {
    if (!token) return;
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/officer/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/officer/tickets?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ticketsRes.ok) setTickets((await ticketsRes.json()).tickets);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (selectedTicketId && token) {
      fetch(`${import.meta.env.VITE_API_URL}/officer/tickets/${selectedTicketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(d => setTicketDetails(d))
      .catch(console.error);
    } else {
      setTicketDetails(null);
    }
  }, [selectedTicketId, token]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    
    mapInstance.current = L.map(mapRef.current).setView([21.19, 81.35], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO",
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    if (!mapInstance.current) return;
    
    // Clear old markers not in current tickets
    const currentIds = new Set(tickets.map(t => t.id));
    for (const id in markersRef.current) {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    tickets.forEach(t => {
      if (!t.geom || !t.geom.coordinates) return;
      const [lng, lat] = t.geom.coordinates;
      
      if (!markersRef.current[t.id]) {
        const marker = L.marker([lat, lng], { icon: createDotIcon(getPriorityColor(t.priorityBand)) })
          .addTo(mapInstance.current!)
          .on('click', () => setSelectedTicketId(t.id));
        markersRef.current[t.id] = marker;
      } else {
        // update icon color if priority band changed
        markersRef.current[t.id].setIcon(createDotIcon(getPriorityColor(t.priorityBand)));
      }
    });

  }, [tickets]);

  if (!isAuthenticated || !officer) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top strip */}
      <header style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1rem", backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" 
      }}>
        <div>
          <h2 className="h2" style={{ margin: 0 }}>Officer Console - {officer.agencyId.toUpperCase()}</h2>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            Welcome, {officer.name} ({officer.role})
          </div>
        </div>
        
        {stats && (
          <div style={{ display: "flex", gap: "2rem", textAlign: "center" }}>
            <div>
              <div className="h2">{stats.open}</div>
              <div className="label">OPEN</div>
            </div>
            <div>
              <div className="h2" style={{ color: stats.breached > 0 ? "var(--color-danger)" : "inherit" }}>
                {stats.breached}
              </div>
              <div className="label">BREACHED</div>
            </div>
            <div>
              <div className="h2">{stats.awaitingCitizen}</div>
              <div className="label">AWAITING REVIEW</div>
            </div>
            <div>
              <div className="h2">{Math.round(stats.confirmedFixRate)}%</div>
              <div className="label">FIX RATE</div>
            </div>
          </div>
        )}
        
        <button className="btn-secondary" onClick={logout}>Logout</button>
      </header>

      {/* Main split */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left: Queue */}
        <div style={{ width: "400px", overflowY: "auto", borderRight: "1px solid var(--color-border)" }}>
          {tickets.map(t => (
            <div 
              key={t.id} 
              onClick={() => {
                setSelectedTicketId(t.id);
                if (t.geom && mapInstance.current) {
                  mapInstance.current.setView([t.geom.coordinates[1], t.geom.coordinates[0]], 16);
                }
              }}
              style={{ 
                padding: "1rem", 
                borderBottom: "1px solid var(--color-border)",
                backgroundColor: selectedTicketId === t.id ? "var(--color-surface-hover)" : "transparent",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span className="label" style={{ color: getPriorityColor(t.priorityBand) }}>
                  {t.priorityBand} ({Number(t.priorityScore).toFixed(1)})
                </span>
                <span className="label" style={{ color: new Date(t.slaDueAt) < new Date() ? "var(--color-danger)" : "inherit" }}>
                  SLA: {new Date(t.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <CategoryIcon name={t.categoryIcon || "circle"} className="icon-md" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.25rem" }}>{t.summaryOfficerEn || t.categoryName?.en}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                    {t.publicCode} • {t.boundaryName?.en || "Unknown Ward"} • {t.reportCount} reports
                  </div>
                  {(t.hazards?.length > 0 || t.needsHumanTriage) && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      {t.hazards?.map((h: string) => <span key={h} className="badge" style={{ backgroundColor: "var(--color-danger-light)", color: "var(--color-danger-dark)" }}>⚠️ {h}</span>)}
                      {t.needsHumanTriage && <span className="badge">Triage Needed</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Middle: Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Right: Detail Drawer */}
        {selectedTicketId && ticketDetails && (
          <div style={{ width: "450px", overflowY: "auto", borderLeft: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
            <div style={{ padding: "1rem", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)" }}>
              <h3 className="h3" style={{ margin: 0 }}>Ticket Details</h3>
              <button onClick={() => setSelectedTicketId(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>
            
            <div style={{ padding: "1rem" }}>
              <div className="label">Original Verbatim</div>
              <p style={{ margin: "0.5rem 0 1.5rem" }}>"{ticketDetails.ticket.priorityTerms?.verbatim || 'No verbatim text available'}"</p>

              <div className="label">Priority Breakdown (Score: {Number(ticketDetails.ticket.priorityScore).toFixed(1)})</div>
              <pre style={{ backgroundColor: "var(--color-surface-hover)", padding: "1rem", borderRadius: "8px", overflowX: "auto", fontSize: "0.8rem", margin: "0.5rem 0 1.5rem" }}>
                {JSON.stringify(ticketDetails.ticket.priorityTerms, null, 2)}
              </pre>

              <div className="label">Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", margin: "0.5rem 0 1.5rem" }}>
                <button className="btn-primary" onClick={() => alert("Assigning team...")}>Assign Team</button>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => alert("Transferring...")}>Transfer</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => alert("Rejecting...")}>Reject</button>
                </div>
              </div>

              <div className="label">Ledger Timeline</div>
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {ticketDetails.events.map((e: any) => (
                  <div key={e.id} style={{ fontSize: "0.875rem", borderLeft: "2px solid var(--color-border)", paddingLeft: "1rem" }}>
                    <div style={{ color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontWeight: 600 }}>{e.type}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>Actor: {e.actorType}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

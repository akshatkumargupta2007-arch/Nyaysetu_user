import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficerAuth } from "../features/officer/useOfficerAuth.js";
import { useLanguage } from "../i18n/LanguageContext.js";

export default function OfficerLogin() {
  const { t } = useLanguage();
  const { login } = useOfficerAuth();
  const navigate = useNavigate();

  const [agencyId, setAgencyId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/officer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, passcode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      login(data.token, data.officer);
      navigate("/officer"); // #F2 dashboard
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: "1rem" }}>
      <h1 className="h1">Officer Login</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="label">Agency ID (e.g. bmc)</label>
          <input
            type="text"
            className="input-text"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            required
            autoComplete="off"
            autoCapitalize="off"
          />
        </div>
        <div>
          <label className="label">Passcode</label>
          <input
            type="password"
            className="input-text"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
          />
        </div>
        {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Verifying..." : "Login"}
        </button>
      </form>
    </div>
  );
}

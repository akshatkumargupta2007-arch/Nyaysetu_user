import { useState, useEffect } from "react";

interface Officer {
  id: string;
  name: string;
  role: string;
  agencyId: string;
  tenantId: string;
  level: number;
}

export function useOfficerAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("officer_token"));
  const [officer, setOfficer] = useState<Officer | null>(() => {
    const stored = localStorage.getItem("officer_data");
    return stored ? JSON.parse(stored) : null;
  });

  const login = (newToken: string, newOfficer: Officer) => {
    localStorage.setItem("officer_token", newToken);
    localStorage.setItem("officer_data", JSON.stringify(newOfficer));
    setToken(newToken);
    setOfficer(newOfficer);
  };

  const logout = () => {
    localStorage.removeItem("officer_token");
    localStorage.removeItem("officer_data");
    setToken(null);
    setOfficer(null);
  };

  return { token, officer, login, logout, isAuthenticated: !!token };
}

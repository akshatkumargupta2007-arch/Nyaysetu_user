import { useCallback, useEffect, useState } from "react";
import { getToken, clearToken, authHeaders } from "../auth/token.js";

export interface ComplaintItem {
  id: string; ticketId: string; ticketCode: string; categoryCode: string;
  summary: string; state: string; createdAt: string; updatedAt: string;
}

/** Logged-in citizen's complaints (build map #D9). Token comes from Phone+OTP login (#D8). */
export function useSession(apiUrl: string) {
  const token = getToken();
  const [reports, setReports] = useState<ComplaintItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!getToken()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/me/reports`, { headers: authHeaders() });
      if (res.status === 401) { clearToken(); window.location.assign("/login"); return; }
      if (res.ok) setReports((await res.json()) as ComplaintItem[]);
    } catch { /* offline */ } finally { setIsLoading(false); }
  }, [apiUrl]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);
  return { token, reports, isLoading, refreshReports: fetchReports };
}

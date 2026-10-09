// Build map #D2 — Hindi/English toggle. Default: Hindi unless the browser
// reports a non-Hindi language. The toggle is remembered in localStorage
// and exposed as `lang` for API calls. A spoken complaint's detected
// language can override this per-report (Bible §2.4) via setLangOverride;
// the persisted toggle itself only changes when the citizen taps it.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import hi from "./hi.json";
import en from "./en.json";

export type Lang = "hi" | "en";

const DICTIONARIES: Record<Lang, Record<string, string>> = { hi, en };
const STORAGE_KEY = "nyaysetu.lang";

function detectDefaultLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "hi" || stored === "en") return stored;
  } catch {
    // localStorage can throw in private browsing on some browsers — fall
    // through to browser-language detection instead of crashing the app.
  }
  // Bible §2.4: Hindi if the browser reports Hindi, English otherwise.
  const nav = typeof navigator !== "undefined" ? navigator.language : "hi";
  return nav.toLowerCase().startsWith("hi") ? "hi" : "en";
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectDefaultLang());

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-fatal — the toggle still works for the current session.
    }
  }, [lang]);

  const setLang = (next: Lang) => setLangState(next);

  const t = useMemo(() => {
    const dict = DICTIONARIES[lang];
    return (key: string): string => dict[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

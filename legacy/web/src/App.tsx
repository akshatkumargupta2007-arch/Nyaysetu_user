import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext.js";
import { TopBar } from "./components/TopBar.js";
import Home from "./pages/Home.js";
import MyComplaints from "./pages/MyComplaints.js";
import Tracking from "./pages/Tracking.js";
import StyleGuide from "./pages/StyleGuide.js";
import OfficerLogin from "./pages/OfficerLogin.js";
import OfficerConsole from "./pages/OfficerConsole.js";
import FieldApp from "./pages/FieldApp.js";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          {/* D8 — /my shows citizen's complaints via anonymous session */}
          <Route path="/my" element={<MyComplaints />} />
          {/* E4 — /c/:id Tracking screen */}
          <Route path="/c/:id" element={<Tracking />} />
          {/* F1 — Officer login */}
          <Route path="/officer/login" element={<OfficerLogin />} />
          {/* F2 — Officer console */}
          <Route path="/officer" element={<OfficerConsole />} />
          {/* F3 — Field App */}
          <Route path="/field" element={<FieldApp />} />
          {/* D1 — dev-only style guide */}
          {import.meta.env.DEV ? <Route path="/styleguide" element={<StyleGuide />} /> : null}
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

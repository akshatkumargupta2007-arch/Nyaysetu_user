import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// D1 — design tokens (CSS custom properties) and self-hosted fonts must be
// the very first imports so nothing renders before the correct typeface loads.
import "./styles/tokens.css";
import "./styles/fonts.js";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

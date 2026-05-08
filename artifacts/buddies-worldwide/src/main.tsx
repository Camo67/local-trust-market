import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  navigator.serviceWorker
    .register(`${base}/sw.js`, { scope: base + "/" })
    .catch((err) => console.warn("SW registration failed:", err));
}

createRoot(document.getElementById("root")!).render(<App />);

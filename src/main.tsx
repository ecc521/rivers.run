import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Show a helpful error if a chunk fails to load due to genuinely dead WiFi.
// Since we use the PWA 'prompt' update mode, they will never hit a 404 cache miss,
// so this only fires for true offline/network failure scenarios!
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('vite-preload-error-shown')) {
    sessionStorage.setItem('vite-preload-error-shown', 'true');
    
    // Create a non-blocking toast notification instead of a native alert
    const toast = document.createElement("div");
    toast.className = "ReloadPromptToast";
    toast.style.backgroundColor = "var(--danger-bg)";
    toast.style.borderColor = "var(--danger)";
    toast.innerHTML = `
      <div class="ReloadPromptMessage">
        <span style="color: var(--danger-text)">Network Error: Could not load this section. Please check your connection.</span>
      </div>
      <div class="ReloadPromptButtons">
        <button class="ReloadPromptDismiss" onclick="this.closest('.ReloadPromptToast').remove()">Dismiss</button>
      </div>
    `;
    document.body.appendChild(toast);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

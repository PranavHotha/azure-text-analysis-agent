import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalConfig.js";

let hasRendered = false;
const renderApp = () => {
  if (hasRendered) return;
  hasRendered = true;
  const rootEl = document.getElementById("root");
  if (rootEl) {
    createRoot(rootEl).render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </StrictMode>,
    );
  }
};

msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise().catch((e) => console.warn("MSAL redirect promise:", e)))
  .catch((err) => console.error("MSAL initialization failed:", err))
  .finally(() => {
    renderApp();
  });

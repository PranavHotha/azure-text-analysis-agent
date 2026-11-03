import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { MsalProvider } from "@azure/msal-react";
import { EventType } from "@azure/msal-browser";
import { msalInstance } from "./msalConfig.js";

// Automatically activate logged-in account when redirect/popup completes
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload && event.payload.account) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});

msalInstance.initialize().then(() => {
  // If accounts already exist in cache, set active account
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
}).catch((err) => {
  console.error("MSAL init error:", err);
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
});

import { PublicClientApplication } from "@azure/msal-browser";

export const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID;
export const TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID;
export const REDIRECT_URI = "http://localhost:3000";

export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
  prompt: "select_account",
};

if (!CLIENT_ID || !TENANT_ID) {
  throw new Error(
    "Missing VITE_ENTRA_CLIENT_ID or VITE_ENTRA_TENANT_ID. Set them in frontend/.env and restart the dev server."
  );
}

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Remove any stored MSAL interaction state from the browser
export function clearStuckInteraction() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && (key.toLowerCase().includes("msal") || key.includes("interaction"))) keys.push(key);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch (e) {
      console.warn("Could not clear MSAL storage:", e);
    }
  }
}

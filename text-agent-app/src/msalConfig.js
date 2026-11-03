import { PublicClientApplication } from "@azure/msal-browser";

export const CLIENT_ID = "e9911bf3-5fbd-41c8-836a-5e250bf59504";

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
    postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [
    "https://cognitiveservices.azure.com/user_impersonation",
    "openid",
    "profile",
    "email",
  ],
};

export const msalInstance = new PublicClientApplication(msalConfig);


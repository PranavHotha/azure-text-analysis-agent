import { PublicClientApplication } from "@azure/msal-browser";

export const CLIENT_ID = "2078b9c6-6f3f-49f0-9d5d-e2860d5a71d3";

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


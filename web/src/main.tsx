import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType, AccountInfo } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { Toaster } from "sonner";
import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

const pca = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${
      import.meta.env.VITE_AAD_TENANT_ID
    }`,
    redirectUri: "/",
  },
  cache: { cacheLocation: "localStorage" },
});

pca.addEventCallback((e) => {
  if (
    e.eventType === EventType.LOGIN_SUCCESS &&
    e.payload &&
    "account" in e.payload
  ) {
    const account = e.payload.account as AccountInfo;
    pca.setActiveAccount(account);
  }
  if (
    (e.eventType === EventType.LOGIN_FAILURE ||
      e.eventType === EventType.ACQUIRE_TOKEN_FAILURE) &&
    (e as any).error
  ) {
    const msg = String((e as any).error?.message || "");
    if (/user_cancelled|access_denied|cancelled/i.test(msg)) {
      window.dispatchEvent(new CustomEvent("msal:userCancelled"));
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MsalProvider instance={pca}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        visibleToasts={3}
      />
    </MsalProvider>
  </React.StrictMode>
);

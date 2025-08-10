import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType, AccountInfo } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import App from './app/App'
import './index.css'

const pca = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
    redirectUri: '/'
  },
  cache: { cacheLocation: 'localStorage' }
})

pca.addEventCallback((e) => {
  if (e.eventType === EventType.LOGIN_SUCCESS && e.payload && 'account' in e.payload) {
    const account = e.payload.account as AccountInfo
    pca.setActiveAccount(account)
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={pca}>
      <App />
    </MsalProvider>
  </React.StrictMode>
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './msalAuth'
import './index.css'
import App from './App.jsx'

msalInstance.initialize().then(async () => {
  try {
    const result = await msalInstance.handleRedirectPromise()
    if (result && result.account) msalInstance.setActiveAccount(result.account)
  } catch (err) {
    console.error('MSAL redirect error:', err)
  }
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0])

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  )
})

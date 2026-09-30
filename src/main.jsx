import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './NewApp.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { installWordLookup } from './services/wordLookup/controller.mjs'
import { installAccessibility } from './services/accessibility/runtime.mjs'

// נגישות: the reader's and the device's accessibility settings, applied before the first paint.
try { installAccessibility() } catch { /* the app works without it */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)

// The word lookup of the readers (מילון בלחיצה): one set of listeners for the whole app, installed once.
try { installWordLookup() } catch { /* the readers work without it */ }

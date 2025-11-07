import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initFirebase } from './firebase'
import 'antd/dist/reset.css'
import './styles.css'

// Initialize Firebase if config is available
const firebaseConfig = window.__FIREBASE_CONFIG__
if (firebaseConfig) {
  const initialized = initFirebase(firebaseConfig)
  console.log('Firebase initialization:', initialized ? 'successful' : 'failed')
} else {
  console.warn('No Firebase config found, using local storage fallback')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

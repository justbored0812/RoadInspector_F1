import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import OpeningSplash from './OpeningSplash.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <OpeningSplash />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
}

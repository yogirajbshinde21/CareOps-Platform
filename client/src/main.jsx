// client/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme before render to prevent flash
const savedTheme = localStorage.getItem('careops_theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

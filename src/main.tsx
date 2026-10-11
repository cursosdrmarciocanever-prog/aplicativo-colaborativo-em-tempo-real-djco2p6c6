/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
// @skip-protected: Do not remove. Required for React rendering.
import App from './App.tsx'
import './main.css'

// Os testes das regras rodam com `npm test` (Vitest), não no navegador.

createRoot(document.getElementById('root')!).render(<App />)

/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { iniciarTema } from './lib/tema'

// Aparência (claro, escuro, noturno ou automático) antes de desenhar a tela.
iniciarTema()

// Os testes das regras rodam com `npm test` (Vitest), não no navegador.

createRoot(document.getElementById('root')!).render(<App />)

// App instalável e abrindo sem internet (só no build de produção).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker não registrado:', err)
    })
  })
}

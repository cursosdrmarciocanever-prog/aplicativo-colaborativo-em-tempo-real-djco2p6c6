/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// @skip-protected: Do not remove. Required for React rendering.
import { runTests } from './lib/regras/regras.test'

// Execução automática e validação dos testes unitários das regras de negócio
try {
  const result = runTests()
  console.log(
    `[Regras Diário da Sarah] Testes executados: ${result.passed}/${result.total} passaram.`,
  )
  if (result.failed > 0) {
    console.error('[Regras Diário da Sarah] Falhas detectadas:', result.errors)
  }
} catch (e) {
  console.error('[Regras Diário da Sarah] Erro ao executar testes de regras:', e)
}

createRoot(document.getElementById('root')!).render(<App />)

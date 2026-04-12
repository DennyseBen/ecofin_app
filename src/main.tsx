import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('🚀 EcoFin Manager inicializando...')

const root = document.getElementById('root')
if (!root) {
  console.error('❌ Elemento root não encontrado!')
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Erro: elemento root não encontrado</div>'
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('✅ App renderizado com sucesso')
}

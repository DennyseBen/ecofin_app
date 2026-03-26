import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Licencas from './pages/Licencas'
import Financas from './pages/Financas'
import Processos from './pages/Processos'
import Configuracoes from './pages/Configuracoes'
import Notificacoes from './pages/Notificacoes'
import Login from './pages/Login'
import InstallPWA from './components/InstallPWA'

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/licencas" element={<Licencas />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/financeiro" element={<Financas />} />
              <Route path="/processos" element={<Processos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
          </Routes>
          <InstallPWA />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Import from './pages/Import'
import Investments from './pages/Investments'
import Analytics from './pages/Analytics'
import Categories from './pages/Categories'
import Transfers from './pages/Transfers'
import InvestmentLinks from './pages/InvestmentLinks'
import Backup from './pages/Backup'
import Login from './pages/Login'
import api from './api/client'
import { PrivacyProvider } from './context/PrivacyContext'

function initAuth(): boolean {
  const token = localStorage.getItem('token')
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return true
  }
  return false
}

export default function App() {
  const [authed, setAuthed] = useState(initAuth)

  function handleLogin() {
    setAuthed(true)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setAuthed(false)
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <PrivacyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="import" element={<Import />} />
            <Route path="investments" element={<Investments />} />
            <Route path="categories" element={<Categories />} />
            <Route path="transfers" element={<Transfers />} />
            <Route path="investment-links" element={<InvestmentLinks />} />
            <Route path="backup" element={<Backup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PrivacyProvider>
  )
}

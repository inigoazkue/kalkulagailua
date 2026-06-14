import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Import from './pages/Import'
import Investments from './pages/Investments'
import Login from './pages/Login'
import api from './api/client'

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="import" element={<Import />} />
          <Route path="investments" element={<Investments />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

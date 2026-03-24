import { Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { VmRequests } from './pages/VmRequests'
import { NewVmRequest } from './pages/NewVmRequest'
import { VmRequestDetail } from './pages/VmRequestDetail'
import { Users } from './pages/Users'
import { Networks } from './pages/Networks'
import { ProvisionedVms } from './pages/ProvisionedVms'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <VmRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests/new"
        element={
          <ProtectedRoute>
            <NewVmRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests/:id"
        element={
          <ProtectedRoute>
            <VmRequestDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/networks"
        element={
          <ProtectedRoute>
            <Networks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provisioned-vms"
        element={
          <ProtectedRoute>
            <ProvisionedVms />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App

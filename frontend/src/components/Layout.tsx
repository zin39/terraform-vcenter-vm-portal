import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from './ui/Button'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/requests', label: 'VM Requests' },
    ...(user?.role === 'admin' || user?.role === 'approver'
      ? [{ to: '/provisioned-vms', label: 'Provisioned VMs' }]
      : []),
    ...(user?.role === 'admin'
      ? [
          { to: '/networks', label: 'Networks' },
          { to: '/users', label: 'Users' },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="text-xl font-semibold text-gray-900">
                VM Provisioning Portal
              </Link>
              <div className="hidden md:flex gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      location.pathname.startsWith(link.to)
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{user.full_name}</span>
                    <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs uppercase">
                      {user.role}
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={logout}>
                    Logout
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

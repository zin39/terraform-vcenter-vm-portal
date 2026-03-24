import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { listUsers, createUser, updateUser, deleteUser } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import type { User, UserRole, CreateUserRequest, UpdateUserRequest } from '../types'

const roleColors: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  approver: 'bg-blue-100 text-blue-800',
  requester: 'bg-gray-100 text-gray-800',
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  approver: 'Approver',
  requester: 'Requester',
}

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    password: '',
    full_name: '',
    role: 'requester',
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await createUser(formData)
      setFormData({ email: '', password: '', full_name: '', role: 'requester' })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to create user')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            placeholder="Min 8 characters"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            >
              <option value="requester">Requester</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create User
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditUserModalProps {
  user: User | null
  onClose: () => void
  onSuccess: () => void
  currentUserId: string
}

function EditUserModal({ user, onClose, onSuccess, currentUserId }: EditUserModalProps) {
  const [formData, setFormData] = useState<UpdateUserRequest>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError(null)
    setIsLoading(true)

    try {
      await updateUser(user.id, formData)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to update user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    if (!confirm('Are you sure you want to deactivate this user?')) return

    setError(null)
    setIsLoading(true)

    try {
      await deleteUser(user.id)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to deactivate user')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  const isCurrentUser = user.id === currentUserId

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">{user.email}</p>
          </div>

          <Input
            label="Full Name"
            value={formData.full_name || ''}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
              value={formData.role || user.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              disabled={isCurrentUser}
            >
              <option value="requester">Requester</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
            {isCurrentUser && (
              <p className="text-xs text-gray-500 mt-1">You cannot change your own role</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active ?? user.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              disabled={isCurrentUser}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
            {isCurrentUser && (
              <span className="text-xs text-gray-500">(You cannot deactivate yourself)</span>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <div>
              {!isCurrentUser && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={isLoading}
                >
                  Deactivate
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    loadUsers()
  }, [roleFilter])

  const loadUsers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = roleFilter ? { role: roleFilter as UserRole } : {}
      const response = await listUsers(params)
      setUsers(response.data)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Only admins can access this page
  if (currentUser?.role !== 'admin') {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          You do not have permission to access this page.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage users and their roles.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Add User</Button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Filter by Role
        </label>
        <select
          className="rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="approver">Approver</option>
          <option value="requester">Requester</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">No users found.</p>
          <Button onClick={() => setShowCreateModal(true)}>Add Your First User</Button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadUsers}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={loadUsers}
        currentUserId={currentUser?.id || ''}
      />
    </Layout>
  )
}

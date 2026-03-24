import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { listNetworks, createNetwork, updateNetwork, deleteNetwork } from '../api/networks'
import { getAllIps, createIpAddress, deleteIpAddress } from '../api/ip-addresses'
import { useAuth } from '../hooks/useAuth'
import type { Network, CreateNetworkRequest, UpdateNetworkRequest } from '../types'
import type { IpAddress } from '../types/ip-address'

interface CreateNetworkModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreateNetworkModal({ isOpen, onClose, onSuccess }: CreateNetworkModalProps) {
  const [formData, setFormData] = useState<CreateNetworkRequest>({
    name: '',
    vsphere_network_name: '',
    vlan_id: undefined,
    subnet: '',
    gateway: '',
    description: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await createNetwork({
        ...formData,
        vlan_id: formData.vlan_id || undefined,
        subnet: formData.subnet || undefined,
        gateway: formData.gateway || undefined,
        description: formData.description || undefined,
      })
      setFormData({
        name: '',
        vsphere_network_name: '',
        vlan_id: undefined,
        subnet: '',
        gateway: '',
        description: '',
      })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to create network')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Network</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Network Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Production Network"
          />

          <Input
            label="vSphere Network Name"
            value={formData.vsphere_network_name}
            onChange={(e) => setFormData({ ...formData, vsphere_network_name: e.target.value })}
            required
            placeholder="e.g., VLAN100-Production"
          />

          <Input
            label="VLAN ID"
            type="number"
            value={formData.vlan_id?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                vlan_id: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            placeholder="e.g., 100"
          />

          <Input
            label="Subnet"
            value={formData.subnet || ''}
            onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
            placeholder="e.g., 192.168.100.0/24"
          />

          <Input
            label="Gateway"
            value={formData.gateway || ''}
            onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
            placeholder="e.g., 192.168.100.1"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of this network"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Network
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditNetworkModalProps {
  network: Network | null
  onClose: () => void
  onSuccess: () => void
}

function EditNetworkModal({ network, onClose, onSuccess }: EditNetworkModalProps) {
  const [formData, setFormData] = useState<UpdateNetworkRequest>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (network) {
      setFormData({
        name: network.name,
        vsphere_network_name: network.vsphere_network_name,
        vlan_id: network.vlan_id ?? undefined,
        subnet: network.subnet ?? '',
        gateway: network.gateway ?? '',
        description: network.description ?? '',
        is_active: network.is_active,
      })
    }
  }, [network])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!network) return

    setError(null)
    setIsLoading(true)

    try {
      await updateNetwork(network.id, formData)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to update network')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!network) return
    if (!confirm('Are you sure you want to delete this network?')) return

    setError(null)
    setIsLoading(true)

    try {
      await deleteNetwork(network.id)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to delete network')
    } finally {
      setIsLoading(false)
    }
  }

  if (!network) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Network</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Network Name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="vSphere Network Name"
            value={formData.vsphere_network_name || ''}
            onChange={(e) => setFormData({ ...formData, vsphere_network_name: e.target.value })}
            required
          />

          <Input
            label="VLAN ID"
            type="number"
            value={formData.vlan_id?.toString() || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                vlan_id: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
          />

          <Input
            label="Subnet"
            value={formData.subnet || ''}
            onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
          />

          <Input
            label="Gateway"
            value={formData.gateway || ''}
            onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active ?? network.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="danger" onClick={handleDelete} isLoading={isLoading}>
              Delete
            </Button>
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

interface IpManagementModalProps {
  network: Network | null
  onClose: () => void
}

function IpManagementModal({ network, onClose }: IpManagementModalProps) {
  const [ips, setIps] = useState<IpAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newIp, setNewIp] = useState('')
  const [newHostname, setNewHostname] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (network) {
      loadIps()
    }
  }, [network])

  const loadIps = async () => {
    if (!network) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAllIps(network.id)
      // Sort IPs numerically
      data.sort((a, b) => {
        const aNum = a.ip_address.split('.').map(Number)
        const bNum = b.ip_address.split('.').map(Number)
        for (let i = 0; i < 4; i++) {
          if (aNum[i] !== bNum[i]) return aNum[i] - bNum[i]
        }
        return 0
      })
      setIps(data)
    } catch (err) {
      setError('Failed to load IP addresses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddIp = async () => {
    if (!network || !newIp) return
    setIsAdding(true)
    setError(null)
    try {
      await createIpAddress({
        ip_address: newIp,
        network_id: network.id,
        status: 'available',
        hostname: newHostname || undefined,
      })
      setNewIp('')
      setNewHostname('')
      loadIps()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to add IP')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteIp = async (ip: IpAddress) => {
    if (ip.status === 'in_use') {
      setError('Cannot delete IP that is in use')
      return
    }
    if (!confirm(`Delete IP ${ip.ip_address}?`)) return
    try {
      await deleteIpAddress(ip.id)
      loadIps()
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to delete IP')
    }
  }

  if (!network) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            IP Addresses - {network.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Add IP Form */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="IP Address (e.g., 10.0.1.50)"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Hostname (optional)"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddIp} isLoading={isAdding} disabled={!newIp}>
            Add
          </Button>
        </div>

        {/* IP List */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : ips.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No IP addresses in this network.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ips.map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono">{ip.ip_address}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{ip.hostname || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        ip.status === 'available' ? 'bg-green-100 text-green-800' :
                        ip.status === 'in_use' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ip.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleDeleteIp(ip)}
                        disabled={ip.status === 'in_use'}
                        className={`text-sm ${
                          ip.status === 'in_use'
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Total: {ips.length} IPs | Available: {ips.filter(ip => ip.status === 'available').length} | In Use: {ips.filter(ip => ip.status === 'in_use').length}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

export function Networks() {
  const { user: currentUser } = useAuth()
  const [networks, setNetworks] = useState<Network[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null)
  const [managingIpsNetwork, setManagingIpsNetwork] = useState<Network | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [includeInactive, setIncludeInactive] = useState(true)

  useEffect(() => {
    loadNetworks()
  }, [page, includeInactive])

  const loadNetworks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listNetworks({
        include_inactive: includeInactive,
        page,
        per_page: 10
      })
      setNetworks(response.data)
      setTotalPages(response.total_pages)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to load networks')
    } finally {
      setIsLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Network Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage vSphere networks and VLANs for VM provisioning.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Add Network</Button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked)
              setPage(1)
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show inactive networks</span>
        </label>
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
      ) : networks.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">No networks configured yet.</p>
          <Button onClick={() => setShowCreateModal(true)}>Add Your First Network</Button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  vSphere Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VLAN ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subnet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {networks.map((network) => (
                <tr key={network.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{network.name}</div>
                    {network.description && (
                      <div className="text-sm text-gray-500">{network.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 font-mono">
                      {network.vsphere_network_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {network.vlan_id ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{network.subnet ?? '-'}</div>
                    {network.gateway && (
                      <div className="text-xs text-gray-500">GW: {network.gateway}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        network.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {network.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <button
                      onClick={() => setManagingIpsNetwork(network)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Manage IPs
                    </button>
                    <button
                      onClick={() => setEditingNetwork(network)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CreateNetworkModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadNetworks}
      />

      <EditNetworkModal
        network={editingNetwork}
        onClose={() => setEditingNetwork(null)}
        onSuccess={loadNetworks}
      />

      <IpManagementModal
        network={managingIpsNetwork}
        onClose={() => setManagingIpsNetwork(null)}
      />
    </Layout>
  )
}

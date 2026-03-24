import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { DeletionProgress } from '../components/DeletionProgress'
import { getProvisionedVms, deleteProvisionedVm } from '../api/provisioned-vms'
import type { ProvisionedVm, ProvisionedVmListResponse } from '../types/provisioned-vm'

export function ProvisionedVms() {
  const [vms, setVms] = useState<ProvisionedVm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState('running')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deletingVm, setDeletingVm] = useState<ProvisionedVm | null>(null)

  useEffect(() => {
    loadVms()
  }, [page, statusFilter])

  const loadVms = async () => {
    setLoading(true)
    setError(null)
    try {
      const response: ProvisionedVmListResponse = await getProvisionedVms({
        status: statusFilter,
        page,
        per_page: perPage,
      })
      setVms(response.vms)
      setTotal(response.total)
    } catch (err) {
      setError('Failed to load provisioned VMs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (vm: ProvisionedVm) => {
    if (deleteConfirm !== vm.id) {
      setDeleteConfirm(vm.id)
      return
    }

    setDeletingId(vm.id)
    setDeleteConfirm(null)

    try {
      await deleteProvisionedVm(vm.id)
      // Show deletion progress modal
      setDeletingVm(vm)
    } catch (err) {
      setError('Failed to start VM deletion')
      console.error(err)
      setDeletingId(null)
    }
  }

  const handleDeletionComplete = useCallback(() => {
    // Refresh the list after deletion completes
    loadVms()
  }, [])

  const handleDeletionError = useCallback((error: string) => {
    setError(`Deletion failed: ${error}`)
  }, [])

  const handleDeletionClose = useCallback(() => {
    setDeletingVm(null)
    setDeletingId(null)
    loadVms()
  }, [])

  const totalPages = Math.ceil(total / perPage)

  return (
    <Layout>
      {/* Deletion Progress Modal */}
      {deletingVm && (
        <DeletionProgress
          vmId={deletingVm.id}
          vmName={deletingVm.vm_name}
          onComplete={handleDeletionComplete}
          onError={handleDeletionError}
          onClose={handleDeletionClose}
        />
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provisioned VMs</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage virtual machines that have been provisioned.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <select
            className="rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="running">Running</option>
            <option value="deleting">Deleting</option>
            <option value="stopped">Stopped</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : vms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No {statusFilter} VMs found.
          </div>
        ) : (
          <>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      VM Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      OS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Specs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requester
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provisioned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vms.map((vm) => (
                    <tr key={vm.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vm.vm_name}
                        </div>
                        <Link
                          to={`/requests/${vm.vm_request_id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Request
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm">{vm.ip_address}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vm.os_template_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vm.cpu_cores} CPU, {vm.ram_gb}GB RAM, {vm.storage_gb}GB
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vm.requester_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(vm.provisioned_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {statusFilter === 'running' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(vm)}
                            isLoading={deletingId === vm.id}
                            disabled={deletingId !== null}
                          >
                            {deleteConfirm === vm.id ? 'Confirm Delete' : 'Delete'}
                          </Button>
                        )}
                        {deleteConfirm === vm.id && (
                          <button
                            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} VMs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

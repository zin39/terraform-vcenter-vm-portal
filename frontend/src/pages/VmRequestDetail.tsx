import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { ProvisioningProgress } from '../components/ProvisioningProgress'
import { getVmRequest, reviewVmRequest, downloadTerraform, cancelVmRequest, retryProvisioning } from '../api/vm-requests'
import { useAuth } from '../hooks/useAuth'
import { OS_OPTIONS } from '../types'
import type { VmRequest, RequestStatus, VmConfig } from '../types'

const statusColors: Record<RequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  provisioning: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function getOsLabel(osType: string): string {
  const os = OS_OPTIONS.find((o) => o.value === osType)
  return os?.label || osType
}

function VmCard({ vm, index }: { vm: VmConfig; index: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{vm.vm_name}</h4>
          <p className="text-xs text-gray-500">VM #{index + 1}</p>
        </div>
        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
          {getOsLabel(vm.os_type)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-500 text-xs">Specifications</dt>
          <dd className="text-gray-900">
            {vm.cpu_cores} CPU, {vm.ram_gb} GB RAM, {vm.storage_gb} GB Storage
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 text-xs">IP Address</dt>
          <dd className="text-gray-900 font-mono">{vm.ip_address}</dd>
        </div>
        <div>
          <dt className="text-gray-500 text-xs">Gateway</dt>
          <dd className="text-gray-900 font-mono">{vm.gateway}</dd>
        </div>
        <div>
          <dt className="text-gray-500 text-xs">DNS Servers</dt>
          <dd className="text-gray-900 font-mono text-xs">
            {vm.dns_primary}, {vm.dns_secondary}
          </dd>
        </div>
        {vm.network_name && (
          <div>
            <dt className="text-gray-500 text-xs">Network</dt>
            <dd className="text-gray-900">{vm.network_name}</dd>
          </div>
        )}
        {vm.username && (
          <div>
            <dt className="text-gray-500 text-xs">Username</dt>
            <dd className="text-gray-900">{vm.username}</dd>
          </div>
        )}
      </div>
    </div>
  )
}

export function VmRequestDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [request, setRequest] = useState<VmRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const canReview = user && (user.role === 'admin' || user.role === 'approver')
  const canRetry = canReview && request?.status === 'failed'
  const canCancel = user && request?.requester_id === user.id && request?.status === 'pending'

  useEffect(() => {
    if (id) {
      loadRequest()
    }
  }, [id])

  // Callback for when provisioning completes
  const handleProvisioningComplete = useCallback(() => {
    loadRequest()
  }, [])

  // Callback for when provisioning fails
  const handleProvisioningError = useCallback(() => {
    loadRequest()
  }, [])

  const loadRequest = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getVmRequest(id!)
      setRequest(data)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to load request')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!id) return

    setIsReviewing(true)
    try {
      const updated = await reviewVmRequest(id, {
        status,
        review_notes: reviewNotes || undefined,
      })
      setRequest(updated)
      setReviewNotes('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to review request')
    } finally {
      setIsReviewing(false)
    }
  }

  const handleDownloadTerraform = async () => {
    if (!id) return

    setIsDownloading(true)
    try {
      await downloadTerraform(id)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to download Terraform config')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleCancel = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to cancel this request? This action cannot be undone.')) return

    setIsCancelling(true)
    try {
      await cancelVmRequest(id)
      navigate('/requests')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to cancel request')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRetry = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to retry provisioning? This will attempt to provision the VMs again.')) return

    setIsRetrying(true)
    setError(null)
    try {
      const updated = await retryProvisioning(id)
      setRequest(updated)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to retry provisioning')
    } finally {
      setIsRetrying(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTotalResources = () => {
    if (!request) return { totalCpu: 0, totalRam: 0, totalStorage: 0 }
    const totalCpu = request.vms.reduce((sum, vm) => sum + vm.cpu_cores, 0)
    const totalRam = request.vms.reduce((sum, vm) => sum + vm.ram_gb, 0)
    const totalStorage = request.vms.reduce((sum, vm) => sum + vm.storage_gb, 0)
    return { totalCpu, totalRam, totalStorage }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    )
  }

  if (error || !request) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Request not found'}
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/requests')}>
            Back to Requests
          </Button>
        </div>
      </Layout>
    )
  }

  const { totalCpu, totalRam, totalStorage } = getTotalResources()

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/requests" className="text-blue-600 hover:text-blue-900 text-sm">
          &larr; Back to Requests
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{request.title}</h1>
            <p className="text-sm text-gray-500">Request ID: {request.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {canCancel && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                isLoading={isCancelling}
              >
                Cancel Request
              </Button>
            )}
            {(request.status === 'approved' || request.status === 'completed') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadTerraform}
                isLoading={isDownloading}
              >
                Download Terraform
              </Button>
            )}
            {request.status === 'provisioning' ? (
              <span className="flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Provisioning...
              </span>
            ) : (
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[request.status]}`}>
                {request.status}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Provisioning Progress */}
          {request.status === 'provisioning' && (
            <ProvisioningProgress
              requestId={request.id}
              onComplete={handleProvisioningComplete}
              onError={handleProvisioningError}
            />
          )}

          {/* Completed Banner */}
          {request.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">VMs provisioned successfully</p>
                  <p className="text-xs text-green-600">All virtual machines have been created and configured.</p>
                </div>
              </div>
            </div>
          )}

          {/* Failed Banner */}
          {request.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">Provisioning failed</p>
                    <p className="text-xs text-red-600">
                      {request.last_error || 'Check the review notes for error details.'}
                      {request.retry_count !== undefined && request.retry_count > 0 && (
                        <span className="ml-2 font-medium">(Retry attempts: {request.retry_count})</span>
                      )}
                    </p>
                  </div>
                </div>
                {canRetry && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRetry}
                    isLoading={isRetrying}
                  >
                    Retry Provisioning
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total VMs</p>
              <p className="text-2xl font-bold text-blue-900">{request.vms.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Total CPU</p>
              <p className="text-2xl font-bold text-green-900">{totalCpu} cores</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Total RAM</p>
              <p className="text-2xl font-bold text-purple-900">{totalRam} GB</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600 font-medium">Total Storage</p>
              <p className="text-2xl font-bold text-orange-900">{totalStorage} GB</p>
            </div>
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                Request Details
              </h2>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Requester</dt>
                  <dd className="text-sm font-medium text-gray-900">{request.requester_name || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Created</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(request.created_at)}</dd>
                </div>
                {request.reviewed_by && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Reviewed By</dt>
                      <dd className="text-sm font-medium text-gray-900">{request.reviewer_name || 'Unknown'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Reviewed At</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {request.reviewed_at ? formatDate(request.reviewed_at) : '-'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Purpose</h2>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{request.purpose}</p>
            </div>
          </div>

          {request.description && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Description</h2>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{request.description}</p>
            </div>
          )}

          {/* VM Configurations */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              VM Configurations ({request.vms.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {request.vms.map((vm, index) => (
                <VmCard key={vm.id} vm={vm} index={index} />
              ))}
            </div>
          </div>

          {request.review_notes && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Review Notes</h2>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{request.review_notes}</p>
            </div>
          )}

          {canReview && request.status === 'pending' && (
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Review Request</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes (Optional)
                </label>
                <textarea
                  className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add notes about your decision..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleReview('approved')}
                  isLoading={isReviewing}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleReview('rejected')}
                  isLoading={isReviewing}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

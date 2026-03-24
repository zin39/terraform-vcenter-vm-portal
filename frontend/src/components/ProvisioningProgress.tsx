import { useProvisioningProgress, SshStatus } from '../hooks/useProvisioningProgress'

const PROVISIONING_STEPS = [
  { key: 'initializing', label: 'Initializing', description: 'Creating workspace, generating Terraform config' },
  { key: 'creating_vm', label: 'Creating VM', description: 'Running Terraform apply' },
  { key: 'configuring_network', label: 'Configuring Network', description: 'Cloud-init network setup' },
  { key: 'setting_up_user', label: 'Setting up User', description: 'Cloud-init user creation' },
  { key: 'verifying_ssh', label: 'Verifying SSH', description: 'Checking SSH connectivity' },
  { key: 'completed', label: 'Completed', description: 'Provisioning finished' },
]

interface ProvisioningProgressProps {
  requestId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

function StepIcon({ status }: { status: 'complete' | 'current' | 'pending' | 'error' }) {
  if (status === 'complete') {
    return (
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (status === 'current') {
    return (
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-gray-400" />
    </div>
  )
}

function SshVerificationSection({ sshStatus }: { sshStatus: SshStatus }) {
  const vms = Object.values(sshStatus)
  if (vms.length === 0) return null

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">SSH Verification Status</h4>
      <div className="space-y-2">
        {vms.map((vm) => (
          <div key={vm.vm_config_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
            <div className="flex items-center gap-2">
              {vm.is_reachable ? (
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span className="text-sm font-medium text-gray-900">{vm.vm_name}</span>
              <span className="text-xs text-gray-500 font-mono">{vm.ip_address}</span>
            </div>
            <div className="text-xs text-gray-500">
              {vm.is_reachable ? (
                <span className="text-green-600">
                  Reachable {vm.latency_ms && `(${vm.latency_ms}ms)`}
                </span>
              ) : (
                <span>Attempt {vm.attempt}/{vm.max_attempts}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProvisioningProgress({ requestId, onComplete, onError }: ProvisioningProgressProps) {
  const { progress, sshStatus, isConnected, error } = useProvisioningProgress({
    requestId,
    onComplete,
    onError,
  })

  const currentStepIndex = progress?.step_index ?? 0
  const isComplete = progress?.is_complete ?? false
  const isError = progress?.is_error ?? false

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-blue-800">Provisioning Progress</h3>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">
            {isConnected ? 'Live updates' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{Math.round((currentStepIndex / (PROVISIONING_STEPS.length - 1)) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${(currentStepIndex / (PROVISIONING_STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {PROVISIONING_STEPS.map((step, index) => {
          let status: 'complete' | 'current' | 'pending' | 'error' = 'pending'
          if (isError && index === currentStepIndex) {
            status = 'error'
          } else if (index < currentStepIndex) {
            status = 'complete'
          } else if (index === currentStepIndex) {
            status = isComplete ? 'complete' : 'current'
          }

          return (
            <div key={step.key} className="flex items-start gap-3">
              <StepIcon status={status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    status === 'current' ? 'text-blue-800' :
                    status === 'complete' ? 'text-green-800' :
                    status === 'error' ? 'text-red-800' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {status === 'current' && progress?.message && (
                  <p className="text-xs text-blue-600 mt-0.5">{progress.message}</p>
                )}
                {status === 'error' && progress?.message && (
                  <p className="text-xs text-red-600 mt-0.5">{progress.message}</p>
                )}
                {status === 'pending' && (
                  <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* SSH Verification */}
      <SshVerificationSection sshStatus={sshStatus} />

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-100 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}

import { useDeletionProgress } from '../hooks/useDeletionProgress'

const DELETION_STEPS = [
  { key: 'initializing', label: 'Initializing', description: 'Preparing to delete' },
  { key: 'destroying_infrastructure', label: 'Destroying Infrastructure', description: 'Running Terraform destroy' },
  { key: 'releasing_resources', label: 'Releasing Resources', description: 'Releasing IP, cleanup' },
  { key: 'completed', label: 'Completed', description: 'Deletion finished' },
]

interface DeletionProgressProps {
  vmId: string
  vmName: string
  onComplete?: () => void
  onError?: (error: string) => void
  onClose?: () => void
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
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
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

export function DeletionProgress({ vmId, vmName, onComplete, onError, onClose }: DeletionProgressProps) {
  const { progress, isConnected, error } = useDeletionProgress({
    vmId,
    onComplete,
    onError,
  })

  const currentStepIndex = progress?.step_index ?? 0
  const isComplete = progress?.is_complete ?? false
  const isError = progress?.is_error ?? false

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Deleting VM</h3>
              <p className="text-sm text-gray-500">{vmName}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : 'Reconnecting...'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{Math.round((currentStepIndex / (DELETION_STEPS.length - 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-red-400'
                }`}
                style={{ width: `${(currentStepIndex / (DELETION_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {DELETION_STEPS.map((step, index) => {
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
                    <span className={`text-sm font-medium ${
                      status === 'current' ? 'text-red-800' :
                      status === 'complete' ? 'text-green-800' :
                      status === 'error' ? 'text-red-800' :
                      'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {status === 'current' && progress?.message && (
                      <p className="text-xs text-red-600 mt-0.5">{progress.message}</p>
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

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-100 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Close Button (only when complete) */}
          {isComplete && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

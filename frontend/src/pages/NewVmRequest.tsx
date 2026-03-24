import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { createVmRequest } from '../api/vm-requests'
import { listNetworks } from '../api/networks'
import { getOsTemplates } from '../api/os-templates'
import { getAvailableIps } from '../api/ip-addresses'
import {
  CPU_OPTIONS,
  RAM_OPTIONS,
  DEFAULT_VM_CONFIG,
} from '../types'
import type { CreateVmRequest, CreateVmConfig, Network } from '../types'
import type { OsTemplate } from '../types/os-template'
import type { IpAddress } from '../types/ip-address'

interface FormData {
  title: string
  description: string
  purpose: string
  vms: CreateVmConfig[]
}

// Validate IP address format and range
const isValidIpAddress = (ip: string): boolean => {
  if (!ip) return false
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString()
  })
}

// Validate VM name format and length
const isValidVmName = (name: string): { valid: boolean; message?: string } => {
  if (!name) return { valid: false, message: 'VM name is required' }
  if (name.length < 3) return { valid: false, message: 'VM name must be at least 3 characters' }
  if (name.length > 63) return { valid: false, message: 'VM name must be under 63 characters' }
  if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(name)) {
    return { valid: false, message: 'Must start with a letter, then letters, numbers, hyphens, or underscores' }
  }
  if (name.endsWith('-') || name.endsWith('_')) {
    return { valid: false, message: 'Cannot end with a hyphen or underscore' }
  }
  return { valid: true }
}

// Icons
function ServerIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  )
}

function CpuIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  )
}

function MemoryIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function StorageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  )
}

function NetworkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function KeyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function ChevronIcon({ className = "w-4 h-4", expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg className={`${className} transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// Resource badge component
function ResourceBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}
      <span>{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  )
}

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all
              ${step < currentStep
                ? 'bg-green-500 text-white'
                : step === currentStep
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-gray-200 text-gray-500'
              }`}
          >
            {step < currentStep ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              step
            )}
          </div>
          {step < totalSteps && (
            <div
              className={`w-16 h-1 mx-2 rounded ${
                step < currentStep ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// VM count selector card component
function VmCountCard({ count, isSelected, onClick }: { count: number; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-6 rounded-2xl border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-100
        ${isSelected
          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className={`text-4xl font-bold ${isSelected ? 'text-blue-600' : 'text-gray-700'}`}>
          {count}
        </div>
        <div className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
          {count === 1 ? 'VM' : 'VMs'}
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(count, 5) }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm ${isSelected ? 'bg-blue-400' : 'bg-gray-300'}`}
            />
          ))}
          {count > 5 && (
            <span className={`text-xs ml-1 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
              +{count - 5}
            </span>
          )}
        </div>
      </div>
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  )
}

export function NewVmRequest() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [vmCount, setVmCount] = useState<number | null>(null)
  const [customCount, setCustomCount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedVms, setExpandedVms] = useState<Record<number, boolean>>({})
  const [showAdvanced, setShowAdvanced] = useState<Record<number, boolean>>({})
  const [networks, setNetworks] = useState<Network[]>([])
  const [osTemplates, setOsTemplates] = useState<OsTemplate[]>([])
  const [availableIps, setAvailableIps] = useState<Record<string, IpAddress[]>>({})
  const [sameCredentials, setSameCredentials] = useState(true)
  const [globalUsername, setGlobalUsername] = useState('')
  const [globalPassword, setGlobalPassword] = useState('')
  const [globalNetworkId, setGlobalNetworkId] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [networksResponse, templates] = await Promise.all([
        listNetworks({ include_inactive: false, per_page: 100 }),
        getOsTemplates()
      ])
      setNetworks(networksResponse.data)
      setOsTemplates(templates)
      if (networksResponse.data.length > 0) {
        setGlobalNetworkId(networksResponse.data[0].id)
      }
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
  }

  const loadAvailableIps = async (networkId: string) => {
    if (!networkId || availableIps[networkId]) return
    try {
      const ips = await getAvailableIps(networkId)
      setAvailableIps(prev => ({ ...prev, [networkId]: ips }))
    } catch (err) {
      console.error('Failed to load IPs:', err)
    }
  }

  useEffect(() => {
    if (globalNetworkId) {
      loadAvailableIps(globalNetworkId)
    }
  }, [globalNetworkId])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      purpose: '',
      vms: [],
    },
  })

  // Initialize VMs when moving to step 2
  const initializeVms = (count: number) => {
    const defaultOs = osTemplates[0]?.name || 'ubuntu-22.04'
    const newVms: CreateVmConfig[] = Array.from({ length: count }, () => ({
      vm_name: '',
      ip_address: '',
      ...DEFAULT_VM_CONFIG,
      os_type: defaultOs,
      storage_gb: getMinStorage(defaultOs),
    }))
    reset({
      title: '',
      description: '',
      purpose: '',
      vms: newVms,
    })
    // Expand first VM by default
    setExpandedVms({ 0: true })
  }

  const handleContinue = () => {
    const count = vmCount || (customCount ? parseInt(customCount, 10) : null)
    if (!count || count < 1 || count > 20) {
      setError('Please select between 1 and 20 VMs')
      return
    }
    setError(null)
    initializeVms(count)
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
    setVmCount(null)
    setCustomCount('')
  }

  const watchedVms = useWatch({ control, name: 'vms' })

  const { fields, remove } = useFieldArray({
    control,
    name: 'vms',
  })

  const getMinStorage = (osType: string): number => {
    const template = osTemplates.find(t => t.name === osType)
    return template?.min_storage_gb || 20
  }

  const getStorageOptions = (osType: string): number[] => {
    const minStorage = getMinStorage(osType)
    const allOptions = [20, 30, 40, 50, 80, 100, 150, 200, 300, 500, 1000, 2000]
    return allOptions.filter(s => s >= minStorage)
  }

  const toggleExpanded = (index: number) => {
    setExpandedVms(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const toggleAdvanced = (index: number) => {
    setShowAdvanced(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleOsChange = (index: number, osType: string) => {
    const minStorage = getMinStorage(osType)
    const currentStorage = watchedVms?.[index]?.storage_gb || 0
    if (currentStorage < minStorage) {
      setValue(`vms.${index}.storage_gb`, minStorage)
    }
  }

  const onSubmit = async (data: FormData) => {
    setError(null)
    setIsLoading(true)

    try {
      const payload: CreateVmRequest = {
        title: data.title,
        description: data.description || undefined,
        purpose: data.purpose,
        vms: data.vms.map((vm) => ({
          ...vm,
          cpu_cores: Number(vm.cpu_cores),
          ram_gb: Number(vm.ram_gb),
          storage_gb: Number(vm.storage_gb),
          username: sameCredentials ? globalUsername || undefined : vm.username || undefined,
          password: sameCredentials ? globalPassword || undefined : vm.password || undefined,
          network_id: sameCredentials ? globalNetworkId || undefined : vm.network_id || undefined,
        })),
      }
      await createVmRequest(payload)
      navigate('/requests')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to create request')
    } finally {
      setIsLoading(false)
    }
  }

  const getAvailableIpsForVm = (networkId: string, currentIp: string, allSelectedIps: string[]) => {
    const ips = availableIps[networkId] || []
    return ips.filter(ip => ip.ip_address === currentIp || !allSelectedIps.includes(ip.ip_address))
  }

  // Calculate totals for summary
  const totalCpu = watchedVms?.reduce((sum, vm) => sum + Number(vm.cpu_cores || 0), 0) || 0
  const totalRam = watchedVms?.reduce((sum, vm) => sum + Number(vm.ram_gb || 0), 0) || 0
  const totalStorage = watchedVms?.reduce((sum, vm) => sum + Number(vm.storage_gb || 0), 0) || 0

  const getOsDisplayName = (osType: string) => {
    const template = osTemplates.find(t => t.name === osType)
    return template?.display_name || osType
  }

  const selectedCount = vmCount || (customCount ? parseInt(customCount, 10) : null)

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">New VM Request</h1>
          <p className="mt-2 text-gray-600">
            {step === 1
              ? 'Start by selecting how many virtual machines you need.'
              : 'Configure and submit your virtual machine request for approval.'}
          </p>
        </div>

        <StepIndicator currentStep={step} totalSteps={2} />

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: VM Count Selection */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ServerIcon className="w-5 h-5" />
                  How many VMs do you need?
                </h2>
              </div>
              <div className="p-8">
                {/* Quick selection cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  {[1, 2, 3, 5].map((count) => (
                    <VmCountCard
                      key={count}
                      count={count}
                      isSelected={vmCount === count && !customCount}
                      onClick={() => {
                        setVmCount(count)
                        setCustomCount('')
                      }}
                    />
                  ))}
                </div>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">or specify a custom number</span>
                  </div>
                </div>

                {/* Custom number input */}
                <div className="max-w-xs mx-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                    Custom VM Count (1-20)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customCount}
                      onChange={(e) => {
                        setCustomCount(e.target.value)
                        setVmCount(null)
                      }}
                      className={`block w-full text-center text-2xl font-bold py-4 rounded-xl border-2 transition-all
                        ${customCount
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                        focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none`}
                      placeholder="0"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      VMs
                    </div>
                  </div>
                </div>

                {/* Selection summary */}
                {selectedCount && selectedCount > 0 && (
                  <div className="mt-8 p-4 bg-blue-50 rounded-xl text-center">
                    <p className="text-blue-800">
                      You're about to configure <span className="font-bold text-lg">{selectedCount}</span> virtual {selectedCount === 1 ? 'machine' : 'machines'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/dashboard')}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleContinue}
                disabled={!selectedCount || selectedCount < 1}
                className="px-8"
              >
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: VM Configuration Form */}
        {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Request Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Request Details
              </h2>
            </div>
            <div className="p-6 space-y-5">
              <Input
                label="Request Title"
                placeholder="e.g., Development Environment for Project X"
                {...register('title', {
                  required: 'Title is required',
                  maxLength: { value: 255, message: 'Title must be under 255 characters' },
                })}
                error={errors.title?.message}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={`block w-full rounded-lg shadow-sm px-4 py-3 border text-sm transition-colors
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none
                    ${errors.purpose ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`}
                  rows={3}
                  placeholder="Describe why you need these VMs and what they will be used for..."
                  {...register('purpose', {
                    required: 'Purpose is required',
                    maxLength: { value: 500, message: 'Purpose must be under 500 characters' },
                  })}
                />
                {errors.purpose && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.purpose.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Additional Notes <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-3 border text-sm hover:border-gray-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  rows={2}
                  placeholder="Any additional details about the request..."
                  {...register('description', {
                    maxLength: { value: 1000, message: 'Description must be under 1000 characters' },
                  })}
                />
              </div>
            </div>
          </div>

          {/* Credentials & Network Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyIcon className="w-5 h-5" />
                Credentials & Network
              </h2>
            </div>
            <div className="p-6">
              <label className="flex items-center gap-3 cursor-pointer mb-5">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={sameCredentials}
                    onChange={(e) => setSameCredentials(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </div>
                <span className="text-sm font-medium text-gray-700">Use same credentials and network for all VMs</span>
              </label>

              {sameCredentials ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <NetworkIcon className="w-4 h-4 text-gray-400" />
                        Network / VLAN
                      </span>
                    </label>
                    <select
                      className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-2.5 border text-sm hover:border-gray-400 transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                      value={globalNetworkId}
                      onChange={(e) => setGlobalNetworkId(e.target.value)}
                    >
                      {networks.map((network) => (
                        <option key={network.id} value={network.id}>
                          {network.name} {network.vlan_id ? `(VLAN ${network.vlan_id})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Username"
                    placeholder="e.g., admin"
                    value={globalUsername}
                    onChange={(e) => setGlobalUsername(e.target.value)}
                  />

                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={globalPassword}
                    onChange={(e) => setGlobalPassword(e.target.value)}
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                  <p>Configure credentials and network individually for each VM in the advanced settings below.</p>
                </div>
              )}
            </div>
          </div>

          {/* VM Configurations */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ServerIcon className="w-6 h-6 text-gray-400" />
                Virtual Machines
                <span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                  {fields.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                Change count
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const currentNetworkId = sameCredentials ? globalNetworkId : watchedVms?.[index]?.network_id
                const currentOsType = watchedVms?.[index]?.os_type || ''
                const storageOptions = getStorageOptions(currentOsType)
                const allSelectedIps = watchedVms?.map(vm => vm.ip_address).filter(Boolean) || []
                const availableIpsForVm = currentNetworkId ? getAvailableIpsForVm(currentNetworkId, watchedVms?.[index]?.ip_address || '', allSelectedIps) : []
                const isExpanded = expandedVms[index] !== false
                const vmData = watchedVms?.[index]

                return (
                  <div key={field.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* VM Header - Always Visible */}
                    <div
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleExpanded(index)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {vmData?.vm_name || `VM #${index + 1}`}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {vmData?.os_type && (
                              <span className="text-xs text-gray-500">{getOsDisplayName(vmData.os_type)}</span>
                            )}
                            {vmData?.ip_address && (
                              <span className="text-xs font-mono text-gray-400">{vmData.ip_address}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Resource badges - visible when collapsed */}
                        {!isExpanded && vmData && (
                          <div className="hidden sm:flex items-center gap-2">
                            <ResourceBadge
                              icon={<CpuIcon className="w-3.5 h-3.5" />}
                              label="CPU"
                              value={String(vmData.cpu_cores || 0)}
                              color="bg-blue-50 text-blue-700"
                            />
                            <ResourceBadge
                              icon={<MemoryIcon className="w-3.5 h-3.5" />}
                              label="GB"
                              value={String(vmData.ram_gb || 0)}
                              color="bg-purple-50 text-purple-700"
                            />
                            <ResourceBadge
                              icon={<StorageIcon className="w-3.5 h-3.5" />}
                              label="GB"
                              value={String(vmData.storage_gb || 0)}
                              color="bg-amber-50 text-amber-700"
                            />
                          </div>
                        )}

                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              remove(index)
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove VM"
                          >
                            <TrashIcon />
                          </button>
                        )}
                        <ChevronIcon expanded={isExpanded} className="text-gray-400" />
                      </div>
                    </div>

                    {/* VM Configuration - Expandable */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-6 space-y-6">
                        {/* Basic Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Input
                            label="VM Name"
                            placeholder="e.g., dev-server-01"
                            {...register(`vms.${index}.vm_name`, {
                              validate: {
                                validFormat: (value) => {
                                  const result = isValidVmName(value)
                                  return result.valid || result.message
                                },
                                unique: (value, formValues) => {
                                  const names = formValues.vms.map((vm: CreateVmConfig) => vm.vm_name.toLowerCase())
                                  const count = names.filter((n: string) => n === value.toLowerCase()).length
                                  return count <= 1 || 'VM name must be unique'
                                },
                              },
                            })}
                            error={errors.vms?.[index]?.vm_name?.message}
                          />

                          {/* IP Address */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              IP Address <span className="text-red-500">*</span>
                            </label>
                            {currentNetworkId && availableIpsForVm.length > 0 ? (
                              <select
                                className={`block w-full rounded-lg shadow-sm px-4 py-2.5 border text-sm transition-colors
                                  focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none
                                  ${errors.vms?.[index]?.ip_address ? 'border-red-400' : 'border-gray-300 hover:border-gray-400'}`}
                                {...register(`vms.${index}.ip_address`, { required: 'IP address is required' })}
                              >
                                <option value="">Select IP Address</option>
                                {availableIpsForVm.map((ip) => (
                                  <option key={ip.id} value={ip.ip_address}>
                                    {ip.ip_address} {ip.hostname ? `(${ip.hostname})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className={`block w-full rounded-lg shadow-sm px-4 py-2.5 border text-sm transition-colors
                                  focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none
                                  ${errors.vms?.[index]?.ip_address ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`}
                                placeholder="e.g., 10.0.1.100"
                                {...register(`vms.${index}.ip_address`, {
                                  required: 'IP address is required',
                                  validate: {
                                    validIp: (value) => isValidIpAddress(value) || 'Invalid IP address',
                                    unique: (value, formValues) => {
                                      const ips = formValues.vms.map((vm: CreateVmConfig) => vm.ip_address)
                                      const count = ips.filter((ip: string) => ip === value).length
                                      return count <= 1 || 'IP must be unique'
                                    },
                                  },
                                })}
                              />
                            )}
                            {errors.vms?.[index]?.ip_address && (
                              <p className="mt-1.5 text-sm text-red-600">{errors.vms?.[index]?.ip_address?.message}</p>
                            )}
                          </div>
                        </div>

                        {/* OS and Resources */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Operating System <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {osTemplates.map((os) => {
                              const isSelected = currentOsType === os.name
                              return (
                                <label
                                  key={os.name}
                                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                                    ${isSelected
                                      ? 'border-green-500 bg-green-50 ring-2 ring-green-500/20'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                  <input
                                    type="radio"
                                    className="sr-only"
                                    value={os.name}
                                    {...register(`vms.${index}.os_type`, {
                                      required: 'OS is required',
                                      onChange: (e) => handleOsChange(index, e.target.value),
                                    })}
                                  />
                                  <div className={`text-2xl mb-2 ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                                    {os.name.includes('ubuntu') ? '🐧' :
                                     os.name.includes('windows') ? '🪟' :
                                     os.name.includes('debian') ? '🌀' :
                                     os.name.includes('centos') || os.name.includes('rhel') || os.name.includes('rocky') ? '🎩' : '💻'}
                                  </div>
                                  <span className={`text-sm font-medium text-center ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                                    {os.display_name}
                                  </span>
                                  <span className="text-xs text-gray-400 mt-1">Min {os.min_storage_gb}GB</span>
                                  {isSelected && (
                                    <div className="absolute top-2 right-2">
                                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                          {errors.vms?.[index]?.os_type && (
                            <p className="mt-2 text-sm text-red-600">{errors.vms?.[index]?.os_type?.message}</p>
                          )}
                        </div>

                        {/* Resource Sliders */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                              <CpuIcon className="w-4 h-4 text-blue-500" />
                              CPU Cores
                            </label>
                            <select
                              className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-2.5 border text-sm hover:border-gray-400 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                              {...register(`vms.${index}.cpu_cores`)}
                            >
                              {CPU_OPTIONS.map((cores) => (
                                <option key={cores} value={cores}>
                                  {cores} {cores === 1 ? 'core' : 'cores'}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                              <MemoryIcon className="w-4 h-4 text-purple-500" />
                              RAM
                            </label>
                            <select
                              className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-2.5 border text-sm hover:border-gray-400 transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                              {...register(`vms.${index}.ram_gb`)}
                            >
                              {RAM_OPTIONS.map((ram) => (
                                <option key={ram} value={ram}>
                                  {ram} GB
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                              <StorageIcon className="w-4 h-4 text-amber-500" />
                              Storage
                            </label>
                            <select
                              className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-2.5 border text-sm hover:border-gray-400 transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                              {...register(`vms.${index}.storage_gb`)}
                            >
                              {storageOptions.map((storage) => (
                                <option key={storage} value={storage}>
                                  {storage >= 1000 ? `${storage / 1000} TB` : `${storage} GB`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Advanced Settings Toggle */}
                        <div className="border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            onClick={() => toggleAdvanced(index)}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <svg className={`w-4 h-4 transition-transform ${showAdvanced[index] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Advanced Network Settings
                          </button>

                          {showAdvanced[index] && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                              {!sameCredentials && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-gray-200">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                      Network / VLAN
                                    </label>
                                    <select
                                      className="block w-full rounded-lg border-gray-300 shadow-sm px-4 py-2.5 border text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                      {...register(`vms.${index}.network_id`, {
                                        onChange: (e) => loadAvailableIps(e.target.value)
                                      })}
                                    >
                                      {networks.map((network) => (
                                        <option key={network.id} value={network.id}>
                                          {network.name} {network.vlan_id ? `(VLAN ${network.vlan_id})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <Input
                                    label="Username"
                                    placeholder="e.g., admin"
                                    {...register(`vms.${index}.username`)}
                                  />

                                  <Input
                                    label="Password"
                                    type="password"
                                    placeholder="Min 8 characters"
                                    {...register(`vms.${index}.password`)}
                                  />
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                  label="Gateway"
                                  placeholder="10.0.1.1"
                                  {...register(`vms.${index}.gateway`, {
                                    required: 'Gateway is required',
                                    validate: (value) => isValidIpAddress(value) || 'Invalid gateway',
                                  })}
                                  error={errors.vms?.[index]?.gateway?.message}
                                />

                                <Input
                                  label="Primary DNS"
                                  placeholder="10.0.0.2"
                                  {...register(`vms.${index}.dns_primary`, {
                                    required: 'Primary DNS is required',
                                    validate: (value) => isValidIpAddress(value) || 'Invalid DNS',
                                  })}
                                  error={errors.vms?.[index]?.dns_primary?.message}
                                />

                                <Input
                                  label="Secondary DNS"
                                  placeholder="8.8.8.8"
                                  {...register(`vms.${index}.dns_secondary`, {
                                    required: 'Secondary DNS is required',
                                    validate: (value) => isValidIpAddress(value) || 'Invalid DNS',
                                  })}
                                  error={errors.vms?.[index]?.dns_secondary?.message}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <ServerIcon className="w-4 h-4" />
                  Total VMs
                </div>
                <div className="text-2xl font-bold text-gray-900">{fields.length}</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-500 text-sm mb-1">
                  <CpuIcon className="w-4 h-4" />
                  Total CPU
                </div>
                <div className="text-2xl font-bold text-gray-900">{totalCpu} <span className="text-sm font-normal text-gray-500">cores</span></div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 text-purple-500 text-sm mb-1">
                  <MemoryIcon className="w-4 h-4" />
                  Total RAM
                </div>
                <div className="text-2xl font-bold text-gray-900">{totalRam} <span className="text-sm font-normal text-gray-500">GB</span></div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 text-amber-500 text-sm mb-1">
                  <StorageIcon className="w-4 h-4" />
                  Total Storage
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalStorage >= 1000 ? `${(totalStorage / 1000).toFixed(1)}` : totalStorage}
                  <span className="text-sm font-normal text-gray-500">{totalStorage >= 1000 ? ' TB' : ' GB'}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Your request will be reviewed by an administrator before provisioning.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              className="px-6"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/dashboard')}
                className="px-6"
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading} className="px-8">
                Submit Request
              </Button>
            </div>
          </div>
        </form>
        )}
      </div>
    </Layout>
  )
}

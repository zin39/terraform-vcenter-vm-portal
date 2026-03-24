export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'provisioning' | 'completed' | 'failed'

export interface VmConfig {
  id: string
  vm_name: string
  cpu_cores: number
  ram_gb: number
  storage_gb: number
  os_type: string
  ip_address: string
  gateway: string
  dns_primary: string
  dns_secondary: string
  username: string | null
  network_id: string | null
  network_name: string | null
}

export interface VmRequest {
  id: string
  requester_id: string
  requester_name: string | null
  title: string
  description: string | null
  purpose: string
  status: RequestStatus
  reviewed_by: string | null
  reviewer_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  retry_count?: number
  last_error?: string | null
  created_at: string
  updated_at: string
  vms: VmConfig[]
}

export interface CreateVmConfig {
  vm_name: string
  cpu_cores: number
  ram_gb: number
  storage_gb: number
  os_type: string
  ip_address: string
  gateway: string
  dns_primary: string
  dns_secondary: string
  username?: string
  password?: string
  network_id?: string
}

export interface CreateVmRequest {
  title: string
  description?: string
  purpose: string
  vms: CreateVmConfig[]
}

export interface ReviewVmRequest {
  status: 'approved' | 'rejected'
  review_notes?: string
}

export interface PaginatedVmRequests {
  data: VmRequest[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ListVmRequestsParams {
  status?: RequestStatus
  page?: number
  per_page?: number
}

export const OS_OPTIONS = [
  { value: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS' },
  { value: 'ubuntu-20.04', label: 'Ubuntu 20.04 LTS' },
  { value: 'debian-12', label: 'Debian 12' },
  { value: 'centos-9', label: 'CentOS Stream 9' },
  { value: 'rhel-9', label: 'Red Hat Enterprise Linux 9' },
  { value: 'windows-server-2022', label: 'Windows Server 2022' },
  { value: 'windows-server-2019', label: 'Windows Server 2019' },
]

export const CPU_OPTIONS = [1, 2, 4, 8, 16, 32, 64]
export const RAM_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
export const STORAGE_OPTIONS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]

export const DEFAULT_GATEWAY = '10.0.1.1'
export const DEFAULT_DNS_PRIMARY = '10.0.0.2'
export const DEFAULT_DNS_SECONDARY = '8.8.8.8'

export const DEFAULT_VM_CONFIG: Omit<CreateVmConfig, 'vm_name' | 'ip_address'> = {
  cpu_cores: 2,
  ram_gb: 4,
  storage_gb: 50,
  os_type: 'ubuntu-22.04',
  gateway: DEFAULT_GATEWAY,
  dns_primary: DEFAULT_DNS_PRIMARY,
  dns_secondary: DEFAULT_DNS_SECONDARY,
}

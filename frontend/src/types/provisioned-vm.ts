export interface ProvisionedVm {
  id: string
  vm_config_id: string
  vm_request_id: string
  vm_name: string
  ip_address: string
  os_template_id: string | null
  os_template_name: string | null
  cpu_cores: number
  ram_gb: number
  storage_gb: number
  provisioned_by: string
  provisioned_by_name: string | null
  requester_name: string | null
  provisioned_at: string
  status: 'running' | 'stopped' | 'deleted'
}

export interface ProvisionedVmListResponse {
  vms: ProvisionedVm[]
  total: number
  page: number
  per_page: number
}

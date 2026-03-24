export interface IpAddress {
  id: string
  ip_address: string
  network_id: string
  status: 'available' | 'reserved' | 'in_use'
  hostname: string | null
  description: string | null
  assigned_vm_config_id: string | null
}

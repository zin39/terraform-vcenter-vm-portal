export interface Network {
  id: string
  name: string
  vlan_id: number | null
  vsphere_network_name: string
  subnet: string | null
  gateway: string | null
  description: string | null
  is_active: boolean
}

export interface CreateNetworkRequest {
  name: string
  vlan_id?: number
  vsphere_network_name: string
  subnet?: string
  gateway?: string
  description?: string
}

export interface UpdateNetworkRequest {
  name?: string
  vlan_id?: number
  vsphere_network_name?: string
  subnet?: string
  gateway?: string
  description?: string
  is_active?: boolean
}

export interface PaginatedNetworks {
  data: Network[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ListNetworksParams {
  include_inactive?: boolean
  page?: number
  per_page?: number
}

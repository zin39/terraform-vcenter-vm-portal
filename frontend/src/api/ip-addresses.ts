import client from './client'
import type { IpAddress } from '../types/ip-address'

export async function getAvailableIps(networkId: string): Promise<IpAddress[]> {
  const { data } = await client.get<IpAddress[]>('/ip-addresses/available', {
    params: { network_id: networkId }
  })
  return data
}

export async function getAllIps(networkId: string): Promise<IpAddress[]> {
  const { data } = await client.get<IpAddress[]>('/ip-addresses', {
    params: { network_id: networkId }
  })
  return data
}

export interface BulkCreateIpRequest {
  network_id: string
  ip_addresses: Array<{
    ip_address: string
    status?: string
    hostname?: string
    description?: string
  }>
}

export async function bulkCreateIps(request: BulkCreateIpRequest): Promise<{ created: number; skipped: number }> {
  const { data } = await client.post('/ip-addresses/bulk', request)
  return data
}

export async function updateIpAddress(id: string, update: Partial<IpAddress>): Promise<IpAddress> {
  const { data } = await client.put<IpAddress>(`/ip-addresses/${id}`, update)
  return data
}

export async function deleteIpAddress(id: string): Promise<void> {
  await client.delete(`/ip-addresses/${id}`)
}

export interface CreateIpRequest {
  ip_address: string
  network_id: string
  status?: string
  hostname?: string
  description?: string
}

export async function createIpAddress(request: CreateIpRequest): Promise<IpAddress> {
  const { data } = await client.post<IpAddress>('/ip-addresses', request)
  return data
}

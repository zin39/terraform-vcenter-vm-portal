import client from './client'
import type { Network, CreateNetworkRequest, UpdateNetworkRequest, PaginatedNetworks, ListNetworksParams } from '../types'

export async function listNetworks(params?: ListNetworksParams): Promise<PaginatedNetworks> {
  const response = await client.get<PaginatedNetworks>('/networks', { params })
  return response.data
}

export async function getNetwork(id: string): Promise<Network> {
  const response = await client.get<Network>(`/networks/${id}`)
  return response.data
}

export async function createNetwork(data: CreateNetworkRequest): Promise<Network> {
  const response = await client.post<Network>('/networks', data)
  return response.data
}

export async function updateNetwork(id: string, data: UpdateNetworkRequest): Promise<Network> {
  const response = await client.put<Network>(`/networks/${id}`, data)
  return response.data
}

export async function deleteNetwork(id: string): Promise<void> {
  await client.delete(`/networks/${id}`)
}

import client from './client'
import type { ProvisionedVm, ProvisionedVmListResponse } from '../types/provisioned-vm'

export async function getProvisionedVms(params?: {
  status?: string
  page?: number
  per_page?: number
}): Promise<ProvisionedVmListResponse> {
  const { data } = await client.get<ProvisionedVmListResponse>('/provisioned-vms', { params })
  return data
}

export async function getProvisionedVm(id: string): Promise<ProvisionedVm> {
  const { data } = await client.get<ProvisionedVm>(`/provisioned-vms/${id}`)
  return data
}

export async function deleteProvisionedVm(id: string): Promise<void> {
  await client.delete(`/provisioned-vms/${id}`)
}

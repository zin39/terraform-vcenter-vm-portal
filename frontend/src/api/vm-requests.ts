import client from './client'
import type {
  VmRequest,
  CreateVmRequest,
  ReviewVmRequest,
  PaginatedVmRequests,
  ListVmRequestsParams,
} from '../types'

export async function createVmRequest(data: CreateVmRequest): Promise<VmRequest> {
  const response = await client.post<VmRequest>('/vm-requests', data)
  return response.data
}

export async function listVmRequests(params?: ListVmRequestsParams): Promise<PaginatedVmRequests> {
  const response = await client.get<PaginatedVmRequests>('/vm-requests', { params })
  return response.data
}

export async function getVmRequest(id: string): Promise<VmRequest> {
  const response = await client.get<VmRequest>(`/vm-requests/${id}`)
  return response.data
}

export async function reviewVmRequest(id: string, data: ReviewVmRequest): Promise<VmRequest> {
  const response = await client.put<VmRequest>(`/vm-requests/${id}/review`, data)
  return response.data
}

export async function downloadTerraform(id: string): Promise<void> {
  const response = await client.get(`/vm-requests/${id}/terraform`, {
    responseType: 'blob',
  })

  // Create download link
  const blob = new Blob([response.data], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `terraform-${id}.tf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function cancelVmRequest(id: string): Promise<void> {
  await client.delete(`/vm-requests/${id}`)
}

export async function retryProvisioning(id: string): Promise<VmRequest> {
  const response = await client.post<VmRequest>(`/vm-requests/${id}/retry`)
  return response.data
}

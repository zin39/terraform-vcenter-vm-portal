import client from './client'
import type { OsTemplate } from '../types/os-template'

export async function getOsTemplates(): Promise<OsTemplate[]> {
  const { data } = await client.get<OsTemplate[]>('/os-templates')
  return data
}

export async function createOsTemplate(template: Omit<OsTemplate, 'id' | 'is_active' | 'created_at' | 'updated_at'>): Promise<OsTemplate> {
  const { data } = await client.post<OsTemplate>('/os-templates', template)
  return data
}

export async function updateOsTemplate(id: string, template: Partial<OsTemplate>): Promise<OsTemplate> {
  const { data } = await client.put<OsTemplate>(`/os-templates/${id}`, template)
  return data
}

export async function deleteOsTemplate(id: string): Promise<void> {
  await client.delete(`/os-templates/${id}`)
}

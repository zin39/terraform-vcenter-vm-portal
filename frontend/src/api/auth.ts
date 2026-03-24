import client from './client'
import type {
  LoginRequest,
  LoginResponse,
  User,
  ChangePasswordRequest,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersParams,
  PaginatedUsers,
} from '../types'

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await client.post<LoginResponse>('/auth/login', data)
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await client.get<User>('/auth/me')
  return response.data
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await client.post('/auth/change-password', data)
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await client.post<User>('/users', data)
  return response.data
}

export async function listUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const response = await client.get<PaginatedUsers>('/users', { params })
  return response.data
}

export async function getUser(id: string): Promise<User> {
  const response = await client.get<User>(`/users/${id}`)
  return response.data
}

export async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  const response = await client.put<User>(`/users/${id}`, data)
  return response.data
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`)
}

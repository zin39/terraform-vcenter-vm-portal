export type UserRole = 'admin' | 'approver' | 'requester'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface CreateUserRequest {
  email: string
  password: string
  full_name: string
  role: UserRole
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface UpdateUserRequest {
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

export interface ListUsersParams {
  role?: UserRole
  page?: number
  per_page?: number
}

export interface PaginatedUsers {
  data: User[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  error: string
}

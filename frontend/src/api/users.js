import apiClient from './client'

/**
 * Get the current authenticated user's profile and approval status.
 */
export async function getCurrentUser() {
  const { data } = await apiClient.get('/users/me')
  return data.user || data
}

/**
 * Get all users (admin only).
 */
export async function getAllUsers() {
  const { data } = await apiClient.get('/users')
  return data.users || data || []
}

/**
 * Approve a pending user (admin only).
 */
export async function approveUser(userId) {
  const { data } = await apiClient.post(`/users/${userId}/approve`)
  return data
}

/**
 * Reject a pending user (admin only).
 */
export async function rejectUser(userId) {
  const { data } = await apiClient.post(`/users/${userId}/reject`)
  return data
}

/**
 * Change a user's role (admin only).
 */
export async function updateUserRole(userId, role) {
  const { data } = await apiClient.put(`/users/${userId}/role`, { role })
  return data
}

/**
 * Revoke a user's access (admin only).
 */
export async function revokeUser(userId) {
  const { data } = await apiClient.post(`/users/${userId}/revoke`)
  return data
}

/**
 * Delete a user permanently (admin only).
 */
export async function deleteUser(userId) {
  const { data } = await apiClient.delete(`/users/${userId}`)
  return data
}

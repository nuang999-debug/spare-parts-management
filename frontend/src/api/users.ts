import { request } from "./client";
import type { Role } from "./auth";

export interface ManagedUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export function listUsers(): Promise<ManagedUser[]> {
  return request<ManagedUser[]>("/admin/users");
}

export function createUser(data: {
  username: string;
  displayName: string;
  role: Role;
  tempPassword: string;
}): Promise<ManagedUser> {
  return request<ManagedUser>("/admin/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(
  id: number,
  data: { role?: Role; isActive?: boolean; resetPassword?: string }
): Promise<ManagedUser> {
  return request<ManagedUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

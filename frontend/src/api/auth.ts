import { request } from "./client";

export type Role = "ADMIN" | "USER";

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

export function fetchMe(): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/me");
}

export function login(username: string, password: string): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

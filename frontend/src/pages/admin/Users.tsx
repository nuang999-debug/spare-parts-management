import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, listUsers, updateUser } from "../../api/users";
import type { Role } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [tempPassword, setTempPassword] = useState("");
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: () => createUser({ username, displayName, role, tempPassword }),
    onSuccess: () => {
      setUsername("");
      setDisplayName("");
      setRole("USER");
      setTempPassword("");
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, data),
    onSuccess: () => {
      setResetTargetId(null);
      setResetPassword("");
      invalidate();
    },
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Users</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
        <input
          type="text"
          placeholder="Temporary password"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          minLength={8}
          required
        />
        <button type="submit" disabled={createMutation.isPending}>
          Create user
        </button>
      </form>

      {createMutation.isError && (
        <p className="import-error">
          {createMutation.error instanceof ApiError ? createMutation.error.message : "Failed to create user"}
        </p>
      )}
      {updateMutation.isError && (
        <p className="import-error">
          {updateMutation.error instanceof ApiError ? updateMutation.error.message : "Update failed"}
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Display name</th>
            <th>Role</th>
            <th>Active</th>
            <th>Must change password</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={isSelf}
                    onChange={(e) =>
                      updateMutation.mutate({ id: u.id, data: { role: e.target.value as Role } })
                    }
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    disabled={isSelf}
                    onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                  >
                    {u.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
                <td>{u.mustChangePassword ? "Yes" : "No"}</td>
                <td>
                  {resetTargetId === u.id ? (
                    <span style={{ display: "flex", gap: "0.3rem" }}>
                      <input
                        type="text"
                        placeholder="New temp password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        minLength={8}
                      />
                      <button
                        type="button"
                        disabled={resetPassword.length < 8}
                        onClick={() =>
                          updateMutation.mutate({ id: u.id, data: { resetPassword } })
                        }
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setResetTargetId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setResetTargetId(u.id)}>
                      Reset password
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

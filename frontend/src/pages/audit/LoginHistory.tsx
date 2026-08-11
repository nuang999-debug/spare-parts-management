import { useQuery } from "@tanstack/react-query";
import { listLoginHistory } from "../../api/audit";
import { ApiError } from "../../api/client";

export default function LoginHistory() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["login-history"], queryFn: listLoginHistory });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Login history</h2>
      {isError && <p className="import-error">{error instanceof ApiError ? error.message : "Failed to load login history"}</p>}
      {data?.truncated && (
        <p style={{ color: "var(--warning)" }}>
          Showing the most recent 500 entries — older entries exist but aren't shown. Narrow the date range to see them.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Username attempted</th>
            <th>User</th>
            <th>Result</th>
            <th>IP address</th>
            <th>User agent</th>
          </tr>
        </thead>
        <tbody>
          {(data?.rows ?? []).map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.createdAt).toLocaleString()}</td>
              <td>{entry.usernameAttempted}</td>
              <td>{entry.user?.displayName ?? "-"}</td>
              <td className={entry.success ? "import-success" : "import-error"}>
                {entry.success ? "Success" : "Failed"}
              </td>
              <td>{entry.ipAddress ?? "-"}</td>
              <td>{entry.userAgent ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

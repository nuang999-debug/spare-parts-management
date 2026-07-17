import { useQuery } from "@tanstack/react-query";
import { listLoginHistory } from "../../api/audit";

export default function LoginHistory() {
  const { data, isLoading } = useQuery({ queryKey: ["login-history"], queryFn: listLoginHistory });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Login history</h2>
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
          {(data ?? []).map((entry) => (
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

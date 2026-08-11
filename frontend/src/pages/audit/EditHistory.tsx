import { useQuery } from "@tanstack/react-query";
import { listEditHistory } from "../../api/audit";
import { ApiError } from "../../api/client";

export default function EditHistory() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["edit-history"], queryFn: listEditHistory });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Edit history</h2>
      {isError && <p className="import-error">{error instanceof ApiError ? error.message : "Failed to load edit history"}</p>}
      {data?.truncated && (
        <p style={{ color: "var(--warning)" }}>
          Showing the most recent 500 entries — older entries exist but aren't shown. Narrow the filters to see them.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Entity</th>
            <th>Field</th>
            <th>Old value</th>
            <th>New value</th>
            <th>Changed by</th>
          </tr>
        </thead>
        <tbody>
          {(data?.rows ?? []).map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.changedAt).toLocaleString()}</td>
              <td>{entry.entityLabel ?? `${entry.entityType} #${entry.entityId}`}</td>
              <td>{entry.fieldName}</td>
              <td>{entry.oldValue ?? "-"}</td>
              <td>{entry.newValue ?? "-"}</td>
              <td>{entry.changedBy.displayName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

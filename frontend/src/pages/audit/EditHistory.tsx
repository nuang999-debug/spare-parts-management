import { useQuery } from "@tanstack/react-query";
import { listEditHistory } from "../../api/audit";

export default function EditHistory() {
  const { data, isLoading } = useQuery({ queryKey: ["edit-history"], queryFn: listEditHistory });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Edit history</h2>
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
          {(data ?? []).map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.changedAt).toLocaleString()}</td>
              <td>
                {entry.entityType} #{entry.entityId}
              </td>
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

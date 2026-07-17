import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPackingRule,
  deactivatePackingRule,
  listPackingRules,
  recalculatePackingRules,
  updatePackingRule,
} from "../../api/packingRules";
import { ApiError } from "../../api/client";

export default function PackingRules() {
  const queryClient = useQueryClient();
  const { data: rules, isLoading } = useQuery({ queryKey: ["packing-rules"], queryFn: listPackingRules });

  const [itemNo, setItemNo] = useState("");
  const [multipleOf, setMultipleOf] = useState("");
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["packing-rules"] });

  const createMutation = useMutation({
    mutationFn: () => createPackingRule(itemNo, Number(multipleOf)),
    onSuccess: () => {
      setItemNo("");
      setMultipleOf("");
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updatePackingRule(id, { active }),
    onSuccess: invalidate,
  });

  const editMultipleMutation = useMutation({
    mutationFn: ({ id, multipleOf }: { id: number; multipleOf: number }) =>
      updatePackingRule(id, { multipleOf }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deactivatePackingRule(id),
    onSuccess: invalidate,
  });

  const recalcMutation = useMutation({
    mutationFn: recalculatePackingRules,
    onSuccess: (result) => {
      setRecalcMessage(`Rounded ${result.changedCount} item(s) to their packing multiple.`);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Packing unit rules</h2>
      <p>PR quantities for these item numbers are always rounded up to a multiple of the value shown.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
      >
        <input
          type="text"
          placeholder="Item No."
          value={itemNo}
          onChange={(e) => setItemNo(e.target.value)}
          required
        />
        <input
          type="number"
          min={1}
          placeholder="Multiple of"
          value={multipleOf}
          onChange={(e) => setMultipleOf(e.target.value)}
          required
        />
        <button type="submit" disabled={createMutation.isPending}>
          Add rule
        </button>
        <button
          type="button"
          disabled={recalcMutation.isPending}
          onClick={() => recalcMutation.mutate()}
        >
          {recalcMutation.isPending ? "Recalculating..." : "Recalculate existing PR values"}
        </button>
      </form>

      {createMutation.isError && (
        <p className="import-error">
          {createMutation.error instanceof ApiError ? createMutation.error.message : "Failed to add rule"}
        </p>
      )}
      {recalcMessage && <p className="import-success">{recalcMessage}</p>}

      <table>
        <thead>
          <tr>
            <th>Item No.</th>
            <th>Multiple of</th>
            <th>Active</th>
            <th>Created by</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(rules ?? []).map((rule) => (
            <tr key={rule.id}>
              <td>{rule.itemNoNormalized}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  defaultValue={rule.multipleOf}
                  style={{ width: "70px" }}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value > 0 && value !== rule.multipleOf) {
                      editMultipleMutation.mutate({ id: rule.id, multipleOf: value });
                    }
                  }}
                />
              </td>
              <td>{rule.active ? "Yes" : "No"}</td>
              <td>{rule.createdBy.displayName}</td>
              <td>
                {rule.active ? (
                  <button type="button" onClick={() => deleteMutation.mutate(rule.id)}>
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: rule.id, active: true })}
                  >
                    Reactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

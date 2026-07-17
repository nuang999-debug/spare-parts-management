import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateItemPr, type ItemListRow } from "../api/items";

export default function PrQtyCell({ item }: { item: ItemListRow }) {
  const [value, setValue] = useState(String(item.prQtyCurrent ?? 0));
  const queryClient = useQueryClient();

  useEffect(() => {
    setValue(String(item.prQtyCurrent ?? 0));
  }, [item.prQtyCurrent]);

  const mutation = useMutation({
    mutationFn: (newPrQty: number) => updateItemPr(item.id, newPrQty),
    onSuccess: (updated) => {
      queryClient.setQueryData<ItemListRow[]>(["items"], (prev) =>
        prev?.map((row) => (row.id === item.id ? { ...row, ...updated } : row))
      );
      queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      queryClient.invalidateQueries({ queryKey: ["item-history", item.id] });
      setValue(String(updated.prQtyCurrent ?? 0));
    },
  });

  function commit() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setValue(String(item.prQtyCurrent ?? 0));
      return;
    }
    if (parsed === item.prQtyCurrent) return;
    mutation.mutate(parsed);
  }

  return (
    <span className="pr-qty-cell" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        min={0}
        value={value}
        disabled={mutation.isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {item.prIsOverride && <span title="Manually overridden"> *</span>}
    </span>
  );
}

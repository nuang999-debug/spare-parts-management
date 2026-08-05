import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateItemPr, type ItemListRow } from "../api/items";

function displayValue(prQtyCurrent: number | null): string {
  return prQtyCurrent != null ? String(prQtyCurrent) : "";
}

export default function PrQtyCell({
  item,
  onFocusRow,
  onNavigate,
  onNavigateColumn,
  inputRef,
  clearSignal,
}: {
  item: ItemListRow;
  onFocusRow?: () => void;
  onNavigate?: (direction: 1 | -1) => void;
  onNavigateColumn?: (direction: 1 | -1) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  clearSignal?: number;
}) {
  const [value, setValue] = useState(displayValue(item.prQtyCurrent));
  const queryClient = useQueryClient();

  useEffect(() => {
    setValue(displayValue(item.prQtyCurrent));
  }, [item.prQtyCurrent]);

  // "Clear all PR" is a separate bulk action from this cell's own debounced auto-save. Without
  // this, a pending edit (typing a new value, or backspacing one to empty) whose 400ms timer
  // hasn't fired yet survives a "clear all" click untouched — the timer only reads `value` and
  // `item.prQtyCurrent` when it eventually fires, and if the bulk clear's own refetch hasn't
  // landed on this cell's props yet at that moment, commit() sees stale (still non-null) data
  // and saves right over the just-cleared value. Comparing the clearSignal captured when the
  // timer was SCHEDULED against its latest value when the timer FIRES catches this regardless of
  // what the local text happens to be — unlike snapshotting/resetting `value` itself, which is a
  // no-op (and so doesn't help) when the pending edit was already blank.
  const clearSignalRef = useRef(clearSignal);
  useEffect(() => {
    clearSignalRef.current = clearSignal;
  }, [clearSignal]);

  // Auto-saves shortly after each keystroke — the KPI bar and other rows' figures that read
  // this value pick it up without waiting for blur/Enter/arrow-nav. Debounced (not per-keystroke)
  // so typing "123" saves once, not three times with three audit-log entries.
  useEffect(() => {
    const signalAtScheduleTime = clearSignalRef.current;
    const timer = setTimeout(() => {
      if (clearSignalRef.current !== signalAtScheduleTime) {
        setValue(displayValue(item.prQtyCurrent)); // abandon — a bulk clear landed in between
        return;
      }
      commit();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const mutation = useMutation({
    // Shared across every PrQtyCell instance so "clear all PR" can check
    // queryClient.isMutating({ mutationKey: ["updateItemPr"] }) and wait for any in-flight edit to
    // land before it runs — a query-client-level check, not tied to any one component's lifetime,
    // so it still works correctly for a row that's scrolled out of view and unmounted mid-request
    // (this table is virtualized — a per-component onMutate/onSettled callback pair would silently
    // stop firing the moment its row unmounts, even though the underlying request keeps running).
    mutationKey: ["updateItemPr"],
    mutationFn: (newPrQty: number) => updateItemPr(item.id, newPrQty),
    onSuccess: (updated) => {
      queryClient.setQueryData<ItemListRow[]>(["items"], (prev) =>
        prev?.map((row) => (row.id === item.id ? { ...row, ...updated } : row))
      );
      queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      queryClient.invalidateQueries({ queryKey: ["item-history", item.id] });
      setValue(displayValue(updated.prQtyCurrent));
    },
  });

  function commit() {
    if (value.trim() === "") {
      if (item.prQtyCurrent == null) return;
      mutation.mutate(0);
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setValue(displayValue(item.prQtyCurrent));
      return;
    }
    if (parsed === (item.prQtyCurrent ?? 0)) return;
    mutation.mutate(parsed);
  }

  return (
    <span
      className="pr-qty-cell"
      onClick={(e) => {
        e.stopPropagation();
        // The span visually fills the whole <td> (including its padding, via negative margin
        // in CSS) so the highlighted box looks fully clickable, but a click landing in that
        // padding area hits the span itself, not the smaller <input> inside it — without this,
        // that click did nothing at all (stopPropagation alone doesn't focus anything), which
        // looked exactly like the reported "stuck" field.
        if (e.target !== e.currentTarget.querySelector("input")) {
          e.currentTarget.querySelector("input")?.focus();
        }
      }}
    >
      <input
        ref={inputRef}
        type="number"
        min={0}
        placeholder="—"
        value={value}
        // Not disabled while mutation.isPending: a disabled input is force-blurred by the
        // browser, which used to be harmless (the user was already leaving on blur/Enter) but
        // now kicks the user out mid-edit every time the debounced auto-save fires. commit()
        // already guards against redundant submits when the value hasn't actually changed.
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          e.target.select();
          // Deferred: calling this synchronously during the browser's native focus dispatch
          // can trigger a heavy re-render (mounting the detail panel + its data fetch) that
          // interrupts the same focus event and bounces focus back to <body>, making the
          // field the user just clicked into immediately untypeable.
          setTimeout(() => onFocusRow?.(), 0);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Same as finishing a cell in a spreadsheet: commit, then drop to the next row.
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            onNavigate?.(1);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // Block the browser's own native increment/decrement-on-arrow-key behavior for
            // type="number", and instead commit + move to the next/previous row.
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            onNavigate?.(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            // Same idea as up/down, but sideways to the adjacent column (same row) — matches
            // the grid's own Excel-style left/right nav instead of just moving the text caret.
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            onNavigateColumn?.(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      />
      {item.prIsOverride && <span title="Manually overridden"> *</span>}
    </span>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnFiltersState,
  type ColumnSizingState,
  type FilterFn,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { clearAllPr, listItems, type ItemListRow } from "../api/items";
import { StatusBadge, TrendIndicator } from "../components/StatusBadge";
import ItemDetailPanel from "../components/ItemDetailPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import PrQtyCell from "../components/PrQtyCell";
import KpiBar from "../components/KpiBar";
import { thaiMonthLabel } from "../lib/thaiMonths";
import { nextCellTone } from "../lib/analysis";
import { exportCSV } from "../lib/exportCsv";
import { useAuth } from "../auth/AuthContext";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterType?: "text" | "select" | "gte";
    selectOptions?: string[];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    // Identified by the item's stable database id, not its row index — react-table's
    // `row.index` can lag behind the row's actual current position after a filter/sort change
    // (the row object is reused across row-model recomputations faster than its cached .index
    // updates), which used to send Enter/arrow-key PR navigation to a completely wrong row.
    onFocusRow?: (itemId: number) => void;
    onNavigatePrRow?: (itemId: number, direction: 1 | -1) => void;
    onNavigatePrColumn?: (itemId: number, direction: 1 | -1) => void;
    registerPrInput?: (itemId: number, el: HTMLInputElement | null) => void;
    // Bumped once per successful "clear all PR" click. A PrQtyCell mid-edit has its own
    // debounced auto-save timer running independently of this button — without a signal to
    // abandon that timer, a value typed just before the click still gets auto-saved a moment
    // after the bulk clear completes, silently undoing it for that one row.
    clearSignal?: number;
  }
}

/**
 * Polls the shared PR-update mutation cache (mutationKey: ["updateItemPr"], set in PrQtyCell)
 * until nothing is in flight, or bails after `timeoutMs` as a safety net against a genuinely
 * stuck/failed request blocking the bulk clear forever. Query-client-level, not tied to any one
 * PrQtyCell instance's lifetime — this table is virtualized, so a row can scroll out of view and
 * unmount while its edit is still in flight; a per-component onMutate/onSettled callback pair
 * would silently stop firing at that point even though the request keeps running, which is
 * exactly the gap that let "clear all" race an off-screen row's pending edit.
 */
function waitForPrMutationsToSettle(queryClient: QueryClient, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (queryClient.isMutating({ mutationKey: ["updateItemPr"] }) === 0 || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

const gteFilter: FilterFn<ItemListRow> = (row, columnId, filterValue) => {
  if (filterValue === "" || filterValue === undefined || filterValue === null) return true;
  const value = row.getValue(columnId);
  return typeof value === "number" && value >= Number(filterValue);
};

const columnHelper = createColumnHelper<ItemListRow>();

/** These two columns render in a separate, non-horizontally-scrolling "frozen" table on the left,
 * so รหัส/ชื่ออะไหล่ stay visible while the rest of the table scrolls — avoids position:sticky
 * on table cells entirely, since that combination is unreliable across browsers/rendering engines. */
const FROZEN_COLUMN_IDS = new Set(["itemNoRaw", "description"]);

const HISTORY_LETTERS = ["AO", "AP", "AQ", "AR", "AS", "AT"];

const historyColumns = HISTORY_LETTERS.map((letter, i) =>
  columnHelper.accessor((row) => row.usageHistory[i]?.qty ?? null, {
    id: `hist${i}`,
    header: `${letter} ${thaiMonthLabel(i - 6)}`,
    size: 58,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => {
      const value = info.getValue();
      if (value == null) return "-";
      const avg = info.row.original.avgMonth ?? 0;
      const cls = avg > 0 && value > avg * 1.2 ? "hist-high" : avg > 0 && value < avg * 0.7 ? "hist-low" : "";
      return <span className={cls}>{value}</span>;
    },
  })
);

const nextColumn = (n: 1 | 2 | 3 | 4 | 5, letter: string) =>
  columnHelper.accessor(`next${n}`, {
    id: `next${n}`,
    header: `NEXT-${n} (${letter}) ${thaiMonthLabel(n)}`,
    size: 100,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => {
      const value = info.getValue();
      if (value == null) return "-";
      const tone = nextCellTone(value, info.row.original.sumMin);
      return <span className={`next-cell tone-${tone}`}>{value.toFixed(1)}</span>;
    },
  });

const columns = [
  columnHelper.accessor("itemNoRaw", {
    header: "รหัส",
    size: 120,
    filterFn: "includesString",
    meta: { filterType: "text" },
    cell: (info) => {
      const item = info.row.original;
      if (!item.isStale && !item.discontinuedModel) return info.getValue();
      const title = [
        item.discontinuedModel ? `Model ยกเลิกขาย: ${item.discontinuedModel} — ระวังก่อนสั่งซื้อเพิ่ม` : null,
        item.isStale ? "ไม่พบในไฟล์ import ล่าสุด — ข้อมูลนี้อาจไม่เป็นปัจจุบัน" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <span title={title}>
          {item.discontinuedModel ? "🛑 " : ""}
          {item.isStale ? "⚠️ " : ""}
          {info.getValue()}
        </span>
      );
    },
  }),
  columnHelper.accessor("description", {
    header: "ชื่ออะไหล่",
    size: 220,
    filterFn: "includesString",
    meta: { filterType: "text" },
  }),
  columnHelper.accessor("class", {
    header: "CLASS",
    size: 51,
    filterFn: "equalsString",
    meta: { filterType: "select" },
  }),
  columnHelper.accessor("category", {
    header: "CAT",
    size: 64,
    filterFn: "equalsString",
    meta: { filterType: "select" },
    cell: (info) => <span className="cat-cell">{info.getValue() ?? "—"}</span>,
  }),
  ...historyColumns,
  columnHelper.accessor("calcTrend", {
    header: "TREND",
    size: 53,
    filterFn: "equalsString",
    meta: { filterType: "select", selectOptions: ["UP", "DOWN", "FLAT"] },
    cell: (info) => <TrendIndicator trend={info.getValue()} />,
  }),
  columnHelper.accessor("avgMonth", {
    header: "AVG/M (AW)",
    size: 78,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => info.getValue()?.toFixed(1) ?? "-",
  }),
  columnHelper.accessor("leadTimeDays", {
    header: "LEAD (AX)",
    size: 69,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("oldMin", {
    header: "OLD MIN (BB)",
    size: 84,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("sumMin", {
    header: "SUM MIN (BC)",
    size: 85,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => <span className="sum-min-cell">{info.getValue() ?? "-"}</span>,
  }),
  columnHelper.accessor("poQty", {
    header: "PO N0 (BD=M)",
    size: 87,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("stockQty", {
    header: "STOCK (BE=Q)",
    size: 88,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("backorderQty", {
    header: "SO (BF=Y)",
    size: 69,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("prQtyCurrent", {
    header: "PR QTY (BG)",
    size: 100,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => (
      <PrQtyCell
        item={info.row.original}
        onFocusRow={() => info.table.options.meta?.onFocusRow?.(info.row.original.id)}
        onNavigate={(direction) => info.table.options.meta?.onNavigatePrRow?.(info.row.original.id, direction)}
        onNavigateColumn={(direction) => info.table.options.meta?.onNavigatePrColumn?.(info.row.original.id, direction)}
        inputRef={(el) => info.table.options.meta?.registerPrInput?.(info.row.original.id, el)}
        clearSignal={info.table.options.meta?.clearSignal}
      />
    ),
  }),
  nextColumn(1, "BH"),
  nextColumn(2, "BI"),
  nextColumn(3, "BJ"),
  nextColumn(4, "BK"),
  nextColumn(5, "BL"),
  columnHelper.accessor("calcStatus", {
    header: "สถานะ",
    size: 62,
    filterFn: "equalsString",
    meta: { filterType: "select", selectOptions: ["OK", "WARN", "DANGER"] },
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
];

function FilterCell({ column, items }: { column: Column<ItemListRow, unknown>; items: ItemListRow[] }) {
  const meta = column.columnDef.meta;
  const filterValue = (column.getFilterValue() as string | undefined) ?? "";

  if (meta?.filterType === "text") {
    return (
      <input
        type="text"
        placeholder="🔍"
        value={filterValue}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      />
    );
  }

  if (meta?.filterType === "select") {
    const options =
      meta.selectOptions ??
      [...new Set(items.map((row) => row[column.id as keyof ItemListRow]).filter((v): v is string => !!v))].sort();
    return (
      <select value={filterValue} onChange={(e) => column.setFilterValue(e.target.value || undefined)}>
        <option value="">ทั้ง</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (meta?.filterType === "gte") {
    return (
      <input
        type="number"
        placeholder="≥ —"
        value={filterValue}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      />
    );
  }

  return null;
}

function ResizeHandle({ header }: { header: Header<ItemListRow, unknown> }) {
  return (
    <div
      className={`th-resizer ${header.column.getIsResizing() ? "resizing" : ""}`}
      onMouseDown={(e) => {
        // Matches the original's resizer exactly (`e.stopPropagation();e.preventDefault();`)
        // — without preventDefault, the mousedown lets the browser start its own native
        // text-selection drag across the row cells below instead of (or on top of) our
        // resize logic, so dragging the handle just highlights text rather than resizing.
        e.stopPropagation();
        e.preventDefault();
        header.getResizeHandler()(e);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        header.getResizeHandler()(e);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default function ItemsTable({
  pendingItemNo,
  onPendingItemHandled,
}: {
  pendingItemNo?: string | null;
  onPendingItemHandled?: () => void;
}) {
  const { data: items, isLoading } = useQuery({ queryKey: ["items"], queryFn: listItems });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prInputRefs = useRef<Map<number, HTMLInputElement>>(new Map()); // keyed by item id, not row index
  const [clearSignal, setClearSignal] = useState(0);
  const clearAllPrMutation = useMutation({
    mutationFn: clearAllPr,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item"] });
      queryClient.invalidateQueries({ queryKey: ["item-history"] });
      setClearSignal((n) => n + 1);
    },
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [alertOnly, setAlertOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colId: string } | null>(null);

  function rowClassName(item: ItemListRow): string {
    const classes: string[] = [];
    if (item.id === selectedItemId) classes.push("row-selected");
    if (item.discontinuedModel) classes.push("row-discontinued");
    return classes.join(" ");
  }

  const zeroSumMinCount = useMemo(() => (items ?? []).filter((d) => (d.sumMin ?? 0) <= 0).length, [items]);

  // The BC=0 hide is skipped only for the two free-text search columns (item code/description),
  // so searching for a known item code still finds it even if its Sum MIN isn't set yet —
  // otherwise a real item can look "not found" purely because of this filter. A facet filter
  // like CAT/CLASS must NOT bypass the hide — this page is order planning for items that have a
  // Sum MIN, so picking e.g. CAT=MACHINE should never flood the view with hundreds of BC=0 rows
  // that were never here to plan orders for in the first place.
  const TEXT_SEARCH_COLUMN_IDS = new Set(["itemNoRaw", "description"]);
  const hasActiveFilter = columnFilters.some((f) => {
    if (!TEXT_SEARCH_COLUMN_IDS.has(f.id)) return false;
    const v = f.value;
    if (v == null || v === "") return false;
    if (Array.isArray(v)) return v.some((x) => x != null && x !== "");
    return true;
  });

  const data = useMemo(() => {
    let base = items ?? [];
    if (!showAll && !hasActiveFilter) base = base.filter((d) => (d.sumMin ?? 0) > 0);
    if (alertOnly) base = base.filter((d) => d.calcStatus !== "OK");
    return base;
  }, [items, showAll, alertOnly, hasActiveFilter]);

  // Mirrors the original's goToPlanItem(): arriving here with a pending item (from the Summary
  // tab) clears every filter that could hide it, temporarily shows BC=0 rows if needed, and
  // opens its detail panel — same as switchTab('plan') + applyF() + openDetail(no) there.
  useEffect(() => {
    if (!pendingItemNo || !items) return;
    const found = items.find((d) => d.itemNoRaw === pendingItemNo);
    if (found) {
      setColumnFilters([]);
      setAlertOnly(false);
      if (!((found.sumMin ?? 0) > 0)) setShowAll(true);
      setSelectedItemId(found.id);
    }
    onPendingItemHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItemNo, items]);

  const table = useReactTable({
    data,
    columns,
    // Matches the original's resize floor exactly: `Math.max(40, ...)` when dragging a th-resizer.
    defaultColumn: { minSize: 40 },
    state: { sorting, columnFilters, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    meta: {
      onFocusRow: (itemId) => {
        // Keeps the Excel-style active-cell highlight in sync with wherever focus actually is —
        // clicking straight into the PR input bypasses the <td>'s own onClick (which normally
        // sets this), so without this the green selection box stays stuck on a stale cell while
        // the field you're actually typing in shows no selection at all.
        const rowIndex = rows.findIndex((r) => r.original.id === itemId);
        if (rowIndex === -1) return;
        suppressScrollRef.current = true;
        setActiveCell({ rowIndex, colId: "prQtyCurrent" });
        setSelectedItemId(itemId);
      },
      onNavigatePrRow: (itemId, direction) => {
        // Resolved fresh by id every call rather than trusting a passed row index — react-table's
        // `row.index` can lag behind the row's real current position right after a filter/sort
        // change (the row object gets reused across row-model recomputations before its cached
        // .index catches up), which used to send this to a completely unrelated row.
        const fromRowIndex = rows.findIndex((r) => r.original.id === itemId);
        if (fromRowIndex === -1) return;
        const nextRowIndex = Math.min(Math.max(fromRowIndex + direction, 0), rows.length - 1);
        setActiveCell({ rowIndex: nextRowIndex, colId: "prQtyCurrent" });
      },
      onNavigatePrColumn: (itemId, direction) => {
        const rowIndex = rows.findIndex((r) => r.original.id === itemId);
        if (rowIndex === -1) return;
        const colIdx = columnOrder.indexOf("prQtyCurrent");
        const nextColId = columnOrder[Math.min(Math.max(colIdx + direction, 0), columnOrder.length - 1)];
        setActiveCell({ rowIndex, colId: nextColId });
        // Nothing else is left holding keyboard focus once we've moved off the PR input onto a
        // plain (non-editable) cell — re-focus the grid wrapper so arrow-key nav keeps working,
        // same as a normal cell click does.
        wrapRef.current?.focus();
      },
      registerPrInput: (itemId, el) => {
        if (el) prInputRefs.current.set(itemId, el);
        else prInputRefs.current.delete(itemId);
      },
      clearSignal,
    },
  });

  const rows = table.getRowModel().rows;
  // Drives the toolbar count label's wording: a search/filter bypasses the BC=0 hide (see
  // hasActiveFilter above), but that doesn't mean the CURRENT result set actually contains any
  // BC=0 row — e.g. searching a real BC>0 item code by itself. Checking the real rows, not just
  // whether a filter is active, keeps the label from claiming "includes BC=0" when it doesn't.
  const includesZeroBc = hasActiveFilter && rows.some((r) => (r.original.sumMin ?? 0) <= 0);
  // A direct click/focus always lands on a cell the user can already see — running the
  // scroll-into-view effect for that case just yanks the viewport out from under the row that's
  // opening the detail panel at the same instant (which itself narrows .items-table-scroll),
  // producing a visible double-jump. Only genuine keyboard-driven navigation (which can reach
  // an off-screen cell) should trigger it.
  const suppressScrollRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const hScrollBarRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => verticalScrollRef.current,
    estimateSize: () => 32,
    overscan: 15,
  });

  // .items-split-row's own vertical scrollbar (from its many rows) eats into its width, but
  // .items-hscroll-track below is a sibling with no vertical overflow of its own, so it doesn't
  // know to reserve the same space — without this, the dedicated horizontal scrollbar's track
  // is a few pixels wider than the body actually has room for, so its "fully scrolled" position
  // falls just short of revealing the last column (e.g. สถานะ) in full. Measuring the real
  // scrollbar width (varies by OS/browser) and folding it into the spacer keeps both tracks
  // representing the exact same usable width.
  const [vScrollbarWidth, setVScrollbarWidth] = useState(0);
  useLayoutEffect(() => {
    const el = verticalScrollRef.current;
    if (!el) return;
    function measure() {
      if (el) setVScrollbarWidth(el.offsetWidth - el.clientWidth);
    }
    measure();
    // The row virtualizer renders its rows asynchronously, so the scrollbar this depends on
    // doesn't necessarily exist yet on this synchronous layout-effect pass — re-measure a beat
    // later (and again after any subsequent resize) once it has actually settled.
    const timer = setTimeout(measure, 100);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [rows.length]);

  const leafColumns = table.getAllLeafColumns();
  const frozenLeafColumns = leafColumns.filter((c) => FROZEN_COLUMN_IDS.has(c.id));
  const scrollLeafColumns = leafColumns.filter((c) => !FROZEN_COLUMN_IDS.has(c.id));
  const columnOrder = leafColumns.map((c) => c.id);
  const frozenWidth = frozenLeafColumns.reduce((s, c) => s + c.getSize(), 0);
  const scrollContentWidth = scrollLeafColumns.reduce((s, c) => s + c.getSize(), 0);

  // The body's own horizontal scrollbar would otherwise sit at the bottom of its full,
  // un-clipped content height (thousands of pixels down) rather than the visible viewport, since
  // that div now grows to its natural content height (see .items-table-scroll CSS comment). This
  // dedicated bar stays pinned at the bottom of the visible table area and drives both the body
  // and header's horizontal position instead.
  function syncHorizontalScroll(scrollLeft: number, source: "bar" | "body") {
    if (source !== "bar" && hScrollBarRef.current) hScrollBarRef.current.scrollLeft = scrollLeft;
    if (horizontalScrollRef.current) horizontalScrollRef.current.scrollLeft = scrollLeft;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft;
  }

  // Keep the active cell in view (vertically via the virtualizer, horizontally in the scroll table).
  useEffect(() => {
    if (!activeCell) return;
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    rowVirtualizer.scrollToIndex(activeCell.rowIndex, { align: "auto" });
    if (FROZEN_COLUMN_IDS.has(activeCell.colId)) return;
    const scrollEl = horizontalScrollRef.current;
    if (!scrollEl) return;
    let offset = 0;
    for (const col of scrollLeafColumns) {
      if (col.id === activeCell.colId) break;
      offset += col.getSize();
    }
    const colWidth = scrollLeafColumns.find((c) => c.id === activeCell.colId)?.getSize() ?? 0;
    if (offset < scrollEl.scrollLeft) {
      syncHorizontalScroll(offset, "body");
    } else if (offset + colWidth > scrollEl.scrollLeft + scrollEl.clientWidth) {
      syncHorizontalScroll(offset + colWidth - scrollEl.clientWidth, "body");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell]);

  // Landing the Excel-style active-cell selection on the PR QTY column should drop straight
  // into typing, same as a spreadsheet — no extra click needed.
  useEffect(() => {
    if (!activeCell || activeCell.colId !== "prQtyCurrent") return;
    const itemId = rows[activeCell.rowIndex]?.original?.id;
    const el = itemId != null ? prInputRefs.current.get(itemId) : undefined;
    if (el && document.activeElement !== el) el.focus();
  }, [activeCell, rows]);

  // Once the detail panel is open, keep it following the active row as the user navigates
  // (arrow keys, or clicking a different row) instead of staying pinned to the first item opened.
  useEffect(() => {
    if (!activeCell || selectedItemId == null) return;
    const row = rows[activeCell.rowIndex];
    if (row && row.original.id !== selectedItemId) setSelectedItemId(row.original.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell?.rowIndex]);

  function onTableKeyDown(e: React.KeyboardEvent) {
    // Let a focused input/select handle its own arrow keys, Delete, etc. natively (caret
    // movement, number step, text selection) instead of the grid hijacking them to move the
    // active-cell selection — this only owns keyboard nav when the wrapper div itself has focus.
    const targetTag = (e.target as HTMLElement).tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") return;
    if (!activeCell) return;
    const { rowIndex, colId } = activeCell;
    const colIdx = columnOrder.indexOf(colId);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCell({ rowIndex: Math.min(rowIndex + 1, rows.length - 1), colId });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCell({ rowIndex: Math.max(rowIndex - 1, 0), colId });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = columnOrder[Math.min(colIdx + 1, columnOrder.length - 1)];
      setActiveCell({ rowIndex, colId: next });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = columnOrder[Math.max(colIdx - 1, 0)];
      setActiveCell({ rowIndex, colId: prev });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[rowIndex];
      if (row) setSelectedItemId(row.original.id);
    }
  }

  if (isLoading) return <p>Loading items...</p>;

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  function headerCell(header: Header<ItemListRow, unknown>, isFilterRow: boolean) {
    // Every column's width MUST be pinned explicitly here (not left to content/auto-sizing) —
    // the header, filter, and body rows each live in their own separate <table> (frozen vs
    // scroll, header vs body), so table-layout:fixed has nothing to lock onto without a real
    // width on every cell, and a long value (e.g. a long item name) would otherwise widen that
    // one table's column independently of the others, throwing header/body out of sync and
    // clipping whatever column ends up short — including the last one on the right edge.
    const width = header.getSize();
    return (
      <th
        key={header.id}
        onClick={isFilterRow ? (e) => e.stopPropagation() : header.column.getToggleSortingHandler()}
        style={{ cursor: isFilterRow ? "default" : "pointer", width, minWidth: width, maxWidth: width }}
      >
        {isFilterRow ? (
          <FilterCell column={header.column} items={items ?? []} />
        ) : (
          <>
            {flexRender(header.column.columnDef.header, header.getContext())}
            {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
          </>
        )}
        <ResizeHandle header={header} />
      </th>
    );
  }

  function bodyCell(cell: ReturnType<(typeof rows)[number]["getVisibleCells"]>[number], rowIndex: number) {
    const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colId === cell.column.id;
    const width = cell.column.getSize();
    return (
      <td
        key={cell.id}
        className={isActive ? "active-cell" : ""}
        style={{ width, minWidth: width, maxWidth: width }}
        onClick={() => {
          suppressScrollRef.current = true;
          setActiveCell({ rowIndex, colId: cell.column.id });
          wrapRef.current?.focus();
        }}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    );
  }

  return (
    <div className="items-page">
      <KpiBar items={items ?? []} />
      <div className="items-toolbar">
        <span className="items-count">
          {showAll
            ? `แสดง ${rows.length} / ${items?.length ?? 0} รายการ`
            : includesZeroBc
              ? `แสดง ${rows.length} รายการ (รวม BC=0 เพราะมีการค้นหา/กรอง) จากทั้งหมด ${items?.length ?? 0} รายการ`
              : `แสดง ${rows.length} รายการ (BC>0) จากทั้งหมด ${items?.length ?? 0} รายการ`}
        </span>
        <div className="items-toolbar-actions">
          <button type="button" className={alertOnly ? "on" : ""} onClick={() => setAlertOnly((v) => !v)}>
            🚨 เฉพาะต้องสั่ง
          </button>
          <button type="button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `ซ่อนแถว BC=0 (${zeroSumMinCount} รายการ)` : "แสดงทั้งหมด รวม BC=0"}
          </button>
          <button
            type="button"
            onClick={() => {
              setColumnFilters([]);
              setAlertOnly(false);
              setShowAll(false);
            }}
          >
            ✕ ล้าง Filter
          </button>
          <button type="button" onClick={() => exportCSV(rows.map((r) => r.original))}>
            ⬇ Export CSV
          </button>
          {user?.role === "ADMIN" && (
            <button
              type="button"
              disabled={clearAllPrMutation.isPending}
              onClick={async () => {
                if (!window.confirm("ต้องการล้างค่า PR QTY ของทุกรายการทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
                // A PR cell mid-edit (typed but not yet saved, or already saving) races the bulk
                // clear below over the network: if that individual PATCH commits AFTER this
                // request's DB write, the row keeps its value — looks exactly like "clicked clear
                // all, but that one row didn't clear." Blurring flushes any focused cell's edit
                // immediately (its onBlur handler saves it right away instead of waiting out its
                // own debounce — at most one cell can have unsaved input at a time, since moving
                // focus to type anywhere else always blurs it first), and waiting for the shared
                // mutation cache to drain then guarantees the bulk clear is always the LAST write
                // for every row, including one that's since scrolled out of view.
                (document.activeElement as HTMLElement | null)?.blur?.();
                await waitForPrMutationsToSettle(queryClient);
                clearAllPrMutation.mutate();
              }}
            >
              🗑 ล้าง PR ทั้งหมด
            </button>
          )}
        </div>
      </div>

      <div className="items-content-row">
        <div className="items-table-wrap" onKeyDown={onTableKeyDown} tabIndex={-1} ref={wrapRef}>
          {/* Header: a fixed (non vertically-scrolling) row, separate from the body below. The
              scroll-side header's horizontal position is synced to the body's scroll via JS, since
              relying on position:sticky here is unreliable across rendering engines. */}
          <div className="items-header-split">
            <div className="items-frozen-cols">
              <table className="items-table items-table-frozen">
                <colgroup>
                  {frozenLeafColumns.map((column) => (
                    <col key={column.id} style={{ width: column.getSize() }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="lrow">
                    {table
                      .getHeaderGroups()[0]
                      .headers.filter((h) => FROZEN_COLUMN_IDS.has(h.column.id))
                      .map((h) => headerCell(h, false))}
                  </tr>
                  <tr className="frow">
                    {table
                      .getHeaderGroups()[0]
                      .headers.filter((h) => FROZEN_COLUMN_IDS.has(h.column.id))
                      .map((h) => headerCell(h, true))}
                  </tr>
                </thead>
              </table>
            </div>
            <div className="items-header-scroll" ref={headerScrollRef}>
              <table className="items-table" style={{ width: scrollContentWidth }}>
                <colgroup>
                  {scrollLeafColumns.map((column) => (
                    <col key={column.id} style={{ width: column.getSize() }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="lrow">
                    {table
                      .getHeaderGroups()[0]
                      .headers.filter((h) => !FROZEN_COLUMN_IDS.has(h.column.id))
                      .map((h) => headerCell(h, false))}
                  </tr>
                  <tr className="frow">
                    {table
                      .getHeaderGroups()[0]
                      .headers.filter((h) => !FROZEN_COLUMN_IDS.has(h.column.id))
                      .map((h) => headerCell(h, true))}
                  </tr>
                </thead>
              </table>
            </div>
          </div>

          <div className="items-split-row" ref={verticalScrollRef}>
            <div className="items-frozen-cols">
              <table className="items-table items-table-frozen">
                <colgroup>
                  {frozenLeafColumns.map((column) => (
                    <col key={column.id} style={{ width: column.getSize() }} />
                  ))}
                </colgroup>
                <tbody>
                  {paddingTop > 0 && (
                    <tr aria-hidden>
                      <td style={{ height: paddingTop, padding: 0, border: "none" }} colSpan={frozenLeafColumns.length} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedItemId(row.original.id)}
                        className={rowClassName(row.original)}
                      >
                        {row
                          .getVisibleCells()
                          .filter((c) => FROZEN_COLUMN_IDS.has(c.column.id))
                          .map((c) => bodyCell(c, virtualRow.index))}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden>
                      <td style={{ height: paddingBottom, padding: 0, border: "none" }} colSpan={frozenLeafColumns.length} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="items-table-scroll"
              ref={horizontalScrollRef}
              onScroll={(e) => syncHorizontalScroll(e.currentTarget.scrollLeft, "body")}
            >
              <table className="items-table" style={{ width: scrollContentWidth }}>
                <colgroup>
                  {scrollLeafColumns.map((column) => (
                    <col key={column.id} style={{ width: column.getSize() }} />
                  ))}
                </colgroup>
                <tbody>
                  {paddingTop > 0 && (
                    <tr aria-hidden>
                      <td style={{ height: paddingTop, padding: 0, border: "none" }} colSpan={scrollLeafColumns.length} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedItemId(row.original.id)}
                        className={rowClassName(row.original)}
                      >
                        {row
                          .getVisibleCells()
                          .filter((c) => !FROZEN_COLUMN_IDS.has(c.column.id))
                          .map((c) => bodyCell(c, virtualRow.index))}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden>
                      <td style={{ height: paddingBottom, padding: 0, border: "none" }} colSpan={scrollLeafColumns.length} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="items-hscroll-track">
            <div className="items-hscroll-spacer" style={{ width: frozenWidth + vScrollbarWidth }} />
            <div
              className="items-hscroll-bar"
              ref={hScrollBarRef}
              onScroll={(e) => syncHorizontalScroll(e.currentTarget.scrollLeft, "bar")}
            >
              <div style={{ width: scrollContentWidth, height: 1 }} />
            </div>
          </div>
        </div>

        {selectedItemId != null && (
          <ErrorBoundary
            resetKey={selectedItemId}
            fallback={
              <aside className="detail-panel">
                <div className="detail-panel-header">
                  <h2>เกิดข้อผิดพลาดในการแสดงผล</h2>
                  <button type="button" onClick={() => setSelectedItemId(null)}>
                    Close
                  </button>
                </div>
                <p style={{ padding: "1rem" }}>ไม่สามารถแสดงรายละเอียดของรายการนี้ได้ ลองเลือกรายการอื่นแล้วกลับมาใหม่</p>
              </aside>
            }
          >
            <ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listItems, type CalcStatus, type ItemListRow } from "../api/items";
import { StatusBadge, TrendIndicator } from "../components/StatusBadge";
import ItemDetailPanel from "../components/ItemDetailPanel";
import PrQtyCell from "../components/PrQtyCell";

const columnHelper = createColumnHelper<ItemListRow>();

const columns = [
  columnHelper.accessor("itemNoRaw", { header: "Item No.", size: 130 }),
  columnHelper.accessor("description", { header: "Description", size: 260 }),
  columnHelper.accessor("category", { header: "Category", size: 90 }),
  columnHelper.accessor("vendor", { header: "Vendor", size: 110 }),
  columnHelper.accessor("stockQty", { header: "Stock", size: 70 }),
  columnHelper.accessor("poQty", { header: "On order", size: 80 }),
  columnHelper.accessor("sumMin", { header: "Sum MIN", size: 80 }),
  columnHelper.accessor("next1", {
    header: "Next-1",
    size: 80,
    cell: (info) => info.getValue()?.toFixed(1) ?? "-",
  }),
  columnHelper.accessor("calcStatus", {
    header: "Status",
    size: 80,
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("calcTrend", {
    header: "Trend",
    size: 60,
    cell: (info) => <TrendIndicator trend={info.getValue()} />,
  }),
  columnHelper.accessor("suggestedOrderQty", { header: "Suggested order", size: 110 }),
  columnHelper.accessor("prQtyCurrent", {
    header: "PR qty",
    size: 100,
    cell: (info) => <PrQtyCell item={info.row.original} />,
  }),
];

const STATUS_OPTIONS: Array<{ value: CalcStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DANGER", label: "Danger" },
  { value: "WARN", label: "Warn" },
  { value: "OK", label: "OK" },
];

export default function ItemsTable() {
  const { data: items, isLoading } = useQuery({ queryKey: ["items"], queryFn: listItems });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CalcStatus | "ALL">("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const filteredData = useMemo(() => {
    if (!items) return [];
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.calcStatus !== statusFilter) return false;
      if (!term) return true;
      return (
        item.itemNoRaw.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 34,
    overscan: 15,
  });

  if (isLoading) return <p>Loading items...</p>;

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;
  const leafColumns = table.getAllLeafColumns();

  return (
    <div className="items-page">
      <div className="items-toolbar">
        <input
          type="text"
          placeholder="Search item no. or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CalcStatus | "ALL")}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="items-count">
          {filteredData.length} / {items?.length ?? 0} items
        </span>
      </div>

      <div className="items-content-row">
      <div className="items-table-wrap">
        <div className="items-table-scroll" ref={scrollRef}>
          <table className="items-table">
            <colgroup>
              {leafColumns.map((column) => (
                <col key={column.id} style={{ width: column.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: "pointer" }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden>
                  <td style={{ height: paddingTop, padding: 0, border: "none" }} colSpan={leafColumns.length} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedItemId(row.original.id)}
                    className={row.original.id === selectedItemId ? "row-selected" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden>
                  <td style={{ height: paddingBottom, padding: 0, border: "none" }} colSpan={leafColumns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItemId != null && (
        <ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
      )}
      </div>
    </div>
  );
}

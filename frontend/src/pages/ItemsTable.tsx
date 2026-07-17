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
  columnHelper.accessor("itemNoRaw", { header: "Item No." }),
  columnHelper.accessor("description", { header: "Description" }),
  columnHelper.accessor("category", { header: "Category" }),
  columnHelper.accessor("vendor", { header: "Vendor" }),
  columnHelper.accessor("stockQty", { header: "Stock" }),
  columnHelper.accessor("poQty", { header: "On order" }),
  columnHelper.accessor("sumMin", { header: "Sum MIN" }),
  columnHelper.accessor("next1", {
    header: "Next-1",
    cell: (info) => info.getValue()?.toFixed(1) ?? "-",
  }),
  columnHelper.accessor("calcStatus", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("calcTrend", {
    header: "Trend",
    cell: (info) => <TrendIndicator trend={info.getValue()} />,
  }),
  columnHelper.accessor("suggestedOrderQty", { header: "Suggested order" }),
  columnHelper.accessor("prQtyCurrent", {
    header: "PR qty",
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

      <div className="items-table-wrap">
        <div className="items-table-scroll" ref={scrollRef}>
          <table className="items-table">
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
            <tbody style={{ height: rowVirtualizer.getTotalSize(), position: "relative", display: "block" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedItemId(row.original.id)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "table",
                      tableLayout: "fixed",
                      width: "100%",
                      cursor: "pointer",
                    }}
                    className={row.original.id === selectedItemId ? "row-selected" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItemId != null && (
        <ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
      )}
    </div>
  );
}

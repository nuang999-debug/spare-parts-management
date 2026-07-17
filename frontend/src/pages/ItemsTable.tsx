import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listItems, type ItemListRow } from "../api/items";
import { StatusBadge, TrendIndicator } from "../components/StatusBadge";
import ItemDetailPanel from "../components/ItemDetailPanel";
import PrQtyCell from "../components/PrQtyCell";
import { thaiMonthLabel } from "../lib/thaiMonths";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    filterType?: "text" | "select" | "gte";
    selectOptions?: string[];
  }
}

const gteFilter: FilterFn<ItemListRow> = (row, columnId, filterValue) => {
  if (filterValue === "" || filterValue === undefined || filterValue === null) return true;
  const value = row.getValue(columnId);
  return typeof value === "number" && value >= Number(filterValue);
};

const columnHelper = createColumnHelper<ItemListRow>();

const HISTORY_LETTERS = ["AO", "AP", "AQ", "AR", "AS", "AT"];

const historyColumns = HISTORY_LETTERS.map((letter, i) =>
  columnHelper.accessor((row) => row.usageHistory[i]?.qty ?? null, {
    id: `hist${i}`,
    header: `${letter} ${thaiMonthLabel(i - 5)}`,
    size: 62,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => info.getValue() ?? "-",
  })
);

const nextColumn = (n: 1 | 2 | 3 | 4 | 5, letter: string) =>
  columnHelper.accessor(`next${n}`, {
    id: `next${n}`,
    header: `NEXT-${n} (${letter}) ${thaiMonthLabel(n)}`,
    size: 100,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => info.getValue()?.toFixed(1) ?? "-",
  });

const columns = [
  columnHelper.accessor("itemNoRaw", {
    header: "รหัส",
    size: 120,
    filterFn: "includesString",
    meta: { filterType: "text" },
  }),
  columnHelper.accessor("description", {
    header: "ชื่ออะไหล่",
    size: 220,
    filterFn: "includesString",
    meta: { filterType: "text" },
  }),
  columnHelper.accessor("class", {
    header: "CLASS",
    size: 70,
    filterFn: "equalsString",
    meta: { filterType: "select" },
  }),
  columnHelper.accessor("category", {
    header: "CAT",
    size: 80,
    filterFn: "equalsString",
    meta: { filterType: "select" },
  }),
  ...historyColumns,
  columnHelper.accessor("calcTrend", {
    header: "TREND",
    size: 70,
    filterFn: "equalsString",
    meta: { filterType: "select", selectOptions: ["UP", "DOWN", "FLAT"] },
    cell: (info) => <TrendIndicator trend={info.getValue()} />,
  }),
  columnHelper.accessor("avgMonth", {
    header: "AVG/M (AW)",
    size: 90,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => info.getValue()?.toFixed(1) ?? "-",
  }),
  columnHelper.accessor("leadTimeDays", {
    header: "LEAD (AX)",
    size: 80,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("oldMin", {
    header: "OLD MIN (BB)",
    size: 90,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("sumMin", {
    header: "SUM MIN (BC)",
    size: 90,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("poQty", {
    header: "PO N0 (BD=M)",
    size: 95,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("stockQty", {
    header: "STOCK (BE=Q)",
    size: 90,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("backorderQty", {
    header: "SO (BF=Y)",
    size: 80,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
  }),
  columnHelper.accessor("prQtyCurrent", {
    header: "PR QTY (BG)",
    size: 100,
    filterFn: gteFilter,
    meta: { filterType: "gte" },
    cell: (info) => <PrQtyCell item={info.row.original} />,
  }),
  nextColumn(1, "BH"),
  nextColumn(2, "BI"),
  nextColumn(3, "BJ"),
  nextColumn(4, "BK"),
  nextColumn(5, "BL"),
  columnHelper.accessor("calcStatus", {
    header: "สถานะ",
    size: 80,
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

export default function ItemsTable() {
  const { data: items, isLoading } = useQuery({ queryKey: ["items"], queryFn: listItems });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const data = useMemo(() => items ?? [], [items]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
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
        <span className="items-count">
          {rows.length} / {items?.length ?? 0} รายการ
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
                  <tr key={headerGroup.id} className="lrow">
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
                <tr className="frow">
                  {table.getHeaderGroups()[0].headers.map((header) => (
                    <th key={header.id} onClick={(e) => e.stopPropagation()}>
                      <FilterCell column={header.column} items={data} />
                    </th>
                  ))}
                </tr>
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

import {
  DocumentLine,
  Item,
  NavClient,
  ScanSubmission,
  StockCountLine,
} from "./types";

const items: Item[] = [
  { no: "1000", description: "Bicycle", barcode: "8850000010001", baseUnitOfMeasure: "PCS" },
  { no: "1001", description: "Bicycle Wheel", barcode: "8850000010002", baseUnitOfMeasure: "PCS" },
  { no: "1002", description: "Bicycle Seat", barcode: "8850000010003", baseUnitOfMeasure: "PCS" },
];

const purchaseOrders: Record<string, DocumentLine[]> = {
  PO001: [
    { documentNo: "PO001", lineNo: 10000, itemNo: "1000", description: "Bicycle", unitOfMeasure: "PCS", quantity: 10, quantityHandled: 0 },
    { documentNo: "PO001", lineNo: 20000, itemNo: "1001", description: "Bicycle Wheel", unitOfMeasure: "PCS", quantity: 20, quantityHandled: 0 },
  ],
};

const salesOrders: Record<string, DocumentLine[]> = {
  SO001: [
    { documentNo: "SO001", lineNo: 10000, itemNo: "1000", description: "Bicycle", unitOfMeasure: "PCS", quantity: 5, quantityHandled: 0 },
  ],
};

const stockCountSheets: Record<string, StockCountLine[]> = {
  MAIN: [
    { location: "MAIN", itemNo: "1000", description: "Bicycle", unitOfMeasure: "PCS", quantityOnBooks: 42 },
    { location: "MAIN", itemNo: "1001", description: "Bicycle Wheel", unitOfMeasure: "PCS", quantityOnBooks: 80 },
    { location: "MAIN", itemNo: "1002", description: "Bicycle Seat", unitOfMeasure: "PCS", quantityOnBooks: 15 },
  ],
};

function applyScans(lines: DocumentLine[], scans: ScanSubmission[]): void {
  for (const scan of scans) {
    const line = lines.find((l) => l.itemNo === scan.itemNo);
    if (line) line.quantityHandled += scan.quantity;
  }
}

export function createMockNavClient(): NavClient {
  return {
    async lookupItemByBarcode(barcode: string) {
      return items.find((i) => i.barcode === barcode) ?? null;
    },

    async getPurchaseOrderLines(poNo: string) {
      return purchaseOrders[poNo] ?? [];
    },

    async postPurchaseReceipt(poNo: string, lines: ScanSubmission[]) {
      const doc = purchaseOrders[poNo];
      if (!doc) throw new Error(`Purchase order ${poNo} not found`);
      applyScans(doc, lines);
    },

    async getSalesOrderLines(soNo: string) {
      return salesOrders[soNo] ?? [];
    },

    async postSalesShipment(soNo: string, lines: ScanSubmission[]) {
      const doc = salesOrders[soNo];
      if (!doc) throw new Error(`Sales order ${soNo} not found`);
      applyScans(doc, lines);
    },

    async getStockCountSheet(location: string) {
      return stockCountSheets[location] ?? [];
    },

    async postStockCount(location: string, lines: ScanSubmission[]) {
      const sheet = stockCountSheets[location];
      if (!sheet) throw new Error(`Location ${location} not found`);
      for (const scan of lines) {
        const line = sheet.find((l) => l.itemNo === scan.itemNo);
        if (line) line.quantityOnBooks = scan.quantity;
      }
    },
  };
}

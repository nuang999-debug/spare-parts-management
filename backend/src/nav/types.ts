export interface Item {
  no: string;
  description: string;
  barcode: string;
  baseUnitOfMeasure: string;
}

export interface DocumentLine {
  documentNo: string;
  lineNo: number;
  itemNo: string;
  description: string;
  unitOfMeasure: string;
  quantity: number;
  quantityHandled: number; // already received / shipped
}

export interface StockCountLine {
  location: string;
  itemNo: string;
  description: string;
  unitOfMeasure: string;
  quantityOnBooks: number;
}

export interface ScanSubmission {
  itemNo: string;
  quantity: number;
}

export interface NavClient {
  lookupItemByBarcode(barcode: string): Promise<Item | null>;

  getPurchaseOrderLines(poNo: string): Promise<DocumentLine[]>;
  postPurchaseReceipt(poNo: string, lines: ScanSubmission[]): Promise<void>;

  getSalesOrderLines(soNo: string): Promise<DocumentLine[]>;
  postSalesShipment(soNo: string, lines: ScanSubmission[]): Promise<void>;

  getStockCountSheet(location: string): Promise<StockCountLine[]>;
  postStockCount(location: string, lines: ScanSubmission[]): Promise<void>;
}

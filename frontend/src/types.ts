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
  quantityHandled: number;
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

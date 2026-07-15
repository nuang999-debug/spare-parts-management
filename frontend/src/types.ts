export type Workflow = "receiving" | "picking" | "stockcount";

export interface ScanLine {
  barcode: string;
  quantity: number;
}

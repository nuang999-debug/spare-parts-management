export type Workflow = "receiving" | "picking" | "stockcount";

export interface ScanLine {
  barcode: string;
  quantity: number;
}

export interface ScanSubmission {
  workflow: Workflow;
  reference?: string;
  lines: ScanLine[];
}

export interface ScanRecord {
  id: number;
  workflow: Workflow;
  reference: string | null;
  barcode: string;
  quantity: number;
  scanned_at: string;
}

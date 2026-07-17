import { request, requestMultipart } from "./client";

export interface ItemPreviewSample {
  itemNoRaw: string;
  description: string;
  sumMin: number | null;
  stockQty: number;
}

export interface PreviewResult {
  fileType: string;
  rowCount: number;
  warnings: string[];
  errors: string[];
  sample: ItemPreviewSample[];
}

export interface CommitResult {
  importBatchId: number;
  rowCount: number;
  warnings: string[];
}

export interface PurchaseLinePreviewSample {
  itemNoRaw: string;
  quantity: number;
  quantityReceived: number;
  outstandingQty: number;
  expectedReceiptDate: string | null;
  bucketMonth: number | null;
}

export interface PurchaseLinesPreviewResult {
  fileType: string;
  rowCount: number;
  warnings: string[];
  errors: string[];
  sample: PurchaseLinePreviewSample[];
}

export interface PurchaseLinesCommitResult {
  importBatchId: number;
  rowCount: number;
  itemsUpdated: number;
  warnings: string[];
}

export interface ImportBatch {
  id: number;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  rowCount: number;
  status: string;
  uploadedBy: { displayName: string; username: string };
}

export function previewItemsImport(file: File): Promise<PreviewResult> {
  const formData = new FormData();
  formData.append("file", file);
  return requestMultipart<PreviewResult>("/admin/import/items/preview", formData);
}

export function commitItemsImport(file: File): Promise<CommitResult> {
  const formData = new FormData();
  formData.append("file", file);
  return requestMultipart<CommitResult>("/admin/import/items/commit", formData);
}

export function listImportBatches(): Promise<ImportBatch[]> {
  return request<ImportBatch[]>("/admin/import/batches");
}

export function previewPurchaseLinesImport(file: File): Promise<PurchaseLinesPreviewResult> {
  const formData = new FormData();
  formData.append("file", file);
  return requestMultipart<PurchaseLinesPreviewResult>("/admin/import/purchase-lines/preview", formData);
}

export function commitPurchaseLinesImport(file: File): Promise<PurchaseLinesCommitResult> {
  const formData = new FormData();
  formData.append("file", file);
  return requestMultipart<PurchaseLinesCommitResult>("/admin/import/purchase-lines/commit", formData);
}

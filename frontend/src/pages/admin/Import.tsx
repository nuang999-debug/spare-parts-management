import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  previewItemsImport,
  commitItemsImport,
  previewPurchaseLinesImport,
  commitPurchaseLinesImport,
  listImportBatches,
  type PreviewResult,
  type PurchaseLinesPreviewResult,
} from "../../api/import";
import { ApiError } from "../../api/client";

function ItemsImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: previewItemsImport,
    onSuccess: (result) => {
      setPreview(result);
      setCommitMessage(null);
    },
  });

  const commitMutation = useMutation({
    mutationFn: commitItemsImport,
    onSuccess: (result) => {
      setCommitMessage(`Imported ${result.rowCount} items (batch #${result.importBatchId}).`);
      setPreview(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setCommitMessage(null);
  }

  return (
    <section>
      <h2>Import item master data</h2>
      <p>Upload the latest "Data Inventory" export (.xlsx) to preview and commit it.</p>

      <input type="file" accept=".xlsx" onChange={handleFileChange} />
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={!file || previewMutation.isPending}
          onClick={() => file && previewMutation.mutate(file)}
        >
          {previewMutation.isPending ? "Checking..." : "Preview"}
        </button>
        <button
          type="button"
          disabled={!file || !preview || preview.errors.length > 0 || commitMutation.isPending}
          onClick={() => file && commitMutation.mutate(file)}
        >
          {commitMutation.isPending ? "Importing..." : "Commit import"}
        </button>
      </div>

      {previewMutation.isError && (
        <p className="import-error">
          {previewMutation.error instanceof ApiError ? previewMutation.error.message : "Preview failed"}
        </p>
      )}
      {commitMutation.isError && (
        <p className="import-error">
          {commitMutation.error instanceof ApiError ? commitMutation.error.message : "Import failed"}
        </p>
      )}
      {commitMessage && <p className="import-success">{commitMessage}</p>}

      {preview && (
        <div className="import-preview">
          <h3>Preview: {preview.rowCount} rows</h3>
          {preview.errors.length > 0 && (
            <ul className="import-error-list">
              {preview.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {preview.warnings.length > 0 && (
            <ul className="import-warning-list">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <table>
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Description</th>
                <th>Sum MIN</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row) => (
                <tr key={row.itemNoRaw}>
                  <td>{row.itemNoRaw}</td>
                  <td>{row.description}</td>
                  <td>{row.sumMin ?? "-"}</td>
                  <td>{row.stockQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PurchaseLinesImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PurchaseLinesPreviewResult | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: previewPurchaseLinesImport,
    onSuccess: (result) => {
      setPreview(result);
      setCommitMessage(null);
    },
  });

  const commitMutation = useMutation({
    mutationFn: commitPurchaseLinesImport,
    onSuccess: (result) => {
      setCommitMessage(
        `Imported ${result.rowCount} PO lines, recalculated forecast for ${result.itemsUpdated} items (batch #${result.importBatchId}).`
      );
      setPreview(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setCommitMessage(null);
  }

  return (
    <section style={{ marginTop: "2.5rem" }}>
      <h2>Import Purchase Lines</h2>
      <p>Upload the latest "PO Due" / Purchase Lines export (.xlsx) to reallocate the Next-1..5 forecast by due date.</p>

      <input type="file" accept=".xlsx" onChange={handleFileChange} />
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={!file || previewMutation.isPending}
          onClick={() => file && previewMutation.mutate(file)}
        >
          {previewMutation.isPending ? "Checking..." : "Preview"}
        </button>
        <button
          type="button"
          disabled={!file || !preview || preview.errors.length > 0 || commitMutation.isPending}
          onClick={() => file && commitMutation.mutate(file)}
        >
          {commitMutation.isPending ? "Importing..." : "Commit import"}
        </button>
      </div>

      {previewMutation.isError && (
        <p className="import-error">
          {previewMutation.error instanceof ApiError ? previewMutation.error.message : "Preview failed"}
        </p>
      )}
      {commitMutation.isError && (
        <p className="import-error">
          {commitMutation.error instanceof ApiError ? commitMutation.error.message : "Import failed"}
        </p>
      )}
      {commitMessage && <p className="import-success">{commitMessage}</p>}

      {preview && (
        <div className="import-preview">
          <h3>Preview: {preview.rowCount} outstanding lines</h3>
          {preview.errors.length > 0 && (
            <ul className="import-error-list">
              {preview.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {preview.warnings.length > 0 && (
            <ul className="import-warning-list">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <table>
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Qty</th>
                <th>Received</th>
                <th>Outstanding</th>
                <th>Expected receipt</th>
                <th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row, i) => (
                <tr key={i}>
                  <td>{row.itemNoRaw}</td>
                  <td>{row.quantity}</td>
                  <td>{row.quantityReceived}</td>
                  <td>{row.outstandingQty}</td>
                  <td>{row.expectedReceiptDate ? new Date(row.expectedReceiptDate).toLocaleDateString() : "-"}</td>
                  <td>{row.bucketMonth ?? "beyond 5 months"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Import() {
  const batchesQuery = useQuery({ queryKey: ["import-batches"], queryFn: listImportBatches });

  return (
    <div>
      <ItemsImportSection />
      <PurchaseLinesImportSection />

      <h3 style={{ marginTop: "2.5rem" }}>Import history</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>File</th>
            <th>Type</th>
            <th>Rows</th>
            <th>Status</th>
            <th>Uploaded by</th>
          </tr>
        </thead>
        <tbody>
          {(batchesQuery.data ?? []).map((batch) => (
            <tr key={batch.id}>
              <td>{new Date(batch.uploadedAt).toLocaleString()}</td>
              <td>{batch.fileName}</td>
              <td>{batch.fileType}</td>
              <td>{batch.rowCount}</td>
              <td>{batch.status}</td>
              <td>{batch.uploadedBy.displayName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

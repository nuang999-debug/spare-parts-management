import { useCallback, useState } from 'react';
import type { DocumentLine, ScanSubmission } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  title: string;
  documentLabel: string; // e.g. "Purchase Order No." / "Sales Order No."
  documentPlaceholder: string; // e.g. "e.g. PO001" / "e.g. SO001"
  quantityLabel: string; // e.g. "Qty. to Receive" / "Qty. to Ship"
  fetchLines: (docNo: string) => Promise<DocumentLine[]>;
  submitLines: (docNo: string, lines: ScanSubmission[]) => Promise<{ ok: true }>;
}

export function DocumentWorkflow({
  title,
  documentLabel,
  documentPlaceholder,
  quantityLabel,
  fetchLines,
  submitLines,
}: Props) {
  const [docNo, setDocNo] = useState('');
  const [docNoInput, setDocNoInput] = useState('');
  const [lines, setLines] = useState<DocumentLine[] | null>(null);
  const [scans, setScans] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = async (no: string) => {
    setError(null);
    setStatus(null);
    try {
      const result = await fetchLines(no);
      if (result.length === 0) {
        setError(`No open lines found for ${no}`);
        setLines(null);
        return;
      }
      setDocNo(no);
      setLines(result);
      setScans({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleScan = useCallback(
    (text: string) => {
      setLines((current) => {
        if (!current) return current;
        const match = current.find((l) => l.itemNo === text);
        if (!match) {
          setError(`Scanned barcode "${text}" does not match any line on this document`);
          return current;
        }
        setError(null);
        setScans((prev) => ({ ...prev, [text]: (prev[text] ?? 0) + 1 }));
        return current;
      });
    },
    [setLines]
  );

  const remaining = (line: DocumentLine) => line.quantity - line.quantityHandled - (scans[line.itemNo] ?? 0);

  const submit = async () => {
    const submission: ScanSubmission[] = Object.entries(scans)
      .filter(([, qty]) => qty > 0)
      .map(([itemNo, quantity]) => ({ itemNo, quantity }));
    if (submission.length === 0) {
      setError('Scan at least one item before submitting');
      return;
    }
    try {
      await submitLines(docNo, submission);
      setStatus(`Submitted ${submission.length} line(s) for ${docNo}`);
      setLines(null);
      setScans({});
      setDocNo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!lines) {
    return (
      <div className="workflow">
        <h2>{title}</h2>
        <label>
          {documentLabel}
          <input
            type="text"
            placeholder={documentPlaceholder}
            value={docNoInput}
            onChange={(e) => setDocNoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadDocument(docNoInput.trim());
            }}
          />
        </label>
        <button className="primary" onClick={() => loadDocument(docNoInput.trim())}>
          Load
        </button>
        <p className="hint">Type the document number, then tap Load (or press Enter).</p>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="workflow">
      <h2>
        {title}: {docNo}
      </h2>

      <button onClick={() => setScanning((s) => !s)}>{scanning ? 'Stop Scanning' : 'Start Scanning'}</button>
      {scanning && <BarcodeScanner active={scanning} onScan={handleScan} />}

      <table className="lines-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>{quantityLabel}</th>
            <th>Scanned</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.itemNo} className={remaining(line) <= 0 ? 'line-done' : ''}>
              <td>
                {line.itemNo} — {line.description}
              </td>
              <td>{line.quantity}</td>
              <td>{scans[line.itemNo] ?? 0}</td>
              <td>{remaining(line)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="error">{error}</p>}
      {status && <p className="status">{status}</p>}

      <button className="primary" onClick={submit}>
        Submit
      </button>
      <button
        onClick={() => {
          setLines(null);
          setScans({});
          setDocNo('');
        }}
      >
        Cancel
      </button>
    </div>
  );
}

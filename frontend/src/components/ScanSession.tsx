import { useCallback, useState } from 'react';
import { api } from '../api';
import type { ScanLine, Workflow } from '../types';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  workflow: Workflow;
  title: string;
  referenceLabel: string; // e.g. "PO/Supplier Note (optional)"
}

export function ScanSession({ workflow, title, referenceLabel }: Props) {
  const [reference, setReference] = useState('');
  const [scans, setScans] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback((text: string) => {
    setScans((prev) => ({ ...prev, [text]: (prev[text] ?? 0) + 1 }));
  }, []);

  const setQuantity = (barcode: string, quantity: number) => {
    setScans((prev) => ({ ...prev, [barcode]: Math.max(0, quantity) }));
  };

  const removeLine = (barcode: string) => {
    setScans((prev) => {
      const next = { ...prev };
      delete next[barcode];
      return next;
    });
  };

  const submit = async () => {
    setError(null);
    const lines: ScanLine[] = Object.entries(scans)
      .filter(([, quantity]) => quantity > 0)
      .map(([barcode, quantity]) => ({ barcode, quantity }));
    if (lines.length === 0) {
      setError('Scan at least one item before submitting');
      return;
    }
    try {
      const result = await api.submitScan(workflow, reference, lines);
      setStatus(`Submitted ${result.count} line(s)`);
      setScans({});
      setReference('');
      setScanning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const entries = Object.entries(scans);

  return (
    <div className="workflow">
      <h2>{title}</h2>

      <label>
        {referenceLabel}
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} />
      </label>

      <button onClick={() => setScanning((s) => !s)}>{scanning ? 'Stop Scanning' : 'Start Scanning'}</button>
      {scanning && <BarcodeScanner active={scanning} onScan={handleScan} />}

      {entries.length > 0 && (
        <table className="lines-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Quantity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([barcode, quantity]) => (
              <tr key={barcode}>
                <td>{barcode}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(barcode, Number(e.target.value))}
                    style={{ width: '4rem' }}
                  />
                </td>
                <td>
                  <button onClick={() => removeLine(barcode)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="error">{error}</p>}
      {status && <p className="status">{status}</p>}

      <button className="primary" onClick={submit}>
        Submit
      </button>
    </div>
  );
}

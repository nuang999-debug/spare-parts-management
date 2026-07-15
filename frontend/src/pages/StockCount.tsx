import { useCallback, useState } from 'react';
import { api } from '../api';
import { BarcodeScanner } from '../components/BarcodeScanner';
import type { ScanSubmission, StockCountLine } from '../types';

export function StockCount() {
  const [location, setLocation] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [lines, setLines] = useState<StockCountLine[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSheet = async (loc: string) => {
    setError(null);
    setStatus(null);
    try {
      const result = await api.getStockCount(loc);
      if (result.length === 0) {
        setError(`No stock count sheet found for location ${loc}`);
        setLines(null);
        return;
      }
      setLocation(loc);
      setLines(result);
      setCounts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleScan = useCallback((text: string) => {
    setLines((current) => {
      if (!current) return current;
      const match = current.find((l) => l.itemNo === text);
      if (!match) {
        setError(`Scanned barcode "${text}" is not on this count sheet`);
        return current;
      }
      setError(null);
      setCounts((prev) => ({ ...prev, [text]: (prev[text] ?? 0) + 1 }));
      return current;
    });
  }, []);

  const submit = async () => {
    // Every line on the sheet is submitted: scanned lines get the counted
    // quantity, unscanned lines are submitted as 0 (confirmed absent).
    const submission: ScanSubmission[] = (lines ?? []).map((line) => ({
      itemNo: line.itemNo,
      quantity: counts[line.itemNo] ?? 0,
    }));
    try {
      await api.postStockCount(location, submission);
      setStatus(`Submitted stock count for ${location}`);
      setLines(null);
      setCounts({});
      setLocation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!lines) {
    return (
      <div className="workflow">
        <h2>Stock Count</h2>
        <label>
          Location Code
          <input
            type="text"
            placeholder="e.g. MAIN"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadSheet(locationInput.trim());
            }}
          />
        </label>
        <button className="primary" onClick={() => loadSheet(locationInput.trim())}>
          Load
        </button>
        <p className="hint">Type the location code, then tap Load (or press Enter).</p>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="workflow">
      <h2>Stock Count: {location}</h2>

      <button onClick={() => setScanning((s) => !s)}>{scanning ? 'Stop Scanning' : 'Start Scanning'}</button>
      {scanning && <BarcodeScanner active={scanning} onScan={handleScan} />}

      <table className="lines-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>On Books</th>
            <th>Counted</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.itemNo}>
              <td>
                {line.itemNo} — {line.description}
              </td>
              <td>{line.quantityOnBooks}</td>
              <td>{counts[line.itemNo] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="error">{error}</p>}
      {status && <p className="status">{status}</p>}

      <button className="primary" onClick={submit}>
        Submit Count
      </button>
      <button
        onClick={() => {
          setLines(null);
          setCounts({});
          setLocation('');
        }}
      >
        Cancel
      </button>
    </div>
  );
}

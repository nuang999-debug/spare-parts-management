import { useState } from 'react';
import { api } from '../api';
import type { Workflow } from '../types';

export function Export() {
  const [workflow, setWorkflow] = useState<Workflow | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const href = api.exportUrl(workflow || undefined, from || undefined, to || undefined);

  return (
    <div className="workflow">
      <h2>Export</h2>

      <label>
        Workflow
        <select value={workflow} onChange={(e) => setWorkflow(e.target.value as Workflow | '')}>
          <option value="">All</option>
          <option value="receiving">Receiving</option>
          <option value="picking">Picking / Issue</option>
          <option value="stockcount">Stock Count</option>
        </select>
      </label>

      <label>
        From date (optional)
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>

      <label>
        To date (optional)
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>

      <a className="primary button-link" href={href}>
        Download CSV
      </a>
      <p className="hint">Open the downloaded CSV in Excel to reconcile against NAV.</p>
    </div>
  );
}

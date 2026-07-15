import { ScanSession } from '../components/ScanSession';

export function Picking() {
  return <ScanSession workflow="picking" title="Picking / Issue" referenceLabel="SO Number / Note (optional)" />;
}

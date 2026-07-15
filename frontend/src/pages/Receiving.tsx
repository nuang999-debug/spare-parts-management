import { ScanSession } from '../components/ScanSession';

export function Receiving() {
  return <ScanSession workflow="receiving" title="Receiving" referenceLabel="PO Number / Note (optional)" />;
}

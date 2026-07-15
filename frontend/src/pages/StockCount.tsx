import { ScanSession } from '../components/ScanSession';

export function StockCount() {
  return <ScanSession workflow="stockcount" title="Stock Count" referenceLabel="Location / Note (optional)" />;
}

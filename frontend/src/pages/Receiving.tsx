import { api } from '../api';
import { DocumentWorkflow } from '../components/DocumentWorkflow';

export function Receiving() {
  return (
    <DocumentWorkflow
      title="Receiving"
      documentLabel="Purchase Order No."
      documentPlaceholder="e.g. PO001"
      quantityLabel="Qty. Ordered"
      fetchLines={api.getReceivingLines}
      submitLines={api.postReceiving}
    />
  );
}

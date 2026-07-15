import { api } from '../api';
import { DocumentWorkflow } from '../components/DocumentWorkflow';

export function Picking() {
  return (
    <DocumentWorkflow
      title="Picking / Issue"
      documentLabel="Sales Order No."
      documentPlaceholder="e.g. SO001"
      quantityLabel="Qty. Ordered"
      fetchLines={api.getPickingLines}
      submitLines={api.postPicking}
    />
  );
}

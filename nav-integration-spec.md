# NAV 2017 Integration Spec — Warehouse Barcode App

Handoff spec for whoever has C/AL Object Designer access (internal NAV admin or the Nilfisk NAV partner) to build the NAV-side objects this app needs. The app (Node.js backend + React PWA) is already built and working against a mock data layer — swapping in these real NAV objects is the only remaining step to go live.

## Environment
- NAV 2017 (W1 8.00), on-premise, instance `navasia.nilfisk.com`
- SOAP Services port: `7347`
- OData Services port: `7348`
- Warehousing: **Basic** (no Bin/Zone) — receiving posts straight off the PO, picking straight off the SO, stock count uses an Item Journal batch
- **Note**: this database already has custom objects (`CN Basic Data - *` pages/queries in the 50000+ range) — please pick unused object IDs and confirm whether Item barcodes live in the standard `Item Reference` table (5771, Reference Type = Bar Code) or a custom field, before implementing the Item lookup below. The earlier discussion confirmed barcodes are already linked to items in NAV, but not which mechanism.

## Auth
A single NAV service account (Windows/NTLM or Basic auth, whichever this NST instance is configured for) is used by the backend for all calls. No per-user NAV login — the app has its own lightweight user selection.

## 1. Item barcode lookup (OData, read-only)

**Object to publish**: an OData page/query, suggested name `WS Item Barcode`, returning one row per barcode.

Fields required:
| Field | Source |
|---|---|
| `No` | Item No. |
| `Description` | Item Description |
| `Barcode` | Item Reference."Reference No." (filtered to Reference Type = Bar Code) or the custom barcode field, whichever applies |
| `Base_Unit_of_Measure` | Item."Base Unit of Measure" |

Backend calls: `GET .../ODataV3/Company('<company>')/WS_Item_Barcode?$filter=Barcode eq '<scanned value>'`

## 2. Purchase Order lines — Receiving (OData read/write + SOAP action)

**OData page** `WS Purchase Line` over the Purchase Line table, filtered to `Document Type = Order`, editable so the backend can PATCH `Qty. to Receive` per line.

Fields: `Document_No`, `Line_No`, `No` (item), `Description`, `Unit_of_Measure_Code`, `Quantity`, `Quantity_Received`.

Flow:
1. Backend `GET`s lines for a PO No. to display quantity ordered / already received.
2. As items are scanned, backend `PATCH`es each line's `Qty. to Receive`.
3. Backend calls the SOAP action below to actually post the receipt.

**SOAP Codeunit** `PostPurchaseReceipt`, one exported function:
```
ReceivePurchaseOrder(DocumentNo: Code[20])
```
Implementation: get Purchase Header by No., set `Receive := TRUE`, `Invoice := FALSE`, `Codeunit.Run(Codeunit::"Purch.-Post", PurchHeader)`.

## 3. Sales Order lines — Picking/Issue (OData read/write + SOAP action)

Same pattern as Purchase, mirrored:

**OData page** `WS Sales Line` over Sales Line, `Document Type = Order`, editable `Qty. to Ship`.

Fields: `Document_No`, `Line_No`, `No`, `Description`, `Unit_of_Measure_Code`, `Quantity`, `Quantity_Shipped`.

**SOAP Codeunit** `PostSalesShipment`:
```
ShipSalesOrder(DocumentNo: Code[20])
```
Implementation: get Sales Header by No., set `Ship := TRUE`, `Invoice := FALSE`, `Codeunit.Run(Codeunit::"Sales-Post", SalesHeader)`.

## 4. Stock count (OData read/write + SOAP action)

**One-time setup**: create a dedicated Item Journal Template (Type = Item) and Batch, e.g. Template `ITEM`, Batch `BARCODE`, reserved for this app.

**OData query** `WS Item Inventory By Location` — read-only, returns current on-hand qty per item for a given Location Code (join Item Ledger Entry or use an existing inventory query). Fields: `Item_No`, `Description`, `Unit_of_Measure_Code`, `Quantity_On_Books`, filtered by `Location_Code`.

**OData page** `WS Item Journal Line` over Item Journal Line, filtered to Template `ITEM` / Batch `BARCODE`, editable so the backend can insert/update lines with the counted quantity.

**SOAP Codeunit** `PostStockCount`:
```
PostPhysInventory(LocationCode: Code[10])
```
Implementation: run `Codeunit::"Item Jnl.-Post Batch"` (22) against Template `ITEM` / Batch `BARCODE` (optionally filtered by location if lines are scoped that way).

## Contract summary for the backend

The backend's `NavClient` interface (`backend/src/nav/types.ts`) is the exact shape all of the above needs to satisfy once wired up for real — `backend/src/nav/mockClient.ts` shows the exact request/response data it currently fakes. Implementing `createLiveNavClient()` in `backend/src/nav/client.ts` against the objects above (using OData for reads/writes, SOAP for the three posting actions) is the only backend change needed to go live — no frontend changes required.

## Suggested build/test order
1. Publish `WS Item Barcode` first — quickest to verify, unblocks item lookup end-to-end.
2. Purchase Order flow (`WS Purchase Line` + `PostPurchaseReceipt`) — test against a real sandbox PO.
3. Sales Order flow (`WS Sales Line` + `PostSalesShipment`).
4. Stock count objects + the one-time Item Journal Template/Batch setup.

Test every object directly with Postman/SoapUI against the NAV **sandbox/test company** before the backend's `NAV_MODE` is switched from `mock` to `live`.

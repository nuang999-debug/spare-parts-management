import { Router } from "express";
import { navClient } from "../nav/client";
import { ScanSubmission } from "../nav/types";

export const receivingRouter = Router();

receivingRouter.get("/:poNo", async (req, res) => {
  const lines = await navClient.getPurchaseOrderLines(req.params.poNo);
  res.json(lines);
});

receivingRouter.post("/:poNo", async (req, res) => {
  const scans: ScanSubmission[] = req.body.lines ?? [];
  try {
    await navClient.postPurchaseReceipt(req.params.poNo, scans);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

import { Router } from "express";
import { navClient } from "../nav/client";
import { ScanSubmission } from "../nav/types";

export const pickingRouter = Router();

pickingRouter.get("/:soNo", async (req, res) => {
  const lines = await navClient.getSalesOrderLines(req.params.soNo);
  res.json(lines);
});

pickingRouter.post("/:soNo", async (req, res) => {
  const scans: ScanSubmission[] = req.body.lines ?? [];
  try {
    await navClient.postSalesShipment(req.params.soNo, scans);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

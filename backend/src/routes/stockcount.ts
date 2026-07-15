import { Router } from "express";
import { navClient } from "../nav/client";
import { ScanSubmission } from "../nav/types";

export const stockCountRouter = Router();

stockCountRouter.get("/:location", async (req, res) => {
  const lines = await navClient.getStockCountSheet(req.params.location);
  res.json(lines);
});

stockCountRouter.post("/:location", async (req, res) => {
  const scans: ScanSubmission[] = req.body.lines ?? [];
  try {
    await navClient.postStockCount(req.params.location, scans);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

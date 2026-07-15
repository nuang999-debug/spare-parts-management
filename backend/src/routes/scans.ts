import { Router } from "express";
import { pool } from "../db";
import { ScanRecord, ScanSubmission } from "../types";

export const scansRouter = Router();

scansRouter.post("/", async (req, res) => {
  const body = req.body as ScanSubmission;
  if (!body.workflow || !Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "workflow and at least one line are required" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const line of body.lines) {
      await client.query(
        `INSERT INTO scans (workflow, reference, barcode, quantity) VALUES ($1, $2, $3, $4)`,
        [body.workflow, body.reference ?? null, line.barcode, line.quantity]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, count: body.lines.length });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

scansRouter.get("/", async (req, res) => {
  const { workflow } = req.query;
  const result = workflow
    ? await pool.query<ScanRecord>("SELECT * FROM scans WHERE workflow = $1 ORDER BY scanned_at DESC", [workflow])
    : await pool.query<ScanRecord>("SELECT * FROM scans ORDER BY scanned_at DESC");
  res.json(result.rows);
});

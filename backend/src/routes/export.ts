import { Router } from "express";
import { pool } from "../db";
import { ScanRecord } from "../types";

export const exportRouter = Router();

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

exportRouter.get("/", async (req, res) => {
  const { workflow, from, to } = req.query as Record<string, string | undefined>;

  const conditions: string[] = [];
  const params: string[] = [];
  if (workflow) {
    params.push(workflow);
    conditions.push(`workflow = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`scanned_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`scanned_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query<ScanRecord>(
    `SELECT * FROM scans ${where} ORDER BY scanned_at ASC`,
    params
  );

  const header = "workflow,reference,barcode,quantity,scanned_at";
  const rows = result.rows.map((r) =>
    [r.workflow, r.reference ?? "", r.barcode, String(r.quantity), r.scanned_at]
      .map(csvEscape)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="scans-export.csv"`);
  res.send(csv);
});

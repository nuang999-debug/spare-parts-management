import { Router } from "express";
import multer from "multer";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { HttpError } from "../../middleware/errorHandler";
import { parseItemsRawWorkbook } from "../../services/excelImport/parseItemsRaw";
import { commitItemsImport } from "../../services/excelImport/commitItemsImport";
import { parsePurchaseLinesWorkbook } from "../../services/excelImport/parsePurchaseLines";
import { commitPurchaseLinesImport } from "../../services/excelImport/commitPurchaseLinesImport";

export const importRouter = Router();
importRouter.use(requireAuth, requireRole("ADMIN"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

importRouter.post("/items/preview", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const result = parseItemsRawWorkbook(req.file.buffer);
    res.json({
      fileType: "ITEMS_RAW",
      rowCount: result.rowCount,
      warnings: result.warnings,
      errors: result.errors,
      sample: result.rows.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

importRouter.post("/items/commit", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const result = parseItemsRawWorkbook(req.file.buffer);
    if (result.errors.length) {
      throw new HttpError(400, result.errors.join(" "));
    }
    const { importBatchId, rowCount } = await commitItemsImport({
      rows: result.rows,
      fileName: req.file.originalname,
      uploadedById: req.user!.id,
    });
    res.json({ importBatchId, rowCount, warnings: result.warnings });
  } catch (err) {
    next(err);
  }
});

importRouter.post("/purchase-lines/preview", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const result = parsePurchaseLinesWorkbook(req.file.buffer);
    res.json({
      fileType: "PURCHASE_LINES",
      rowCount: result.rowCount,
      warnings: result.warnings,
      errors: result.errors,
      sample: result.rows.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

importRouter.post("/purchase-lines/commit", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const result = parsePurchaseLinesWorkbook(req.file.buffer);
    if (result.errors.length) {
      throw new HttpError(400, result.errors.join(" "));
    }
    const { importBatchId, rowCount, itemsUpdated } = await commitPurchaseLinesImport({
      rows: result.rows,
      fileName: req.file.originalname,
      uploadedById: req.user!.id,
    });
    res.json({ importBatchId, rowCount, itemsUpdated, warnings: result.warnings });
  } catch (err) {
    next(err);
  }
});

importRouter.get("/batches", async (_req, res, next) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: { select: { displayName: true, username: true } } },
    });
    res.json(batches);
  } catch (err) {
    next(err);
  }
});

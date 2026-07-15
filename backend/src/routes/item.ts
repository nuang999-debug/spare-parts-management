import { Router } from "express";
import { navClient } from "../nav/client";

export const itemRouter = Router();

itemRouter.get("/:barcode", async (req, res) => {
  const item = await navClient.lookupItemByBarcode(req.params.barcode);
  if (!item) {
    res.status(404).json({ error: `No item found for barcode ${req.params.barcode}` });
    return;
  }
  res.json(item);
});

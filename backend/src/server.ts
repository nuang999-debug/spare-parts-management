import cors from "cors";
import express from "express";
import { config } from "./config";
import { itemRouter } from "./routes/item";
import { pickingRouter } from "./routes/picking";
import { receivingRouter } from "./routes/receiving";
import { stockCountRouter } from "./routes/stockcount";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, navMode: config.navMode });
});

app.use("/api/item", itemRouter);
app.use("/api/receiving", receivingRouter);
app.use("/api/picking", pickingRouter);
app.use("/api/stockcount", stockCountRouter);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Barcode backend listening on http://0.0.0.0:${config.port} (NAV_MODE=${config.navMode})`);
});

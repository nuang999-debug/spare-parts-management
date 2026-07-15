import cors from "cors";
import express from "express";
import { config } from "./config";
import { initDb } from "./db";
import { exportRouter } from "./routes/export";
import { scansRouter } from "./routes/scans";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/scans", scansRouter);
app.use("/api/export", exportRouter);

initDb()
  .then(() => {
    app.listen(config.port, "0.0.0.0", () => {
      console.log(`Barcode backend listening on http://0.0.0.0:${config.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database", err);
    process.exit(1);
  });

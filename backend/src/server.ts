import cors from "cors";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import "./types";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { importRouter } from "./routes/admin/import";
import { itemsRouter } from "./routes/items";
import { auditRouter } from "./routes/audit";
import { packingRulesRouter } from "./routes/admin/packingRules";
import { usersRouter } from "./routes/admin/users";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

const sessionPool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({ pool: sessionPool, createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/admin/import", importRouter);
app.use("/api/items", itemsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin/packing-rules", packingRulesRouter);
app.use("/api/admin/users", usersRouter);

app.use(errorHandler);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Spare parts backend listening on http://0.0.0.0:${config.port}`);
});

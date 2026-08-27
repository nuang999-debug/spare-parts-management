import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  // Comma-separated so both the old and new frontend hosts can work at once during a migration
  // (e.g. Render static site + Cloudflare Pages) instead of an all-or-nothing cutover.
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim()),
  isProduction: process.env.NODE_ENV === "production",
};

if (config.isProduction && (!config.sessionSecret || config.sessionSecret === "change-me-to-a-long-random-string")) {
  throw new Error("SESSION_SECRET must be set to a real secret in production");
}

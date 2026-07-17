import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
};

if (config.isProduction && (!config.sessionSecret || config.sessionSecret === "change-me-to-a-long-random-string")) {
  throw new Error("SESSION_SECRET must be set to a real secret in production");
}

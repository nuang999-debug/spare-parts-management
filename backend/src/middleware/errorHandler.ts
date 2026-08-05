import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Without this, every request-body validation failure across the whole app (bad types, an
  // out-of-range number, a missing field) fell through to the generic 500 branch below —
  // reported to the client as "Internal server error" instead of the actual reason, and logged
  // as a server-side error even though it's a completely expected/handled input problem.
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", issues: err.issues });
    return;
  }
  // Same class of gap as ZodError above: Multer throws its own error type (e.g. a file over the
  // 25MB limit) that isn't HttpError or ZodError, so it used to fall through to the generic 500
  // below instead of a clear "file too large" 400.
  if (err instanceof MulterError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

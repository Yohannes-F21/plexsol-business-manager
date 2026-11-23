import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = {
  success: false;
  error: { flatten: () => unknown };
};
type ParsableSchema<T> = {
  safeParse: (data: unknown) => SafeParseSuccess<T> | SafeParseFailure;
};

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function parseBody<T>(schema: ParsableSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      "Invalid request body",
      400,
      "validation_error",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function parseQuery<T>(schema: ParsableSchema<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new HttpError(
      "Invalid query parameters",
      400,
      "validation_error",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function paramId(req: Request, name = "id"): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    throw new HttpError(`${name} is required`, 400, "validation_error");
  }
  return value;
}

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(`Invalid date: ${value}`, 400, "validation_error");
  }
  return date;
}

export function decimalToString(value: { toString(): string } | null | undefined): string | null {
  return value == null ? null : value.toString();
}

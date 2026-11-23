import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const moneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Amount must be a positive decimal string")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

export const currencyCodeSchema = z
  .string()
  .length(3)
  .transform((value) => value.toUpperCase());

export const optionalStringSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => (value && value.length > 0 ? value : null));

/** Accepts YYYY-MM-DD or ISO datetime strings. */
export const dateInputSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

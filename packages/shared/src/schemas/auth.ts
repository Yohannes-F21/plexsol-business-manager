import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "STAFF"]);

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema,
});

export const authSessionResponseSchema = z.object({
  user: publicUserSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must not exceed 72 UTF-8 bytes.',
  });

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email,
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

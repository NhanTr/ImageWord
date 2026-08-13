import { z } from 'zod';

export const imageIdSchema = z.uuid();

export const imageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum(['UPLOADED', 'GENERATED']).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
  cursor: z.string().max(512).optional(),
});

const printableAscii = /^[\x20-\x7e]+$/;

export const generateImageSchema = z.object({
  columns: z.number().int().min(20).max(300).default(120),
  characterSet: z
    .string()
    .min(2)
    .max(32)
    .regex(printableAscii, 'Character set must contain printable ASCII characters only.')
    .default('@%#*+=-:. '),
  fontFamily: z.literal('monospace').default('monospace'),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Background color must use #RRGGBB format.')
    .transform((value) => value.toLowerCase())
    .default('#000000'),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const generateVideoSchema = generateImageSchema.extend({
  columns: z.number().int().min(20).max(120).default(80),
  durationSeconds: z.number().min(2).max(10).default(5),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;

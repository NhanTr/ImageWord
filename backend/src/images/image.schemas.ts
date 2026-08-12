import { z } from 'zod';

export const imageIdSchema = z.uuid();

export const imageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum(['UPLOADED', 'GENERATED']).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
  cursor: z.string().max(512).optional(),
});

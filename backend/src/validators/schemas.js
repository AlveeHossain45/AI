/**
 * Request validation schemas (zod).
 */
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(/[a-zA-Z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.');
const name = z.string().trim().min(1, 'Name is required.').max(80);
const id = z.string().uuid('Invalid id.');

export const registerSchema = z.object({ body: z.object({ email, password, name: name.optional() }) });
export const loginSchema = z.object({ body: z.object({ email, password: z.string().min(1, 'Password is required.').max(128) }) });
export const forgotSchema = z.object({ body: z.object({ email }) });
export const resetSchema = z.object({
  body: z.object({ token: z.string().min(10).max(200), password }),
});
export const verifyEmailSchema = z.object({ body: z.object({ token: z.string().min(10).max(200) }) });
export const googleAuthSchema = z.object({ body: z.object({ credential: z.string().min(20).max(4000) }) });

export const chatStreamSchema = z.object({
  body: z.object({
    conversationId: id.optional(),
    message: z.string().trim().min(1, 'Message cannot be empty.').max(20000),
    mode: z.enum(['AUTO', 'FAST', 'DEEP', 'DOCUMENTS', 'WEB']).default('AUTO'),
    documentIds: z.array(id).max(10).default([]),
    fileIds: z.array(id).max(5).default([]),
  }),
});

export const conversationCreateSchema = z.object({
  body: z.object({ title: z.string().trim().min(1).max(120).optional() }).default({}),
});

export const conversationUpdateSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      folderId: id.nullable().optional(),
      archived: z.boolean().optional(),
      summary: z.string().max(8000).nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.'),
});

export const idParamSchema = z.object({ params: z.object({ id }) });

export const feedbackSchema = z.object({
  body: z.object({
    messageId: id,
    rating: z.enum(['LIKE', 'DISLIKE']),
    comment: z.string().trim().max(1000).optional(),
  }),
});

export const preferencesSchema = z.object({
  body: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      mode: z.enum(['AUTO', 'FAST', 'DEEP', 'DOCUMENTS', 'WEB']).optional(),
      showSources: z.boolean().optional(),
      enterToSend: z.boolean().optional(),
      speakAnswers: z.boolean().optional(),
      analyticsOptOut: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one preference.'),
});

export const searchSchema = z.object({
  body: z.object({
    query: z.string().trim().min(2).max(500),
    mode: z.enum(['AUTO', 'FAST', 'DEEP', 'WEB']).default('WEB'),
    limit: z.number().int().min(1).max(20).default(8),
  }),
});

export const researchSchema = z.object({
  body: z.object({
    question: z.string().trim().min(3).max(2000),
    stream: z.boolean().default(false),
  }),
});

export const adminSettingsSchema = z.object({
  body: z
    .object({
      system_prompt: z.string().max(8000).optional(),
      show_sources: z.boolean().optional(),
      fact_check: z.boolean().optional(),
      maintenance_mode: z.boolean().optional(),
      blocked_domains: z.array(z.string().max(120)).max(100).optional(),
      deep_research_max_searches: z.number().int().min(1).max(50).optional(),
      chat_rate_limit_max: z.number().int().min(1).max(1000).optional(),
      allow_registration: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one setting.'),
});

export const adminUserUpdateSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    isSuspended: z.boolean().optional(),
    name: z.string().trim().min(1).max(80).optional(),
  }),
});

export const paginationQuery = z.object({
  query: z
    .object({
      search: z.string().max(200).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
      folderId: id.optional(),
      includeArchived: z.coerce.boolean().optional(),
    })
    .default({ limit: 20, offset: 0 }),
});

export const folderSchema = z.object({ body: z.object({ name: z.string().trim().min(1).max(60), color: z.string().trim().max(20).optional() }) });

export const exportSchema = z.object({ params: z.object({ id }), query: z.object({ format: z.enum(['json', 'md', 'txt']).default('md') }) });

export default {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  verifyEmailSchema,
  googleAuthSchema,
  chatStreamSchema,
  conversationCreateSchema,
  conversationUpdateSchema,
  feedbackSchema,
  preferencesSchema,
  searchSchema,
  researchSchema,
  adminSettingsSchema,
  adminUserUpdateSchema,
  paginationQuery,
  folderSchema,
  exportSchema,
};

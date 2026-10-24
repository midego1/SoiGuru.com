import { z } from 'zod';

/** Body of a save or a test send from the admin email editor (spec 073). */
export const emailTemplateContentSchema = z.object({
	subject: z.string().trim().min(1).max(200),
	preheader: z.string().max(300).default(''),
	bodyHtml: z.string().min(1).max(50_000)
});

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { soiguruEmailTemplates, type SoiguruEmailTemplate } from '@/lib/db/schema';
import type { EmailTemplateContent, EmailTemplateId } from './templates';

/**
 * Admin overrides of the email templates (spec 073), one row per template in
 * `soiguru_email_templates`. Reads never throw: without a database, or before the migration
 * has run, every template simply uses its code default.
 */

export async function getTemplateOverride(id: EmailTemplateId): Promise<SoiguruEmailTemplate | null> {
	if (!process.env.DATABASE_URL) return null;
	try {
		const rows = await db.select().from(soiguruEmailTemplates).where(eq(soiguruEmailTemplates.id, id)).limit(1);
		return rows[0] ?? null;
	} catch (error) {
		console.warn('[emails] Could not read template override, using the default:', id, error);
		return null;
	}
}

export async function listTemplateOverrides(): Promise<SoiguruEmailTemplate[]> {
	if (!process.env.DATABASE_URL) return [];
	try {
		return await db.select().from(soiguruEmailTemplates);
	} catch (error) {
		console.warn('[emails] Could not list template overrides:', error);
		return [];
	}
}

export async function saveTemplateOverride(
	id: EmailTemplateId,
	content: EmailTemplateContent,
	userId: string | null
): Promise<SoiguruEmailTemplate> {
	const values = {
		id,
		subject: content.subject,
		preheader: content.preheader,
		bodyHtml: content.bodyHtml,
		updatedBy: userId,
		updatedAt: new Date()
	};
	const [row] = await db
		.insert(soiguruEmailTemplates)
		.values(values)
		.onConflictDoUpdate({
			target: soiguruEmailTemplates.id,
			set: {
				subject: values.subject,
				preheader: values.preheader,
				bodyHtml: values.bodyHtml,
				updatedBy: values.updatedBy,
				updatedAt: values.updatedAt
			}
		})
		.returning();
	return row;
}

export async function deleteTemplateOverride(id: EmailTemplateId): Promise<void> {
	await db.delete(soiguruEmailTemplates).where(eq(soiguruEmailTemplates.id, id));
}

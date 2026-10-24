import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { listTemplateOverrides } from '@/lib/soiguru/emails/store';
import { isEmailTemplateId } from '@/lib/soiguru/emails/templates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email-templates — the saved admin overrides of the SoiGuru email templates
 * (spec 073). The defaults ship with the client (`lib/soiguru/emails/templates.ts`).
 */
export async function GET() {
	const guard = await requireAdminSession();
	if (guard instanceof NextResponse) return guard;

	const rows = await listTemplateOverrides();
	return NextResponse.json({
		success: true,
		overrides: rows
			.filter((r) => isEmailTemplateId(r.id))
			.map((r) => ({
				id: r.id,
				subject: r.subject,
				preheader: r.preheader,
				bodyHtml: r.bodyHtml,
				updatedAt: r.updatedAt
			}))
	});
}

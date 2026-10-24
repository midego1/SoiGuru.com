import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { deleteTemplateOverride, saveTemplateOverride } from '@/lib/soiguru/emails/store';
import { isEmailTemplateId } from '@/lib/soiguru/emails/templates';
import { emailTemplateContentSchema } from '../schema';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** PUT /api/admin/email-templates/:id — save the admin's subject, preview text and body (spec 073). */
export async function PUT(request: NextRequest, { params }: Params) {
	const guard = await requireAdminSession();
	if (guard instanceof NextResponse) return guard;
	const { id } = await params;
	if (!isEmailTemplateId(id))
		return NextResponse.json({ success: false, error: 'Unknown template' }, { status: 404 });

	const parsed = emailTemplateContentSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
			{ status: 400 }
		);
	}

	try {
		const row = await saveTemplateOverride(id, parsed.data, guard.session.user.id);
		return NextResponse.json({ success: true, override: { ...parsed.data, id, updatedAt: row.updatedAt } });
	} catch (error) {
		console.error('[emails] Save failed:', error);
		return NextResponse.json({ success: false, error: 'Could not save the template' }, { status: 500 });
	}
}

/** DELETE /api/admin/email-templates/:id — back to the default in code. */
export async function DELETE(_request: NextRequest, { params }: Params) {
	const guard = await requireAdminSession();
	if (guard instanceof NextResponse) return guard;
	const { id } = await params;
	if (!isEmailTemplateId(id))
		return NextResponse.json({ success: false, error: 'Unknown template' }, { status: 404 });

	try {
		await deleteTemplateOverride(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('[emails] Reset failed:', error);
		return NextResponse.json({ success: false, error: 'Could not reset the template' }, { status: 500 });
	}
}

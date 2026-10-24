import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/admin-guard';
import { isEmailServiceConfigured, sendRenderedEmail } from '@/lib/mail';
import { renderTemplate } from '@/lib/soiguru/emails/render';
import { emailRenderOptions } from '@/lib/soiguru/emails/send';
import { isEmailTemplateId, sampleValues } from '@/lib/soiguru/emails/templates';
import { ratelimit } from '@/lib/utils/rate-limit';
import { emailTemplateContentSchema } from '../../schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/email-templates/:id/test — send the draft in the editor (saved or not) to the
 * signed-in admin, with the sample placeholder values and "[Test]" before the subject (spec 073).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const guard = await requireAdminSession();
	if (guard instanceof NextResponse) return guard;
	const { id } = await params;
	if (!isEmailTemplateId(id))
		return NextResponse.json({ success: false, error: 'Unknown template' }, { status: 404 });

	const to = guard.session.user.email;
	if (!to) return NextResponse.json({ success: false, error: 'Your account has no email address' }, { status: 400 });

	const parsed = emailTemplateContentSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
			{ status: 400 }
		);
	}

	const gate = await ratelimit(`email-test:${guard.session.user.id}`, 10, 10 * 60 * 1000);
	if (!gate.success) {
		return NextResponse.json(
			{ success: false, error: 'Too many test emails, wait a few minutes' },
			{ status: 429 }
		);
	}

	if (!(await isEmailServiceConfigured())) {
		return NextResponse.json({ success: false, error: 'No email provider is configured' }, { status: 503 });
	}

	try {
		const rendered = renderTemplate(id, parsed.data, { ...sampleValues(id), email: to }, emailRenderOptions());
		const result = await sendRenderedEmail({
			to,
			subject: `[Test] ${rendered.subject}`,
			html: rendered.html,
			text: rendered.text
		});
		if (result && typeof result === 'object' && 'skipped' in result) {
			return NextResponse.json({ success: false, error: 'No email provider is configured' }, { status: 503 });
		}
		return NextResponse.json({ success: true, to });
	} catch (error) {
		console.error('[emails] Test send failed:', error);
		return NextResponse.json({ success: false, error: 'Send failed, see the server log' }, { status: 500 });
	}
}

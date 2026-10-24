import { DEFAULT_RENDER_OPTIONS, renderTemplate, type EmailRenderOptions, type RenderedEmail } from './render';
import { getTemplateOverride } from './store';
import type { EmailTemplateId } from './templates';

/**
 * Server side of the branded emails (spec 073): the admin override (if any) rendered in the
 * SoiGuru frame. The logo is always the production PNG (an inbox cannot load a localhost
 * image); `SOIGURU_EMAIL_LOGO_URL` can point it elsewhere, e.g. for a staging host.
 */
export function emailRenderOptions(): EmailRenderOptions {
	const logo = process.env.SOIGURU_EMAIL_LOGO_URL?.trim();
	return {
		...DEFAULT_RENDER_OPTIONS,
		logoUrl: logo && /^https:\/\//i.test(logo) ? logo : DEFAULT_RENDER_OPTIONS.logoUrl
	};
}

export async function renderSoiGuruEmail(id: EmailTemplateId, vars: Record<string, string>): Promise<RenderedEmail> {
	const override = await getTemplateOverride(id);
	return renderTemplate(id, override, vars, emailRenderOptions());
}

/** First word of a display name, or "there" ("Hi there,"). */
export function greetingName(name: string | null | undefined): string {
	const first = (name ?? '').trim().split(/\s+/)[0];
	return first && first.length <= 40 ? first : 'there';
}

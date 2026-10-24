/**
 * The branded SoiGuru email frame (spec 073) and the template renderer.
 *
 * Email-safe by construction: table layout, inline styles only, 600px max and fluid below it,
 * a bulletproof button (padded link with Outlook's `mso-` spacing so the whole button is
 * clickable in Outlook desktop too), a hidden preview line and a plain-text alternative.
 * The logo is a PNG on an absolute https URL (Outlook does not show WebP or SVG).
 *
 * Placeholders are `{{key}}`; their values are HTML-escaped in the HTML part, so a name like
 * `<b>` cannot inject markup. `{{button:Label}}` renders the button pointing at `{{link}}`.
 * Unknown placeholders are left as typed, so a typo shows up in the admin preview.
 *
 * Pure (no server imports): the admin editor uses it for the live preview.
 */

import {
	EMAIL_TEMPLATES,
	type EmailTemplateContent,
	type EmailTemplateDefinition,
	type EmailTemplateId
} from './templates';

export const BRAND = {
	sea: '#0a6b73',
	seaDeep: '#064a50',
	seaTint: '#e2f1f2',
	sun: '#f2a33a',
	ink: '#14201f',
	muted: '#5a6665',
	line: '#dde2df',
	ground: '#f4f5f2',
	white: '#ffffff'
} as const;

const FONT =
	"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Thai','Leelawadee UI',sans-serif";

export interface EmailRenderOptions {
	/** Absolute https URL of a PNG logo (about 190×44 at 1x). */
	logoUrl: string;
	/** The public site, linked from the logo and the footer. */
	siteUrl: string;
	supportEmail: string;
}

export const DEFAULT_RENDER_OPTIONS: EmailRenderOptions = {
	logoUrl: 'https://owner.soiguru.com/brand/email-logo-horizontal-88.png',
	siteUrl: 'https://soiguru.com',
	supportEmail: 'support@soiguru.com'
};

export interface RenderedEmail {
	subject: string;
	html: string;
	text: string;
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Only http(s) and mailto URLs may go into an href; anything else becomes `#`. */
export function safeUrl(value: string | undefined): string {
	const v = (value ?? '').trim();
	return /^(https?:\/\/|mailto:)/i.test(v) ? v : '#';
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const BUTTON = /\{\{\s*button\s*:\s*([^}]{1,80}?)\s*\}\}/g;

/** Replace `{{key}}` with the value for `key`; `escape` HTML-escapes values. Unknown keys stay. */
export function fillPlaceholders(input: string, vars: Record<string, string>, escape: boolean): string {
	return input.replace(PLACEHOLDER, (whole, key: string) => {
		if (!Object.prototype.hasOwnProperty.call(vars, key)) return whole;
		const value = String(vars[key] ?? '');
		if (key === 'link') return escape ? escapeHtml(safeUrl(value)) : safeUrl(value);
		return escape ? escapeHtml(value) : value;
	});
}

/** Placeholders used in the content that the template does not provide (for admin warnings). */
export function unknownPlaceholders(content: EmailTemplateContent, known: string[]): string[] {
	const found = new Set<string>();
	for (const part of [content.subject, content.preheader, content.bodyHtml]) {
		for (const m of part.matchAll(PLACEHOLDER)) {
			if (!known.includes(m[1])) found.add(m[1]);
		}
	}
	return [...found];
}

/** The bulletproof button: a padded link in a table cell, with Outlook spacing hacks. */
export function buttonHtml(label: string, href: string): string {
	const url = escapeHtml(safeUrl(href));
	const text = escapeHtml(label);
	return [
		'<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0;border-collapse:separate;">',
		'<tr>',
		`<td align="center" bgcolor="${BRAND.sea}" style="border-radius:10px;background:${BRAND.sea};">`,
		`<a href="${url}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND.sea};border:1px solid ${BRAND.seaDeep};mso-padding-alt:0;">`,
		'<!--[if mso]><i style="letter-spacing:30px;mso-font-width:-100%;mso-text-raise:30pt">&nbsp;</i><![endif]-->',
		`<span style="mso-text-raise:15pt;">${text}</span>`,
		'<!--[if mso]><i style="letter-spacing:30px;mso-font-width:-100%">&nbsp;</i><![endif]-->',
		'</a>',
		'</td>',
		'</tr>',
		'</table>'
	].join('');
}

/** Inline styles for the simple tags a body uses; tags that already carry a style are left alone. */
function inlineStyles(html: string): string {
	const base = `font-family:${FONT};color:${BRAND.ink};`;
	return html.replace(/<(h1|h2|p|a|ul|ol|li|strong|hr)(\s[^>]*)?>/gi, (whole, rawTag: string, rawAttrs?: string) => {
		const attrs = rawAttrs ?? '';
		if (/\sstyle\s*=/i.test(attrs)) return whole;
		const tag = rawTag.toLowerCase();
		const cls = (attrs.match(/\sclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').split(/\s+/);
		let style: string;
		switch (tag) {
			case 'h1':
				style = `${base}margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;`;
				break;
			case 'h2':
				style = `${base}margin:24px 0 12px;font-size:19px;line-height:26px;font-weight:700;`;
				break;
			case 'p':
				if (cls.includes('code')) {
					style = `font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;margin:8px 0 20px;padding:16px 20px;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;text-align:center;color:${BRAND.seaDeep};background:${BRAND.seaTint};border-radius:10px;`;
				} else if (cls.includes('muted')) {
					style = `font-family:${FONT};margin:0 0 16px;font-size:13px;line-height:20px;color:${BRAND.muted};word-wrap:break-word;overflow-wrap:anywhere;`;
				} else {
					style = `${base}margin:0 0 16px;font-size:16px;line-height:24px;`;
				}
				break;
			case 'a':
				style = `color:${BRAND.sea};text-decoration:underline;`;
				break;
			case 'ul':
			case 'ol':
				style = `${base}margin:0 0 16px;padding:0 0 0 22px;font-size:16px;line-height:24px;`;
				break;
			case 'li':
				style = 'margin:0 0 6px;';
				break;
			case 'strong':
				style = 'font-weight:700;';
				break;
			default:
				style = `border:0;border-top:1px solid ${BRAND.line};margin:24px 0;`;
		}
		return `<${rawTag}${attrs} style="${style}">`;
	});
}

/** Apply `pattern` until the string stops changing, so nested or split markup can't survive one pass. */
function stripRepeatedly(text: string, pattern: RegExp): string {
	let previous: string;
	let current = text;
	do {
		previous = current;
		current = current.replace(pattern, '');
	} while (current !== previous);
	return current;
}

/** A readable plain-text version of an HTML body. */
export function htmlToText(html: string): string {
	const marked = stripRepeatedly(html, /<!--[\s\S]*?-->/g)
		.replace(/<a\s[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_w, href: string, inner: string) => {
			const label = stripRepeatedly(inner, /<[^>]+>/g).trim();
			return !label || label === href ? href : `${label} (${href})`;
		})
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<\/(li|tr)>/gi, '\n')
		.replace(/<\/(p|h1|h2|h3|div|ul|ol|table)>/gi, '\n\n');
	const decoded = stripRepeatedly(marked, /<[^>]+>/g)
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
	// Escaped markup in the source (`&lt;b&gt;`) must not come back as a tag after decoding.
	return stripRepeatedly(decoded, /<[^>]+>/g)
		.split('\n')
		.map((l) => l.replace(/[ \t]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** The frame: preview line, logo, white card with the body, footer. */
export function emailLayout(
	parts: { subject: string; preheader: string; bodyHtml: string; reasonHtml: string },
	opts: EmailRenderOptions = DEFAULT_RENDER_OPTIONS
): string {
	const site = escapeHtml(safeUrl(opts.siteUrl));
	const siteLabel = escapeHtml(opts.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
	const support = escapeHtml(opts.supportEmail);
	const logo = escapeHtml(safeUrl(opts.logoUrl));
	// Filler after the preview line so mail apps do not pull body text into the inbox preview.
	const filler = '&#847;&zwnj;&nbsp;'.repeat(60);
	return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(parts.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:light;supported-color-schemes:light;}
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
@media only screen and (max-width:620px){
.sg-card{padding:28px 20px!important;}
.sg-outer{padding:16px 8px!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.ground};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${parts.preheader}${filler}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${BRAND.ground}" style="background-color:${BRAND.ground};">
<tr>
<td align="center" class="sg-outer" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
<tr>
<td align="left" style="padding:0 4px 20px;">
<a href="${site}" target="_blank" style="text-decoration:none;"><img src="${logo}" width="190" height="44" alt="SoiGuru" style="display:block;width:190px;max-width:190px;height:auto;border:0;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.sea};"></a>
</td>
</tr>
<tr>
<td class="sg-card" bgcolor="${BRAND.white}" style="background-color:${BRAND.white};border:1px solid ${BRAND.line};border-top:4px solid ${BRAND.sea};border-radius:14px;padding:36px 40px;">
${parts.bodyHtml}
</td>
</tr>
<tr>
<td style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">
<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">${parts.reasonHtml}</p>
<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">Questions? Write to <a href="mailto:${support}" style="color:${BRAND.sea};text-decoration:underline;">${support}</a>.</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};"><strong style="color:${BRAND.ink};">SoiGuru</strong> &middot; Local places in Thailand, kept up to date &middot; <a href="${site}" target="_blank" style="color:${BRAND.sea};text-decoration:underline;">${siteLabel}</a></p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr><td width="32" height="3" bgcolor="${BRAND.sea}" style="font-size:0;line-height:0;">&nbsp;</td><td width="16" height="3" bgcolor="${BRAND.sun}" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>`;
}

/** Render content + reason with placeholder values into subject, HTML and text. */
export function renderEmail(
	content: EmailTemplateContent & { reason: string },
	vars: Record<string, string>,
	opts: EmailRenderOptions = DEFAULT_RENDER_OPTIONS
): RenderedEmail {
	const link = vars.link ?? '';
	const subject = fillPlaceholders(content.subject, vars, false)
		.replace(/[\r\n]+/g, ' ')
		.trim()
		.slice(0, 200);

	const htmlBody = inlineStyles(
		fillPlaceholders(
			content.bodyHtml.replace(BUTTON, (_w, label: string) => buttonHtml(label, link)),
			vars,
			true
		)
	);
	// The reason is plain text in code: escape it, then fill (escaped) values.
	const reasonHtml = fillPlaceholders(escapeHtml(content.reason), vars, true);
	const html = emailLayout(
		{ subject, preheader: fillPlaceholders(content.preheader, vars, true), bodyHtml: htmlBody, reasonHtml },
		opts
	);

	const textBody = htmlToText(
		fillPlaceholders(
			content.bodyHtml.replace(BUTTON, (_w, label: string) => `<p>${label}: ${safeUrl(link)}</p>`),
			vars,
			false
		)
	);
	const reasonText = fillPlaceholders(content.reason, vars, false);
	const siteLabel = opts.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
	const text = `${textBody}\n\n--\n${reasonText}\nQuestions? Write to ${opts.supportEmail}.\nSoiGuru · Local places in Thailand · ${siteLabel}\n`;

	return { subject, html, text };
}

/** Render a template by id, using the admin override when there is one. */
export function renderTemplate(
	id: EmailTemplateId,
	override: Partial<EmailTemplateContent> | null | undefined,
	vars: Record<string, string>,
	opts: EmailRenderOptions = DEFAULT_RENDER_OPTIONS
): RenderedEmail {
	const def: EmailTemplateDefinition = EMAIL_TEMPLATES[id];
	return renderEmail(
		{
			subject: override?.subject?.trim() ? override.subject : def.subject,
			preheader: override?.preheader ?? def.preheader,
			bodyHtml: override?.bodyHtml?.trim() ? override.bodyHtml : def.bodyHtml,
			reason: def.reason
		},
		vars,
		opts
	);
}

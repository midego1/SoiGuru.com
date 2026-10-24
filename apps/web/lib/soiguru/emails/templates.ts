/**
 * Default content of SoiGuru's transactional emails (spec 073). Each template is a subject,
 * a preview line (the grey text after the subject in the inbox) and a body in simple HTML.
 * The branded frame around the body (logo, card, footer) is added by `render.ts`, so a body
 * only needs headings, paragraphs, links and the `{{button:Label}}` helper.
 *
 * Admins can override subject, preview and body from `/admin/emails`; overrides are stored in
 * `soiguru_email_templates` and these defaults come back with "Reset to default".
 *
 * Pure (no server imports): the admin editor renders its live preview with it in the browser.
 */

export const EMAIL_TEMPLATE_IDS = ['magic-link', 'verify-email', 'password-reset', 'two-factor-code'] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export interface EmailPlaceholder {
	key: string;
	description: string;
	/** Value used in the admin preview and the test email. */
	sample: string;
}

export interface EmailTemplateContent {
	subject: string;
	preheader: string;
	bodyHtml: string;
}

export interface EmailTemplateDefinition extends EmailTemplateContent {
	id: EmailTemplateId;
	name: string;
	description: string;
	/** Footer line: why the reader got this email. May use placeholders. */
	reason: string;
	placeholders: EmailPlaceholder[];
}

export function isEmailTemplateId(value: unknown): value is EmailTemplateId {
	return typeof value === 'string' && (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

const P_NAME: EmailPlaceholder = { key: 'name', description: 'First name, or "there" when unknown', sample: 'Somchai' };
const P_EMAIL: EmailPlaceholder = {
	key: 'email',
	description: 'The address the email is sent to',
	sample: 'somchai@gmail.com'
};
const P_LINK: EmailPlaceholder = {
	key: 'link',
	description: 'The link the button opens (one-time, personal)',
	sample: 'https://owner.soiguru.com/auth/magic-link?token=preview'
};

const COPY_LINK = `<p class="muted">Button not working? Copy this link into your browser:<br><a href="{{link}}">{{link}}</a></p>`;

export const EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplateDefinition> = {
	'magic-link': {
		id: 'magic-link',
		name: 'Sign-in link',
		description: 'Sent when someone asks for a sign-in link on the sign-in or create-account page.',
		subject: 'Your SoiGuru sign-in link',
		preheader: 'Tap to sign in. The link works once and expires in {{expires}}.',
		bodyHtml: [
			'<h1>Sign in to SoiGuru</h1>',
			'<p>Hi {{name}},</p>',
			'<p>Tap the button below to sign in to SoiGuru. No password needed. If you are new, this also creates your free account.</p>',
			'{{button:Sign in to SoiGuru}}',
			'<p>The link works once and expires in {{expires}}. Asked for more than one? Use the newest email.</p>',
			COPY_LINK
		].join('\n'),
		reason: 'You got this email because someone entered {{email}} on SoiGuru. If that was not you, ignore it: nobody can sign in without this link.',
		placeholders: [
			P_LINK,
			P_NAME,
			P_EMAIL,
			{ key: 'expires', description: 'How long the link works', sample: '20 minutes' }
		]
	},
	'verify-email': {
		id: 'verify-email',
		name: 'Confirm email address',
		description: 'Sent after someone creates an account with a password.',
		subject: 'Confirm your email for SoiGuru',
		preheader: 'One tap to confirm {{email}} and finish setting up your account.',
		bodyHtml: [
			'<h1>Confirm your email address</h1>',
			'<p>Hi {{name}},</p>',
			'<p>Welcome to SoiGuru. Please confirm that {{email}} is your address, so we can reach you about your saved places and your business listing.</p>',
			'{{button:Confirm my email}}',
			'<p>The link works for {{expires}}.</p>',
			COPY_LINK
		].join('\n'),
		reason: 'You got this email because an account was created on SoiGuru with {{email}}. If that was not you, ignore it.',
		placeholders: [
			P_LINK,
			P_NAME,
			P_EMAIL,
			{ key: 'expires', description: 'How long the link works', sample: '1 hour' }
		]
	},
	'password-reset': {
		id: 'password-reset',
		name: 'Reset password',
		description: 'Sent from "Forgot password?" on the sign-in page.',
		subject: 'Reset your SoiGuru password',
		preheader: 'Choose a new password. The link expires in {{expires}}.',
		bodyHtml: [
			'<h1>Choose a new password</h1>',
			'<p>Hi {{name}},</p>',
			'<p>Someone asked to reset the password of the SoiGuru account for {{email}}. Tap the button to choose a new one.</p>',
			'{{button:Choose a new password}}',
			'<p>The link works once and expires in {{expires}}. Your password stays the same until you choose a new one.</p>',
			COPY_LINK
		].join('\n'),
		reason: 'You got this email because a password reset was requested for {{email}} on SoiGuru. If that was not you, ignore it.',
		placeholders: [
			P_LINK,
			P_NAME,
			P_EMAIL,
			{ key: 'expires', description: 'How long the link works', sample: '1 hour' }
		]
	},
	'two-factor-code': {
		id: 'two-factor-code',
		name: 'Sign-in code (two-step)',
		description: 'Sent when an account with two-step sign-in enters the right password.',
		subject: 'Your SoiGuru sign-in code: {{code}}',
		preheader: 'Enter this code to finish signing in. It expires in {{expires}}.',
		bodyHtml: [
			'<h1>Your sign-in code</h1>',
			'<p>Hi {{name}},</p>',
			'<p>Enter this code on SoiGuru to finish signing in:</p>',
			'<p class="code">{{code}}</p>',
			'<p>The code expires in {{expires}}. Never share it: SoiGuru will never ask you for it.</p>'
		].join('\n'),
		reason: 'You got this email because someone signed in to the SoiGuru account for {{email}} with the right password. If that was not you, change your password now.',
		placeholders: [
			{ key: 'code', description: 'The one-time code', sample: '482913' },
			P_NAME,
			P_EMAIL,
			{ key: 'expires', description: 'How long the code works', sample: '10 minutes' }
		]
	}
};

/** Sample values for every placeholder of a template (admin preview and test email). */
export function sampleValues(id: EmailTemplateId): Record<string, string> {
	return Object.fromEntries(EMAIL_TEMPLATES[id].placeholders.map((p) => [p.key, p.sample]));
}

'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/constants';
import { isValidCallbackUrl } from '@/lib/auth/validate-callback-url';
import { ratelimit } from '@/lib/utils/rate-limit';
import { getMailSenderAddress, isEmailServiceConfigured, sendBrandedEmail } from '@/lib/mail';
import { mailboxLinkFor, type MailboxLink } from '@/lib/soiguru/mailbox-links';
import { MAGIC_LINK_TTL_MINUTES, issueMagicLink, normalizeEmail } from '@/lib/soiguru/magic-link';

/**
 * "Email me a sign-in link" (spec 073). Works for new and existing addresses alike (the link
 * creates the account on first use), so the answer never reveals whether an account exists.
 *
 * Throttles: per address in the database (3 links per 15 minutes, 30 s apart; see
 * `lib/soiguru/magic-link.ts`) and per IP in memory (10 requests per 15 minutes).
 */

export type MagicLinkState = {
	success?: boolean;
	email?: string;
	mailbox?: MailboxLink | null;
	error?: 'invalid_email' | 'throttled' | 'unavailable' | 'failed';
	retryAfterSeconds?: number;
};

/** Hosts a sign-in link may point to; anything else gets the app's own URL. */
const DEFAULT_LINK_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://owner.soiguru.com').replace(/\/+$/, '');
const LINK_ORIGINS = new Set([DEFAULT_LINK_ORIGIN, 'https://owner.soiguru.com', 'http://localhost:3000']);

const IP_LIMIT = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;

const schema = z.object({
	email: z.string().trim().email().max(255),
	callbackUrl: z.string().max(500).optional(),
	locale: z.string().max(10).optional()
});

async function requestContext(): Promise<{ origin?: string; ip: string }> {
	try {
		const h = await headers();
		const ip = (h.get('cf-connecting-ip') ?? h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '')
			.split(',')[0]
			.trim();
		const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
		if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return { ip };
		const proto = (h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https'))
			.split(',')[0]
			.trim();
		return { origin: `${proto === 'http' ? 'http' : 'https'}://${host}`, ip };
	} catch {
		return { ip: '' };
	}
}

export async function requestMagicLinkAction(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
	const parsed = schema.safeParse({
		email: formData.get('email') ?? '',
		callbackUrl: formData.get('callbackUrl') || undefined,
		locale: formData.get('locale') || undefined
	});
	if (!parsed.success) return { error: 'invalid_email' };

	const email = normalizeEmail(parsed.data.email);
	try {
		const { origin, ip } = await requestContext();
		if (ip) {
			const gate = await ratelimit(`magic-link-ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
			if (!gate.success) return { error: 'throttled', email };
		}

		if (!(await isEmailServiceConfigured())) return { error: 'unavailable', email };

		const issued = await issueMagicLink(email, ip || null);
		if (!issued.ok) return { error: 'throttled', email, retryAfterSeconds: issued.retryAfterSeconds };

		const locale = parsed.data.locale;
		const prefix =
			locale && locale !== DEFAULT_LOCALE && (LOCALES as readonly string[]).includes(locale) ? `/${locale}` : '';
		const params = new URLSearchParams({ token: issued.token });
		if (parsed.data.callbackUrl && isValidCallbackUrl(parsed.data.callbackUrl)) {
			params.set('callbackUrl', parsed.data.callbackUrl);
		}
		// The link may only point at a known host: a forged Host / X-Forwarded-Host would otherwise
		// send the victim a working token on the attacker's domain (link poisoning).
		const base = origin && LINK_ORIGINS.has(origin) ? origin : DEFAULT_LINK_ORIGIN;
		const link = `${base}${prefix}/auth/magic-link?${params.toString()}`;

		let name = 'there';
		try {
			const { getUserByEmail, getClientProfileByUserId } = await import('@/lib/db/queries');
			const { greetingName } = await import('@/lib/soiguru/emails/send');
			const user = await getUserByEmail(email);
			const profile = user ? await getClientProfileByUserId(user.id) : null;
			name = greetingName(profile?.displayName || profile?.name);
		} catch {
			// The greeting is cosmetic.
		}

		const sent = await sendBrandedEmail('magic-link', email, {
			link,
			name,
			email,
			expires: `${MAGIC_LINK_TTL_MINUTES} minutes`
		});
		if (sent && typeof sent === 'object' && 'skipped' in sent) return { error: 'unavailable', email };

		return { success: true, email, mailbox: mailboxLinkFor(email, await getMailSenderAddress()) };
	} catch (error) {
		console.error('[magic-link] Could not send a sign-in link:', error instanceof Error ? error.message : error);
		return { error: 'failed', email };
	}
}

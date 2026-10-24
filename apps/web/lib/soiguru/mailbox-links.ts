/**
 * "Open Gmail" after a sign-in link is sent (spec 073): from the address the visitor typed,
 * pick their webmail and a URL that opens it already searched for our message where the
 * webmail supports a search deep link. Pure, so the sign-in card and the tests share it.
 *
 * Only well-known consumer domains are recognised; a company domain (Google Workspace,
 * Microsoft 365) gives `null` and the card just says "Open your email app".
 */

export type MailboxProvider = 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'proton';

export interface MailboxLink {
	provider: MailboxProvider;
	/** Display name of the webmail, not translated (brand names). */
	label: string;
	url: string;
}

const LABELS: Record<MailboxProvider, string> = {
	gmail: 'Gmail',
	outlook: 'Outlook',
	yahoo: 'Yahoo Mail',
	icloud: 'iCloud Mail',
	proton: 'Proton Mail'
};

/** The bare address from `Name <a@b.c>` or `a@b.c`, lower-cased; empty when there is none. */
export function bareAddress(value: string | null | undefined): string {
	if (!value) return '';
	const angled = value.match(/<([^<>\s]+@[^<>\s]+)>/);
	const raw = (angled ? angled[1] : value).trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
}

/** The provider for an email domain, or null when it is not a known consumer webmail. */
export function mailboxProviderForDomain(domain: string): MailboxProvider | null {
	const d = domain.trim().toLowerCase().replace(/\.$/, '');
	if (!d) return null;
	if (d === 'gmail.com' || d === 'googlemail.com') return 'gmail';
	// outlook.com, hotmail.com, hotmail.co.th, live.com, live.co.uk, msn.com, windowslive.com …
	if (/^(outlook|hotmail|live|msn|windowslive|passport)\.[a-z]{2,}(\.[a-z]{2,})?$/.test(d)) return 'outlook';
	// yahoo.com, yahoo.co.th, yahoo.co.uk, ymail.com, rocketmail.com
	if (/^yahoo\.[a-z]{2,}(\.[a-z]{2,})?$/.test(d) || d === 'ymail.com' || d === 'rocketmail.com') return 'yahoo';
	if (d === 'icloud.com' || d === 'me.com' || d === 'mac.com') return 'icloud';
	if (d === 'proton.me' || d === 'protonmail.com' || d === 'protonmail.ch' || d === 'pm.me') return 'proton';
	return null;
}

/**
 * The webmail link for `email`, searched for messages from `sender` where possible.
 * `sender` may be `Name <noreply@x>`; without a usable sender the plain inbox URL is used.
 */
export function mailboxLinkFor(email: string, sender?: string | null): MailboxLink | null {
	const address = bareAddress(email);
	if (!address) return null;
	const provider = mailboxProviderForDomain(address.slice(address.lastIndexOf('@') + 1));
	if (!provider) return null;
	const from = bareAddress(sender);
	const q = encodeURIComponent(from);
	let url: string;
	switch (provider) {
		case 'gmail':
			// Search across every folder (spam and Promotions too) for the last hour.
			url = from
				? `https://mail.google.com/mail/u/0/#search/from%3A${q}+in%3Aanywhere+newer_than%3A1h`
				: 'https://mail.google.com/mail/u/0/#inbox';
			break;
		case 'outlook':
			// Outlook.com has no documented search deep link; the inbox is the reliable target.
			url = 'https://outlook.live.com/mail/0/';
			break;
		case 'yahoo':
			url = from ? `https://mail.yahoo.com/d/search/keyword=${q}` : 'https://mail.yahoo.com/';
			break;
		case 'icloud':
			url = 'https://www.icloud.com/mail';
			break;
		case 'proton':
			url = from ? `https://mail.proton.me/u/0/all-mail#keyword=${q}` : 'https://mail.proton.me/u/0/inbox';
			break;
	}
	return { provider, label: LABELS[provider], url };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bareAddress, mailboxLinkFor, mailboxProviderForDomain } from '../mailbox-links';

/**
 * Spec 073 — "Open Gmail" button after a sign-in link is sent.
 *
 * Run with: `pnpm --filter @ever-works/web test:unit`
 */

const SENDER = 'SoiGuru <hello@soiguru.com>';

describe('bareAddress', () => {
	it('takes the address out of a display name', () => {
		assert.equal(bareAddress(SENDER), 'hello@soiguru.com');
		assert.equal(bareAddress('  Hello@SoiGuru.com '), 'hello@soiguru.com');
	});
	it('is empty for anything that is not an address', () => {
		assert.equal(bareAddress(''), '');
		assert.equal(bareAddress(null), '');
		assert.equal(bareAddress('not an email'), '');
	});
});

describe('mailboxProviderForDomain', () => {
	const cases: Array<[string, ReturnType<typeof mailboxProviderForDomain>]> = [
		['gmail.com', 'gmail'],
		['googlemail.com', 'gmail'],
		['GMAIL.COM', 'gmail'],
		['outlook.com', 'outlook'],
		['hotmail.com', 'outlook'],
		['hotmail.co.th', 'outlook'],
		['live.com', 'outlook'],
		['live.co.uk', 'outlook'],
		['msn.com', 'outlook'],
		['yahoo.com', 'yahoo'],
		['yahoo.co.th', 'yahoo'],
		['ymail.com', 'yahoo'],
		['icloud.com', 'icloud'],
		['me.com', 'icloud'],
		['mac.com', 'icloud'],
		['proton.me', 'proton'],
		['protonmail.com', 'proton'],
		['pm.me', 'proton'],
		['soiguru.com', null],
		['company.co.th', null],
		['mygmail.com', null],
		['gmail.com.evil.io', null],
		['', null]
	];
	for (const [domain, expected] of cases) {
		it(`${domain || '(empty)'} → ${expected}`, () => {
			assert.equal(mailboxProviderForDomain(domain), expected);
		});
	}
});

describe('mailboxLinkFor', () => {
	it('Gmail searches every folder for our sender in the last hour', () => {
		const link = mailboxLinkFor('somchai@gmail.com', SENDER);
		assert.deepEqual(link, {
			provider: 'gmail',
			label: 'Gmail',
			url: 'https://mail.google.com/mail/u/0/#search/from%3Ahello%40soiguru.com+in%3Aanywhere+newer_than%3A1h'
		});
	});
	it('Outlook, Hotmail and Live open the Outlook.com inbox', () => {
		for (const email of ['a@outlook.com', 'a@hotmail.com', 'a@live.com', 'a@msn.com']) {
			assert.equal(mailboxLinkFor(email, SENDER)?.url, 'https://outlook.live.com/mail/0/');
		}
	});
	it('Yahoo searches by keyword', () => {
		assert.equal(
			mailboxLinkFor('a@yahoo.co.th', SENDER)?.url,
			'https://mail.yahoo.com/d/search/keyword=hello%40soiguru.com'
		);
	});
	it('iCloud opens iCloud Mail', () => {
		assert.equal(mailboxLinkFor('a@me.com', SENDER)?.url, 'https://www.icloud.com/mail');
	});
	it('Proton searches all mail', () => {
		assert.equal(
			mailboxLinkFor('a@proton.me', SENDER)?.url,
			'https://mail.proton.me/u/0/all-mail#keyword=hello%40soiguru.com'
		);
	});
	it('falls back to the plain inbox without a sender', () => {
		assert.equal(mailboxLinkFor('a@gmail.com')?.url, 'https://mail.google.com/mail/u/0/#inbox');
		assert.equal(mailboxLinkFor('a@yahoo.com', 'nonsense')?.url, 'https://mail.yahoo.com/');
	});
	it('gives no link for other domains or a bad address', () => {
		assert.equal(mailboxLinkFor('owner@myresort.co.th', SENDER), null);
		assert.equal(mailboxLinkFor('not-an-email', SENDER), null);
		assert.equal(mailboxLinkFor('', SENDER), null);
	});
});

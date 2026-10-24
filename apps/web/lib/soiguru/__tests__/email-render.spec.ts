import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	escapeHtml,
	fillPlaceholders,
	htmlToText,
	renderTemplate,
	safeUrl,
	unknownPlaceholders
} from '../emails/render';
import { EMAIL_TEMPLATE_IDS, EMAIL_TEMPLATES, isEmailTemplateId, sampleValues } from '../emails/templates';

/**
 * Spec 073 — branded transactional emails.
 *
 * Run with: `pnpm --filter @ever-works/web test:unit`
 */

const LINK = 'https://owner.soiguru.com/auth/magic-link?token=abc&x=1';

describe('fillPlaceholders', () => {
	it('escapes values in HTML and keeps them raw in text', () => {
		const vars = { name: '<b>Som & Chai</b>' };
		assert.equal(fillPlaceholders('Hi {{name}}', vars, true), 'Hi &lt;b&gt;Som &amp; Chai&lt;/b&gt;');
		assert.equal(fillPlaceholders('Hi {{ name }}', vars, false), 'Hi <b>Som & Chai</b>');
	});
	it('leaves unknown placeholders as typed', () => {
		assert.equal(fillPlaceholders('Hi {{nmae}}', { name: 'A' }, true), 'Hi {{nmae}}');
	});
	it('never lets a javascript: link through', () => {
		assert.equal(fillPlaceholders('{{link}}', { link: 'javascript:alert(1)' }, true), '#');
		assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
	});
});

describe('templates', () => {
	it('every id has a definition that uses only its own placeholders', () => {
		for (const id of EMAIL_TEMPLATE_IDS) {
			const def = EMAIL_TEMPLATES[id];
			assert.equal(def.id, id);
			const known = def.placeholders.map((p) => p.key);
			assert.deepEqual(unknownPlaceholders(def, known), [], id);
			assert.deepEqual(unknownPlaceholders({ ...def, bodyHtml: def.reason }, known), [], `${id} reason`);
		}
		assert.equal(isEmailTemplateId('magic-link'), true);
		assert.equal(isEmailTemplateId('nope'), false);
	});
	it('renders every default with its sample values and leaves no placeholder behind', () => {
		for (const id of EMAIL_TEMPLATE_IDS) {
			const out = renderTemplate(id, null, sampleValues(id));
			assert.ok(!out.html.includes('{{'), `${id} html`);
			assert.ok(!out.text.includes('{{'), `${id} text`);
			assert.ok(!out.subject.includes('{{'), `${id} subject`);
			assert.ok(out.html.includes('email-logo-horizontal-88.png'), `${id} logo`);
			assert.ok(out.html.includes('max-width:600px'), `${id} width`);
		}
	});
});

describe('renderTemplate', () => {
	const vars = { link: LINK, name: 'Somchai', email: 'somchai@gmail.com', expires: '20 minutes' };

	it('magic link: button, escaped link, subject and text alternative', () => {
		const out = renderTemplate('magic-link', null, vars);
		assert.equal(out.subject, 'Your SoiGuru sign-in link');
		assert.ok(out.html.includes(`href="${escapeHtml(LINK)}"`));
		assert.ok(out.html.includes('Sign in to SoiGuru</span>'));
		assert.ok(out.html.includes('20 minutes'));
		assert.ok(out.text.includes(`Sign in to SoiGuru: ${LINK}`));
		assert.ok(out.text.includes('somchai@gmail.com'));
		assert.ok(!/<[a-z]/i.test(out.text));
	});

	it('uses an override but falls back to the default for an empty subject or body', () => {
		const out = renderTemplate(
			'magic-link',
			{ subject: 'Hello {{name}}', preheader: '', bodyHtml: '<p>Go: {{button:Open}}</p>' },
			vars
		);
		assert.equal(out.subject, 'Hello Somchai');
		assert.ok(out.html.includes('Open</span>'));
		const blank = renderTemplate('magic-link', { subject: '  ', bodyHtml: '' }, vars);
		assert.equal(blank.subject, 'Your SoiGuru sign-in link');
		assert.ok(blank.html.includes('Sign in to SoiGuru</h1>'));
	});

	it('strips line breaks from the subject (header injection)', () => {
		const out = renderTemplate('magic-link', { subject: 'Hi {{name}}' }, { ...vars, name: 'A\r\nBcc: x@y.z' });
		assert.ok(!/[\r\n]/.test(out.subject));
	});

	it('inlines styles on plain tags and keeps author styles', () => {
		const out = renderTemplate('magic-link', { bodyHtml: '<p>One</p><p style="color:red">Two</p>' }, vars);
		assert.match(out.html, /<p style="font-family:[^"]*font-size:16px;line-height:24px;">One<\/p>/);
		assert.ok(out.html.includes('<p style="color:red">Two</p>'));
	});
});

describe('htmlToText', () => {
	it('turns links, breaks and lists into text', () => {
		assert.equal(
			htmlToText('<p>Go <a href="https://x.y">here</a></p><ul><li>One</li><li>Two</li></ul>'),
			'Go here (https://x.y)\n\n- One\n- Two'
		);
		assert.equal(htmlToText('<p><a href="https://x.y">https://x.y</a><br>next</p>'), 'https://x.y\nnext');
	});
});

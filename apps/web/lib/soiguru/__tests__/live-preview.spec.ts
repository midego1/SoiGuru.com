import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	applyFormToPreview,
	dayFromForm,
	formEntries,
	hasAnyHours,
	isDirty,
	phoneE164,
	previewFromItem,
	previewHoursRows,
	type FormEntries,
	type PreviewListing
} from '../live-preview';
import { WEEKDAYS, type WeeklyHours } from '../types';

/**
 * Spec 074 — the edit pages' live preview overlays the unsaved form on the saved listing with
 * the same rules as the save actions.
 *
 * Run with: `pnpm --filter @ever-works/web test:unit`
 */

const unknownHours = Object.fromEntries(WEEKDAYS.map((d) => [d, null])) as WeeklyHours;

const BASE: PreviewListing = {
	name: 'Ao Nang Nail Studio',
	nameTh: 'ร้านทำเล็บอ่าวนาง',
	description: 'Gel nails and pedicures.',
	category: { id: 'nail-salons', name: 'Nail salons', name_th: 'ร้านทำเล็บ' },
	areaName: 'Ao Nang',
	phone: '+66812345678',
	hasGeo: true,
	hours: { ...unknownHours, mon: [{ start: 600, end: 1260 }] },
	amenities: [{ id: 'wifi', name: 'Wi-Fi', available: true }],
	menu: [],
	images: [],
	claimed: true
};

const fields = (o: Record<string, string>): FormEntries => Object.entries(o);

describe('phoneE164', () => {
	it('adds +66 and drops the leading 0, like the save action', () => {
		assert.equal(phoneE164('081 234 5678'), '+66812345678');
		assert.equal(phoneE164('812345678'), '+66812345678');
		assert.equal(phoneE164('+44 20 7946 0000'), '+442079460000');
		assert.equal(phoneE164('  '), undefined);
	});
});

describe('isDirty', () => {
	it('compares keys, values and order', () => {
		const a = fields({ name: 'A', phone: '1' });
		assert.equal(isDirty(a, fields({ name: 'A', phone: '1' })), false);
		assert.equal(isDirty(a, fields({ name: 'B', phone: '1' })), true);
		assert.equal(isDirty(a, fields({ name: 'A' })), true);
		assert.equal(
			isDirty(a, [
				['phone', '1'],
				['name', 'A']
			]),
			true
		);
	});
});

describe('formEntries', () => {
	it('keeps string values in order and skips files', () => {
		const fd = new FormData();
		fd.append('a', '1');
		fd.append('f', new Blob(['x']), 'x.jpg');
		fd.append('b', '2');
		assert.deepEqual(formEntries(fd), [
			['a', '1'],
			['b', '2']
		]);
	});
});

describe('dayFromForm', () => {
	it('reads two ranges, 23:59 as midnight, and off as closed', () => {
		const get = (k: string) =>
			({ mon_open: 'on', mon_from1: '09:00', mon_to1: '12:00', mon_from2: '17:00', mon_to2: '23:59' })[k];
		assert.deepEqual(dayFromForm(get, 'mon'), [
			{ start: 540, end: 720 },
			{ start: 1020, end: 1440 }
		]);
		assert.deepEqual(dayFromForm(get, 'tue'), []);
	});
	it('drops a half-filled second range', () => {
		const get = (k: string) => ({ sat_open: 'on', sat_from1: '10:00', sat_to1: '18:00', sat_from2: '19:00' })[k];
		assert.deepEqual(dayFromForm(get, 'sat'), [{ start: 600, end: 1080 }]);
	});
});

describe('applyFormToPreview', () => {
	it('applies the details fields and keeps the rest', () => {
		const out = applyFormToPreview(
			BASE,
			fields({
				name: '  New name ',
				name_th: '',
				description: 'Walk-ins welcome',
				category: 'massage',
				phone: '0899999999',
				line_id: '@@studio',
				whatsapp: '',
				address: '12 Beach Road',
				booking_note: 'Book on LINE'
			}),
			{ categories: [{ id: 'massage', name: 'Massage' }] }
		);
		assert.equal(out.name, 'New name');
		assert.equal(out.nameTh, undefined);
		assert.equal(out.description, 'Walk-ins welcome');
		assert.equal(out.category.name, 'Massage');
		assert.equal(out.phone, '+66899999999');
		assert.equal(out.lineId, '@studio');
		assert.equal(out.whatsapp, undefined);
		assert.equal(out.address, '12 Beach Road');
		assert.equal(out.bookingNote, 'Book on LINE');
		assert.deepEqual(out.hours, BASE.hours);
	});

	it('keeps the saved name when the field is emptied, and an unknown category', () => {
		const out = applyFormToPreview(BASE, fields({ name: ' ', category: 'nope' }), { categories: [] });
		assert.equal(out.name, BASE.name);
		assert.equal(out.category.id, 'nail-salons');
	});

	it('builds the week from the hours form', () => {
		const out = applyFormToPreview(
			BASE,
			fields({
				mon_from1: '09:00',
				mon_to1: '18:00',
				tue_open: 'on',
				tue_from1: '08:00',
				tue_to1: '16:00',
				hours_note: 'Closed on Buddhist holidays'
			})
		);
		assert.deepEqual(out.hours.mon, []);
		assert.deepEqual(out.hours.tue, [{ start: 480, end: 960 }]);
		assert.deepEqual(out.hours.sun, []);
		assert.equal(out.hoursNote, 'Closed on Buddhist holidays');
		assert.equal(hasAnyHours(out.hours), true);
	});

	it('lists amenities in page order and leaves "Not set" out', () => {
		const out = applyFormToPreview(
			BASE,
			fields({ amenity_parking: 'no', amenity_wifi: '', 'amenity_card-payment': 'yes' }),
			{ amenityNames: { 'card-payment': { name: 'Card payment', name_th: 'รับบัตร' } } }
		);
		assert.deepEqual(
			out.amenities.map((a) => [a.id, a.available, a.name]),
			[
				['parking', false, 'Parking'],
				['card-payment', true, 'Card payment']
			]
		);
	});

	it('reads the menu rows and notes', () => {
		const out = applyFormToPreview(
			BASE,
			fields({
				s0_title: 'Nails',
				s0_i0_name: 'Gel polish',
				s0_i0_price: '450',
				s0_i0_from: 'on',
				s0_i1_name: '',
				s0_i1_price: '100',
				menu_note: 'Prices include VAT',
				menu_note_th: ''
			})
		);
		assert.equal(out.menu.length, 1);
		assert.deepEqual(out.menu[0].items, [
			{
				name: 'Gel polish',
				name_th: undefined,
				price: 450,
				price_max: undefined,
				from: true,
				note: undefined,
				note_th: undefined
			}
		]);
		assert.equal(out.menuNote, 'Prices include VAT');
		assert.equal(out.menuNoteTh, undefined);
	});

	it('empties the menu when every row is cleared', () => {
		const out = applyFormToPreview(
			{ ...BASE, menu: [{ items: [{ name: 'X', price: 1 }] }] },
			fields({ menu_note: '' })
		);
		assert.deepEqual(out.menu, []);
	});
});

describe('previewHoursRows', () => {
	it('puts today first and keeps every day on its own row', () => {
		// 2026-10-21 is a Wednesday; 10:00 UTC is 17:00 in Bangkok.
		const rows = previewHoursRows(BASE.hours, new Date('2026-10-21T10:00:00Z'));
		assert.deepEqual(
			rows.map((r) => r.day),
			['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue']
		);
		assert.equal(rows[0].today, true);
		assert.equal(rows.filter((r) => r.today).length, 1);
		assert.deepEqual(rows[5].ranges, [{ start: 600, end: 1260 }]);
	});
});

describe('previewFromItem', () => {
	it('uses the edited fields over the raw item', () => {
		const out = previewFromItem(
			{
				name: 'Old',
				name_th: 'เก่า',
				area: 'ao-nang',
				hours: { mon: '10:00-20:00', tue: 'closed' },
				amenities: { wifi: true, parking: false },
				images: ['https://example.com/a.jpg', 'not-a-url'],
				geo: { lat: 8.03, lng: 98.82 },
				menu: [{ name: 'Tea', price: 40 }]
			},
			{ name: 'New', description: 'Fresh', category: ['cafes'] },
			{ categories: [{ id: 'cafes', name: 'Cafés' }] }
		);
		assert.equal(out.name, 'New');
		assert.equal(out.nameTh, 'เก่า');
		assert.equal(out.description, 'Fresh');
		assert.equal(out.category.name, 'Cafés');
		assert.equal(out.areaName, 'Ao nang');
		assert.deepEqual(out.hours.mon, [{ start: 600, end: 1200 }]);
		assert.deepEqual(out.hours.tue, []);
		assert.equal(out.hours.wed, null);
		assert.deepEqual(
			out.amenities.map((a) => a.available),
			[true, false]
		);
		assert.deepEqual(out.images, ['https://example.com/a.jpg']);
		assert.equal(out.hasGeo, true);
		assert.equal(out.menu[0].items[0].name, 'Tea');
	});
});

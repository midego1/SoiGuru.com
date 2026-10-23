/**
 * Starter sections for the Menu & prices editor (spec 069), per listing category: the
 * headings most places of that trade use, in English and Thai. Owners pick the layout, then
 * fill the rows. Unknown categories get one generic section.
 */
export interface MenuTemplateSection {
	title: string;
	title_th: string;
}

const T: Record<string, MenuTemplateSection[]> = {
	restaurants: [
		{ title: 'Starters', title_th: 'อาหารเรียกน้ำย่อย' },
		{ title: 'Mains', title_th: 'อาหารจานหลัก' },
		{ title: 'Noodles & rice', title_th: 'ก๋วยเตี๋ยวและข้าว' },
		{ title: 'Drinks', title_th: 'เครื่องดื่ม' },
		{ title: 'Desserts', title_th: 'ของหวาน' }
	],
	cafes: [
		{ title: 'Coffee', title_th: 'กาแฟ' },
		{ title: 'Tea & drinks', title_th: 'ชาและเครื่องดื่ม' },
		{ title: 'Food', title_th: 'อาหาร' },
		{ title: 'Desserts', title_th: 'ของหวาน' }
	],
	bars: [
		{ title: 'Beer', title_th: 'เบียร์' },
		{ title: 'Cocktails', title_th: 'ค็อกเทล' },
		{ title: 'Spirits & wine', title_th: 'เหล้าและไวน์' },
		{ title: 'Food', title_th: 'อาหาร' }
	],
	massage: [
		{ title: 'Massage', title_th: 'นวด' },
		{ title: 'Spa & body', title_th: 'สปาและบำรุงผิว' },
		{ title: 'Packages', title_th: 'แพ็กเกจ' }
	],
	'nail-salons': [
		{ title: 'Manicure', title_th: 'ทำเล็บมือ' },
		{ title: 'Pedicure', title_th: 'ทำเล็บเท้า' },
		{ title: 'Nail art', title_th: 'เพ้นท์เล็บ' },
		{ title: 'Extras', title_th: 'บริการเสริม' }
	],
	'barbers-salons': [
		{ title: 'Haircuts', title_th: 'ตัดผม' },
		{ title: 'Beard & shave', title_th: 'หนวดเคราและโกน' },
		{ title: 'Colour', title_th: 'ทำสี' },
		{ title: 'Treatments', title_th: 'ทรีตเมนต์' }
	],
	tours: [
		{ title: 'Island trips', title_th: 'ทริปเกาะ' },
		{ title: 'Day tours', title_th: 'ทัวร์วันเดียว' },
		{ title: 'Transfers', title_th: 'รถรับส่ง' },
		{ title: 'Private charters', title_th: 'เหมาลำส่วนตัว' }
	],
	'scooter-rental': [
		{ title: 'Scooters', title_th: 'สกู๊ตเตอร์' },
		{ title: 'Motorbikes', title_th: 'มอเตอร์ไซค์' },
		{ title: 'Cars', title_th: 'รถยนต์' },
		{ title: 'Extras', title_th: 'บริการเสริม' }
	],
	'dive-shops': [
		{ title: 'Fun dives', title_th: 'ดำน้ำลึก' },
		{ title: 'Courses', title_th: 'คอร์สเรียน' },
		{ title: 'Snorkelling', title_th: 'ดำน้ำตื้น' },
		{ title: 'Equipment', title_th: 'อุปกรณ์' }
	],
	'gyms-muay-thai': [
		{ title: 'Classes', title_th: 'คลาส' },
		{ title: 'Private training', title_th: 'เทรนส่วนตัว' },
		{ title: 'Memberships', title_th: 'สมาชิก' }
	],
	hotels: [
		{ title: 'Rooms', title_th: 'ห้องพัก' },
		{ title: 'Extras', title_th: 'บริการเสริม' }
	],
	laundry: [
		{ title: 'Wash & fold', title_th: 'ซักพับ' },
		{ title: 'Dry cleaning', title_th: 'ซักแห้ง' },
		{ title: 'Express', title_th: 'ด่วน' }
	],
	coworking: [
		{ title: 'Day pass', title_th: 'รายวัน' },
		{ title: 'Weekly', title_th: 'รายสัปดาห์' },
		{ title: 'Monthly', title_th: 'รายเดือน' },
		{ title: 'Meeting room', title_th: 'ห้องประชุม' }
	],
	'clinics-pharmacies': [
		{ title: 'Consultations', title_th: 'ปรึกษาแพทย์' },
		{ title: 'Treatments', title_th: 'การรักษา' }
	],
	shops: [{ title: 'Products', title_th: 'สินค้า' }]
};

const GENERIC: MenuTemplateSection[] = [{ title: 'Services', title_th: 'บริการ' }];

export function menuTemplate(categoryId: string | undefined): MenuTemplateSection[] {
	return (categoryId && T[categoryId]) || GENERIC;
}

/**
 * Parses pasted lines into rows: "Gel manicure 500", "Hair colour 1200-2500", "Island trip
 * from 1500", "ทำเล็บเจล ฿500". The price sits at the end; "from" / "เริ่ม" marks a starting
 * price. Lines without a number become rows without a price.
 */
export function parsePastedMenu(text: string): { name: string; price?: number; price_max?: number; from?: boolean }[] {
	const rows: { name: string; price?: number; price_max?: number; from?: boolean }[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim().replace(/^[-•*]\s*/, '');
		if (!line) continue;
		const m = /^(.*?)[\s\-–:·|]*(?:(from|เริ่ม(?:ต้น)?)\s*)?฿?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:[-–~]\s*฿?\s*(\d[\d,]*(?:\.\d+)?))?\s*(?:฿|baht|บาท|thb|b)?\.?\s*$/i.exec(line);
		if (!m || !m[1].trim()) {
			rows.push({ name: line.slice(0, 80) });
			continue;
		}
		const num = (v: string | undefined) => (v ? Number(v.replace(/,/g, '')) : undefined);
		const price = num(m[3]);
		const max = num(m[4]);
		rows.push({
			name: m[1].trim().slice(0, 80),
			price,
			price_max: price !== undefined && max !== undefined && max > price ? max : undefined,
			from: Boolean(m[2]) || /\bfrom\b|เริ่ม/i.test(m[1]) ? true : undefined
		});
	}
	return rows;
}

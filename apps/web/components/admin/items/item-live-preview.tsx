'use client';

import { useEffect, useMemo, useState } from 'react';
import { PreviewSurface, type PreviewSection } from '@/components/soiguru/live-preview';
import { useAllCategories } from '@/hooks/use-admin-categories';
import { previewFromItem } from '@/lib/soiguru/live-preview';
import type { ItemData } from '@/lib/types/item';
import { soiguruFontVariables } from '@/lib/soiguru/fonts';
// The preview draws with the SoiGuru tokens and classes, which the admin doesn't load otherwise.
import '@/app/[locale]/(soiguru)/soiguru.css';

/**
 * Live preview in the admin item editor (spec 074 on spec 070): the SoiGuru listing page drawn
 * from the editor's current name, description, category and address over the item's own data
 * (hours, menu, photos, …, which this editor doesn't change). Same panel and dialog as the owner
 * edit pages; 150ms debounced.
 */

export interface ItemPreviewFields {
	name: string;
	description: string;
	category: string[];
	address?: string;
}

const FOCUS: PreviewSection[] = ['title', 'about'];

export function ItemLivePreview({ item, fields }: { item?: ItemData; fields: ItemPreviewFields }) {
	const { data: categories } = useAllCategories();
	const [debounced, setDebounced] = useState(fields);
	const [saved] = useState(() => JSON.stringify(fields));

	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(fields), 150);
		return () => window.clearTimeout(id);
	}, [fields]);

	const view = useMemo(() => {
		const cats = (categories ?? []).map((c) => ({ id: c.id, name: c.name }));
		return {
			data: previewFromItem((item ?? {}) as unknown as Record<string, unknown>, debounced, { categories: cats }),
			dirty: JSON.stringify(debounced) !== saved
		};
	}, [item, debounced, categories, saved]);

	return (
		<div className={`tkg-root sg-pv-root ${soiguruFontVariables}`}>
			<PreviewSurface view={view} focus={FOCUS} />
		</div>
	);
}

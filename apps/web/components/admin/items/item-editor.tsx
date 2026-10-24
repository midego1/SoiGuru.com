"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Star, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ItemCompanyManager } from '@/components/admin/items/item-company-manager';
import { useCompaniesEnabled } from '@/hooks/use-companies-enabled';
import { useLocationSettings } from '@/hooks/use-location-settings';
import { ItemData, CreateItemRequest, UpdateItemRequest, ITEM_STATUSES, ItemStatus } from '@/lib/types/item';
import {
	BasicInfoStep,
	MediaLinksStep,
	ClassificationStep,
	LocationStep,
	type BasicInfoData,
	type MediaLinksData,
	type ClassificationData,
	type LocationStepData,
	type ReviewData
} from './form-steps';

/**
 * Full-screen item editor (spec 070). Every section of the item is on one page: basic
 * information, media and links, classification, location (when the location feature is on)
 * and the publish settings (featured, status). It replaces the five-step modal wizard for
 * admins: no "Next", nothing hidden behind a step, one Save. The section components are the
 * wizard's step components unchanged; this editor only lays them out together and keeps one
 * validity flag per section, so Save is enabled once every section is valid.
 */

interface ItemEditorProps {
	item?: ItemData;
	mode: 'create' | 'edit';
	onSubmit: (data: CreateItemRequest | UpdateItemRequest) => void;
	onCancel: () => void;
	isLoading?: boolean;
}

interface EditorData {
	basicInfo: BasicInfoData;
	mediaLinks: MediaLinksData;
	classification: ClassificationData;
	location: LocationStepData;
	review: ReviewData;
}

type SectionKey = 'basicInfo' | 'mediaLinks' | 'classification' | 'location' | 'review';

const STATUS_OPTIONS: Array<{ value: ItemStatus; label: string; description: string }> = [
	{ value: ITEM_STATUSES.DRAFT, label: 'Draft', description: 'Save as draft for later editing' },
	{ value: ITEM_STATUSES.PENDING, label: 'Pending Review', description: 'Submit for admin review' },
	{ value: ITEM_STATUSES.APPROVED, label: 'Approved', description: 'Publish immediately (Admin only)' },
	{ value: ITEM_STATUSES.REJECTED, label: 'Rejected', description: 'Mark as rejected (Admin only)' }
];

function fromItem(item: ItemData | undefined): EditorData {
	return {
		basicInfo: {
			id: item?.id || '',
			name: item?.name || '',
			slug: item?.slug || '',
			description: item?.description || ''
		},
		mediaLinks: {
			icon_url: item?.icon_url || '',
			source_url: item?.source_url || ''
		},
		classification: {
			category: Array.isArray(item?.category) ? item.category : [],
			tags: Array.isArray(item?.tags) ? item.tags : []
		},
		location: {
			address: item?.location?.address,
			city: item?.location?.city,
			state: item?.location?.state,
			country: item?.location?.country,
			postal_code: item?.location?.postal_code,
			latitude: item?.location?.latitude,
			longitude: item?.location?.longitude,
			service_area: item?.location?.service_area,
			is_remote: item?.location?.is_remote,
			geocoded_by: item?.location?.geocoded_by
		},
		review: {
			featured: item?.featured || false,
			status: item?.status || ITEM_STATUSES.DRAFT
		}
	};
}

/** Check if location data has any meaningful content */
function hasLocationData(location: LocationStepData): boolean {
	if (location.is_remote === true) return true;
	if (location.latitude !== undefined && location.longitude !== undefined) return true;
	if (location.address?.trim()) return true;
	if (location.city?.trim()) return true;
	if (location.country?.trim()) return true;
	return false;
}

function statusBadgeVariant(status: ItemStatus): 'default' | 'secondary' | 'destructive' {
	switch (status) {
		case ITEM_STATUSES.REJECTED:
			return 'destructive';
		case ITEM_STATUSES.PENDING:
		case ITEM_STATUSES.APPROVED:
			return 'default';
		default:
			return 'secondary';
	}
}

export function ItemEditor({ item, mode, onSubmit, onCancel, isLoading = false }: ItemEditorProps) {
	const t = useTranslations('admin.ITEM_FORM');
	const { settings: locationSettings } = useLocationSettings();
	const locationEnabled = locationSettings.enabled;
	const { companiesEnabled } = useCompaniesEnabled();

	const [data, setData] = useState<EditorData>(() => fromItem(item));
	const [valid, setValid] = useState<Record<SectionKey, boolean>>({
		basicInfo: false,
		mediaLinks: false,
		classification: false,
		location: true,
		review: true
	});

	// Edit mode: a different item arrives → start from its values.
	useEffect(() => {
		if (item && mode === 'edit') setData(fromItem(item));
	}, [item, mode]);

	const update = useCallback(<K extends SectionKey>(key: K, value: EditorData[K]) => {
		setData((prev) => ({ ...prev, [key]: value }));
	}, []);

	const setSectionValid = useCallback((key: SectionKey, isValid: boolean) => {
		setValid((prev) => (prev[key] === isValid ? prev : { ...prev, [key]: isValid }));
	}, []);

	const onBasicValid = useCallback((v: boolean) => setSectionValid('basicInfo', v), [setSectionValid]);
	const onMediaValid = useCallback((v: boolean) => setSectionValid('mediaLinks', v), [setSectionValid]);
	const onClassValid = useCallback((v: boolean) => setSectionValid('classification', v), [setSectionValid]);
	const onLocationValid = useCallback((v: boolean) => setSectionValid('location', v), [setSectionValid]);

	const sections = useMemo(() => {
		const keys: SectionKey[] = ['basicInfo', 'mediaLinks', 'classification'];
		if (locationEnabled) keys.push('location');
		return keys;
	}, [locationEnabled]);

	const invalidCount = sections.filter((k) => !valid[k]).length + (data.review.status ? 0 : 1);
	const canSave = invalidCount === 0 && !isLoading;

	const handleSave = () => {
		if (!canSave) return;
		const combined = {
			...data.basicInfo,
			...data.mediaLinks,
			...data.classification,
			...data.review,
			...(locationEnabled && hasLocationData(data.location) ? { location: data.location } : {})
		} as CreateItemRequest | UpdateItemRequest;
		onSubmit(combined);
	};

	const title = mode === 'create' ? t('TITLE_CREATE') : t('TITLE_EDIT');
	const saveLabel = mode === 'create' ? t('NAVIGATION.CREATE') : t('NAVIGATION.UPDATE');

	return (
		<div className="flex min-h-full flex-col bg-gray-50 dark:bg-[#0a0a0a]">
			{/* Top bar: title, cancel, save. Sticky so Save is always in reach on a long form. */}
			<div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#121212]/95">
				<div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
					<button
						type="button"
						onClick={onCancel}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
						aria-label={t('NAVIGATION.CANCEL')}
					>
						<X className="h-5 w-5" />
					</button>
					<div className="min-w-0 flex-1">
						<h2 id="item-form-modal-title" className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
							{title}
						</h2>
						<p className="truncate text-xs text-gray-500 dark:text-gray-400">
							{mode === 'edit' && item?.name ? item.name : mode === 'create' ? t('SUBTITLE_CREATE') : t('SUBTITLE_EDIT')}
						</p>
					</div>
					{invalidCount > 0 && (
						<span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">
							{invalidCount === 1 ? '1 section needs attention' : `${invalidCount} sections need attention`}
						</span>
					)}
					<button
						type="button"
						onClick={onCancel}
						disabled={isLoading}
						className="hidden h-10 items-center rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10 sm:inline-flex"
					>
						{t('NAVIGATION.CANCEL')}
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!canSave}
						className="inline-flex h-10 items-center gap-2 rounded-full bg-theme-primary px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
						{saveLabel}
					</button>
				</div>
			</div>

			{/* Body: the sections on the left, the publish settings on the right. */}
			<div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="space-y-6">
					<Card>
						<CardContent className="pt-6">
							<BasicInfoStep data={data.basicInfo} onChange={(v) => update('basicInfo', v)} onValidationChange={onBasicValid} mode={mode} />
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<MediaLinksStep data={data.mediaLinks} onChange={(v) => update('mediaLinks', v)} onValidationChange={onMediaValid} />
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<ClassificationStep data={data.classification} onChange={(v) => update('classification', v)} onValidationChange={onClassValid} />
						</CardContent>
					</Card>
					{locationEnabled && (
						<Card>
							<CardContent className="pt-6">
								<LocationStep data={data.location} onChange={(v) => update('location', v)} onValidationChange={onLocationValid} />
							</CardContent>
						</Card>
					)}
				</div>

				<aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">{t('STEPS.REVIEW.SETTINGS_TITLE')}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between gap-4">
								<div className="space-y-1">
									<Label className="flex items-center text-sm font-medium">
										<Star className="mr-2 h-4 w-4" />
										{t('FIELDS.FEATURED.LABEL')}
									</Label>
									<p className="text-xs text-gray-500">{t('FIELDS.FEATURED.HELP')}</p>
								</div>
								<Switch
									checked={data.review.featured}
									onCheckedChange={(checked) => update('review', { ...data.review, featured: checked })}
								/>
							</div>

							<Separator />

							<div className="space-y-3">
								<Label className="text-sm font-medium">
									{t('FIELDS.STATUS.LABEL')} <span className="text-red-500">*</span>
								</Label>
								<Select
									selectedKeys={data.review.status ? [data.review.status] : []}
									onSelectionChange={(keys) => update('review', { ...data.review, status: keys[0] as ItemStatus })}
									placeholder={t('FIELDS.STATUS.PLACEHOLDER')}
								>
									{STATUS_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											<div className="flex w-full items-center justify-between">
												<span>{option.label}</span>
												<Badge variant={statusBadgeVariant(option.value)} className="ml-2">
													{option.value}
												</Badge>
											</div>
										</SelectItem>
									))}
								</Select>
								{data.review.status && (
									<p className="text-xs text-gray-600">
										{STATUS_OPTIONS.find((opt) => opt.value === data.review.status)?.description}
									</p>
								)}
							</div>
						</CardContent>
					</Card>

					{companiesEnabled && data.basicInfo.slug && (
						<Card>
							<CardContent className="pt-6">
								<ItemCompanyManager itemSlug={data.basicInfo.slug} />
							</CardContent>
						</Card>
					)}
				</aside>
			</div>

			{/* Phone: the save button once more at the bottom, where thumbs are. */}
			<div className="sticky bottom-0 border-t border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#121212] sm:hidden">
				<button
					type="button"
					onClick={handleSave}
					disabled={!canSave}
					className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-theme-primary text-sm font-semibold text-white disabled:opacity-50"
				>
					{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
					{saveLabel}
				</button>
			</div>
		</div>
	);
}

'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * SoiGuru admin top bar (spec 055): the "Admin" label (the site header above carries the logo) and a
 * horizontal section nav. The active item is sea on sea-tint; every item is a
 * 44px touch target. On narrow screens the nav scrolls sideways instead of
 * wrapping. Replaces the template's plain "Admin Panel" strip.
 */

type NavKey =
	| 'DASHBOARD'
	| 'ITEMS'
	| 'CATEGORIES'
	| 'TAGS'
	| 'CLAIMS'
	| 'CLIENTS'
	| 'USERS'
	| 'COMMENTS'
	| 'REPORTS'
	| 'EMAILS'
	| 'SETTINGS';

const NAV: Array<{ key: NavKey; href: string; exact?: boolean }> = [
	{ key: 'DASHBOARD', href: '/admin', exact: true },
	{ key: 'ITEMS', href: '/admin/items' },
	{ key: 'CATEGORIES', href: '/admin/categories' },
	{ key: 'TAGS', href: '/admin/tags' },
	// SoiGuru claim queue (spec 054) lives on the owner side of the app
	{ key: 'CLAIMS', href: '/owner/review' },
	{ key: 'CLIENTS', href: '/admin/clients' },
	{ key: 'USERS', href: '/admin/users' },
	{ key: 'COMMENTS', href: '/admin/comments' },
	{ key: 'REPORTS', href: '/admin/reports' },
	// Transactional email templates (spec 073)
	{ key: 'EMAILS', href: '/admin/emails' },
	{ key: 'SETTINGS', href: '/admin/settings' }
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
	if (exact) return pathname === href || pathname === `${href}/`;
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShellBar() {
	const t = useTranslations('admin.SHELL');
	const pathname = usePathname() ?? '';

	return (
		<header className="border-b border-[var(--sg-line,#dde2df)] bg-[var(--sg-surface,#ffffff)]">
			<div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pt-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:py-2">
				<Link
					href="/admin"
					className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-[10px] text-[var(--sg-ink,#14201f)]"
				>
					{/* The site header above already shows the SoiGuru logo and name: here only the section label. */}
					<span className="rounded-full bg-[var(--sg-sun-tint,#fdf0dc)] px-2 py-0.5 text-xs font-semibold text-[var(--sg-ink,#14201f)]">
						{t('ADMIN')}
					</span>
				</Link>
				<nav
					aria-label={t('NAV_LABEL')}
					className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:m-0 lg:p-0"
				>
					<ul className="flex min-w-max items-center gap-1">
						{NAV.map(({ key, href, exact }) => {
							const active = isActive(pathname, href, exact);
							return (
								<li key={key}>
									<Link
										href={href}
										aria-current={active ? 'page' : undefined}
										className={[
											'flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium whitespace-nowrap transition-colors',
											active
												? 'bg-[var(--sg-sea-tint,#e2f1f2)] font-semibold text-[var(--sg-sea,#0a6b73)]'
												: 'text-[var(--sg-ink-muted,#5a6665)] hover:bg-[var(--sg-surface-100,#f4f5f2)] hover:text-[var(--sg-ink,#14201f)]'
										].join(' ')}
									>
										{t(`NAV.${key}`)}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
			</div>
		</header>
	);
}

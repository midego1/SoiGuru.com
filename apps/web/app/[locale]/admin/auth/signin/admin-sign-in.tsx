'use client';

import { Building, Globe, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CredentialsForm } from '@/app/[locale]/auth/components/credentials-form';
import { SoiGuruIcon, SoiGuruLogo } from '@/components/soiguru/logo-mark';

/**
 * SoiGuru admin sign-in (spec 055). Left panel on sea-deep with the logo and a
 * karst scene, right panel the template's credentials form (same auth flow,
 * 2FA step and reCAPTCHA as before) with a sea "Sign in" button. Replaces the
 * generic `AuthForm` illustration layout on `/admin/auth/signin` only; the
 * client sign-in keeps `AuthForm`.
 */
export function AdminSignIn({ onSuccess }: { onSuccess: () => void }) {
	const tAuth = useTranslations('admin.AUTH_FORM');
	const tShell = useTranslations('admin.SHELL');

	const features = [
		{ icon: User, title: tAuth('USER_MANAGEMENT'), description: tAuth('USER_MANAGEMENT_DESC') },
		{ icon: Building, title: tAuth('CONTENT_MODERATION'), description: tAuth('CONTENT_MODERATION_DESC') },
		{ icon: Globe, title: tAuth('ANALYTICS_DASHBOARD'), description: tAuth('ANALYTICS_DASHBOARD_DESC') }
	];

	return (
		<div className="sg-signin flex min-h-[90dvh] items-center justify-center bg-[var(--app-ground,#f4f5f2)] px-4 py-8">
			<div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--sg-line,#dde2df)] bg-[var(--sg-surface,#ffffff)] shadow-[0_1px_2px_#14201f14]">
				<div className="flex flex-col lg:flex-row">
					{/* Brand panel */}
					<div className="relative flex w-full flex-col justify-between gap-6 bg-[#064a50] p-6 text-white lg:w-1/2 lg:p-10">
						<SoiGuruLogo tone="dark" height={44} alt="SoiGuru" />

						{/* The brand icon, large, in place of the drawn karst scene (2026-10-23). */}
						<SoiGuruIcon size={220} className="hidden self-center lg:block" />

						<div className="space-y-3">
							<h2 className="text-xl font-bold leading-tight tracking-[-0.01em] lg:text-2xl">
								{tAuth('ADMIN_WELCOME_TITLE')}
							</h2>
							<p className="text-sm leading-relaxed text-white/80">
								{tAuth('ADMIN_WELCOME_DESCRIPTION')}
							</p>
						</div>

						<ul className="hidden space-y-3 sm:block">
							{features.map(({ icon: Icon, title, description }) => (
								<li key={title} className="flex items-start gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10">
										<Icon className="h-4 w-4 text-[#f2a33a]" aria-hidden="true" />
									</span>
									<span>
										<span className="block text-sm font-semibold">{title}</span>
										<span className="block text-xs text-white/70">{description}</span>
									</span>
								</li>
							))}
						</ul>

						<p className="flex items-center gap-2 border-t border-white/15 pt-4 text-xs text-white/70">
							<span className="inline-block h-0.5 w-6 rounded-full bg-[#f2a33a]" aria-hidden="true" />
							{tShell('SIGNIN_FOOTNOTE')}
						</p>
					</div>

					{/* Form panel */}
					<div className="flex w-full flex-col justify-center p-6 lg:w-1/2 lg:p-10">
						<div className="mx-auto w-full max-w-sm">
							<CredentialsForm type="login" hideSwitchButton onSuccess={onSuccess} clientMode />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

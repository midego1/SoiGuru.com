/**
 * Owner-side building blocks (OwnerDashboard in the design): the "· Owner"
 * brand bar, the back bar of the edit screens, and the sign-in prompt.
 * Server components; every action is a link or a form post.
 */
import Link from 'next/link';
import { Icon } from './icon';
import { SoiGuruLogo } from './logo-mark';
import { LanguageToggle } from './parts';
import type { SgContext } from '@/lib/soiguru/context';

export function OwnerBar({ ctx, langPath }: { ctx: SgContext; langPath: string }) {
	return (
		<header className="tkg-topbar">
			<Link className="tkg-brand" href={ctx.href('/')} aria-label="SoiGuru">
				<SoiGuruLogo height={30} />
			</Link>
			<span className="sg-brand-owner">{ctx.t('owner.owner')}</span>
			<div className="tkg-spacer" />
			<LanguageToggle ctx={ctx} path={langPath} />
		</header>
	);
}

/** Back bar for an edit screen, with the listing name under the title. */
export function EditorBar({ ctx, title, listingName }: { ctx: SgContext; title: string; listingName: string }) {
	return (
		<header className="tkg-topbar">
			<Link className="tkg-iconbtn" href={ctx.href('/owner')} aria-label={ctx.t('results.back')}>
				<Icon name="chevron-left" />
			</Link>
			<div className="sg-bar-title">
				{title}
				<small>{listingName}</small>
			</div>
		</header>
	);
}

export function SignInPrompt({
	ctx,
	back,
	title = ctx.t('owner.signInTitle'),
	body = ctx.t('owner.signInBody')
}: {
	ctx: SgContext;
	back: string;
	title?: string;
	body?: string;
}) {
	return (
		<section className="tkg-section sg-grow" style={{ paddingTop: 20 }}>
			<div className="tkg-pad">
				<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
					{title}
				</h1>
				<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
					{body}
				</p>
				<div className="tkg-stack">
					<Link
						className="tkg-btn tkg-btn-block"
						href={ctx.href(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)}
					>
						{ctx.t('claim.signIn')}
					</Link>
					<Link
						className="tkg-btn tkg-btn-secondary tkg-btn-block"
						href={ctx.href(`/auth/register?callbackUrl=${encodeURIComponent(back)}`)}
					>
						{ctx.t('claim.createAccount')}
					</Link>
				</div>
			</div>
		</section>
	);
}

/** "Saved" confirmation shown after a form post redirects back with `?saved=1`. */
export function SavedNote({ ctx }: { ctx: SgContext }) {
	return (
		<p className="tkg-info sg-sample" role="status">
			<Icon name="check" />
			<span>{ctx.t('owner.saved')}</span>
		</p>
	);
}

/** Sticky save bar of an edit form. */
export function SaveBar({ ctx }: { ctx: SgContext }) {
	return (
		<div className="tkg-bottombar">
			<div className="tkg-bb-info">
				<span className="tkg-strong">{ctx.t('owner.saveTitle')}</span>
				<small>{ctx.t('owner.saveNote')}</small>
			</div>
			<button className="tkg-btn" type="submit">
				<Icon name="check" />
				{ctx.t('owner.save')}
			</button>
		</div>
	);
}

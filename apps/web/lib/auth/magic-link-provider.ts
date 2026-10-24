import Credentials from 'next-auth/providers/credentials';

/**
 * NextAuth provider for SoiGuru's emailed sign-in links (spec 073).
 *
 * A credentials-style provider (id `magic-link`) rather than Auth.js's Email provider: the app
 * runs JWT sessions with its own user/client-profile model, and the sign-in page calls
 * `signIn('magic-link', { token })` from the browser, the path the password form already uses
 * so the session cookie is set reliably (see `signUp` in `app/[locale]/auth/actions.ts`).
 *
 * `authorize` is the only place a magic-link session is minted: it consumes the token (one
 * use, unexpired) and returns the user. Anything else returns null, which NextAuth reports as
 * a failed sign-in.
 */
export const magicLinkProvider = Credentials({
	id: 'magic-link',
	name: 'magic-link',
	credentials: {
		token: { type: 'text' }
	},
	authorize: async (credentials) => {
		const token = typeof credentials?.token === 'string' ? credentials.token.trim() : '';
		if (!token) return null;
		try {
			const { consumeMagicLink, resolveMagicLinkUser } = await import('@/lib/soiguru/magic-link');
			const email = await consumeMagicLink(token);
			if (!email) return null;
			return await resolveMagicLinkUser(email);
		} catch (error) {
			console.error('[magic-link] Sign-in failed:', error instanceof Error ? error.message : error);
			return null;
		}
	}
});

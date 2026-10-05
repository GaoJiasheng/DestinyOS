import NextAuth from 'next-auth';
import { cookies } from 'next/headers';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import { getDb } from './db';
import { roleForEmail } from './auth-role';
import { sendMagicEmail } from './auth-email';
import { logger } from './logger';
import { recordEvent } from './events';

export const { auth, handlers, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  const baseAdapter = PrismaAdapter(db);
  const adapter: Adapter = {
    ...baseAdapter,
    async createUser(data) {
      const user = await db.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          image: data.image,
          role: roleForEmail(data.email),
          locale: (await cookies()).get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh',
        },
      });
      await recordEvent('user.registered', {
        userId: user.id,
        locale: user.locale,
        plan: user.plan,
      });
      return { ...user, email: data.email };
    },
    async getSessionAndUser(sessionToken) {
      const result = await baseAdapter.getSessionAndUser?.(sessionToken);
      return result && !('deletedAt' in result.user && result.user.deletedAt) ? result : null;
    },
  };
  return {
    adapter,
    session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
    // DESIGN-GAP: Secure cookies require HTTPS; localhost HTTP development uses Auth.js's automatic exception.
    useSecureCookies: process.env.NODE_ENV === 'production',
    providers: [
      Google({
        // DESIGN-GAP: Auth.js defaults to PKCE only; require state and OIDC nonce explicitly.
        checks: ['pkce', 'state', 'nonce'],
        authorization: { params: { scope: 'openid email profile' } },
      }),
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM,
        maxAge: 15 * 60,
        async sendVerificationRequest({ identifier, url }) {
          const original = new URL(url);
          const callbackUrl = original.searchParams.get('callbackUrl') ?? '';
          const locale = new URL(callbackUrl, original.origin).pathname.startsWith('/en')
            ? 'en'
            : 'zh';
          const confirmation = new URL(`/${locale}/auth/verify`, original.origin);
          confirmation.searchParams.set('token', original.searchParams.get('token') ?? '');
          confirmation.searchParams.set('email', identifier);
          if (new URL(callbackUrl, original.origin).pathname === '/admin')
            confirmation.searchParams.set('returnTo', '/admin');
          await sendMagicEmail(identifier, locale, confirmation.toString());
        },
      }),
    ],
    pages: { signIn: '/auth/login', verifyRequest: '/auth/login?sent=1', error: '/auth/login' },
    callbacks: {
      async signIn({ user, email, account, profile }) {
        if (account?.provider === 'google' && profile?.email_verified !== true) return false;
        const existing = user.email
          ? await db.user.findUnique({ where: { email: user.email } })
          : null;
        if (existing?.deletedAt) return false;
        if (!email?.verificationRequest && existing)
          await db.user.update({
            where: { id: existing.id },
            data: { role: roleForEmail(existing.email) },
          });
        return true;
      },
      async session({ session, user }) {
        const current = await db.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { role: true, plan: true },
        });
        session.user.id = user.id;
        session.user.role =
          roleForEmail(user.email) === 'admin' && current.role === 'admin' ? 'admin' : 'user';
        session.user.plan = current.plan;
        await recordEvent('user.active', { userId: user.id });
        await db.user.updateMany({
          where: {
            id: user.id,
            OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(Date.now() - 60000) } }],
          },
          data: { lastActiveAt: new Date() },
        });
        return session;
      },
    },
    logger: {
      error: (error) => {
        const raw = error.cause;
        const cause =
          raw && typeof raw === 'object' && 'err' in raw && raw.err instanceof Error
            ? raw.err
            : undefined;
        const causeCode =
          cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
        logger.error({ err: error, causeCode, causeName: cause?.name }, 'Authentication error');
      },
      warn: (code) => logger.warn({ code }, 'Authentication warning'),
      debug: () => undefined,
    },
  };
});

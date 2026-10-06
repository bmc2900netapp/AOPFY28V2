import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}

export const { handlers, auth: nextAuth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase();
        const password = String(credentials.password);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any)?.role ?? (isAdmin(user.email) ? 'admin' : 'requestor');
      }
      // For SSO users — check admin list on every token refresh
      if (account?.provider === 'microsoft-entra-id') {
        token.role = isAdmin(token.email as string) ? 'admin' : 'requestor';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
});

// ---------------------------------------------------------------------------
// TESTING MODE: login is bypassed. The app assumes the user is already
// authenticated (e.g. via SharePoint SSO). auth() returns a fixed mock user
// backed by a real DB record so submission foreign keys stay valid.
// To restore real authentication, export the NextAuth `auth` directly again.
// ---------------------------------------------------------------------------
const MOCK_USER_EMAIL = (process.env.MOCK_USER_EMAIL ?? 'abacus-09068b09@example.com').toLowerCase();
const MOCK_USER_NAME = process.env.MOCK_USER_NAME ?? 'SharePoint Test User';

export async function auth() {
  let user = await prisma.user.findUnique({ where: { email: MOCK_USER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: MOCK_USER_EMAIL,
        name: MOCK_USER_NAME,
        role: 'admin',
      },
    });
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? MOCK_USER_NAME,
      role: user.role ?? 'admin',
    },
  } as any;
}

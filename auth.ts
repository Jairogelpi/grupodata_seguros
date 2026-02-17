import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "Credenciales",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Contraseña", type: "password" },
            },
            async authorize(credentials) {
                const email = (credentials?.email as string)?.toLowerCase()?.trim();
                const password = credentials?.password as string;

                if (!email || !password) return null;

                // Check whitelist
                const allowedEmails = (process.env.ALLOWED_EMAILS || "")
                    .split(",")
                    .map((e) => e.trim().toLowerCase());

                if (!allowedEmails.includes(email)) return null;

                // Check shared password
                const validPassword = process.env.AUTH_PASSWORD || "admin123";
                if (password !== validPassword) return null;

                // Authenticated
                return {
                    id: email,
                    email: email,
                    name: email.split("@")[0],
                };
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.email = user.email;
            }
            return token;
        },
        async session({ session, token }) {
            if (token.email) {
                session.user.email = token.email as string;
            }
            return session;
        },
    },
});

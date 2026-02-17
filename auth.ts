import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
            const userEmail = user.email?.toLowerCase();

            if (userEmail && allowedEmails.includes(userEmail)) {
                return true;
            }

            return false; // Access denied if not in whitelist
        },
        async session({ session, token }) {
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
});

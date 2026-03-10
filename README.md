This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Android Wrapper

This project can be packaged as an Android app that loads the deployed website inside a native WebView using Capacitor.

1. Publish the web app to a public HTTPS URL.
2. Create a local `.env` or `.env.local` file with:

```bash
CAPACITOR_APP_URL=https://tu-dominio-publicado.com
```

3. Regenerate the Android icon and splash from `public/logo.png` when needed:

```bash
npm run mobile:assets
```

4. Sync the Android project:

```bash
npm run mobile:sync
```

5. Open Android Studio:

```bash
npm run mobile:android
```

6. From Android Studio, generate the APK or AAB.

If `CAPACITOR_APP_URL` is not configured, the mobile shell shows a placeholder screen instead of the real app.

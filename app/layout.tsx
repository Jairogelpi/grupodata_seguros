import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Grupo Data Seguros',
  description: 'Sistema de Gestión y Métricas para Grupo Data Seguros',
};

import { Providers } from './providers';

import PrintLayout from '@/components/PrintLayout';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <Providers>
          <PrintLayout />
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:py-0 print:px-4 print:mx-auto print:max-w-full">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

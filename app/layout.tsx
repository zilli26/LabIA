import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

import { AppShell } from "@/components/app/app-shell";
import { getCurrentMonthSpendBrl } from "@/lib/db/flows";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "LabIA",
  description: "Canvas de fluxos para produção social com IA.",
};

export const dynamic = "force-dynamic";

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const monthSpend = await getCurrentMonthSpendBrl().catch(() => 0);

  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
      >
        <AppShell monthCostLabel={`mês ${formatBrl(monthSpend)}`}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

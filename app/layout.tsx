import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans"
});

export const metadata: Metadata = {
  title: "Nexus Academy",
  description:
    "Plataforma institucional para acompanhamento acadêmico, relatórios e gestão operacional."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={publicSans.variable}>{children}</body>
    </html>
  );
}




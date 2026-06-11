import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}




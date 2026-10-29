import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PátioSeguro — Checklist diário",
  description:
    "Controle e preenchimento de checklist diário para empilhadeiras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

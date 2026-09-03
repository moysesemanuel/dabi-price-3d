import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans-ui",
  display: "swap",
  preload: true,
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display-ui",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-mono-ui",
  display: "swap",
  preload: true,
  fallback: ["SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "Dabi Price",
  description:
    "Precificação profissional para produtos físicos, impressão 3D e operações artesanais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

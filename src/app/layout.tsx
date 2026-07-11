import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans-ui",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: "DaBi Price 3D",
  description: "Precificadora para produtos impressos em 3D.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}


import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coloring Assistant",
  description: "Your personal AI coloring assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

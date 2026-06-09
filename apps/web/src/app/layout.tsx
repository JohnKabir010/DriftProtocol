import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drift Protocol — Underground Racing, Neo-Meridian",
  description:
    "Web-based multiplayer cyberpunk street racing. Own the night. Race, drift, bet, control districts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-white font-body antialiased">{children}</body>
    </html>
  );
}

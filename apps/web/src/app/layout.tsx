import type { Metadata } from "next";
import { Orbitron, Inter } from "next/font/google";
import { NavBar } from "@/components/ui/NavBar";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToastContainer } from "@/components/ui/Toast";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drift Protocol — Underground Racing, Neo-Meridian",
  description: "Web-based multiplayer cyberpunk street racing. Own the night.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable}`}>
      <body className="bg-void text-white font-body antialiased">
        <SessionProvider>
          <NavBar />
          {children}
          <ToastContainer />
        </SessionProvider>
      </body>
    </html>
  );
}

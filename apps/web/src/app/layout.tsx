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
  description:
    "Web-based multiplayer cyberpunk street racing with Stellar blockchain economy. Own your car. Earn your rep. Control the district.",
  keywords: ["cyberpunk", "racing", "blockchain", "Stellar", "multiplayer", "NFT", "web3"],
  authors: [{ name: "Drift Protocol Team" }],
  openGraph: {
    title: "Drift Protocol",
    description: "Street racing, real stakes. Own your car. Earn your rep. Control the district.",
    type: "website",
    locale: "en_US",
    siteName: "Drift Protocol",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drift Protocol — Underground Racing",
    description: "Cyberpunk multiplayer street racing powered by Stellar blockchain.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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

import type { Metadata } from "next";
import { NavBar } from "@/components/ui/NavBar";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drift Protocol — Underground Racing, Neo-Meridian",
  description: "Web-based multiplayer cyberpunk street racing. Own the night.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-white font-body antialiased">
        <SessionProvider>
          <NavBar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

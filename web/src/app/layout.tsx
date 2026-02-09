import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });

export const metadata: Metadata = {
  title: "Jubilee Steward",
  description: "The Parable Interface for the Jubilee Agent",
};

import { Navigation, MobileNavigation } from "@/components/Navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cinzel.variable} font-sans bg-stone-50 text-stone-900 antialiased`}>
        <Providers>
          <div className="flex min-h-screen">
            <Navigation />
            <div className="flex-1 flex flex-col md:pl-64">
              <MobileNavigation />
              <main className="flex-1">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

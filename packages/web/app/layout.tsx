import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RewardRail — Verified actions. Instant settlement.",
  description:
    "Programmable payout and settlement infrastructure for rewarded advertising.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        {/*
          The scroll reveals start hidden, which is rendered into the HTML.
          Without this a visitor with scripting off would find a blank page
          where the product case should be.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}

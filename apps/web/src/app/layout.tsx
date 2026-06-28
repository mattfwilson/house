import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// Root layout — the minimal App-Router shell. The persistent profile+scenario header (D-02),
// Geist fonts, and dark-slate design system land in the layout/cockpit plans (07-02+). This is
// the buildable scaffold root the rest of the phase mounts under.
export const metadata: Metadata = {
  title: 'House — Affordability & FI-Impact',
  description:
    'What does buying this house do to our early-retirement timeline? A finances-first home-affordability decision tool.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}

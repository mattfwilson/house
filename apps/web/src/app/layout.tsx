import type { Metadata } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Header } from '@/components/chrome/Header';
import { AssumptionsRail } from '@/components/rail/AssumptionsRail';

// Geist Sans drives UI/body; Geist Mono is reserved for numeric instrument readouts (dollars, ratios,
// FI dates) via the `.num-readout` utility — UI-SPEC §Design System / §Typography.
const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'House — Affordability & FI-Impact',
  description:
    'What does buying this house do to our early-retirement timeline? A finances-first home-affordability decision tool.',
};

// Root layout — the dark instrument-panel base (D-12). `class="dark"` makes the locked slate
// design contract (globals.css) the default and only theme. The persistent profile + scenario
// switcher Header (D-02) is mounted ABOVE the route `children` slot, and the persistent docked
// AssumptionsRail (D-10) is docked BESIDE it, so both are present on every route (cockpit, heatmap,
// sensitivity) — the routes inherit the active profile/scenario context and the always-visible,
// live-recompute assumptions rail.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn('dark', geistSans.variable, geistMono.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Header />
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <AssumptionsRail />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

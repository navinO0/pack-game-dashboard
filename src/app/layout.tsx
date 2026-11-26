import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileViewportSync } from "@/components/MobileViewportSync";

export const metadata: Metadata = {
  title: "PackScore Pro — Pack Game Score & Prize Management",
  description:
    "Commercial Pack Game session management, automatic elimination tracking, and configurable prize pool distribution.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Runtime environment variables injected by docker-entrypoint.sh in VPS/Coolify */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/env.js" />
      </head>
      <body className="min-h-[100dvh] bg-background font-sans text-foreground antialiased overflow-x-clip">
        <MobileViewportSync />
        {children}
      </body>
    </html>
  );
}

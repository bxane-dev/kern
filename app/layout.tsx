import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KERN — Developer Command Center",
  description: "GitHub, deployments, logs, uptime, issues and TODOs in one command center.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

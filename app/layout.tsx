import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WiV1",
  description: "WiFi NFC + QR platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

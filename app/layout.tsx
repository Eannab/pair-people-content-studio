import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Poppins SemiBold for headings
const poppins = Poppins({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

// NOTE: Alte Haas Grotesk is self-hosted.
// Place the font file at: /public/fonts/AlteHaasGroteskRegular.woff2
// The @font-face declaration is in globals.css

export const metadata: Metadata = {
  title: "Pair People — Content Studio",
  description:
    "AI-powered LinkedIn content creation for Pair People, Sydney's Fixed Fee tech recruitment agency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin", "thai"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

import { TRPCReactProvider } from "@/trpc/Provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${kanit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TRPCReactProvider>
          {children}
          <Toaster position="top-right" richColors />
        </TRPCReactProvider>
      </body>
    </html>
  );
}

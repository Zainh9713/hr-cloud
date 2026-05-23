import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "H&R Cloud - Cyberpunk Storage",
  description: "Futuristic encrypted cloud storage solution",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#4c1d95",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#fff',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)'
            }
          }}
        />
      </body>
    </html>
  );
}

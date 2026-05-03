import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "YouTube Sort By Likes",
  description:
    "Find the best YouTube videos from any channel by sorting by likes or like:view ratio",
  keywords: ["youtube", "sort", "likes", "ratio", "videos", "channel"],
  openGraph: {
    title: "YouTube Sort By Likes",
    description:
      "Find the best YouTube videos from any channel by sorting by likes or like:view ratio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Sort By Likes",
    description:
      "Find the best YouTube videos from any channel by sorting by likes or like:view ratio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC for dark mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark' ||
                  (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

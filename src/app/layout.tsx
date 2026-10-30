import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppProviders from "@/components/AppProviders";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { APP_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} — ${APP_CONFIG.slogan}`,
  description:
    "Study workspace for students in Ghana. Turn lecture slides, PDFs, and notes into clear summaries, structured study notes, and timed practice quizzes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LAMLA Guide",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  keywords: [
    "LAMLA Guide AI",
    "Ghana Education",
    "WASSCE Prep",
    "SHS Study",
    "University of Ghana",
    "KNUST",
    "UCC",
    "AI Study Tutor",
    "Flashcards Ghana",
    "Timed Exam Practice",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('lamla_theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-white dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 selection:bg-blue-100 selection:text-blue-900">
        <a
          href="#main-content"
          className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:text-sm focus:font-medium focus:shadow-md"
        >
          Skip to main content
        </a>
        <AppProviders>
          <Navbar />
          <main id="main-content" className="flex-1 flex flex-col">
            {children}
          </main>
          <Footer />
          <PwaInstallPrompt />
        </AppProviders>
      </body>
    </html>
  );
}

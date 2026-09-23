import type { Metadata, Viewport } from "next";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Food Review Hà Nội — Ký Sự Ẩm Thực 36 Phố Phường",
  description:
    "Tuyển tập và đánh giá quán ăn thật tâm nhất Hà Nội. Không booking KOL, khám phá từ vỉa hè ngõ nhỏ đến tiệm gia truyền.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Food HN",
  },
  openGraph: {
    title: "Food Review Hà Nội — Ký Sự Ẩm Thực 36 Phố Phường",
    description: "Khám phá và review thật tâm những quán ăn ngon nhất Hà Nội",
    type: "website",
    locale: "vi_VN",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D1B16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${playfair.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <head>
        <script
          id="theme-script"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('foodhn-theme');
                  var isDark = theme === 'dark' || (!theme || theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  } else if (theme === 'dark' || isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <AuthProvider>
          <a href="#main-content" className="skip-link">Đến nội dung chính</a>
          <Navbar />
          <main id="main-content" className="flex-1 pt-0 md:pt-[72px] pb-20 md:pb-0">
            {children}
          </main>
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

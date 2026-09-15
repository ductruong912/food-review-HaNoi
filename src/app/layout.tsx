import type { Metadata, Viewport } from "next";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${playfair.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 pt-0 md:pt-16 pb-20 md:pb-0">
            {children}
          </main>
          <Toaster
            position="top-center"
            theme="dark"
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

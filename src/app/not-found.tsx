import Link from 'next/link';
import { UtensilsCrossed, Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Decorative Icon */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-24 h-24 rounded-3xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-2xl">
            <UtensilsCrossed size={42} strokeWidth={1.75} />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-border/80 border border-border text-[11px] font-mono text-text-muted">
            404
          </span>
        </div>

        {/* Heading & description */}
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-white mb-2">
          Lạc bước giữa 36 phố phường!
        </h1>
        <p className="text-sm text-text-muted leading-relaxed mb-8">
          Địa chỉ này có thể đã đổi tên, chuyển quán, hoặc chưa từng tồn tại trên bản đồ ẩm thực. Hãy cùng quay lại để tìm món ngon khác nhé!
        </p>

        {/* Navigation CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-bg-primary font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-accent/20"
          >
            <Home size={16} />
            <span>Về trang chủ</span>
          </Link>
          <Link
            href="/map"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border/80 text-text-secondary hover:text-white hover:border-accent/40 active:scale-95 transition-all text-sm font-medium"
          >
            <Compass size={16} />
            <span>Xem bản đồ ẩm thực</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

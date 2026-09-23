'use client';
import Link from 'next/link';

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="mx-auto max-w-md p-6 text-center space-y-4">
    <h1 className="font-editorial text-2xl">Chưa tải được trang</h1>
    <p role="alert" className="text-text-secondary">Kết nối đang gián đoạn hoặc có lỗi tạm thời. Hãy thử lại sau một chút.</p>
    <button onClick={retry} className="gradient-warm rounded-xl px-5 py-3">Thử lại</button>
    <Link href="/" className="block p-3 text-accent">Về danh sách quán</Link>
  </div>;
}

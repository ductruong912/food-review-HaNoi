'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    // The shared browser client exchanges the PKCE code during initialization.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error') || hash.has('error')) {
      setFailed(true);
      return;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) setFailed(true);
      else window.location.replace('/profile');
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <div className="max-w-md mx-auto p-6 text-center" role="status">
    {failed ? <>
      <h1 className="font-editorial text-2xl mb-3">Chưa đăng nhập được</h1>
      <p>Link đăng nhập đã hết hạn hoặc không mở trên trình duyệt ban đầu. Hãy đăng nhập lại để nhận link mới.</p>
      <Link href="/profile" className="inline-block mt-4 text-accent underline">Quay lại đăng nhập</Link>
    </> : <p>Đang hoàn tất đăng nhập…</p>}
  </div>;
}

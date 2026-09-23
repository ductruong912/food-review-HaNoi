'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useModalFocus } from './useModalFocus';

export default function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { signInWithGoogle, signInWithEmail, googleEnabled } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!loading) { setSent(false); setError(''); onClose(); } };
  const dialogRef = useModalFocus(isOpen, close);
  if (!isOpen) return null;
  const login = async (provider: 'google' | 'email') => {
    setLoading(true);
    setError('');
    try {
      if (provider === 'google') await signInWithGoogle();
      else {
        const result = await signInWithEmail(email);
        if (result.error) throw new Error(result.error);
        setSent(true);
      }
    } catch {
      setError('Chưa đăng nhập được. Kiểm tra kết nối hoặc thử lại sau nhé.');
    } finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="login-title" className="glass-card relative w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Đóng" disabled={loading} onClick={close} className="absolute right-3 top-3 p-2"><X size={18} /></button>
      <h2 id="login-title" className="text-xl font-bold mb-2">Đăng nhập</h2>
      <p className="text-sm text-text-secondary mb-5">{googleEnabled ? 'Đăng nhập bằng Google hoặc email.' : 'Đăng nhập bằng email.'} Chủ nhóm sẽ cấp quyền thêm quán cho bạn.</p>
      {sent ? <p role="status" className="text-sm">Đã gửi link đến <strong>{email}</strong>. Mở link trên cùng trình duyệt và thiết bị này để hoàn tất đăng nhập.</p> : <>
        {googleEnabled && <button disabled={loading} onClick={() => void login('google')} className="w-full rounded-xl bg-white text-gray-900 p-3 font-semibold disabled:opacity-50">Đăng nhập bằng Google</button>}
        <form className={`${googleEnabled ? 'mt-4' : ''} space-y-3`} onSubmit={(e) => { e.preventDefault(); void login('email'); }}>
          <label htmlFor="login-email" className="block text-sm">Email của bạn</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl bg-card border border-border p-3" />
          <button disabled={loading} className="w-full rounded-xl gradient-warm p-3 text-white font-semibold disabled:opacity-50">{loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Gửi link đăng nhập'}</button>
        </form>
      </>}
      {error && <p role="alert" className="text-accent-red text-sm mt-3">{error}</p>}
    </div>
  </div>;
}

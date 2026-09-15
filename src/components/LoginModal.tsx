'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_EMOJIS = ['🍜', '🍕', '☕', '🐱', '🦊', '🐼', '🔥', '⭐'];

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { signInWithGoogle, signInWithEmail, signInAsGuest } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍜');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Vui lòng nhập tên hoặc biệt danh');
      return;
    }

    signInAsGuest(guestName.trim(), selectedEmoji);
    toast.success(`Chào mừng ${guestName.trim()}! Đã sẵn sàng thêm quán 🎉`);
    handleClose();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    const result = await signInWithEmail(email);
    if (result.error) {
      setError(result.error);
    } else {
      setEmailSent(true);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setGuestName('');
    setEmail('');
    setEmailSent(false);
    setError('');
    setShowAdvanced(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm"
          >
            <div className="glass-card p-6 relative overflow-hidden">
              {/* Glow effect */}
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-accent/20 blur-3xl" />

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>

              {!emailSent ? (
                <>
                  {/* Header */}
                  <div className="text-center mb-5">
                    <div className="text-3xl mb-1.5">🍜</div>
                    <h2 className="text-xl font-bold text-white">Đăng nhập nhanh</h2>
                    <p className="text-xs text-text-secondary mt-1">
                      Nhập tên để thêm quán & nhận xét ngay lập tức
                    </p>
                  </div>

                  {/* 1. Quick Guest Login */}
                  <form onSubmit={handleGuestLogin} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                        Tên hoặc biệt danh của bạn:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="VD: Đức Trường, Nam, Linh..."
                          className="w-full px-4 py-3 rounded-xl bg-secondary/70 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    {/* Avatar Emoji Selector */}
                    <div>
                      <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                        Chọn biểu tượng avatar:
                      </label>
                      <div className="flex gap-1.5 justify-between">
                        {AVATAR_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setSelectedEmoji(emoji)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                              selectedEmoji === emoji
                                ? 'bg-accent/25 border-2 border-accent scale-110'
                                : 'bg-secondary/40 border border-border/50 hover:bg-secondary'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl gradient-warm text-white font-bold text-sm hover:opacity-90 transition-opacity glow-accent flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Sparkles size={16} />
                      Vào trải nghiệm ngay 🚀
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="w-full text-center text-xs text-text-muted hover:text-accent transition-colors py-2 flex items-center justify-center gap-1"
                    >
                      {showAdvanced ? '▲ Thu gọn đăng nhập khác' : '▼ Hoặc đăng nhập bằng Google / Email'}
                    </button>
                  </div>

                  {/* Advanced: Google & Email */}
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-2 border-t border-border/50"
                    >
                      {/* Google */}
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white text-gray-800 text-xs font-semibold hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Đăng nhập bằng Google
                      </button>

                      {/* Email */}
                      <form onSubmit={handleEmailLogin} className="space-y-2">
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Nhập email gửi link đăng nhập"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-xs"
                          />
                        </div>

                        {error && (
                          <p className="text-accent-red text-xs">{error}</p>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 rounded-xl bg-secondary text-text-secondary hover:text-white font-medium hover:bg-secondary/80 transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {loading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Đang gửi...
                            </>
                          ) : (
                            'Gửi Magic Link vào Email'
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </>
              ) : (
                /* Email Sent Confirmation */
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">✉️</div>
                  <h2 className="text-xl font-bold text-white mb-2">Kiểm tra email!</h2>
                  <p className="text-sm text-text-secondary mb-4">
                    Mình đã gửi link đăng nhập đến<br />
                    <span className="text-accent font-semibold">{email}</span>
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 rounded-full border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors text-sm"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

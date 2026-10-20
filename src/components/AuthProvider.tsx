'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { clearBookmarkChange, getBookmarks, getPendingBookmarkChanges, mergeBookmarkIds, queueBookmarkChange, setActiveBookmarkAccount, setBookmarks } from '@/lib/bookmarks';
import type { Profile } from '@/lib/types';
import type { Session } from '@supabase/supabase-js';
import { MotionConfig } from 'framer-motion';

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  role: Profile['role'];
}
interface AuthContextType {
  user: AppUser | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  googleEnabled: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAuthenticated: boolean;
  canContribute: boolean;
  profileError: string;
  refreshProfile: () => void;
  bookmarkSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  bookmarkSyncError: string;
  syncBookmarks: () => Promise<boolean>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [bookmarkSyncStatus, setBookmarkSyncStatus] = useState<AuthContextType['bookmarkSyncStatus']>('idle');
  const [bookmarkSyncError, setBookmarkSyncError] = useState('');
  const activeUserId = useRef<string | null>(null);
  const sessionUserId = session?.user.id;

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    // Keep callbacks synchronous; fetch profiles outside the auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      authEventReceived = true;
      if (activeUserId.current !== (next?.user.id ?? null)) {
        setActiveBookmarkAccount(next?.user.id ?? null);
        setProfile(null);
        setLoading(!!next);
        setProfileError('');
        activeUserId.current = next?.user.id ?? null;
      }
      setSession(next ? { ...next } : null);
      if (!next) setLoading(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      activeUserId.current = error ? null : data.session?.user.id ?? null;
      setActiveBookmarkAccount(activeUserId.current);
      setSession(error ? null : data.session);
      if (error || !data.session) setLoading(false);
    }).catch(() => { if (active && !authEventReceived) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    let active = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ external?: Record<string, boolean> }>;
      })
      .then((settings) => { if (active) setGoogleEnabled(settings?.external?.google === true); })
      .catch(() => { /* Email sign-in remains available if settings cannot be read. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    setLoading(true);
    setProfileError('');
    supabase.from('profiles').select('*').eq('id', sessionUserId).single()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile(data as Profile | null);
        if (error) setProfileError('Chưa tải được quyền tài khoản. Hãy kiểm tra kết nối rồi thử lại.');
        setLoading(false);
      }, () => { if (active) { setProfile(null); setProfileError('Chưa tải được quyền tài khoản. Hãy thử lại.'); setLoading(false); } });
    return () => { active = false; };
  }, [sessionUserId, profileAttempt]);

  const user: AppUser | null = session ? {
    id: session.user.id,
    email: session.user.email ?? '',
    display_name: profile?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Bạn',
    avatar_url: profile?.avatar_url ?? null,
    role: profile?.role ?? 'viewer',
  } : null;
  const isAdmin = !!session && profile?.id === session.user.id && profile.role === 'admin';
  const canContribute = isAdmin || (!!session && profile?.id === session.user.id && profile.role === 'contributor');

  const syncBookmarks = useCallback(async (): Promise<boolean> => {
    if (!sessionUserId) {
      setBookmarkSyncStatus('idle');
      setBookmarkSyncError('');
      return true;
    }
    setBookmarkSyncStatus('syncing');
    setBookmarkSyncError('');
    try {
      const pendingChanges = getPendingBookmarkChanges(sessionUserId);
      for (const change of pendingChanges.filter((item) => item.isSaved)) {
        const { error } = await supabase.from('user_favorites').upsert(
          { user_id: sessionUserId, restaurant_id: change.id },
          { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true },
        );
        if (error) throw error;
        clearBookmarkChange(sessionUserId, change.id, true);
      }
      for (const change of pendingChanges.filter((item) => !item.isSaved)) {
        const { error } = await supabase.from('user_favorites').delete()
          .eq('user_id', sessionUserId).eq('restaurant_id', change.id);
        if (error) throw error;
        clearBookmarkChange(sessionUserId, change.id, false);
      }
      const { data, error } = await supabase.from('user_favorites')
        .select('restaurant_id').eq('user_id', sessionUserId);
      if (error) throw error;
      const cloudIds = (data ?? []).map((row) => row.restaurant_id as string);
      const localIds = getBookmarks();
      const missingCloudIds = localIds.filter((id) => !cloudIds.includes(id));
      if (missingCloudIds.length) {
        const { error: saveError } = await supabase.from('user_favorites').upsert(
          missingCloudIds.map((restaurant_id) => ({ user_id: sessionUserId, restaurant_id })),
          { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true },
        );
        if (saveError) throw saveError;
      }
      if (activeUserId.current !== sessionUserId) return false;
      setBookmarks(mergeBookmarkIds(cloudIds, localIds));
      setBookmarkSyncStatus('synced');
      return true;
    } catch {
      if (activeUserId.current === sessionUserId) {
        setBookmarkSyncStatus('error');
        setBookmarkSyncError('Chưa đồng bộ được danh sách. Bản lưu trên thiết bị vẫn còn; hãy thử lại khi có mạng.');
      }
      return false;
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) {
      setBookmarkSyncStatus('idle');
      setBookmarkSyncError('');
      return;
    }
    void syncBookmarks();
  }, [sessionUserId, syncBookmarks]);

  useEffect(() => {
    if (!sessionUserId) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void syncBookmarks();
    };
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [sessionUserId, syncBookmarks]);

  useEffect(() => {
    const handleBookmarkUpdate = async (event: Event) => {
      if (!sessionUserId) return;
      const detail = (event as CustomEvent<{ id?: string; isSaved?: boolean; accountChanged?: boolean }>).detail;
      if (!detail?.id || detail.accountChanged) return;
      setBookmarkSyncStatus('syncing');
      queueBookmarkChange(sessionUserId, detail.id, detail.isSaved === true);
      try {
        const result = detail.isSaved
          ? await supabase.from('user_favorites').upsert(
            { user_id: sessionUserId, restaurant_id: detail.id },
            { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true },
          )
          : await supabase.from('user_favorites').delete().eq('user_id', sessionUserId).eq('restaurant_id', detail.id);
        if (activeUserId.current !== sessionUserId) return;
        if (result.error) throw result.error;
        clearBookmarkChange(sessionUserId, detail.id, detail.isSaved === true);
        setBookmarkSyncStatus('synced');
        setBookmarkSyncError('');
      } catch {
        if (activeUserId.current !== sessionUserId) return;
        setBookmarkSyncStatus('error');
        setBookmarkSyncError('Chưa đồng bộ được thay đổi. Bản lưu trên thiết bị vẫn còn; hãy thử lại khi có mạng.');
      }
    };
    window.addEventListener('food_hn_bookmarks_updated', handleBookmarkUpdate);
    return () => window.removeEventListener('food_hn_bookmarks_updated', handleBookmarkUpdate);
  }, [sessionUserId]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };
  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setActiveBookmarkAccount(null);
    setSession(null);
    setProfile(null);
  };
  return <AuthContext.Provider value={{ user, profile, session, loading, profileError, refreshProfile: () => setProfileAttempt(n => n + 1), signInWithGoogle, googleEnabled, signInWithEmail, signOut, isAdmin, isAuthenticated: !!session, canContribute, bookmarkSyncStatus, bookmarkSyncError, syncBookmarks }}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import type { Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  role: 'admin' | 'contributor' | 'viewer';
  isGuest?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signInAsGuest: (name: string, avatarEmoji?: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    // 1. Check Supabase session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const u: AppUser = {
          id: s.user.id,
          email: s.user.email ?? '',
          display_name:
            s.user.user_metadata?.full_name ||
            s.user.user_metadata?.name ||
            (s.user.email ? s.user.email.split('@')[0] : 'Người dùng'),
          avatar_url: s.user.user_metadata?.avatar_url ?? null,
          role: 'contributor',
          isGuest: false,
        };
        setUser(u);
        fetchProfile(s.user.id);
        setLoading(false);
      } else {
        // 2. Check localStorage guest session
        if (typeof window !== 'undefined') {
          const savedGuest = localStorage.getItem('food_review_guest_user');
          if (savedGuest) {
            try {
              const parsed = JSON.parse(savedGuest) as AppUser;
              setUser(parsed);
              setProfile({
                id: parsed.id,
                email: parsed.email,
                display_name: parsed.display_name,
                avatar_url: parsed.avatar_url ?? null,
                role: parsed.role,
                created_at: new Date().toISOString(),
              });
            } catch {}
          }
        }
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user) {
          const u: AppUser = {
            id: s.user.id,
            email: s.user.email ?? '',
            display_name:
              s.user.user_metadata?.full_name ||
              s.user.user_metadata?.name ||
              (s.user.email ? s.user.email.split('@')[0] : 'Người dùng'),
            avatar_url: s.user.user_metadata?.avatar_url ?? null,
            role: 'contributor',
            isGuest: false,
          };
          setUser(u);
          fetchProfile(s.user.id);
        } else {
          if (typeof window !== 'undefined') {
            const savedGuest = localStorage.getItem('food_review_guest_user');
            if (savedGuest) {
              try {
                const parsed = JSON.parse(savedGuest) as AppUser;
                setUser(parsed);
                setProfile({
                  id: parsed.id,
                  email: parsed.email,
                  display_name: parsed.display_name,
                  avatar_url: parsed.avatar_url ?? null,
                  role: parsed.role,
                  created_at: new Date().toISOString(),
                });
                return;
              } catch {}
            }
          }
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInAsGuest = (name: string, avatarEmoji?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    let guestId = '';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('food_review_guest_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id) guestId = parsed.id;
        } catch {}
      }
    }
    if (!guestId) {
      guestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
    }

    const guestUser: AppUser = {
      id: guestId,
      email: `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}@tamthoi.local`,
      display_name: trimmed,
      avatar_url: avatarEmoji || '🍜',
      role: 'contributor',
      isGuest: true,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('food_review_guest_user', JSON.stringify(guestUser));
    }
    setUser(guestUser);
    setProfile({
      id: guestUser.id,
      email: guestUser.email,
      display_name: guestUser.display_name,
      avatar_url: guestUser.avatar_url ?? null,
      role: guestUser.role,
      created_at: new Date().toISOString(),
    });
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('food_review_guest_user');
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signInAsGuest,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        isAdmin: profile?.role === 'admin',
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Compass, RotateCw, Plus, Cloud, CloudOff, FolderHeart, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { FavoriteCollection, Restaurant } from '@/lib/types';
import { getBookmarks, getDeviceBookmarks, mergeBookmarkIds, planBookmarkImport, setBookmarks } from '@/lib/bookmarks';
import { rememberPostLoginDestination } from '@/lib/authIntent';
import { rememberRestaurantReturn } from '@/lib/restaurantNavigation';
import { useAuth } from '@/components/AuthProvider';
import LoginModal from '@/components/LoginModal';
import RestaurantCard from '@/components/RestaurantCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

const CACHE_KEY = 'food_hn_cached_restaurants';
const COLLECTION_PRESETS = ['Muốn thử', 'Quán quen', 'Đi cùng bạn bè'];

function readDeviceCache(ids: string[]): Restaurant[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    if (!Array.isArray(rows)) return [];
    const byId = new Map((rows as Restaurant[]).filter((row) => row && typeof row.id === 'string').map((row) => [row.id, row]));
    return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  } catch {
    return [];
  }
}

export default function SavedPage() {
  const { user, isAuthenticated, bookmarkSyncStatus, bookmarkSyncError, syncBookmarks } = useAuth();
  const accountId = user?.id;
  const [ids, setIds] = useState<string[]>([]);
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [collections, setCollections] = useState<FavoriteCollection[]>([]);
  const [collectionItemIds, setCollectionItemIds] = useState<{ collection_id: string; restaurant_id: string }[]>([]);
  const [collectionRestaurants, setCollectionRestaurants] = useState<Restaurant[]>([]);
  const [collectionError, setCollectionError] = useState('');
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [remoteFavoriteIds, setRemoteFavoriteIds] = useState<string[]>([]);
  const [validDeviceRestaurants, setValidDeviceRestaurants] = useState<Restaurant[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);

  const syncIds = useCallback(() => {
    setIds(getBookmarks());
    setDeviceIds(getDeviceBookmarks());
  }, []);

  useEffect(() => {
    syncIds();
    window.addEventListener('food_hn_bookmarks_updated', syncIds);
    window.addEventListener('storage', syncIds);
    return () => {
      window.removeEventListener('food_hn_bookmarks_updated', syncIds);
      window.removeEventListener('storage', syncIds);
    };
  }, [syncIds]);

  useEffect(() => {
    if (ids.length === 0) {
      setRestaurants([]);
      setError(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);
    supabase.from('restaurants').select('*').in('id', ids).then(({ data, error: queryError }) => {
      if (!active) return;
      if (!queryError && data) {
        const byId = new Map((data as Restaurant[]).map((restaurant) => [restaurant.id, restaurant]));
        setRestaurants(ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
        setError(false);
      } else {
        const cached = readDeviceCache(ids);
        setRestaurants(cached);
        setError(cached.length === 0);
      }
      setLoading(false);
    }, () => {
      if (!active) return;
      const cached = readDeviceCache(ids);
      setRestaurants(cached);
      setError(cached.length === 0);
      setLoading(false);
    });

    return () => { active = false; };
  }, [ids, attempt]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setCollections([]);
      setCollectionItemIds([]);
      setCollectionRestaurants([]);
      setCollectionError('');
      return;
    }
    let active = true;
    const loadCollections = async () => {
      setCollectionError('');
      const [collectionResult, itemResult] = await Promise.all([
        supabase.from('favorite_collections').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('favorite_collection_items').select('collection_id,restaurant_id').eq('user_id', user.id),
      ]);
      if (!active) return;
      if (collectionResult.error || itemResult.error) {
        setCollectionError('Chưa tải được bộ sưu tập. Hãy thử lại khi có mạng.');
        return;
      }
      const nextCollections = (collectionResult.data ?? []) as FavoriteCollection[];
      const nextItems = (itemResult.data ?? []) as { collection_id: string; restaurant_id: string }[];
      setCollections(nextCollections);
      setCollectionItemIds(nextItems);
      const restaurantIds = [...new Set(nextItems.map((item) => item.restaurant_id))];
      if (!restaurantIds.length) { setCollectionRestaurants([]); return; }
      const restaurantResult = await supabase.from('restaurants').select('*').in('id', restaurantIds);
      if (active && !restaurantResult.error) setCollectionRestaurants((restaurantResult.data ?? []) as Restaurant[]);
    };
    void loadCollections().catch(() => { if (active) setCollectionError('Chưa tải được bộ sưu tập. Hãy thử lại khi có mạng.'); });
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  const openImport = useCallback(async () => {
    if (!accountId) {
      rememberPostLoginDestination('/saved?importDevice=1');
      setShowLogin(true);
      return;
    }
    setShowImport(true);
    window.history.replaceState(null, '', '/saved');
    setImportLoading(true);
    setImportError('');
    setImportSuccess(false);
    try {
      const [favoritesResult, restaurantsResult] = await Promise.all([
        supabase.from('user_favorites').select('restaurant_id').eq('user_id', accountId),
        deviceIds.length ? supabase.from('restaurants').select('*').in('id', deviceIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (favoritesResult.error) throw favoritesResult.error;
      if (restaurantsResult.error) throw restaurantsResult.error;
      const cloudIds = (favoritesResult.data ?? []).map((item) => item.restaurant_id as string);
      const validRestaurants = (restaurantsResult.data ?? []) as Restaurant[];
      const validIds = new Set(validRestaurants.map((restaurant) => restaurant.id));
      setRemoteFavoriteIds(cloudIds);
      setValidDeviceRestaurants(validRestaurants);
      setSelectedImportIds(planBookmarkImport(deviceIds, cloudIds, [...validIds]).importable);
    } catch {
      setImportError('Chưa thể đọc tài khoản hoặc danh sách trên thiết bị. Dữ liệu trên thiết bị vẫn được giữ nguyên.');
    } finally {
      setImportLoading(false);
    }
  }, [accountId, deviceIds]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!isAuthenticated || !accountId) return;
    if (query.get('importDevice') === '1') void openImport();
    else if (query.get('createCollection') === '1') {
      setCreateCollectionOpen(true);
      window.history.replaceState(null, '', '/saved');
    }
  }, [isAuthenticated, accountId, openImport]);

  const importRowsById = useMemo(() => new Map(validDeviceRestaurants.map((restaurant) => [restaurant.id, restaurant])), [validDeviceRestaurants]);
  const importPlan = useMemo(() => planBookmarkImport(deviceIds, remoteFavoriteIds, [...importRowsById.keys()]), [deviceIds, remoteFavoriteIds, importRowsById]);
  const importableIds = importPlan.importable;
  const duplicateCount = importPlan.duplicates.length;

  const importSelected = async () => {
    if (!user?.id || importBusy) return;
    setImportBusy(true);
    setImportError('');
    try {
      const chosen = selectedImportIds.filter((id) => importableIds.includes(id));
      if (chosen.length) {
        const { error: saveError } = await supabase.from('user_favorites').upsert(
          chosen.map((restaurant_id) => ({ user_id: user.id, restaurant_id })),
          { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true },
        );
        if (saveError) throw saveError;
      }
      setBookmarks(mergeBookmarkIds(getBookmarks(), remoteFavoriteIds, chosen));
      setImportSuccess(true);
      setIds(getBookmarks());
    } catch {
      setImportError('Chưa nhập được danh sách. Danh sách trên thiết bị chưa bị xóa; hãy thử lại.');
    } finally {
      setImportBusy(false);
    }
  };

  const createCollection = async (name = collectionName) => {
    const trimmed = name.trim();
    if (!trimmed || collectionBusy) return;
    if (!user?.id) {
      rememberPostLoginDestination('/saved?createCollection=1');
      setShowLogin(true);
      return;
    }
    setCollectionBusy(true);
    setCollectionError('');
    try {
      const { data, error: insertError } = await supabase.from('favorite_collections')
        .insert({ user_id: user.id, name: trimmed }).select('*').single();
      if (insertError) {
        setCollectionError(insertError.code === '23505' ? 'Bộ sưu tập này đã có trong tài khoản.' : 'Chưa tạo được bộ sưu tập. Dữ liệu hiện có vẫn còn.');
      } else if (data) {
        setCollections((current) => [...current, data as FavoriteCollection]);
        setCollectionName('');
        setCreateCollectionOpen(false);
        window.history.replaceState(null, '', '/saved');
      }
    } catch {
      setCollectionError('Chưa tạo được bộ sưu tập vì lỗi kết nối. Hãy thử lại.');
    } finally { setCollectionBusy(false); }
  };

  const addToCollection = async (collectionId: string, restaurantId: string) => {
    if (!user?.id) return;
    try {
      const { error: insertError } = await supabase.from('favorite_collection_items').upsert(
        { user_id: user.id, collection_id: collectionId, restaurant_id: restaurantId },
        { onConflict: 'collection_id,restaurant_id', ignoreDuplicates: true },
      );
      if (insertError) throw insertError;
      setCollectionItemIds((current) => current.some((item) => item.collection_id === collectionId && item.restaurant_id === restaurantId)
        ? current : [...current, { collection_id: collectionId, restaurant_id: restaurantId }]);
      setCollectionRestaurants((current) => current.some((restaurant) => restaurant.id === restaurantId)
        ? current : [...current, ...restaurants.filter((restaurant) => restaurant.id === restaurantId)]);
      toast.success('Đã thêm quán vào bộ sưu tập.');
    } catch { toast.error('Chưa thêm được quán vào bộ sưu tập.'); }
  };

  const removeFromCollection = async (collectionId: string, restaurantId: string) => {
    if (!user?.id) return;
    try {
      const { error: deleteError } = await supabase.from('favorite_collection_items').delete()
        .eq('user_id', user.id).eq('collection_id', collectionId).eq('restaurant_id', restaurantId);
      if (deleteError) throw deleteError;
      setCollectionItemIds((current) => current.filter((item) => !(item.collection_id === collectionId && item.restaurant_id === restaurantId)));
    } catch { toast.error('Chưa xóa được quán khỏi bộ sưu tập.'); }
  };

  const closeImport = () => {
    setShowImport(false);
    window.history.replaceState(null, '', '/saved');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-9">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-accent">SỔ TAY CỦA BẠN</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Quán đã lưu</h1>
          <p className="mt-2 max-w-xl text-sm text-text-secondary">{isAuthenticated ? 'Danh sách theo tài khoản, đồng bộ khi đăng nhập trên thiết bị khác.' : 'Danh sách này nằm trên thiết bị. Đăng nhập để đồng bộ hoặc nhập danh sách vào tài khoản.'}</p>
        </div>
        <Bookmark aria-hidden="true" size={24} className="mt-1 shrink-0 text-accent" />
      </header>

      {isAuthenticated ? <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        {bookmarkSyncStatus === 'error' ? <CloudOff size={18} className="text-accent-red" /> : <Cloud size={18} className="text-accent" />}
        <span className="flex-1 text-text-secondary">{bookmarkSyncError || (bookmarkSyncStatus === 'syncing' ? 'Đang đồng bộ với tài khoản…' : 'Danh sách tài khoản sẵn sàng đồng bộ.')}</span>
        {bookmarkSyncStatus === 'error' && <button type="button" onClick={() => void syncBookmarks()} className="btn-secondary min-h-11 px-3"><RotateCw size={14} />Thử lại</button>}
        <button type="button" onClick={() => void openImport()} className="btn-secondary min-h-11 px-3"><Plus size={14} />Nhập từ thiết bị</button>
      </div> : <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <CloudOff size={18} className="text-text-muted" /><span className="flex-1 text-text-secondary">Khách vẫn lưu được trên thiết bị này.</span>
        {deviceIds.length > 0 && <button type="button" onClick={() => void openImport()} className="btn-secondary min-h-11 px-3">Đăng nhập để đồng bộ</button>}
      </div>}

      <section className="mb-8 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="collections-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="collections-title" className="flex items-center gap-2 font-semibold"><FolderHeart size={18} className="text-accent" />Bộ sưu tập cá nhân</h2><p className="mt-1 text-xs text-text-secondary">{isAuthenticated ? 'Riêng tư trong tài khoản của bạn.' : 'Đăng nhập để tạo và đồng bộ bộ sưu tập.'}</p></div>
          <button type="button" onClick={() => {
            if (!isAuthenticated) {
              rememberPostLoginDestination('/saved?createCollection=1');
              setShowLogin(true);
              return;
            }
            setCreateCollectionOpen((open) => !open);
          }} className="btn-secondary min-h-11 px-3"><Plus size={15} />Tạo bộ sưu tập</button>
        </div>
        {createCollectionOpen && <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void createCollection(); }}>
          <label className="sr-only" htmlFor="new-collection-name">Tên bộ sưu tập</label>
          <input id="new-collection-name" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} maxLength={80} placeholder="VD: Quán muốn thử" className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
          <button type="submit" disabled={!collectionName.trim() || collectionBusy} className="btn-primary min-h-11 px-4 disabled:opacity-50">Lưu</button>
        </form>}
        {collectionError && <p role="alert" className="mb-3 text-sm text-accent-red">{collectionError}</p>}
        {isAuthenticated && collections.length === 0 && <div className="flex flex-wrap gap-2">{COLLECTION_PRESETS.map((name) => <button key={name} type="button" disabled={collectionBusy} onClick={() => void createCollection(name)} className="min-h-11 rounded-xl border border-border px-3 text-sm text-text-secondary hover:border-accent hover:text-accent">+ {name}</button>)}</div>}
        {collections.length > 0 && <div className="space-y-2">{collections.map((collection) => {
          const itemIds = collectionItemIds.filter((item) => item.collection_id === collection.id).map((item) => item.restaurant_id);
          const itemMap = new Map(collectionRestaurants.map((restaurant) => [restaurant.id, restaurant]));
          return <details key={collection.id} className="rounded-xl border border-border bg-background px-3 py-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{collection.name}<span className="ml-2 text-xs font-normal text-text-muted">{itemIds.length} quán</span></summary>
            {itemIds.length ? <ul className="space-y-1 border-t border-border py-2">{itemIds.map((restaurantId) => <li key={restaurantId} className="flex items-center justify-between gap-2 text-sm">
              {itemMap.has(restaurantId) ? <Link href={`/restaurant/${restaurantId}`} onClick={() => rememberRestaurantReturn(restaurantId)} className="text-text-secondary hover:text-accent">{itemMap.get(restaurantId)!.name}</Link> : <span className="text-text-muted">Quán không còn trong danh sách công khai</span>}
              <button type="button" onClick={() => void removeFromCollection(collection.id, restaurantId)} aria-label={`Xóa quán khỏi ${collection.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:text-accent-red"><X size={15} /></button>
            </li>)}</ul> : <p className="border-t border-border py-3 text-xs text-text-muted">Chưa có quán trong bộ sưu tập này.</p>}
          </details>;
        })}</div>}
      </section>

      {loading ? <SkeletonGrid count={4} /> : error ? (
        <section className="state-panel" role="alert">
          <h2 className="text-lg font-semibold text-foreground">Chưa tải được quán đã lưu</h2>
          <p className="mt-2 text-sm text-text-secondary">Hãy thử lại khi có kết nối. Các mã quán vẫn còn trên thiết bị này.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="btn-primary mt-5 inline-flex items-center gap-2"><RotateCw size={16} />Thử lại</button>
        </section>
      ) : restaurants.length === 0 ? (
        <section className="state-panel">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-accent"><Bookmark size={22} /></div>
          <h2 className="text-lg font-semibold text-foreground">Chưa có quán nào được lưu</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">Bấm nút lưu trên thẻ quán để tạo danh sách riêng trên thiết bị này.</p>
          <Link href="/" className="btn-primary mt-5 inline-flex items-center gap-2"><Compass size={16} />Khám phá quán</Link>
        </section>
      ) : <>
        <p className="mb-4 text-sm text-text-secondary">{restaurants.length} quán đã lưu</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{restaurants.map((restaurant) => <div key={restaurant.id} className="space-y-2">
          <RestaurantCard restaurant={restaurant} />
          {isAuthenticated && collections.length > 0 && <label className="flex items-center gap-2 text-xs text-text-secondary">Thêm vào bộ sưu tập
            <select aria-label={`Thêm ${restaurant.name} vào bộ sưu tập`} defaultValue="" onChange={(event) => { if (event.target.value) void addToCollection(event.target.value, restaurant.id); event.target.value = ''; }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-foreground">
              <option value="">Chọn bộ sưu tập</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
          </label>}
        </div>)}</div>
      </>}

      {showImport && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={closeImport}>
        <section role="dialog" aria-modal="true" aria-labelledby="import-title" className="glass-card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><h2 id="import-title" className="text-lg font-bold">Nhập danh sách trên thiết bị</h2><p className="mt-1 text-sm text-text-secondary">Chọn quán để sao chép vào tài khoản. Danh sách thiết bị sẽ không bị xóa.</p></div><button type="button" aria-label="Đóng nhập danh sách" onClick={closeImport} className="flex h-11 w-11 items-center justify-center rounded-lg"><X size={18} /></button></div>
          {importLoading ? <p role="status" className="py-6 text-sm text-text-secondary">Đang kiểm tra trùng và tải quán…</p> : importError ? <p role="alert" className="py-4 text-sm text-accent-red">{importError}</p> : <>
            <p className="mt-4 text-xs text-text-secondary">{duplicateCount} quán đã có trong tài khoản; các mục trùng sẽ được bỏ qua. {importPlan.unavailable.length} mục không còn khả dụng sẽ được giữ nguyên trên thiết bị.</p>
            <div className="my-3 flex gap-2"><button type="button" onClick={() => setSelectedImportIds(importableIds)} className="min-h-11 rounded-lg border border-border px-3 text-xs">Chọn tất cả mục mới</button><button type="button" onClick={() => setSelectedImportIds([])} className="min-h-11 rounded-lg border border-border px-3 text-xs">Bỏ chọn</button></div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">{deviceIds.map((id) => {
              const restaurant = importRowsById.get(id) ?? readDeviceCache([id])[0];
              const duplicate = remoteFavoriteIds.includes(id);
              const missing = !importRowsById.has(id);
              return <li key={id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-1 text-sm">
                <input type="checkbox" aria-label={`Chọn ${restaurant?.name ?? id} để nhập`} disabled={duplicate || missing} checked={selectedImportIds.includes(id)} onChange={(event) => setSelectedImportIds((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} className="h-4 w-4 accent-accent" />
                <span className="flex-1">{restaurant?.name ?? 'Quán không còn khả dụng'}</span><span className="text-xs text-text-muted">{duplicate ? 'Đã có' : missing ? 'Không tải được' : ''}</span>
              </li>;
            })}</ul>
            {importSuccess && <p role="status" className="mt-3 text-sm text-accent">Đã nhập lựa chọn. Danh sách trên thiết bị vẫn được giữ lại.</p>}
            {importError && <p role="alert" className="mt-3 text-sm text-accent-red">{importError}</p>}
          </>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={closeImport} className="btn-secondary min-h-11 px-4">Đóng</button><button type="button" disabled={importLoading || importBusy || !selectedImportIds.length} onClick={() => void importSelected()} className="btn-primary min-h-11 px-4 disabled:opacity-50">{importBusy ? 'Đang nhập…' : `Nhập ${selectedImportIds.length} quán`}</button></div>
        </section>
      </div>}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}

const PENDING_AUTH_DESTINATION = 'foodhn:pending-auth-destination';
const ALLOWED_DESTINATIONS = new Set([
  '/restaurant/new',
  '/saved?importDevice=1',
  '/saved?createCollection=1',
]);

export function rememberPostLoginDestination(destination: string): void {
  if (typeof window === 'undefined' || !ALLOWED_DESTINATIONS.has(destination)) return;
  try { localStorage.setItem(PENDING_AUTH_DESTINATION, destination); } catch { /* Login can still proceed. */ }
}

export function consumePostLoginDestination(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const destination = localStorage.getItem(PENDING_AUTH_DESTINATION);
    localStorage.removeItem(PENDING_AUTH_DESTINATION);
    return destination && ALLOWED_DESTINATIONS.has(destination) ? destination : null;
  } catch {
    return null;
  }
}

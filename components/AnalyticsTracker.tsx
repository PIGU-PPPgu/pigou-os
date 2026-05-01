'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/ops')) return;
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const payload = JSON.stringify({
      path,
      title: document.title,
      referrer: document.referrer
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
      return;
    }

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}

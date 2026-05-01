import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

export type AnalyticsEvent = {
  id: string;
  kind: 'pageview';
  path: string;
  title?: string;
  referrer?: string;
  visitorId: string;
  userAgent?: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  isOwner: boolean;
  createdAt: string;
};

export type AnalyticsSummary = {
  generatedAt: string;
  totalPageviews: number;
  visitorCount: number;
  pageviews24h: number;
  visitors24h: number;
  pageviews7d: number;
  visitors7d: number;
  ownerPageviews: number;
  publicPageviews: number;
  topPages: { path: string; views: number; visitors: number }[];
  referrers: { referrer: string; views: number }[];
  devices: { device: AnalyticsEvent['device']; views: number }[];
  daily: { date: string; views: number; visitors: number }[];
  recent: AnalyticsEvent[];
};

function analyticsDir() {
  return path.join(process.cwd(), 'content', 'analytics');
}

function eventsPath() {
  return path.join(analyticsDir(), 'events.jsonl');
}

function sha(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function visitorFromRequest(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const daySalt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  return sha(`${daySalt}:${ip}:${userAgent}`).slice(0, 20);
}

function deviceFromUserAgent(userAgent = ''): AnalyticsEvent['device'] {
  const ua = userAgent.toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|spider|crawler|slurp|bingpreview|facebookexternalhit|telegrambot/.test(ua)) return 'bot';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function cleanPath(input: unknown) {
  if (typeof input !== 'string') return '/';
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(input, 'https://pigou.local');
    return `${url.pathname}${url.search}`.slice(0, 240) || '/';
  } catch {
    return input.startsWith('/') ? input.slice(0, 240) : '/';
  }
}

function safeText(input: unknown, limit = 240) {
  return typeof input === 'string' ? input.replace(/\s+/g, ' ').trim().slice(0, limit) : undefined;
}

export async function recordPageview(input: { request: Request; path: unknown; title?: unknown; referrer?: unknown; isOwner: boolean }) {
  assertDurableLocalWrites();
  await fsp.mkdir(analyticsDir(), { recursive: true });
  const userAgent = safeText(input.request.headers.get('user-agent'), 500);
  const event: AnalyticsEvent = {
    id: randomUUID(),
    kind: 'pageview',
    path: cleanPath(input.path),
    title: safeText(input.title),
    referrer: safeText(input.referrer, 500),
    visitorId: visitorFromRequest(input.request),
    userAgent,
    device: deviceFromUserAgent(userAgent),
    isOwner: input.isOwner,
    createdAt: new Date().toISOString()
  };
  await fsp.appendFile(eventsPath(), `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

export function getAnalyticsEvents(limit = 5000) {
  const file = eventsPath();
  if (!fs.existsSync(file)) return [] as AnalyticsEvent[];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map(line => {
    try {
      return JSON.parse(line) as AnalyticsEvent;
    } catch {
      return null;
    }
  }).filter((event): event is AnalyticsEvent => Boolean(event?.path && event.createdAt));
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

function increment<K extends string>(map: Map<K, number>, key: K, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function hostFromReferrer(referrer?: string) {
  if (!referrer) return 'direct';
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return 'unknown';
  }
}

export function summarizeAnalytics(events = getAnalyticsEvents()): AnalyticsSummary {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const publicEvents = events.filter(event => !event.isOwner && event.device !== 'bot');
  const within24 = publicEvents.filter(event => now - Date.parse(event.createdAt) <= day);
  const within7d = publicEvents.filter(event => now - Date.parse(event.createdAt) <= day * 7);
  const visitors = new Set(publicEvents.map(event => event.visitorId));
  const visitors24h = new Set(within24.map(event => event.visitorId));
  const visitors7d = new Set(within7d.map(event => event.visitorId));

  const pageViews = new Map<string, number>();
  const pageVisitors = new Map<string, Set<string>>();
  const referrers = new Map<string, number>();
  const devices = new Map<AnalyticsEvent['device'], number>();
  const dailyViews = new Map<string, number>();
  const dailyVisitors = new Map<string, Set<string>>();

  for (const event of publicEvents) {
    increment(pageViews, event.path);
    if (!pageVisitors.has(event.path)) pageVisitors.set(event.path, new Set());
    pageVisitors.get(event.path)?.add(event.visitorId);
    increment(referrers, hostFromReferrer(event.referrer));
    increment(devices, event.device);
    const key = dateKey(new Date(event.createdAt));
    increment(dailyViews, key);
    if (!dailyVisitors.has(key)) dailyVisitors.set(key, new Set());
    dailyVisitors.get(key)?.add(event.visitorId);
  }

  const recentDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now - (13 - index) * day);
    const key = dateKey(date);
    return { date: key, views: dailyViews.get(key) || 0, visitors: dailyVisitors.get(key)?.size || 0 };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalPageviews: publicEvents.length,
    visitorCount: visitors.size,
    pageviews24h: within24.length,
    visitors24h: visitors24h.size,
    pageviews7d: within7d.length,
    visitors7d: visitors7d.size,
    ownerPageviews: events.filter(event => event.isOwner).length,
    publicPageviews: publicEvents.length,
    topPages: Array.from(pageViews.entries())
      .map(([pagePath, views]) => ({ path: pagePath, views, visitors: pageVisitors.get(pagePath)?.size || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    referrers: Array.from(referrers.entries()).map(([referrer, views]) => ({ referrer, views })).sort((a, b) => b.views - a.views).slice(0, 8),
    devices: Array.from(devices.entries()).map(([device, views]) => ({ device, views })).sort((a, b) => b.views - a.views),
    daily: recentDays,
    recent: publicEvents.slice(-25).reverse()
  };
}

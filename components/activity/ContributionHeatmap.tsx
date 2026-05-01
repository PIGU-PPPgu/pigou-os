'use client';

import { useMemo, useState } from 'react';
import type { ContributionDay } from '@/lib/data';

type Mode = 'day' | 'week' | 'month';

function level(count: number) {
  if (count <= 0) return 'bg-[var(--surface-soft)]';
  if (count < 2) return 'bg-green-950';
  if (count < 4) return 'bg-green-800';
  if (count < 8) return 'bg-green-600';
  return 'bg-green-400';
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function groupByWeek(days: ContributionDay[]) {
  const weeks: ContributionDay[][] = [];
  days.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    weeks[weekIndex] ||= [];
    weeks[weekIndex].push(day);
  });
  return weeks.map(week => ({ date: week[0]?.date ?? '', count: week.reduce((sum, day) => sum + day.count, 0) }));
}

function groupByMonth(days: ContributionDay[]) {
  const map = new Map<string, { date: string; count: number }>();
  days.forEach(day => {
    const key = day.date.slice(0, 7);
    const current = map.get(key) ?? { date: `${key}-01`, count: 0 };
    current.count += day.count;
    map.set(key, current);
  });
  return Array.from(map.values());
}

export function ContributionHeatmap({ days, total }: { days: ContributionDay[]; total: number }) {
  const [mode, setMode] = useState<Mode>('day');
  const cells = useMemo(() => {
    if (mode === 'week') return groupByWeek(days);
    if (mode === 'month') return groupByMonth(days);
    return days;
  }, [days, mode]);

  const columns = mode === 'day' ? 'repeat(53, minmax(0, 1fr))' : mode === 'week' ? 'repeat(27, minmax(0, 1fr))' : 'repeat(12, minmax(0, 1fr))';
  const rows = mode === 'day' ? 7 : 1;

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-2xl font-semibold leading-tight text-[var(--ink)]">{total} contributions</div>
        <div className="caption mt-1">GitHub / 最近一年</div>
      </div>
      <div className="inline-flex rounded-full border border-[var(--border-visible)] bg-white/45 p-1">
        {(['day', 'week', 'month'] as Mode[]).map(item => <button key={item} type="button" onClick={() => setMode(item)} className={`mono rounded-full px-3 py-1.5 text-[10px] uppercase transition ${mode === item ? 'bg-[var(--ink)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--ink)]'}`}>{item === 'day' ? '日' : item === 'week' ? '周' : '月'}</button>)}
      </div>
    </div>
    <div className="overflow-x-auto">
      <div className="grid min-w-[680px] gap-1" style={{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${rows}, 10px)` }}>
        {cells.map((cell, index) => <span key={`${cell.date}-${index}`} title={`${cell.date}: ${cell.count}`} className={`h-2.5 rounded-[2px] ${level(cell.count)}`} />)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="caption">{days[0] ? monthLabel(days[0].date) : ''} - {days.at(-1) ? monthLabel(days.at(-1)!.date) : ''}</div>
      <div className="flex items-center gap-2"><span className="caption">Less</span>{[0,1,3,6,10].map(item => <span key={item} className={`h-3 w-3 rounded-[2px] ${level(item)}`} />)}<span className="caption">More</span></div>
    </div>
  </div>;
}

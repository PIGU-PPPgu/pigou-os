'use client';

import { useState } from 'react';

type GalleryImage = { src: string; alt: string; public?: boolean };

export function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState<GalleryImage | null>(null);

  return <>
    <div className="grid gap-4 lg:grid-cols-2">
      {images.map((image, index) => <button key={image.src} type="button" onClick={() => setActive(image)} className={`group overflow-hidden rounded-[8px] border border-[var(--border)] bg-white text-left transition hover:-translate-y-0.5 hover:border-[var(--ink)] ${index === 0 ? 'lg:col-span-2' : ''}`}>
        <img src={image.src} alt={image.alt} className={`${index === 0 ? 'h-[420px]' : 'h-72'} w-full object-contain bg-[var(--surface-soft)] p-3 transition duration-300 group-hover:scale-[1.015]`} />
        <span className="caption block border-t border-[var(--border)] px-3 py-2">{image.alt}</span>
      </button>)}
    </div>
    {active && <div className="fixed inset-0 z-50 grid place-items-center bg-black/82 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
      <button type="button" className="absolute right-4 top-4 mono rounded-full border border-white/30 px-4 py-2 text-[11px] uppercase text-white/80">关闭</button>
      <figure className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[8px] border border-white/20 bg-[#10100f]" onClick={(event) => event.stopPropagation()}>
        <img src={active.src} alt={active.alt} className="max-h-[82vh] w-full object-contain" />
        <figcaption className="caption border-t border-white/15 px-4 py-3 text-white/60">{active.alt}</figcaption>
      </figure>
    </div>}
  </>;
}

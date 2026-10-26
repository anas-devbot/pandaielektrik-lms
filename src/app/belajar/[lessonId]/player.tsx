"use client";
import { useEffect, useRef, useState } from "react";

// Lapisan provider: hanya YouTube dilaksanakan (CLAUDE.md bahagian 3; tukar ke Bunny/Cloudflare Stream kelak).
// Watermark ialah deterrent sosial, bukan perlindungan sebenar.
type YTPlayer = { getCurrentTime(): number; destroy(): void };
type YTApi = { Player: new (el: HTMLElement, o: unknown) => YTPlayer; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } };
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

const INTERVAL_MS = 5000;

export default function Player(props: { lessonId: string; provider: string; videoRef: string; duration: number; watermark: string; initialWatched: number; initialDone: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [watched, setWatched] = useState(props.initialWatched);
  const [done, setDone] = useState(props.initialDone);
  const [closed, setClosed] = useState(false);
  const [wm, setWm] = useState({ top: 10, left: 10 });

  useEffect(() => {
    const t = setInterval(() => setWm({ top: 5 + Math.random() * 80, left: 5 + Math.random() * 60 }), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (props.provider !== "youtube" || !host.current) return;
    let player: YTPlayer | undefined, timer: ReturnType<typeof setInterval> | undefined, dead = false;

    const beat = async () => {
      if (!player) return;
      try {
        const r = await fetch("/api/progress/heartbeat", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonId: props.lessonId, position: Math.floor(player.getCurrentTime()) }) });
        if (r.status === 403) { setClosed(true); return; }
        if (r.ok) { const d = await r.json(); setWatched(d.watched); setDone(!!d.completed); }
      } catch { /* rangkaian: heartbeat seterusnya cuba lagi */ }
    };
    const create = () => {
      if (dead || !window.YT || !host.current) return;
      const el = document.createElement("div"); host.current.appendChild(el);
      player = new window.YT.Player(el, {
        videoId: props.videoRef, width: "100%", playerVars: { rel: 0, modestbranding: 1 },
        events: { onStateChange: (e: { data: number }) => {
          const S = window.YT!.PlayerState;
          if (timer) { clearInterval(timer); timer = undefined; }
          if (e.data === S.PLAYING) { beat(); timer = setInterval(beat, INTERVAL_MS); }
          else if (e.data === S.PAUSED || e.data === S.ENDED) beat();
        } },
      });
    };
    if (window.YT?.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
      }
    }
    return () => { dead = true; if (timer) clearInterval(timer); player?.destroy(); };
  }, [props.provider, props.videoRef, props.lessonId]);

  if (props.provider !== "youtube") return <p className="mt-4">Penyedia video &quot;{props.provider}&quot; belum disokong.</p>;
  const pct = Math.min(100, Math.round((watched / props.duration) * 100));
  return (
    <div className="mt-4">
      <div className="relative aspect-video w-full bg-black">
        <div ref={host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
        <span aria-hidden className="pointer-events-none absolute select-none text-xs text-white/40 transition-all duration-1000"
          style={{ top: `${wm.top}%`, left: `${wm.left}%` }}>{props.watermark}</span>
      </div>
      {closed ? <p role="status" className="mt-2 text-sm text-red-600">Akses telah tamat. Kemajuan tidak lagi direkod.</p>
        : <p role="status" className="mt-2 text-sm">Kemajuan: {pct}% saat unik ditonton{done ? " · Selesai" : ""}</p>}
    </div>
  );
}

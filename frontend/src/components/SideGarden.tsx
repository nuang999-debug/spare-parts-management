import { useEffect, useRef, useState } from "react";

/* A little night camp in the empty middle of the side menu: starry sky, moon, mountains, a tent and
   a crackling campfire with fireflies, plus a seasonal layer that changes with the Thai calendar
   (Loy Krathong lanterns, New Year snow and fireworks, Songkran water splashes, otherwise the odd
   shooting star). In front, a grey cat peeks over a bush (its eyes follow the mouse) and a black
   rabbit hops on the grass.
   Both pets pop out and wave/jump whenever the menu is collapsed or expanded, and fall asleep
   after a while without any mouse/keyboard activity. Purely decorative: aria-hidden, no pointer
   events, frozen under prefers-reduced-motion (see .sg-* in redesign.css). */

const IDLE_MS = 2 * 60 * 1000;
const POP_MS = 1800;
const EYE_L = { x: 43, y: 77 };
const EYE_R = { x: 57, y: 77 };
/** The garden strip (designed on a 200x140 box) sits at the bottom of a taller 200x360 scene. */
const GROUND_Y = 220;

type Season =
  | "chinesenewyear"
  | "valentine"
  | "songkran"
  | "mothersday"
  | "halloween"
  | "loykrathong"
  | "newyear"
  | "plain";
const SEASONS: Season[] = ["chinesenewyear", "valentine", "songkran", "mothersday", "halloween", "loykrathong", "newyear", "plain"];

/** Chinese New Year's day (lunar, so it moves every year), as [month, day]. */
const CHINESE_NEW_YEAR: Record<number, [number, number]> = {
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8],
  2036: [1, 28],
};

/** From a week before Chinese New Year to ten days after it (when the year is in the table). */
function isChineseNewYear(d: Date): boolean {
  const cny = CHINESE_NEW_YEAR[d.getFullYear()];
  if (!cny) return false;
  const day = new Date(d.getFullYear(), cny[0] - 1, cny[1]).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const DAY = 864e5;
  return t >= day - 7 * DAY && t <= day + 10 * DAY;
}

/** Which seasonal layer to show for a date. `?season=` in the URL overrides it (for previewing). */
function seasonFor(d: Date): Season {
  const forced = new URLSearchParams(window.location.search).get("season");
  if (forced && (SEASONS as string[]).includes(forced)) return forced as Season;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // Valentine's own days win over Chinese New Year when the two overlap in February.
  if (m === 2 && day >= 12 && day <= 14) return "valentine";
  if (isChineseNewYear(d)) return "chinesenewyear";
  if (m === 2 && day >= 8 && day <= 11) return "valentine";
  if (m === 8 && day >= 5 && day <= 12) return "mothersday";
  if (m === 10 && day >= 24) return "halloween";
  if ((m === 10 && day >= 15) || m === 11) return "loykrathong";
  if ((m === 12 && day >= 15) || (m === 1 && day <= 7)) return "newyear";
  if (m === 4 && day <= 20) return "songkran";
  return "plain";
}

function SeasonLayer({ season }: { season: Season }) {
  if (season === "chinesenewyear") {
    return (
      <g className="sg-season">
        <path d="M-4 18 Q100 44 204 18" stroke="#A32D2D" strokeWidth="1.4" fill="none" />
        {[
          [34, 26, 0],
          [100, 32, -1],
          [166, 26, -2],
        ].map(([x, y, delay], i) => (
          <g key={i} className="sg-cny-lantern" style={{ animationDelay: `${delay}s` }}>
            <g transform={`translate(${x} ${y})`}>
              <line x1="0" y1="0" x2="0" y2="6" stroke="#A32D2D" />
              <ellipse cx="0" cy="16" rx="12" ry="11" className="sg-glow" />
              <rect x="-6" y="5" width="12" height="3" rx="1" fill="#BA7517" />
              <ellipse cx="0" cy="16" rx="10" ry="9" fill="#E24B4A" stroke="#A32D2D" />
              <path d="M-4 8 q-2 8 0 16 M4 8 q2 8 0 16 M0 7 v18" stroke="#A32D2D" strokeWidth=".8" fill="none" />
              <rect x="-6" y="24" width="12" height="3" rx="1" fill="#BA7517" />
              <path d="M-2 27 v8 M0 27 v10 M2 27 v8" stroke="#EF9F27" strokeWidth="1" />
            </g>
          </g>
        ))}
        {[24, 62, 118, 150, 184].map((x, i) =>
          i % 2 ? (
            <circle key={x} className="sg-coin" cx={x} cy="-8" r="3" fill="#FAC775" stroke="#BA7517" style={{ animationDelay: `${-i * 1.7}s` }} />
          ) : (
            <g key={x} className="sg-coin" style={{ animationDelay: `${-i * 1.7}s` }}>
              <rect x={x - 4} y="-14" width="8" height="11" rx="1.2" fill="#E24B4A" stroke="#A32D2D" />
              <rect x={x - 2} y="-10" width="4" height="3" rx=".6" fill="#FAC775" />
            </g>
          )
        )}
      </g>
    );
  }
  if (season === "loykrathong") {
    return (
      <g className="sg-season">
        {[
          [30, 0],
          [96, -3.5],
          [150, -7],
          [66, -10.5],
        ].map(([x, delay], i) => (
          <g key={i} className="sg-lantern" style={{ animationDelay: `${delay}s` }}>
            <g transform={`translate(${x} 300)`}>
              <ellipse cx="7" cy="2" rx="9" ry="5" className="sg-glow" />
              <path d="M0 0 h14 l-2 -16 h-10 Z" fill={i % 2 ? "#F0997B" : "#EF9F27"} />
              <ellipse cx="7" cy="0" rx="4" ry="2" fill="#FAC775" />
            </g>
          </g>
        ))}
      </g>
    );
  }
  if (season === "valentine") {
    return (
      <g className="sg-season">
        {[
          [26, 0, "#ED93B1"],
          [70, -2.2, "#E24B4A"],
          [112, -4.4, "#F4C0D1"],
          [154, -6.6, "#E24B4A"],
          [186, -8.8, "#ED93B1"],
        ].map(([x, delay, c], i) => (
          <g key={i} className="sg-heart" style={{ animationDelay: `${delay}s` }}>
            <path
              transform={`translate(${x} 300) scale(${i % 2 ? 0.8 : 1})`}
              d="M0 4 C-7 -3 -14 4 0 13 C14 4 7 -3 0 4 Z"
              fill={String(c)}
            />
          </g>
        ))}
      </g>
    );
  }
  if (season === "mothersday") {
    return (
      <g className="sg-season">
        <path d="M-4 16 Q100 40 204 16" stroke="#C0DD97" strokeWidth="1.2" fill="none" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = i * 16 + 4;
          const y = 16 + Math.sin((x / 200) * Math.PI) * 13;
          return <circle key={i} cx={x} cy={y} r="3.2" fill="#FFFFFF" stroke="#D3D1C7" strokeWidth=".6" />;
        })}
        {[18, 54, 96, 138, 178].map((x, i) => (
          <g key={x} className="sg-jasmine" style={{ animationDelay: `${-i * 1.6}s` }}>
            <g transform={`translate(${x} -6)`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-3" rx="1.8" ry="3" fill="#FFFFFF" transform={`rotate(${a})`} />
              ))}
              <circle r="1.3" fill="#FAC775" />
            </g>
          </g>
        ))}
      </g>
    );
  }
  if (season === "halloween") {
    return (
      <g className="sg-season">
        {[0, -5].map((delay, i) => (
          <g key={i} className="sg-bat" style={{ animationDelay: `${delay}s` }}>
            <g transform={`translate(0 ${i ? 150 : 100})`}>
              <g className="sg-bat-wing">
                <path d="M0 0 q-6 -6 -14 -2 q4 2 4 6 q-4 0 -6 4 q8 -2 16 -8 Z" fill="#2C2C2A" />
                <path d="M0 0 q6 -6 14 -2 q-4 2 -4 6 q4 0 6 4 q-8 -2 -16 -8 Z" fill="#2C2C2A" />
              </g>
              <circle cx="0" cy="1" r="3" fill="#2C2C2A" />
            </g>
          </g>
        ))}
      </g>
    );
  }
  if (season === "newyear") {
    return (
      <g className="sg-season">
        <g className="sg-sleigh">
          <g transform="translate(0 112)">
            <path d="M18 8 q8 -6 16 0" stroke="#854F0B" strokeWidth="1.2" fill="none" />
            <ellipse cx="44" cy="8" rx="8" ry="4" fill="#854F0B" />
            <path d="M48 5 l3 -6 M50 5 l4 -4 M51 -1 l3 0" stroke="#5F3E1C" strokeWidth="1" />
            <circle cx="52" cy="7" r="1.4" fill="#E24B4A" />
            <path d="M38 11 v5 M48 11 v5" stroke="#854F0B" strokeWidth="1.2" />
            <line x1="22" y1="8" x2="36" y2="8" stroke="#BA7517" strokeWidth=".8" />
            <path d="M0 4 h20 q2 8 -6 10 h-12 q-6 -2 -4 -10 Z" fill="#E24B4A" stroke="#A32D2D" />
            <path d="M-2 15 h22" stroke="#FAC775" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="9" cy="-1" r="5" fill="#FAEEDA" />
            <path d="M4 -2 q5 8 10 0" fill="#fff" />
            <path d="M4 -3 l5 -8 l5 8 Z" fill="#E24B4A" />
            <circle cx="9" cy="-11" r="1.6" fill="#fff" />
            <rect x="12" y="-2" width="8" height="7" rx="1" fill="#97C459" />
          </g>
        </g>
        {[14, 40, 70, 98, 126, 152, 182].map((x, i) => (
          <circle key={x} className="sg-snow" cx={x} cy="-6" r={i % 2 ? 1.6 : 2.2} fill="#fff" style={{ animationDelay: `${-i * 1.3}s` }} />
        ))}
        {[
          [52, 70, "#F09595", 0],
          [146, 44, "#FAC775", -1.6],
          [104, 110, "#AFA9EC", -3.2],
        ].map(([x, y, c, delay], i) => (
          <g key={i} className="sg-firework" style={{ animationDelay: `${delay}s` }}>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k / 8) * Math.PI * 2;
              return (
                <line
                  key={k}
                  x1={Number(x) + Math.cos(a) * 4}
                  y1={Number(y) + Math.sin(a) * 4}
                  x2={Number(x) + Math.cos(a) * 12}
                  y2={Number(y) + Math.sin(a) * 12}
                  stroke={String(c)}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        ))}
      </g>
    );
  }
  if (season === "songkran") {
    return (
      <g className="sg-season">
        {[20, 58, 92, 130, 170].map((x, i) => (
          <path
            key={x}
            className="sg-splash"
            d={`M${x} 0 q2 4 0 6 q-2 -2 0 -6`}
            fill="#85B7EB"
            style={{ animationDelay: `${-i * 0.7}s` }}
          />
        ))}
      </g>
    );
  }
  return (
    <g className="sg-season">
      <line className="sg-shooting" x1="170" y1="30" x2="186" y2="22" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

export default function SideGarden({ collapsed }: { collapsed: boolean }) {
  const [popping, setPopping] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const catRef = useRef<SVGGElement>(null);
  const leftPupil = useRef<SVGCircleElement>(null);
  const rightPupil = useRef<SVGCircleElement>(null);
  const [season] = useState(() => seasonFor(new Date()));

  // pop out on first show and every time the menu is collapsed/expanded
  useEffect(() => {
    setPopping(true);
    setAsleep(false);
    const t = setTimeout(() => setPopping(false), POP_MS);
    return () => clearTimeout(t);
  }, [collapsed]);

  // fall asleep when idle; any activity wakes both pets. Checked on a short interval against the
  // last activity time rather than one long timeout, which browsers may delay or drop for
  // background/throttled tabs.
  useEffect(() => {
    let last = Date.now();
    const wake = () => {
      last = Date.now();
      setAsleep(false);
    };
    const check = setInterval(() => {
      if (Date.now() - last >= IDLE_MS) setAsleep(true);
    }, 5000);
    const events = ["mousemove", "keydown", "pointerdown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearInterval(check);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  // the cat's eyes follow the mouse (moved directly on the SVG, no re-render per mouse move)
  useEffect(() => {
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cat = catRef.current;
        if (!cat || !leftPupil.current || !rightPupil.current) return;
        const r = cat.getBoundingClientRect();
        if (!r.width) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        const k = Math.min(2, d / 40);
        const ox = (dx / d) * k;
        const oy = (dy / d) * k;
        leftPupil.current.setAttribute("cx", String(EYE_L.x + ox));
        leftPupil.current.setAttribute("cy", String(EYE_L.y + oy));
        rightPupil.current.setAttribute("cx", String(EYE_R.x + ox));
        rightPupil.current.setAttribute("cy", String(EYE_R.y + oy));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className={`side-garden${asleep ? " sg-sleep" : ""}`} aria-hidden>
      {/* Collapsed menu: a tall, narrow window on the cat's column (the sky extends above the scene for it),
          so the night sky still fills the whole icon rail. */}
      <svg
        className="sg-scene"
        viewBox={collapsed ? "28 -140 44 500" : "0 0 200 360"}
        preserveAspectRatio={collapsed ? "xMidYMax meet" : "xMidYMax slice"}
        focusable="false"
      >
        <defs>
          <linearGradient id="sg-night" x1="0" y1="0" x2="0" y2="1">
            {/* fully transparent at the top of the visible scene so it melts into the menu, any theme */}
            <stop offset="0" stopColor="#0b1a33" stopOpacity="0" />
            <stop offset="0.36" stopColor="#0b1a33" stopOpacity="0" />
            <stop offset="0.56" stopColor="#0f2547" stopOpacity="0.4" />
            <stop offset="0.8" stopColor="#0f2547" stopOpacity="0.8" />
            <stop offset="1" stopColor="#1e3a5f" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect y="-200" width="200" height="560" fill="url(#sg-night)" />
        {[
          [22, 60, 1.3],
          [64, 40, 1],
          [104, 90, 1.2],
          [140, 30, 1],
          [36, 130, 1],
          [178, 116, 1.2],
          [12, 190, 1],
          [120, 170, 1],
          [70, 220, 0.9],
        ].map(([x, y, r], i) => (
          <circle key={i} className={`sg-star${i % 2 ? " sg-star-b" : ""}`} cx={x} cy={y} r={r} fill="#fff" />
        ))}
        {/* crescent cut with a mask, so it reads as a moon on any sky colour (light themes included) */}
        <mask id="sg-moon-cut">
          <rect x="140" y="60" width="40" height="40" fill="#fff" />
          <circle cx="164" cy="73" r="13" fill="#000" />
        </mask>
        <circle cx="158" cy="78" r="15" fill="#FAEEDA" mask="url(#sg-moon-cut)" />
        <SeasonLayer season={season} />
        <path d="M0 340 L0 300 L36 262 L64 292 L100 246 L140 290 L170 266 L200 296 L200 340 Z" fill="#1e293b" />
        <path d="M100 246 l-9 11 l9 -4 l8 4 Z M36 262 l-6 7 l6 -2 l5 2 Z" fill="#cbd5e1" opacity=".6" />
        <g transform="translate(150 296)">
          <path d="M0 36 l18 -30 l18 30 Z" fill="#D85A30" stroke="#993C1D" strokeWidth="1.2" />
          <path d="M18 6 v30" stroke="#993C1D" />
          <path d="M12 36 l6 -12 l6 12 Z" fill="#4A1B0C" />
        </g>
        <g transform={`translate(0 ${GROUND_Y})`}>
          <path d="M0 112 q50 -16 100 -4 t100 -6 v38 h-200 Z" fill="#C0DD97" />
          <g className="sg-flower">
            <line x1="10" y1="114" x2="10" y2="98" stroke="#3B6D11" strokeWidth="1.5" />
            <circle cx="10" cy="96" r="4" fill="#ED93B1" />
            <circle cx="10" cy="96" r="1.5" fill="#FAC775" />
          </g>
            <g className="sg-fire">
              <path d="M90 114 l12 -5 l12 5" stroke="#5F3E1C" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="102" cy="110" rx="16" ry="6" className="sg-glow" />
              <g className="sg-flame">
                <path d="M95 110 q7 -24 14 0 Z" fill="#EF9F27" />
                <path d="M99 110 q3 -13 6 0 Z" fill="#FAC775" />
              </g>
            </g>
          <g className="sg-flower">
            <line x1="190" y1="110" x2="190" y2="92" stroke="#3B6D11" strokeWidth="1.5" />
            <circle cx="190" cy="90" r="4.5" fill="#FAC775" />
            <circle cx="190" cy="90" r="1.6" fill="#BA7517" />
          </g>

          <g ref={catRef} className={`sg-cat${popping ? " sg-pop" : ""}`}>
            <path className="sg-ear" d="M34 70 L38 52 L48 64 Z" fill="#888780" stroke="#444441" strokeWidth="1.2" strokeLinejoin="round" />
            <path className="sg-ear" d="M66 70 L62 52 L52 64 Z" fill="#888780" stroke="#444441" strokeWidth="1.2" strokeLinejoin="round" />
            <ellipse cx="50" cy="80" rx="19" ry="15" fill="#B4B2A9" stroke="#444441" strokeWidth="1.2" />
            <g className="sg-open">
              <ellipse cx={EYE_L.x} cy={EYE_L.y} rx="4.4" ry="4.8" fill="#fff" stroke="#444441" />
              <ellipse cx={EYE_R.x} cy={EYE_R.y} rx="4.4" ry="4.8" fill="#fff" stroke="#444441" />
              <circle ref={leftPupil} cx={EYE_L.x} cy={EYE_L.y} r="2.2" fill="#2C2C2A" />
              <circle ref={rightPupil} cx={EYE_R.x} cy={EYE_R.y} r="2.2" fill="#2C2C2A" />
            </g>
            <g className="sg-closed">
              <path d="M39 78 q4 3 8 0 M53 78 q4 3 8 0" stroke="#2C2C2A" strokeWidth="1.5" fill="none" />
            </g>
            <path d="M48 83 l2 2 l2 -2 Z" fill="#ED93B1" />
            <circle cx="37" cy="84" r="2.4" fill="#F4C0D1" opacity=".7" />
            <circle cx="63" cy="84" r="2.4" fill="#F4C0D1" opacity=".7" />
            <g className="sg-arm">
              <ellipse cx="74" cy="88" rx="5" ry="4.5" fill="#B4B2A9" stroke="#444441" strokeWidth="1.2" />
            </g>
            <text className="sg-zz" x="70" y="62" fontSize="9" fontWeight="600">
              z
            </text>
            {season === "newyear" && (
              <g className="sg-hat">
                <path d="M34 66 q14 -6 30 0 q4 -12 10 -16 q-16 -10 -34 4 Z" fill="#E24B4A" stroke="#A32D2D" />
                <rect x="32" y="62" width="34" height="6" rx="3" fill="#FFFFFF" />
                <circle cx="75" cy="50" r="3.6" fill="#FFFFFF" />
              </g>
            )}
            {season === "halloween" && (
              <g className="sg-hat">
                <ellipse cx="50" cy="66" rx="22" ry="4" fill="#26215C" />
                <path d="M38 65 L52 36 L62 65 Z" fill="#3C3489" />
                <rect x="40" y="58" width="21" height="4" fill="#EF9F27" />
              </g>
            )}
            <text className="sg-zz sg-zz-b" x="76" y="54" fontSize="12" fontWeight="600">
              Z
            </text>
          </g>

          <path d="M18 116 q-2 -18 16 -22 q6 -12 20 -6 q14 -8 22 6 q14 2 10 22 Z" fill="#639922" stroke="#3B6D11" strokeWidth="1.2" />
          <circle cx="32" cy="104" r="2" fill="#ED93B1" />
          <circle cx="70" cy="100" r="2" fill="#FAC775" />
          <circle cx="52" cy="108" r="1.8" fill="#F0997B" />

          <g className={`sg-rabbit${popping ? " sg-pop" : ""}`}>
            <g transform="translate(124 0)">
              {season === "songkran" && (
                <g className="sg-watergun">
                  <path className="sg-stream" d="M-12 99 q-28 -20 -56 -8" stroke="#85B7EB" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  <circle className="sg-drop" cx="-66" cy="92" r="1.6" fill="#85B7EB" />
                  <circle className="sg-drop sg-drop-b" cx="-62" cy="88" r="1.3" fill="#85B7EB" />
                  <rect x="-12" y="96" width="14" height="6" rx="2" fill="#378ADD" />
                  <rect x="-2" y="101" width="4" height="6" rx="1" fill="#185FA5" />
                  <rect x="-6" y="90" width="7" height="6" rx="2" fill="#E24B4A" />
                </g>
              )}
              <ellipse className="sg-rear" cx="8" cy="78" rx="3" ry="10" fill="#2C2C2A" />
              <ellipse className="sg-rear" cx="15" cy="78" rx="3" ry="10" fill="#2C2C2A" />
              <ellipse cx="8" cy="78" rx="1.2" ry="7" fill="#ED93B1" />
              <ellipse cx="15" cy="78" rx="1.2" ry="7" fill="#ED93B1" />
              <ellipse cx="16" cy="104" rx="13" ry="9" fill="#2C2C2A" />
              <circle cx="12" cy="93" r="8" fill="#2C2C2A" />
              <circle cx="3" cy="106" r="3.5" fill="#F1EFE8" />
              <g className="sg-open">
                <circle cx="9" cy="92" r="1.8" fill="#fff" />
                <circle cx="15" cy="92" r="1.8" fill="#fff" />
                <circle cx="9.4" cy="92.2" r=".9" fill="#2C2C2A" />
                <circle cx="15.4" cy="92.2" r=".9" fill="#2C2C2A" />
              </g>
              <g className="sg-closed">
                <path d="M7.5 92.5 q1.6 1.2 3.2 0 M13.5 92.5 q1.6 1.2 3.2 0" stroke="#F1EFE8" strokeWidth="1" fill="none" />
              </g>
              <ellipse cx="12" cy="96" rx="1.2" ry=".8" fill="#ED93B1" />
              <text className="sg-zz" x="24" y="80" fontSize="8" fontWeight="600">
                z
              </text>
            </g>
          </g>

          <path d="M0 122 q60 -8 120 0 t80 -2 v20 h-200 Z" fill="#97C459" />
            {season === "halloween" &&
              [
              [120, 110, 1],
              [184, 112, 0.8],
              ].map(([x, y, k], i) => (
              <g key={`pumpkin${i}`} transform={`translate(${x} ${y}) scale(${k})`}>
                <ellipse cx="0" cy="0" rx="9" ry="7" className="sg-glow" />
                <ellipse cx="0" cy="0" rx="8" ry="6.5" fill="#EF9F27" stroke="#BA7517" />
                <path d="M0 -6.5 v13 M-4 -6 q-2 6 0 12 M4 -6 q2 6 0 12" stroke="#BA7517" strokeWidth=".7" fill="none" />
                <rect x="-1" y="-10" width="2" height="4" rx="1" fill="#3B6D11" />
                <path d="M-5 -2 l2 -2 l2 2 Z M1 -2 l2 -2 l2 2 Z M-4 2 q4 3 8 0 l-2 1 l-2 -1 l-2 1 Z" className="sg-pumpkin-face" />
              </g>
              ))}
            {[
              [70, 60, 0],
              [128, 48, -1.4],
              [168, 76, -2.8],
            ].map(([x, y, delay], i) => (
              <circle key={i} className="sg-firefly" cx={x} cy={y} r="1.7" style={{ animationDelay: `${delay}s` }} />
            ))}

        </g>
      </svg>
    </div>
  );
}

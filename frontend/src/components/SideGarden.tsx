import { useEffect, useRef, useState } from "react";

/* A little garden in the empty middle of the side menu: a grey cat peeking over a bush (its eyes
   follow the mouse), a black rabbit hopping on the grass, swaying flowers and a butterfly.
   Both pets pop out and wave/jump whenever the menu is collapsed or expanded, and fall asleep
   after a while without any mouse/keyboard activity. Purely decorative: aria-hidden, no pointer
   events, frozen under prefers-reduced-motion (see .sg-* in redesign.css). */

const IDLE_MS = 2 * 60 * 1000;
const POP_MS = 1800;
const EYE_L = { x: 43, y: 77 };
const EYE_R = { x: 57, y: 77 };

export default function SideGarden({ collapsed }: { collapsed: boolean }) {
  const [popping, setPopping] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const catRef = useRef<SVGGElement>(null);
  const leftPupil = useRef<SVGCircleElement>(null);
  const rightPupil = useRef<SVGCircleElement>(null);

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
      {/* Collapsed menu: zoom in on the cat and its bush so it stays visible in the narrow icon rail. */}
      <svg
        className="sg-scene"
        viewBox={collapsed ? "16 46 74 74" : "0 0 200 140"}
        preserveAspectRatio="xMidYMax meet"
        focusable="false"
      >
        <ellipse cx="150" cy="26" rx="20" ry="7" className="sg-cloud" />
        <path d="M0 112 q50 -16 100 -4 t100 -6 v38 h-200 Z" fill="#C0DD97" />
        <g className="sg-flower">
          <line x1="10" y1="114" x2="10" y2="98" stroke="#3B6D11" strokeWidth="1.5" />
          <circle cx="10" cy="96" r="4" fill="#ED93B1" />
          <circle cx="10" cy="96" r="1.5" fill="#FAC775" />
        </g>
        <g className="sg-flower sg-flower-b">
          <line x1="104" y1="112" x2="104" y2="98" stroke="#3B6D11" strokeWidth="1.5" />
          <circle cx="104" cy="96" r="3.5" fill="#AFA9EC" />
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
        <g className="sg-butterfly">
          <g className="sg-wing">
            <path d="M0 0 q-6 -6 -8 0 q2 6 8 0 q6 -6 8 0 q-2 6 -8 0" fill="#F0997B" />
          </g>
        </g>
      </svg>
    </div>
  );
}

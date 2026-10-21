/* Small animated cartoons for the KPI cards — pure SVG + CSS keyframes (see .kart-* in
   redesign.css), decorative only, hidden from screen readers and frozen under reduced motion. */

const FLOOR = "var(--border-strong)";

/** รายการทั้งหมด — a happy box hopping on a pile of stock boxes. */
export function ArtStock() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <rect x="4" y="66" width="76" height="4" rx="2" fill={FLOOR} />
      <rect x="8" y="46" width="20" height="20" rx="3" fill="#FAC775" stroke="#BA7517" />
      <rect x="56" y="46" width="20" height="20" rx="3" fill="#FAC775" stroke="#BA7517" />
      <rect x="32" y="50" width="20" height="16" rx="3" fill="#FAC775" stroke="#BA7517" />
      <g className="kart-hop">
        <rect x="28" y="22" width="28" height="26" rx="4" fill="#EF9F27" stroke="#854F0B" />
        <line x1="28" y1="30" x2="56" y2="30" stroke="#854F0B" />
        <g className="kart-blink">
          <circle cx="37" cy="38" r="2" fill="#412402" />
          <circle cx="47" cy="38" r="2" fill="#412402" />
        </g>
        <path d="M38 43 Q42 46 46 43" stroke="#412402" fill="none" strokeLinecap="round" />
        <circle cx="33" cy="42" r="2" fill="#F0997B" opacity=".7" />
        <circle cx="51" cy="42" r="2" fill="#F0997B" opacity=".7" />
      </g>
    </svg>
  );
}

/** Next-0 < Sum MIN — a startled box shaking under a flashing siren. */
export function ArtDanger() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <circle className="kart-siren" cx="58" cy="14" r="12" fill="#F09595" />
      <path d="M51 22 Q58 4 65 22 Z" fill="#E24B4A" stroke="#791F1F" />
      <rect x="49" y="22" width="18" height="4" rx="1" fill="#791F1F" />
      <rect x="4" y="66" width="76" height="4" rx="2" fill={FLOOR} />
      <g className="kart-shake">
        <rect x="14" y="36" width="30" height="30" rx="4" fill="#F7C1C1" stroke="#A32D2D" />
        <line x1="14" y1="44" x2="44" y2="44" stroke="#A32D2D" />
        <circle cx="23" cy="53" r="3" fill="#fff" stroke="#501313" />
        <circle cx="35" cy="53" r="3" fill="#fff" stroke="#501313" />
        <circle cx="23" cy="53" r="1.2" fill="#501313" />
        <circle cx="35" cy="53" r="1.2" fill="#501313" />
        <ellipse cx="29" cy="61" rx="3" ry="2.5" fill="#501313" />
      </g>
      <path className="kart-sweat" d="M47 38 q2 4 0 6 q-2 -2 0 -6" fill="#85B7EB" />
      <path d="M63 46 v9" stroke="#A32D2D" strokeWidth="3" strokeLinecap="round" />
      <circle cx="63" cy="60" r="1.7" fill="#A32D2D" />
    </svg>
  );
}

/** Next-1 < Sum MIN — an hourglass flipping while a pair of eyes watches next month's calendar. */
export function ArtWarn({ monthLabel }: { monthLabel: string }) {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <rect x="46" y="10" width="32" height="30" rx="4" fill="#fff" stroke="#BA7517" />
      <rect x="46" y="10" width="32" height="9" rx="4" fill="#EF9F27" />
      <text x="62" y="34" fontSize="10" textAnchor="middle" fill="#633806" fontFamily="inherit">
        {monthLabel}
      </text>
      <g className="kart-flip">
        <path d="M10 30 h18 l-9 13 Z" fill="#FAC775" stroke="#854F0B" />
        <path d="M10 56 h18 l-9 -13 Z" fill="#FAC775" stroke="#854F0B" />
        <rect x="8" y="27" width="22" height="3" rx="1" fill="#854F0B" />
        <rect x="8" y="56" width="22" height="3" rx="1" fill="#854F0B" />
      </g>
      <g className="kart-look">
        <circle cx="36" cy="58" r="5" fill="#fff" stroke="#633806" />
        <circle cx="46" cy="58" r="5" fill="#fff" stroke="#633806" />
        <circle cx="37.5" cy="57" r="2" fill="#412402" />
        <circle cx="47.5" cy="57" r="2" fill="#412402" />
      </g>
      <rect x="4" y="66" width="76" height="4" rx="2" fill={FLOOR} />
    </svg>
  );
}

/** มี PR qty — a smiling clipboard ticking its boxes while a pencil writes. */
export function ArtPr() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <g className="kart-wiggle">
        <rect x="14" y="10" width="38" height="56" rx="4" fill="#E6F1FB" stroke="#185FA5" />
        <rect x="25" y="6" width="16" height="8" rx="2" fill="#378ADD" />
        <rect x="20" y="22" width="6" height="6" rx="1" fill="#fff" stroke="#185FA5" />
        <rect x="20" y="36" width="6" height="6" rx="1" fill="#fff" stroke="#185FA5" />
        <line x1="30" y1="25" x2="46" y2="25" stroke="#85B7EB" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="39" x2="46" y2="39" stroke="#85B7EB" strokeWidth="2" strokeLinecap="round" />
        <path className="kart-tick" d="M20 25 l3 3 l6 -7" stroke="#1D9E75" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path className="kart-tick kart-tick2" d="M20 39 l3 3 l6 -7" stroke="#1D9E75" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="27" cy="54" r="1.6" fill="#0C447C" />
        <circle cx="39" cy="54" r="1.6" fill="#0C447C" />
        <path d="M30 58 Q33 61 36 58" stroke="#0C447C" fill="none" strokeLinecap="round" />
      </g>
      <g className="kart-pen">
        <rect x="58" y="22" width="6" height="30" rx="2" fill="#EF9F27" transform="rotate(30 61 37)" />
        <path d="M52 50 l3 -4 l3 2 Z" fill="#412402" />
      </g>
    </svg>
  );
}

/** มูลค่า PR รวม — a piggy bank catching falling coins. */
export function ArtValue() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <circle className="kart-coin" cx="48" cy="22" r="6" fill="#FAC775" stroke="#BA7517" />
      <circle className="kart-coin kart-coin2" cx="48" cy="22" r="6" fill="#FAC775" stroke="#BA7517" />
      <g className="kart-hop kart-slow">
        <ellipse cx="44" cy="48" rx="26" ry="18" fill="#F4C0D1" stroke="#993556" />
        <rect x="40" y="31" width="10" height="3" rx="1.5" fill="#72243E" />
        <ellipse cx="68" cy="49" rx="5" ry="6" fill="#ED93B1" stroke="#993556" />
        <circle cx="67" cy="48" r="1" fill="#72243E" />
        <circle cx="69.5" cy="50" r="1" fill="#72243E" />
        <path d="M26 33 l-3 -7 l8 4 Z" fill="#ED93B1" stroke="#993556" />
        <g className="kart-blink">
          <circle cx="56" cy="42" r="1.8" fill="#4B1528" />
        </g>
        <rect x="28" y="62" width="6" height="7" rx="2" fill="#ED93B1" stroke="#993556" />
        <rect x="52" y="62" width="6" height="7" rx="2" fill="#ED93B1" stroke="#993556" />
      </g>
      <rect x="4" y="68" width="76" height="3" rx="1.5" fill={FLOOR} />
    </svg>
  );
}

/** Stock N0 รวม — a little forklift lifting a box up and down. */
export function ArtForklift() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <rect x="4" y="66" width="76" height="4" rx="2" fill={FLOOR} />
      <g className="kart-drive">
        <rect x="40" y="38" width="30" height="20" rx="4" fill="#5DCAA5" stroke="#0F6E56" />
        <path d="M46 38 v-14 h16 l4 14" fill="#E1F5EE" stroke="#0F6E56" />
        <circle cx="47" cy="61" r="5" fill="#2C2C2A" />
        <circle cx="64" cy="61" r="5" fill="#2C2C2A" />
        <circle cx="47" cy="61" r="1.8" fill="#B4B2A9" />
        <circle cx="64" cy="61" r="1.8" fill="#B4B2A9" />
        <rect x="35" y="16" width="3" height="46" rx="1" fill="#444441" />
        <g className="kart-lift">
          <rect x="18" y="50" width="20" height="3" rx="1" fill="#444441" />
          <rect x="18" y="34" width="18" height="16" rx="3" fill="#FAC775" stroke="#BA7517" />
          <line x1="18" y1="40" x2="36" y2="40" stroke="#BA7517" />
        </g>
        <g className="kart-blink">
          <circle cx="56" cy="31" r="1.6" fill="#04342C" />
          <circle cx="61" cy="31" r="1.6" fill="#04342C" />
        </g>
      </g>
    </svg>
  );
}

/** มูลค่า Stock รวม — a money bag with coins bobbing beside it. */
export function ArtMoneyBag() {
  return (
    <svg className="kart" viewBox="0 0 84 76" aria-hidden focusable="false">
      <rect x="4" y="66" width="76" height="4" rx="2" fill={FLOOR} />
      <g className="kart-hop kart-slow">
        <path d="M30 30 q-14 12 -12 26 q2 10 18 10 h12 q16 0 18 -10 q2 -14 -12 -26 Z" fill="#FAC775" stroke="#854F0B" />
        <path d="M34 30 l-4 -10 q12 6 24 0 l-4 10 Z" fill="#EF9F27" stroke="#854F0B" />
        <rect x="32" y="27" width="20" height="4" rx="2" fill="#854F0B" />
        <text x="42" y="56" fontSize="15" fontWeight="700" textAnchor="middle" fill="#633806" fontFamily="inherit">
          ฿
        </text>
        <g className="kart-blink">
          <circle cx="36" cy="43" r="1.6" fill="#412402" />
          <circle cx="48" cy="43" r="1.6" fill="#412402" />
        </g>
      </g>
      <g className="kart-bob">
        <ellipse cx="72" cy="62" rx="7" ry="3" fill="#EF9F27" stroke="#854F0B" />
        <ellipse cx="72" cy="57" rx="7" ry="3" fill="#FAC775" stroke="#854F0B" />
        <ellipse cx="72" cy="52" rx="7" ry="3" fill="#FAC775" stroke="#854F0B" />
      </g>
    </svg>
  );
}

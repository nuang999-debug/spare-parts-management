import type { ItemDetail } from "../api/items";
import type { ItemAnalysis } from "./analysis";
import { safetyFactorFor } from "./analysis";
import { thaiDateShort } from "./thaiMonths";
import { provisionLongLabel, provisionMonths, splitReplacement } from "./provision";
import { tr } from "./i18n";

/** A styled text fragment — mirrors the original's embedded <b style="color:..."> spans. */
export interface Run {
  text: string;
  bold?: boolean;
  color?: string;
}

export type NarrativeBlock =
  | { kind: "para"; runs: Run[] }
  | { kind: "bullets"; items: Run[][] }
  | { kind: "subheading"; text: string };

export interface NarrativeSection {
  title: string;
  blocks: NarrativeBlock[];
}

/** original's fmt(): a real zero renders as an em dash. */
function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** original's fmtN(): zero renders as "0", only null/undefined dash out. */
function fmtN(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function money(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function t(text: string): Run {
  return { text };
}

function b(text: string, color?: string): Run {
  return { text, bold: true, color };
}

export function buildNarrative(item: ItemDetail, a: ItemAnalysis): NarrativeSection[] {
  const sections: NarrativeSection[] = [];
  const nz = a.nonZeroMonths;
  const sumMin = item.sumMin ?? 0;
  const belowCount = a.belowMinCount;
  const unit = tr("หน่วย", "units");

  // ── 1. แนวโน้มการใช้งาน ──
  const usageRuns: Run[] =
    nz === 6
      ? [
          t(tr("มีการใช้งาน", "Used ")),
          b(tr("ต่อเนื่องทุกเดือน", "every month")),
          t(tr(" (6/6 เดือน) แสดงถึงความต้องการที่สม่ำเสมอ เหมาะเป็นอะไหล่ stock หลัก", " (6/6 months), showing steady demand; a good core stock part")),
        ]
      : nz >= 3
        ? [
            t(tr("มีการใช้งาน ", "Used in ")),
            b(tr(`${nz}/6 เดือน`, `${nz}/6 months`)),
            t(tr(" ถือว่าใช้", ", ")),
            b(tr("ค่อนข้างสม่ำเสมอ", "fairly regular")),
            t(tr(" แต่ยังมีบางเดือนที่ไม่มีการเบิกใช้", ", but some months had no issues")),
          ]
        : nz > 0
          ? [
              t(tr("มีการใช้งานเพียง ", "Used in only ")),
              b(tr(`${nz}/6 เดือน`, `${nz}/6 months`)),
              t(tr(" ถือว่า", ", ")),
              b(tr("ใช้ไม่ต่อเนื่อง", "irregular use")),
              t(tr(" ควรพิจารณาว่าจำเป็นต้อง stock มากน้อยเพียงใด", "; consider how much stock is really needed")),
            ]
          : [
              b(tr("ไม่มีการใช้งานเลย", "No usage at all")),
              t(tr("ในช่วง 6 เดือนที่ผ่านมา ควรทบทวนความจำเป็นของ MIN Stock รายการนี้", " in the last 6 months; review whether this item needs a MIN stock")),
            ];

  const peakLowRuns: Run[] = [
    t(tr("เดือนที่ใช้", "Month with the ")),
    b(tr("มากที่สุด", "highest use")),
    t(`: ${a.max.label} (${fmtN(a.max.value, 0)} ${unit})`),
  ];
  if (a.min.value < a.max.value) {
    peakLowRuns.push(
      t(tr(" · เดือนที่ใช้", " · month with the ")),
      b(tr("น้อยที่สุด", "lowest use")),
      t(`: ${a.min.label} (${fmtN(a.min.value, 0)} ${unit})`),
    );
  }

  const section1: NarrativeBlock[] = [
    { kind: "para", runs: usageRuns },
    { kind: "para", runs: peakLowRuns },
  ];

  if (a.volatilityPct > 0) {
    const vol = a.volatilityPct.toFixed(0);
    const volRuns: Run[] =
      a.volatilityPct > 60
        ? [
            b(tr("ผันผวนสูง", "High"), "var(--danger)"),
            t(
              tr(
                ` (ความเบี่ยงเบน ${vol}% จากค่าเฉลี่ย) ควรเผื่อ Safety Stock มากกว่าปกติ`,
                ` (${vol}% deviation from the average); keep more safety stock than usual`,
              ),
            ),
          ]
        : a.volatilityPct > 30
          ? [
              b(tr("ผันผวนปานกลาง", "Moderate"), "var(--warning)"),
              t(tr(` (${vol}%) การคาดการณ์มีความคลาดเคลื่อนได้บ้าง`, ` (${vol}%); forecasts may be somewhat off`)),
            ]
          : [
              b(tr("ค่อนข้างคงที่", "Fairly stable"), "var(--success)"),
              t(tr(` (${vol}%) คาดการณ์ได้แม่นยำ`, ` (${vol}%); forecasts are reliable`)),
            ];
    section1.push({ kind: "para", runs: [t(tr("ความผันผวนของการใช้งาน: ", "Usage volatility: ")), ...volRuns] });
  }

  const trendRuns: Run[] =
    item.calcTrend === "UP"
      ? [
          b(tr(`ขาขึ้น +${a.trendPct.toFixed(1)}%`, `Rising +${a.trendPct.toFixed(1)}%`), "var(--success)"),
          t(tr(" (เทียบ 3 เดือนหลังกับ 3 เดือนแรก) ความต้องการกำลังเพิ่มขึ้น", " (last 3 months vs first 3 months); demand is growing")),
        ]
      : item.calcTrend === "DOWN"
        ? [
            b(tr(`ขาลง ${a.trendPct.toFixed(1)}%`, `Falling ${a.trendPct.toFixed(1)}%`), "var(--danger)"),
            t(tr(" ความต้องการกำลังลดลง อาจพิจารณาปรับลด MIN ในอนาคต", "; demand is shrinking, consider lowering the MIN later")),
          ]
        : [
            b(tr("ทรงตัว", "Flat"), "var(--flat)"),
            t(
              tr(
                ` (${a.trendPct >= 0 ? "+" : ""}${a.trendPct.toFixed(1)}%) ไม่มีการเปลี่ยนแปลงอย่างมีนัยสำคัญ`,
                ` (${a.trendPct >= 0 ? "+" : ""}${a.trendPct.toFixed(1)}%); no significant change`,
              ),
            ),
          ];
  section1.push({ kind: "para", runs: [t(tr("แนวโน้มรวม: ", "Overall trend: ")), ...trendRuns] });

  sections.push({ title: tr("1. แนวโน้มการใช้งาน", "1. Usage trend"), blocks: section1 });

  // ── 2. ประเมินความเสี่ยง Stock (5 เดือนข้างหน้า) ──
  const section2: NarrativeBlock[] = [];
  let riskRuns: Run[];
  if (sumMin <= 0) {
    riskRuns = [
      t(
        tr(
          "ยังไม่ได้กำหนด Sum MIN สำหรับรายการนี้ จึงไม่สามารถประเมินความเสี่ยงเทียบกับเกณฑ์ขั้นต่ำได้",
          "No Sum MIN is set for this item, so the risk against a minimum level can't be assessed",
        ),
      ),
    ];
  } else if (belowCount === 0) {
    riskRuns = [
      b(tr("ความเสี่ยงต่ำ", "Low risk"), "var(--success)"),
      t(tr(" — Stock คาดการณ์ทั้งเดือนนี้และ 5 เดือนข้างหน้ายังคงอยู่", " — forecast stock for this month and the next 5 stays ")),
      b(tr("เหนือ Sum MIN", "above Sum MIN")),
      t(tr(` (${fmt(sumMin, 0)}) ตลอด ไม่มีความจำเป็นเร่งด่วน`, ` (${fmt(sumMin, 0)}) throughout; nothing urgent`)),
    ];
  } else if (belowCount === 6) {
    riskRuns = [
      b(tr("ความเสี่ยงสูงมาก", "Very high risk"), "var(--danger)"),
      t(tr(" — Stock คาดการณ์", " — forecast stock is ")),
      b(tr("ต่ำกว่า Sum MIN ตลอดทั้งเดือนนี้และ 5 เดือนข้างหน้า", "below Sum MIN this month and for all of the next 5")),
      t(
        tr(
          ` เริ่มตั้งแต่ ${a.triggerMonthLabel} หากไม่ดำเนินการจะขาดสต็อกต่อเนื่อง`,
          ` starting ${a.triggerMonthLabel}; without action the item stays out of stock`,
        ),
      ),
    ];
  } else {
    // next[] is a running total that can climb back above Sum MIN if a PO receipt lands in a
    // later bucket, so a below-MIN month doesn't guarantee every month after it stays below too
    // — "ตั้งแต่เดือน X เป็นต้นไป" (continuously from month X onward) would misstate that as fact
    // whenever there's a recovery-then-dip in between. Only claim continuity when it's real.
    const isContinuousFromTrigger = a.next.slice(a.triggerMonth).every((v) => v < sumMin);
    riskRuns = isContinuousFromTrigger
      ? [
          b(tr("ความเสี่ยงปานกลางถึงสูง", "Medium to high risk"), "var(--warning)"),
          t(tr(` — Stock จะตกลงต่ำกว่า Sum MIN (${fmt(sumMin, 0)}) ตั้งแต่เดือน `, ` — stock falls below Sum MIN (${fmt(sumMin, 0)}) from `)),
          b(a.triggerMonthLabel),
          t(tr(` เป็นต้นไป (รวม ${belowCount}/6 เดือนที่ต่ำกว่าเกณฑ์)`, ` onward (${belowCount}/6 months below the level)`)),
        ]
      : [
          b(tr("ความเสี่ยงปานกลางถึงสูง", "Medium to high risk"), "var(--warning)"),
          t(
            tr(
              ` — Stock จะตกลงต่ำกว่า Sum MIN (${fmt(sumMin, 0)}) ในบางช่วง เริ่มที่เดือน `,
              ` — stock falls below Sum MIN (${fmt(sumMin, 0)}) at times, starting `,
            ),
          ),
          b(a.triggerMonthLabel),
          t(
            tr(
              ` (รวม ${belowCount}/6 เดือนที่ต่ำกว่าเกณฑ์ ไม่ต่อเนื่องกันทั้งหมด เนื่องจากมี PO เข้าคั่นกลาง)`,
              ` (${belowCount}/6 months below the level, not all in a row because a PO arrives in between)`,
            ),
          ),
        ];
  }
  section2.push({ kind: "para", runs: riskRuns });
  if (item.backorderQty > item.stockQty) {
    section2.push({
      kind: "para",
      runs: [
        t(tr(`นอกจากนี้ Sale Order ที่ค้างอยู่ (${fmt(item.backorderQty, 0)} หน่วย) `, `Also, open sale orders (${fmt(item.backorderQty, 0)} units) are `)),
        b(tr("มากกว่า Stock ปัจจุบัน", "more than current stock"), "var(--danger)"),
        t(
          tr(
            ` (${fmt(item.stockQty, 0)} หน่วย) ซึ่งอาจกระทบการส่งมอบลูกค้าได้ทันที`,
            ` (${fmt(item.stockQty, 0)} units), which may affect customer deliveries right away`,
          ),
        ),
      ],
    });
  }
  sections.push({
    title: tr("2. ประเมินความเสี่ยง Stock (เดือนนี้ถึง 5 เดือนข้างหน้า)", "2. Stock risk (this month to 5 months ahead)"),
    blocks: section2,
  });

  // ── 3. เหตุผลและจำนวนที่ควรสั่งซื้อ ──
  const section3: NarrativeBlock[] = [];
  if (sumMin <= 0 || belowCount === 0) {
    section3.push({ kind: "para", runs: [b(tr("ยังไม่จำเป็นต้องสั่งซื้อในขณะนี้", "No order needed right now"), "var(--success)")] });
    if (sumMin > 0) {
      section3.push({
        kind: "para",
        runs: [
          t(
            tr(
              `Stock คาดการณ์ปัจจุบันและในอนาคตยังสูงกว่า Sum MIN (${fmt(sumMin, 0)}) เพียงพอต่อความต้องการ`,
              `Current and forecast stock stays above Sum MIN (${fmt(sumMin, 0)}), enough to cover demand`,
            ),
          ),
        ],
      });
    }
  } else {
    section3.push({
      kind: "para",
      runs: [
        b(tr("ควรพิจารณาสั่งซื้อ", "Consider ordering"), "var(--danger)"),
        t(tr(" จำนวนประมาณ ", " about ")),
        b(`${fmtN(a.recommendedOrderQty, 0)} ${unit}`),
      ],
    });
    const roundedForPacking = item.packingRule?.active && a.recommendedOrderQty !== a.orderQty;
    section3.push({
      kind: "para",
      runs: [
        t(
          tr(
            `คำนวณจาก: Sum MIN (${fmt(sumMin, 0)}) − Stock คาดการณ์เดือน ${a.triggerMonthLabel} (${fmtN(a.triggerValue, 1)}) = ${fmtN(a.orderQty, 0)} หน่วย`,
            `Calculated as: Sum MIN (${fmt(sumMin, 0)}) − forecast stock for ${a.triggerMonthLabel} (${fmtN(a.triggerValue, 1)}) = ${fmtN(a.orderQty, 0)} units`,
          ) +
            (roundedForPacking
              ? tr(
                  ` → ปัดขึ้นเป็น ${fmtN(a.recommendedOrderQty, 0)} หน่วย ตามกฎบรรจุภัณฑ์ (คูณของ ${item.packingRule!.multipleOf})`,
                  ` → rounded up to ${fmtN(a.recommendedOrderQty, 0)} units by the packing rule (multiple of ${item.packingRule!.multipleOf})`,
                )
              : "")
        ),
      ],
    });
    if (item.poQty > 0) {
      section3.push({
        kind: "para",
        runs: [
          t(tr(`หมายเหตุ: มี PO รอรับอยู่แล้ว ${fmt(item.poQty, 0)} หน่วย ซึ่ง`, `Note: ${fmt(item.poQty, 0)} units already on open POs are `)),
          b(tr("รวมอยู่ในตัวเลขคาดการณ์ข้างต้นแล้ว", "already included in the forecast above")),
          t(tr(" ไม่ต้องหักซ้ำ", "; don't subtract them again")),
        ],
      });
    }
  }
  sections.push({ title: tr("3. เหตุผลและจำนวนที่ควรสั่งซื้อ", "3. Why and how much to order"), blocks: section3 });

  // ── 4. ช่วงเวลาที่เหมาะสมและข้อควรระวัง ──
  const section4: NarrativeBlock[] = [];
  if (sumMin > 0 && belowCount > 0) {
    if (a.daysToOrder <= 0) {
      section4.push({
        kind: "para",
        runs: [
          b(tr("ควรเปิด PR ทันที", "Open a PR now"), "var(--danger)"),
          t(
            tr(
              ` เนื่องจาก Lead Time (${item.leadTimeDays ?? "—"} วัน) ใกล้เคียงหรือมากกว่าเวลาที่เหลือก่อน Stock จะต่ำกว่าเกณฑ์`,
              ` because the lead time (${item.leadTimeDays ?? "—"} days) is close to or longer than the time left before stock drops below the level`,
            )
          ),
        ],
      });
    } else {
      const dueDate = item.mustOrderByDate ? thaiDateShort(new Date(item.mustOrderByDate)) : "-";
      section4.push({
        kind: "para",
        runs: [
          t(tr("ควรสั่งซื้อ", "Order ")),
          b(tr(`ภายในวันที่ ${dueDate}`, `by ${dueDate}`)),
          t(
            tr(
              ` (อีกประมาณ ${a.daysToOrder} วัน) โดยคำนวณจาก Lead Time ${item.leadTimeDays ?? "—"} วัน หักจากเดือนที่ Stock จะต่ำกว่าเกณฑ์`,
              ` (about ${a.daysToOrder} days from now), i.e. the month stock drops below the level minus the ${item.leadTimeDays ?? "—"}-day lead time`,
            )
          ),
        ],
      });
    }
    const cautions: string[] = [];
    if (a.volatilityPct > 50) {
      cautions.push(
        tr(
          "การใช้งานผันผวนสูง ควรเผื่อจำนวนสั่งซื้อเพิ่มจากที่คำนวณไว้เล็กน้อย",
          "Usage is very volatile; order a little more than calculated",
        ),
      );
    }
    if (item.calcTrend === "UP") {
      cautions.push(
        tr(
          "เทรนด์กำลังขาขึ้น หากสั่งจำนวนตามสูตรอาจไม่พอในระยะถัดไป ควรพิจารณาสั่งเผื่อเพิ่ม",
          "The trend is rising; the formula quantity may fall short later, consider ordering extra",
        ),
      );
    }
    if ((item.leadTimeDays ?? 0) >= 60) {
      cautions.push(
        tr(
          `Lead Time ค่อนข้างนาน (${item.leadTimeDays} วัน) ควรวางแผนล่วงหน้าและติดตามสถานะ PO อย่างใกล้ชิด`,
          `Long lead time (${item.leadTimeDays} days); plan ahead and follow the PO closely`,
        ),
      );
    }
    if (item.backorderQty > 0) {
      cautions.push(
        tr(
          `มี Sale Order ค้างอยู่ ${fmt(item.backorderQty, 0)} หน่วย ควรยืนยันว่าจำนวนที่สั่งซื้อครอบคลุมความต้องการนี้แล้ว`,
          `${fmt(item.backorderQty, 0)} units on open sale orders; make sure the order quantity covers them`,
        ),
      );
    }
    if (cautions.length === 0) cautions.push(tr("ไม่มีปัจจัยเสี่ยงเพิ่มเติมที่ต้องระวังเป็นพิเศษ", "No other risk factors to watch"));
    section4.push({ kind: "para", runs: [b(tr("ข้อควรระวัง:", "Watch out for:"))] });
    section4.push({ kind: "bullets", items: cautions.map((c) => [t(c)]) });
  } else {
    section4.push({
      kind: "para",
      runs: [
        t(
          tr(
            "ยังไม่มีความจำเป็นต้องกำหนดช่วงเวลาสั่งซื้อในขณะนี้ ระบบจะแจ้งเตือนอัตโนมัติเมื่อ Stock คาดการณ์เริ่มต่ำกว่า Sum MIN",
            "No order date is needed yet; the system flags the item automatically once forecast stock drops below Sum MIN",
          ),
        ),
      ],
    });
  }
  sections.push({ title: tr("4. ช่วงเวลาที่เหมาะสมและข้อควรระวัง", "4. Timing and cautions"), blocks: section4 });

  // ── 5. ข้อเสนอแนะเพิ่มเติม ──
  const section5: NarrativeBlock[] = [];

  // 5a. การจัดเก็บ Stock
  const stockVal = item.stockQty * (item.purchasePrice ?? 0);
  const avgUsageVal = (item.avgMonth ?? 0) * (item.purchasePrice ?? 0);
  const storageRuns: Run[] =
    nz === 0
      ? [
          b(tr("ไม่ควรจัดเก็บ Stock", "Don't keep stock"), "var(--danger)"),
          t(
            tr(
              " — ไม่มีการเบิกใช้เลยใน 6 เดือนที่ผ่านมา การถือ Stock ไว้เป็นการจมทุนโดยไม่จำเป็น",
              " — no issues at all in the last 6 months; holding stock just ties up money",
            ),
          ),
          ...(stockVal > 0
            ? [
                t(
                  tr(
                    ` ปัจจุบันมีมูลค่า Stock ค้างอยู่ ฿${money(stockVal)} ควรพิจารณาขายคืน Vendor หรือใช้งานในจุดอื่น`,
                    ` Stock currently worth ฿${money(stockVal)}; consider returning it to the vendor or using it elsewhere`,
                  ),
                ),
              ]
            : []),
        ]
      : nz <= 2
        ? [
            b(tr("ควรจัดเก็บแบบเบาบาง (Low Stock / Make-to-Order)", "Keep low stock (Low Stock / Make-to-Order)"), "var(--warning)"),
            t(
              tr(
                ` — ใช้งานเพียง ${nz}/6 เดือน ความถี่ต่ำ ไม่จำเป็นต้องสำรองมาก แนะนำให้สั่งเฉพาะเมื่อมีคำสั่งซื้อจริง (Make-to-Order) แทนการตั้ง MIN Stock ไว้ล่วงหน้าจำนวนมาก`,
                ` — used in only ${nz}/6 months, so little reserve is needed; order when there is real demand (Make-to-Order) instead of holding a large MIN stock`,
              )
            ),
          ]
        : nz <= 4
          ? [
              b(tr("ควรจัดเก็บในระดับปานกลาง", "Keep a moderate level"), "var(--accent2)"),
              t(
                tr(
                  ` — ใช้งาน ${nz}/6 เดือน มีความต้องการสม่ำเสมอพอสมควร เหมาะกับการตั้ง MIN Stock ไว้ในระดับที่ครอบคลุม Lead Time บวก Safety margin เล็กน้อย`,
                  ` — used in ${nz}/6 months with fairly steady demand; set a MIN stock that covers the lead time plus a small safety margin`,
                )
              ),
            ]
          : [
              b(tr("ควรจัดเก็บเป็น Stock หลัก (Core Stock Item)", "Keep as core stock (Core Stock Item)"), "var(--success)"),
              t(
                tr(
                  ` — ใช้งานต่อเนื่อง ${nz}/6 เดือน เป็นอะไหล่ที่มีความต้องการสูงและสม่ำเสมอ ควรคง MIN Stock ไว้เสมอเพื่อป้องกันการขาดแคลน`,
                  ` — used in ${nz}/6 months with high, steady demand; always keep a MIN stock to avoid shortages`,
                ),
              ),
            ];
  section5.push({ kind: "subheading", text: tr("📦 การจัดเก็บ Stock", "📦 Stock holding") });
  section5.push({ kind: "para", runs: storageRuns });
  if ((item.purchasePrice ?? 0) > 0 && stockVal > 0 && avgUsageVal > 0) {
    const monthsOfStock = (item.avgMonth ?? 0) > 0 ? item.stockQty / (item.avgMonth ?? 1) : 0;
    if (monthsOfStock > 12 && nz <= 2) {
      section5.push({
        kind: "para",
        runs: [
          t(tr(`ปัจจุบัน Stock ที่ถืออยู่เพียงพอสำหรับการใช้งานนานถึง `, `Current stock lasts about `)),
          b(tr(`~${monthsOfStock.toFixed(0)} เดือน`, `~${monthsOfStock.toFixed(0)} months`)),
          t(tr(" ที่อัตราการใช้ปัจจุบัน ถือว่า", " at the current usage rate, which is ")),
          b(tr("มากเกินความจำเป็น", "more than needed"), "var(--danger)"),
          t(tr(" สำหรับอะไหล่ที่ใช้ไม่บ่อย ควรพิจารณาลดจำนวนการสั่งซื้อในรอบถัดไป", " for a rarely used part; consider ordering less next time")),
        ],
      });
    }
  }

  // 5b. การปรับ SUM MIN
  section5.push({ kind: "subheading", text: tr("⚖️ การปรับ SUM MIN", "⚖️ SUM MIN adjustment") });
  if ((item.leadTimeDays ?? 0) > 0 && (item.avgMonth ?? 0) > 0) {
    const ltMonths = (item.leadTimeDays ?? 0) / 30;
    const safetyFactor = safetyFactorFor(a.volatilityPct);
    const recommendedMin = Math.ceil((item.avgMonth ?? 0) * ltMonths * safetyFactor);
    const diffFromCurrent = sumMin - recommendedMin;
    const diffPct = recommendedMin > 0 ? (diffFromCurrent / recommendedMin) * 100 : 0;

    section5.push({
      kind: "para",
      runs: [
        t(
          tr(
            `จากข้อมูลการใช้งานจริง (AVG/M=${fmt(item.avgMonth, 1)}, Lead Time=${item.leadTimeDays} วัน, ความผันผวน=${a.volatilityPct.toFixed(0)}%) คำนวณ MIN ที่เหมาะสมได้ประมาณ `,
            `From actual usage (AVG/M=${fmt(item.avgMonth, 1)}, Lead Time=${item.leadTimeDays} days, volatility=${a.volatilityPct.toFixed(0)}%) a suitable MIN is about `,
          )
        ),
        b(`${fmtN(recommendedMin, 0)} ${unit}`),
        t(
          tr(
            ` (สูตร: AVG/M × Lead Time ${ltMonths.toFixed(1)} เดือน × Safety Factor ${safetyFactor})`,
            ` (formula: AVG/M × Lead Time ${ltMonths.toFixed(1)} months × Safety Factor ${safetyFactor})`,
          ),
        ),
      ],
    });

    const diffAbs = Math.abs(diffPct).toFixed(0);
    if (Math.abs(diffPct) < 15) {
      section5.push({
        kind: "para",
        runs: [
          b(
            tr(`SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) ใกล้เคียงกับค่าที่เหมาะสมแล้ว`, `Current SUM MIN (${fmt(sumMin, 0)}) is already close to the suitable value`),
            "var(--success)",
          ),
          t(tr(` (ต่างกัน ${diffAbs}%) ไม่จำเป็นต้องปรับ`, ` (${diffAbs}% apart); no change needed`)),
        ],
      });
    } else if (diffFromCurrent > 0) {
      section5.push({
        kind: "para",
        runs: [
          b(
            tr(
              `SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) สูงกว่าค่าที่ควรจะเป็นประมาณ ${diffAbs}%`,
              `Current SUM MIN (${fmt(sumMin, 0)}) is about ${diffAbs}% higher than it should be`,
            ),
            "var(--warning)",
          ),
          t(tr(` อาจทำให้ถือ Stock เกินความจำเป็น แนะนำพิจารณาปรับลดลงเหลือประมาณ `, `, which may mean holding too much stock; consider lowering it to about `)),
          b(`${fmtN(recommendedMin, 0)} ${unit}`),
          t(tr(" เพื่อลดเงินทุนจม", " to free up tied-up money")),
        ],
      });
    } else {
      section5.push({
        kind: "para",
        runs: [
          b(
            tr(
              `SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) ต่ำกว่าค่าที่ควรจะเป็นประมาณ ${diffAbs}%`,
              `Current SUM MIN (${fmt(sumMin, 0)}) is about ${diffAbs}% lower than it should be`,
            ),
            "var(--danger)",
          ),
          t(tr(" มีความเสี่ยงขาดสต็อกในอนาคต แนะนำพิจารณาปรับเพิ่มเป็นประมาณ ", "; there is a risk of running out later, consider raising it to about ")),
          b(`${fmtN(recommendedMin, 0)} ${unit}`),
        ],
      });
    }

    if ((item.oldMin ?? 0) > 0) {
      const oldMin = item.oldMin ?? 0;
      const diff = sumMin - oldMin;
      const diffText = `${diff >= 0 ? "+" : ""}${fmt(diff, 0)}`;
      const trendVsOld =
        sumMin > oldMin ? tr("เพิ่มขึ้น", "raised") : sumMin < oldMin ? tr("ลดลง", "lowered") : tr("คงเดิม", "unchanged");
      section5.push({
        kind: "para",
        runs: [
          t(
            tr(
              `เทียบกับ Old MIN (${fmt(oldMin, 0)}): มีการปรับ MIN ${trendVsOld}แล้วในรอบล่าสุด (${diffText})`,
              `Compared with Old MIN (${fmt(oldMin, 0)}): the MIN was ${trendVsOld} in the latest round (${diffText})`,
            )
          ),
        ],
      });
    }
  } else {
    section5.push({
      kind: "para",
      runs: [
        t(
          tr(
            "ไม่สามารถคำนวณ MIN ที่เหมาะสมได้ เนื่องจากไม่มีข้อมูล Lead Time หรือ AVG/M ที่เพียงพอ",
            "Can't calculate a suitable MIN because there isn't enough Lead Time or AVG/M data",
          ),
        ),
      ],
    });
  }

  // 5c. ข้อสังเกตอื่นๆ
  const otherNotes: string[] = [];
  const oldMin = item.oldMin ?? 0;
  if (oldMin > 0 && sumMin > oldMin * 1.3) {
    otherNotes.push(
      tr(
        `Sum MIN ปัจจุบัน (${fmt(sumMin, 0)}) สูงกว่า Old MIN เดิม (${fmt(oldMin, 0)}) มากกว่า 30% ควรตรวจสอบว่าการปรับเพิ่มสอดคล้องกับแนวโน้มการใช้งานจริง`,
        `Current Sum MIN (${fmt(sumMin, 0)}) is more than 30% above the Old MIN (${fmt(oldMin, 0)}); check that the increase matches actual usage`,
      )
    );
  }
  if (oldMin > 0 && sumMin < oldMin * 0.7) {
    otherNotes.push(
      tr(
        `Sum MIN ปัจจุบัน (${fmt(sumMin, 0)}) ต่ำกว่า Old MIN เดิม (${fmt(oldMin, 0)}) มากกว่า 30% หากการใช้งานยังสูงอยู่ ควรพิจารณาทบทวน MIN อีกครั้ง`,
        `Current Sum MIN (${fmt(sumMin, 0)}) is more than 30% below the Old MIN (${fmt(oldMin, 0)}); if usage is still high, review the MIN again`,
      )
    );
  }
  if ((item.purchasePrice ?? 0) > 0 && a.recommendedOrderQty > 0) {
    const orderValue = a.recommendedOrderQty * (item.purchasePrice ?? 0);
    if (orderValue > 50000) {
      otherNotes.push(
        tr(
          `มูลค่าการสั่งซื้อที่แนะนำค่อนข้างสูง (฿${money(orderValue)}) ควรขออนุมัติงบประมาณล่วงหน้า`,
          `The suggested order value is high (฿${money(orderValue)}); get budget approval in advance`,
        ),
      );
    }
  }
  if ((item.leadTimeDays ?? 0) >= 90) {
    otherNotes.push(
      tr(
        `Lead Time ยาวนานมาก (${item.leadTimeDays} วัน) ควรพิจารณาหา Vendor สำรองหรือเพิ่ม Safety Stock เพื่อลดความเสี่ยงจากการส่งมอบล่าช้า`,
        `Very long lead time (${item.leadTimeDays} days); consider a backup vendor or more safety stock to reduce the risk of late delivery`,
      )
    );
  }
  if (otherNotes.length) {
    section5.push({ kind: "subheading", text: tr("📋 ข้อสังเกตอื่นๆ", "📋 Other notes") });
    section5.push({ kind: "bullets", items: otherNotes.map((n) => [t(n)]) });
  }

  sections.push({ title: tr("5. ข้อเสนอแนะเพิ่มเติม", "5. More suggestions"), blocks: section5 });

  return sections;
}

/**
 * The "เหตุผลที่ควรสั่ง" bullet list inside the recommended-purchase-plan card — mirrors
 * fillPRPlan's `reasons` array exactly. This is deliberately separate from buildNarrative's
 * section 3, which mirrors a different function (runDeepAnalysis) with much shorter wording.
 */
export function buildPlanReasons(item: ItemDetail, a: ItemAnalysis): Run[][] {
  const sumMin = item.sumMin ?? 0;
  const days = tr("วัน", "days");
  const pcs = tr("ชิ้น", "pcs");
  if (a.triggerMonth < 0) {
    return [
      [
        t(
          tr(
            `Stock คาดการณ์ทั้งเดือนนี้และ 5 เดือนข้างหน้า ยังสูงกว่า Sum MIN = ${fmt(sumMin, 0)} ทุกเดือน`,
            `Forecast stock for this month and the next 5 stays above Sum MIN = ${fmt(sumMin, 0)} every month`,
          ),
        ),
      ],
    ];
  }

  const reasons: Run[][] = [
    [
      t(tr("Stock คาดการณ์เดือน ", "Forecast stock for ")),
      b(a.triggerMonthLabel),
      t(" = "),
      b(fmtN(a.triggerValue, 1), "var(--danger)"),
      t(tr(" ต่ำกว่า Sum MIN = ", " is below Sum MIN = ")),
      b(fmt(sumMin, 0)),
    ],
  ];

  if (a.daysToOrder <= 0) {
    reasons.push([
      t("⚠️ Lead Time "),
      b(`${item.leadTimeDays ?? "—"} ${days}`),
      t(tr(" เกินเวลาที่เหลือ — ต้องสั่ง", " is longer than the time left — order ")),
      b(tr("ทันที", "now")),
    ]);
  } else {
    const dueDate = item.mustOrderByDate ? thaiDateShort(new Date(item.mustOrderByDate)) : "-";
    reasons.push([
      t("Lead Time "),
      b(`${item.leadTimeDays ?? "—"} ${days}`),
      t(tr(" → ต้องสั่งก่อนวันที่ ", " → order before ")),
      b(dueDate),
      t(tr(` (อีก ${a.daysToOrder} วัน)`, ` (in ${a.daysToOrder} days)`)),
    ]);
  }

  reasons.push([
    t("AVG/M = "),
    b(fmt(item.avgMonth, 1)),
    t(tr(" → สั่งเพิ่มให้ Stock ครบ Sum MIN = ", " → top stock back up to Sum MIN = ")),
    b(fmt(sumMin, 0)),
  ]);

  if (item.poQty > 0) {
    reasons.push([t(tr("มี PO รอรับ ", "Open PO ")), b(fmt(item.poQty, 0)), t(tr(" ชิ้น (รวมอยู่ใน Next แล้ว)", ` ${pcs} (already in Next)`))]);
  }
  if (item.backorderQty > 0) {
    reasons.push([t(tr("มี Sale Order ", "Sale orders ")), b(fmt(item.backorderQty, 0)), t(tr(" ชิ้น → ต้องสำรองไว้ด้วย", ` ${pcs} → reserve for these too`))]);
  }
  if (item.calcTrend === "UP") {
    reasons.push([
      t(tr(`เทรนด์ขาขึ้น +${a.trendPct.toFixed(1)}% ควรพิจารณาสั่งเพิ่ม`, `Rising trend +${a.trendPct.toFixed(1)}%; consider ordering more`)),
    ]);
  }

  return reasons;
}

export interface Suggestion {
  icon: string;
  text: string;
}

export function buildSuggestions(item: ItemDetail, a: ItemAnalysis): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (item.discontinuedModel) {
    suggestions.push({
      icon: "🛑",
      text: tr(
        `Model ยกเลิกขาย: ${item.discontinuedModel} — ระวังก่อนสั่งซื้อเพิ่ม เนื่องจากรุ่นที่ใช้อะไหล่นี้เลิกขายแล้ว`,
        `Discontinued model: ${item.discontinuedModel} — take care before ordering more, the model using this part is no longer sold`,
      ),
    });
  }
  // Warnings only — a replaced part or one under provision still gets its normal status and
  // suggested quantity; this just tells the reader to double-check before ordering more of it.
  if (item.calcStatus === "DANGER" || item.calcStatus === "WARN") {
    const replacement = splitReplacement(item.description2);
    if (replacement) {
      suggestions.push({
        icon: "🔁",
        text: tr(
          `ถูกทดแทนด้วย ${replacement.code} แต่รายการนี้เข้าเกณฑ์สั่งซื้อ ควรตรวจสอบก่อนสั่งเพิ่ม`,
          `Replaced by ${replacement.code}, but this item meets the order criteria; check before ordering more`,
        ),
      });
    }
    const provision = provisionMonths(item.provisionStatus);
    if (provision !== null) {
      suggestions.push({
        icon: "🏷️",
        text: tr(
          `${provisionLongLabel(provision)} แต่รายการนี้เข้าเกณฑ์สั่งซื้อ ควรตรวจสอบก่อนสั่งเพิ่ม`,
          `${provisionLongLabel(provision)}, but this item meets the order criteria; check before ordering more`,
        ),
      });
    }
  }
  if (item.calcStatus === "DANGER") {
    suggestions.push({
      icon: "🚨",
      text: tr(
        `วิกฤต — Next-0 (${fmtN(a.next[0], 1)}) ต่ำกว่า Sum MIN (${fmt(item.sumMin, 0)})`,
        `Critical — Next-0 (${fmtN(a.next[0], 1)}) is below Sum MIN (${fmt(item.sumMin, 0)})`,
      ),
    });
  } else if (item.calcStatus === "WARN") {
    suggestions.push({
      icon: "⚠️",
      text: tr(
        `Next-1 (${fmtN(a.next[1], 1)}) ใกล้ Sum MIN (${fmt(item.sumMin, 0)})`,
        `Next-1 (${fmtN(a.next[1], 1)}) is close to Sum MIN (${fmt(item.sumMin, 0)})`,
      ),
    });
  } else {
    suggestions.push({ icon: "✅", text: tr("Stock อยู่ในระดับปกติ", "Stock is at a normal level") });
  }
  if (a.trendPct > 8) {
    suggestions.push({
      icon: "📈",
      text: tr(`เทรนด์ขาขึ้น +${fmt(a.trendPct, 1)}% (6 เดือน)`, `Rising trend +${fmt(a.trendPct, 1)}% (6 months)`),
    });
  }
  if (a.trendPct < -8) {
    suggestions.push({
      icon: "📉",
      text: tr(`เทรนด์ขาลง ${fmt(a.trendPct, 1)}% (6 เดือน)`, `Falling trend ${fmt(a.trendPct, 1)}% (6 months)`),
    });
  }
  if (item.backorderQty > item.stockQty) {
    suggestions.push({ icon: "🚚", text: `SO (${fmt(item.backorderQty, 0)}) > Stock (${fmt(item.stockQty, 0)})` });
  }
  if (item.poQty > 0) {
    suggestions.push({ icon: "📦", text: tr(`PO รอรับ ${fmt(item.poQty, 0)} ชิ้น`, `Open PO ${fmt(item.poQty, 0)} pcs`) });
  }
  if ((item.prQtyCurrent ?? 0) > 0) {
    suggestions.push({ icon: "📋", text: `PR qty = ${fmt(item.prQtyCurrent, 0)}` });
  }
  if ((item.leadTimeDays ?? 0) > 0) {
    suggestions.push({ icon: "⏳", text: tr(`Lead Time ${fmt(item.leadTimeDays, 0)} วัน`, `Lead Time ${fmt(item.leadTimeDays, 0)} days`) });
  }
  if (item.remark) {
    suggestions.push({ icon: "📝", text: item.remark });
  }
  if (item.forModel) {
    suggestions.push({ icon: "🔩", text: item.forModel });
  }
  if (item.packingRule) {
    suggestions.push({
      icon: "🔢",
      text: tr(`PR ต้องเป็นจำนวนคูณของ ${item.packingRule.multipleOf}`, `PR must be a multiple of ${item.packingRule.multipleOf}`),
    });
  }
  return suggestions;
}

import type { ItemDetail } from "../api/items";
import type { ItemAnalysis } from "./analysis";
import { safetyFactorFor } from "./analysis";
import { thaiDateShort } from "./thaiMonths";

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

  // ── 1. แนวโน้มการใช้งาน ──
  const usageRuns: Run[] =
    nz === 6
      ? [t("มีการใช้งาน"), b("ต่อเนื่องทุกเดือน"), t(" (6/6 เดือน) แสดงถึงความต้องการที่สม่ำเสมอ เหมาะเป็นอะไหล่ stock หลัก")]
      : nz >= 3
        ? [
            t("มีการใช้งาน "),
            b(`${nz}/6 เดือน`),
            t(" ถือว่าใช้"),
            b("ค่อนข้างสม่ำเสมอ"),
            t(" แต่ยังมีบางเดือนที่ไม่มีการเบิกใช้"),
          ]
        : nz > 0
          ? [
              t("มีการใช้งานเพียง "),
              b(`${nz}/6 เดือน`),
              t(" ถือว่า"),
              b("ใช้ไม่ต่อเนื่อง"),
              t(" ควรพิจารณาว่าจำเป็นต้อง stock มากน้อยเพียงใด"),
            ]
          : [b("ไม่มีการใช้งานเลย"), t("ในช่วง 6 เดือนที่ผ่านมา ควรทบทวนความจำเป็นของ MIN Stock รายการนี้")];

  const peakLowRuns: Run[] = [t("เดือนที่ใช้"), b("มากที่สุด"), t(`: ${a.max.label} (${fmtN(a.max.value, 0)} หน่วย)`)];
  if (a.min.value < a.max.value) {
    peakLowRuns.push(t(" · เดือนที่ใช้"), b("น้อยที่สุด"), t(`: ${a.min.label} (${fmtN(a.min.value, 0)} หน่วย)`));
  }

  const section1: NarrativeBlock[] = [
    { kind: "para", runs: usageRuns },
    { kind: "para", runs: peakLowRuns },
  ];

  if (a.volatilityPct > 0) {
    const volRuns: Run[] =
      a.volatilityPct > 60
        ? [
            b("ผันผวนสูง", "var(--danger)"),
            t(` (ความเบี่ยงเบน ${a.volatilityPct.toFixed(0)}% จากค่าเฉลี่ย) ควรเผื่อ Safety Stock มากกว่าปกติ`),
          ]
        : a.volatilityPct > 30
          ? [b("ผันผวนปานกลาง", "var(--warning)"), t(` (${a.volatilityPct.toFixed(0)}%) การคาดการณ์มีความคลาดเคลื่อนได้บ้าง`)]
          : [b("ค่อนข้างคงที่", "var(--success)"), t(` (${a.volatilityPct.toFixed(0)}%) คาดการณ์ได้แม่นยำ`)];
    section1.push({ kind: "para", runs: [t("ความผันผวนของการใช้งาน: "), ...volRuns] });
  }

  const trendRuns: Run[] =
    item.calcTrend === "UP"
      ? [
          b(`ขาขึ้น +${a.trendPct.toFixed(1)}%`, "var(--success)"),
          t(" (เทียบ 3 เดือนหลังกับ 3 เดือนแรก) ความต้องการกำลังเพิ่มขึ้น"),
        ]
      : item.calcTrend === "DOWN"
        ? [b(`ขาลง ${a.trendPct.toFixed(1)}%`, "var(--danger)"), t(" ความต้องการกำลังลดลง อาจพิจารณาปรับลด MIN ในอนาคต")]
        : [
            b("ทรงตัว", "var(--flat)"),
            t(` (${a.trendPct >= 0 ? "+" : ""}${a.trendPct.toFixed(1)}%) ไม่มีการเปลี่ยนแปลงอย่างมีนัยสำคัญ`),
          ];
  section1.push({ kind: "para", runs: [t("แนวโน้มรวม: "), ...trendRuns] });

  sections.push({ title: "1. แนวโน้มการใช้งาน", blocks: section1 });

  // ── 2. ประเมินความเสี่ยง Stock (5 เดือนข้างหน้า) ──
  const section2: NarrativeBlock[] = [];
  let riskRuns: Run[];
  if (sumMin <= 0) {
    riskRuns = [t("ยังไม่ได้กำหนด Sum MIN (BC) สำหรับรายการนี้ จึงไม่สามารถประเมินความเสี่ยงเทียบกับเกณฑ์ขั้นต่ำได้")];
  } else if (belowCount === 0) {
    riskRuns = [
      b("ความเสี่ยงต่ำ", "var(--success)"),
      t(" — Stock คาดการณ์ทั้ง 5 เดือนข้างหน้ายังคงอยู่"),
      b("เหนือ Sum MIN"),
      t(` (${fmt(sumMin, 0)}) ตลอด ไม่มีความจำเป็นเร่งด่วน`),
    ];
  } else if (belowCount === 5) {
    riskRuns = [
      b("ความเสี่ยงสูงมาก", "var(--danger)"),
      t(" — Stock คาดการณ์"),
      b("ต่ำกว่า Sum MIN ตลอดทั้ง 5 เดือน"),
      t(` เริ่มตั้งแต่ ${a.triggerMonthLabel} หากไม่ดำเนินการจะขาดสต็อกต่อเนื่อง`),
    ];
  } else {
    // next[] is a running total that can climb back above Sum MIN if a PO receipt lands in a
    // later bucket, so a below-MIN month doesn't guarantee every month after it stays below too
    // — "ตั้งแต่เดือน X เป็นต้นไป" (continuously from month X onward) would misstate that as fact
    // whenever there's a recovery-then-dip in between. Only claim continuity when it's real.
    const isContinuousFromTrigger = a.next.slice(a.triggerMonth - 1).every((v) => v < sumMin);
    riskRuns = isContinuousFromTrigger
      ? [
          b("ความเสี่ยงปานกลางถึงสูง", "var(--warning)"),
          t(` — Stock จะตกลงต่ำกว่า Sum MIN (${fmt(sumMin, 0)}) ตั้งแต่เดือน `),
          b(a.triggerMonthLabel),
          t(` เป็นต้นไป (รวม ${belowCount}/5 เดือนที่ต่ำกว่าเกณฑ์)`),
        ]
      : [
          b("ความเสี่ยงปานกลางถึงสูง", "var(--warning)"),
          t(` — Stock จะตกลงต่ำกว่า Sum MIN (${fmt(sumMin, 0)}) ในบางช่วง เริ่มที่เดือน `),
          b(a.triggerMonthLabel),
          t(` (รวม ${belowCount}/5 เดือนที่ต่ำกว่าเกณฑ์ ไม่ต่อเนื่องกันทั้งหมด เนื่องจากมี PO เข้าคั่นกลาง)`),
        ];
  }
  section2.push({ kind: "para", runs: riskRuns });
  if (item.backorderQty > item.stockQty) {
    section2.push({
      kind: "para",
      runs: [
        t(`นอกจากนี้ Sale Order ที่ค้างอยู่ (${fmt(item.backorderQty, 0)} หน่วย) `),
        b("มากกว่า Stock ปัจจุบัน", "var(--danger)"),
        t(` (${fmt(item.stockQty, 0)} หน่วย) ซึ่งอาจกระทบการส่งมอบลูกค้าได้ทันที`),
      ],
    });
  }
  sections.push({ title: "2. ประเมินความเสี่ยง Stock (5 เดือนข้างหน้า)", blocks: section2 });

  // ── 3. เหตุผลและจำนวนที่ควรสั่งซื้อ ──
  const section3: NarrativeBlock[] = [];
  if (sumMin <= 0 || belowCount === 0) {
    section3.push({ kind: "para", runs: [b("ยังไม่จำเป็นต้องสั่งซื้อในขณะนี้", "var(--success)")] });
    if (sumMin > 0) {
      section3.push({
        kind: "para",
        runs: [t(`Stock คาดการณ์ปัจจุบันและในอนาคตยังสูงกว่า Sum MIN (${fmt(sumMin, 0)}) เพียงพอต่อความต้องการ`)],
      });
    }
  } else {
    section3.push({
      kind: "para",
      runs: [b("ควรพิจารณาสั่งซื้อ", "var(--danger)"), t(" จำนวนประมาณ "), b(`${fmtN(a.recommendedOrderQty, 0)} หน่วย`)],
    });
    const roundedForPacking = item.packingRule?.active && a.recommendedOrderQty !== a.orderQty;
    section3.push({
      kind: "para",
      runs: [
        t(
          `คำนวณจาก: Sum MIN (${fmt(sumMin, 0)}) − Stock คาดการณ์เดือน ${a.triggerMonthLabel} (${fmtN(a.triggerValue, 1)}) = ${fmtN(a.orderQty, 0)} หน่วย` +
            (roundedForPacking
              ? ` → ปัดขึ้นเป็น ${fmtN(a.recommendedOrderQty, 0)} หน่วย ตามกฎบรรจุภัณฑ์ (คูณของ ${item.packingRule!.multipleOf})`
              : "")
        ),
      ],
    });
    if (item.poQty > 0) {
      section3.push({
        kind: "para",
        runs: [
          t(`หมายเหตุ: มี PO รอรับอยู่แล้ว ${fmt(item.poQty, 0)} หน่วย ซึ่ง`),
          b("รวมอยู่ในตัวเลขคาดการณ์ข้างต้นแล้ว"),
          t(" ไม่ต้องหักซ้ำ"),
        ],
      });
    }
  }
  sections.push({ title: "3. เหตุผลและจำนวนที่ควรสั่งซื้อ", blocks: section3 });

  // ── 4. ช่วงเวลาที่เหมาะสมและข้อควรระวัง ──
  const section4: NarrativeBlock[] = [];
  if (sumMin > 0 && belowCount > 0) {
    if (a.daysToOrder <= 0) {
      section4.push({
        kind: "para",
        runs: [
          b("ควรเปิด PR ทันที", "var(--danger)"),
          t(
            ` เนื่องจาก Lead Time (${item.leadTimeDays ?? "—"} วัน) ใกล้เคียงหรือมากกว่าเวลาที่เหลือก่อน Stock จะต่ำกว่าเกณฑ์`
          ),
        ],
      });
    } else {
      const dueDate = item.mustOrderByDate ? thaiDateShort(new Date(item.mustOrderByDate)) : "-";
      section4.push({
        kind: "para",
        runs: [
          t("ควรสั่งซื้อ"),
          b(`ภายในวันที่ ${dueDate}`),
          t(
            ` (อีกประมาณ ${a.daysToOrder} วัน) โดยคำนวณจาก Lead Time ${item.leadTimeDays ?? "—"} วัน หักจากเดือนที่ Stock จะต่ำกว่าเกณฑ์`
          ),
        ],
      });
    }
    const cautions: string[] = [];
    if (a.volatilityPct > 50) cautions.push("การใช้งานผันผวนสูง ควรเผื่อจำนวนสั่งซื้อเพิ่มจากที่คำนวณไว้เล็กน้อย");
    if (item.calcTrend === "UP") {
      cautions.push("เทรนด์กำลังขาขึ้น หากสั่งจำนวนตามสูตรอาจไม่พอในระยะถัดไป ควรพิจารณาสั่งเผื่อเพิ่ม");
    }
    if ((item.leadTimeDays ?? 0) >= 60) {
      cautions.push(`Lead Time ค่อนข้างนาน (${item.leadTimeDays} วัน) ควรวางแผนล่วงหน้าและติดตามสถานะ PO อย่างใกล้ชิด`);
    }
    if (item.backorderQty > 0) {
      cautions.push(`มี Sale Order ค้างอยู่ ${fmt(item.backorderQty, 0)} หน่วย ควรยืนยันว่าจำนวนที่สั่งซื้อครอบคลุมความต้องการนี้แล้ว`);
    }
    if (cautions.length === 0) cautions.push("ไม่มีปัจจัยเสี่ยงเพิ่มเติมที่ต้องระวังเป็นพิเศษ");
    section4.push({ kind: "para", runs: [b("ข้อควรระวัง:")] });
    section4.push({ kind: "bullets", items: cautions.map((c) => [t(c)]) });
  } else {
    section4.push({
      kind: "para",
      runs: [t("ยังไม่มีความจำเป็นต้องกำหนดช่วงเวลาสั่งซื้อในขณะนี้ ระบบจะแจ้งเตือนอัตโนมัติเมื่อ Stock คาดการณ์เริ่มต่ำกว่า Sum MIN")],
    });
  }
  sections.push({ title: "4. ช่วงเวลาที่เหมาะสมและข้อควรระวัง", blocks: section4 });

  // ── 5. ข้อเสนอแนะเพิ่มเติม ──
  const section5: NarrativeBlock[] = [];

  // 5a. การจัดเก็บ Stock
  const stockVal = item.stockQty * (item.purchasePrice ?? 0);
  const avgUsageVal = (item.avgMonth ?? 0) * (item.purchasePrice ?? 0);
  const storageRuns: Run[] =
    nz === 0
      ? [
          b("ไม่ควรจัดเก็บ Stock", "var(--danger)"),
          t(" — ไม่มีการเบิกใช้เลยใน 6 เดือนที่ผ่านมา การถือ Stock ไว้เป็นการจมทุนโดยไม่จำเป็น"),
          ...(stockVal > 0
            ? [t(` ปัจจุบันมีมูลค่า Stock ค้างอยู่ ฿${money(stockVal)} ควรพิจารณาขายคืน Vendor หรือใช้งานในจุดอื่น`)]
            : []),
        ]
      : nz <= 2
        ? [
            b("ควรจัดเก็บแบบเบาบาง (Low Stock / Make-to-Order)", "var(--warning)"),
            t(
              ` — ใช้งานเพียง ${nz}/6 เดือน ความถี่ต่ำ ไม่จำเป็นต้องสำรองมาก แนะนำให้สั่งเฉพาะเมื่อมีคำสั่งซื้อจริง (Make-to-Order) แทนการตั้ง MIN Stock ไว้ล่วงหน้าจำนวนมาก`
            ),
          ]
        : nz <= 4
          ? [
              b("ควรจัดเก็บในระดับปานกลาง", "var(--accent2)"),
              t(
                ` — ใช้งาน ${nz}/6 เดือน มีความต้องการสม่ำเสมอพอสมควร เหมาะกับการตั้ง MIN Stock ไว้ในระดับที่ครอบคลุม Lead Time บวก Safety margin เล็กน้อย`
              ),
            ]
          : [
              b("ควรจัดเก็บเป็น Stock หลัก (Core Stock Item)", "var(--success)"),
              t(` — ใช้งานต่อเนื่อง ${nz}/6 เดือน เป็นอะไหล่ที่มีความต้องการสูงและสม่ำเสมอ ควรคง MIN Stock ไว้เสมอเพื่อป้องกันการขาดแคลน`),
            ];
  section5.push({ kind: "subheading", text: "📦 การจัดเก็บ Stock" });
  section5.push({ kind: "para", runs: storageRuns });
  if ((item.purchasePrice ?? 0) > 0 && stockVal > 0 && avgUsageVal > 0) {
    const monthsOfStock = (item.avgMonth ?? 0) > 0 ? item.stockQty / (item.avgMonth ?? 1) : 0;
    if (monthsOfStock > 12 && nz <= 2) {
      section5.push({
        kind: "para",
        runs: [
          t(`ปัจจุบัน Stock ที่ถืออยู่เพียงพอสำหรับการใช้งานนานถึง `),
          b(`~${monthsOfStock.toFixed(0)} เดือน`),
          t(" ที่อัตราการใช้ปัจจุบัน ถือว่า"),
          b("มากเกินความจำเป็น", "var(--danger)"),
          t(" สำหรับอะไหล่ที่ใช้ไม่บ่อย ควรพิจารณาลดจำนวนการสั่งซื้อในรอบถัดไป"),
        ],
      });
    }
  }

  // 5b. การปรับ SUM MIN
  section5.push({ kind: "subheading", text: "⚖️ การปรับ SUM MIN" });
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
          `จากข้อมูลการใช้งานจริง (AVG/M=${fmt(item.avgMonth, 1)}, Lead Time=${item.leadTimeDays} วัน, ความผันผวน=${a.volatilityPct.toFixed(0)}%) คำนวณ MIN ที่เหมาะสมได้ประมาณ `
        ),
        b(`${fmtN(recommendedMin, 0)} หน่วย`),
        t(` (สูตร: AVG/M × Lead Time ${ltMonths.toFixed(1)} เดือน × Safety Factor ${safetyFactor})`),
      ],
    });

    if (Math.abs(diffPct) < 15) {
      section5.push({
        kind: "para",
        runs: [
          b(`SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) ใกล้เคียงกับค่าที่เหมาะสมแล้ว`, "var(--success)"),
          t(` (ต่างกัน ${Math.abs(diffPct).toFixed(0)}%) ไม่จำเป็นต้องปรับ`),
        ],
      });
    } else if (diffFromCurrent > 0) {
      section5.push({
        kind: "para",
        runs: [
          b(`SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) สูงกว่าค่าที่ควรจะเป็นประมาณ ${Math.abs(diffPct).toFixed(0)}%`, "var(--warning)"),
          t(` อาจทำให้ถือ Stock เกินความจำเป็น แนะนำพิจารณาปรับลดลงเหลือประมาณ `),
          b(`${fmtN(recommendedMin, 0)} หน่วย`),
          t(" เพื่อลดเงินทุนจม"),
        ],
      });
    } else {
      section5.push({
        kind: "para",
        runs: [
          b(`SUM MIN ปัจจุบัน (${fmt(sumMin, 0)}) ต่ำกว่าค่าที่ควรจะเป็นประมาณ ${Math.abs(diffPct).toFixed(0)}%`, "var(--danger)"),
          t(" มีความเสี่ยงขาดสต็อกในอนาคต แนะนำพิจารณาปรับเพิ่มเป็นประมาณ "),
          b(`${fmtN(recommendedMin, 0)} หน่วย`),
        ],
      });
    }

    if ((item.oldMin ?? 0) > 0) {
      const oldMin = item.oldMin ?? 0;
      const trendVsOld = sumMin > oldMin ? "เพิ่มขึ้น" : sumMin < oldMin ? "ลดลง" : "คงเดิม";
      const diff = sumMin - oldMin;
      section5.push({
        kind: "para",
        runs: [
          t(
            `เทียบกับ Old MIN (${fmt(oldMin, 0)}): มีการปรับ MIN ${trendVsOld}แล้วในรอบล่าสุด (${diff >= 0 ? "+" : ""}${fmt(diff, 0)})`
          ),
        ],
      });
    }
  } else {
    section5.push({
      kind: "para",
      runs: [t("ไม่สามารถคำนวณ MIN ที่เหมาะสมได้ เนื่องจากไม่มีข้อมูล Lead Time หรือ AVG/M ที่เพียงพอ")],
    });
  }

  // 5c. ข้อสังเกตอื่นๆ
  const otherNotes: string[] = [];
  const oldMin = item.oldMin ?? 0;
  if (oldMin > 0 && sumMin > oldMin * 1.3) {
    otherNotes.push(
      `Sum MIN ปัจจุบัน (${fmt(sumMin, 0)}) สูงกว่า Old MIN เดิม (${fmt(oldMin, 0)}) มากกว่า 30% ควรตรวจสอบว่าการปรับเพิ่มสอดคล้องกับแนวโน้มการใช้งานจริง`
    );
  }
  if (oldMin > 0 && sumMin < oldMin * 0.7) {
    otherNotes.push(
      `Sum MIN ปัจจุบัน (${fmt(sumMin, 0)}) ต่ำกว่า Old MIN เดิม (${fmt(oldMin, 0)}) มากกว่า 30% หากการใช้งานยังสูงอยู่ ควรพิจารณาทบทวน MIN อีกครั้ง`
    );
  }
  if ((item.purchasePrice ?? 0) > 0 && a.recommendedOrderQty > 0) {
    const orderValue = a.recommendedOrderQty * (item.purchasePrice ?? 0);
    if (orderValue > 50000) {
      otherNotes.push(`มูลค่าการสั่งซื้อที่แนะนำค่อนข้างสูง (฿${money(orderValue)}) ควรขออนุมัติงบประมาณล่วงหน้า`);
    }
  }
  if ((item.leadTimeDays ?? 0) >= 90) {
    otherNotes.push(
      `Lead Time ยาวนานมาก (${item.leadTimeDays} วัน) ควรพิจารณาหา Vendor สำรองหรือเพิ่ม Safety Stock เพื่อลดความเสี่ยงจากการส่งมอบล่าช้า`
    );
  }
  if (otherNotes.length) {
    section5.push({ kind: "subheading", text: "📋 ข้อสังเกตอื่นๆ" });
    section5.push({ kind: "bullets", items: otherNotes.map((n) => [t(n)]) });
  }

  sections.push({ title: "5. ข้อเสนอแนะเพิ่มเติม", blocks: section5 });

  return sections;
}

/**
 * The "เหตุผลที่ควรสั่ง" bullet list inside the recommended-purchase-plan card — mirrors
 * fillPRPlan's `reasons` array exactly. This is deliberately separate from buildNarrative's
 * section 3, which mirrors a different function (runDeepAnalysis) with much shorter wording.
 */
export function buildPlanReasons(item: ItemDetail, a: ItemAnalysis): Run[][] {
  const sumMin = item.sumMin ?? 0;
  if (a.triggerMonth < 0) {
    return [[t(`Stock คาดการณ์ทั้ง 5 เดือนข้างหน้า ยังสูงกว่า Sum MIN (BC) = ${fmt(sumMin, 0)} ทุกเดือน`)]];
  }

  const reasons: Run[][] = [
    [
      t("Stock คาดการณ์เดือน "),
      b(`${a.triggerMonthLabel} (${a.triggerLetter})`),
      t(" = "),
      b(fmtN(a.triggerValue, 1), "var(--danger)"),
      t(" ต่ำกว่า Sum MIN (BC) = "),
      b(fmt(sumMin, 0)),
    ],
  ];

  if (a.daysToOrder <= 0) {
    reasons.push([t("⚠️ Lead Time "), b(`${item.leadTimeDays ?? "—"} วัน`), t(" เกินเวลาที่เหลือ — ต้องสั่ง"), b("ทันที")]);
  } else {
    const dueDate = item.mustOrderByDate ? thaiDateShort(new Date(item.mustOrderByDate)) : "-";
    reasons.push([
      t("Lead Time "),
      b(`${item.leadTimeDays ?? "—"} วัน`),
      t(" → ต้องสั่งก่อนวันที่ "),
      b(dueDate),
      t(` (อีก ${a.daysToOrder} วัน)`),
    ]);
  }

  reasons.push([t("AVG/M (AW) = "), b(fmt(item.avgMonth, 1)), t(" → สั่งเพิ่มให้ Stock ครบ Sum MIN = "), b(fmt(sumMin, 0))]);

  if (item.poQty > 0) {
    reasons.push([t("มี PO รอรับ "), b(fmt(item.poQty, 0)), t(" ชิ้น (รวมอยู่ใน Next แล้ว)")]);
  }
  if (item.backorderQty > 0) {
    reasons.push([t("มี Sale Order "), b(fmt(item.backorderQty, 0)), t(" ชิ้น → ต้องสำรองไว้ด้วย")]);
  }
  if (item.calcTrend === "UP") {
    reasons.push([t(`เทรนด์ขาขึ้น +${a.trendPct.toFixed(1)}% ควรพิจารณาสั่งเพิ่ม`)]);
  }

  return reasons;
}

export interface Suggestion {
  icon: string;
  text: string;
}

export function buildSuggestions(item: ItemDetail, a: ItemAnalysis): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (item.calcStatus === "DANGER") {
    suggestions.push({
      icon: "🚨",
      text: `วิกฤต — Next-1/BH (${fmtN(a.next[0], 1)}) ต่ำกว่า Sum MIN/BC (${fmt(item.sumMin, 0)})`,
    });
  } else if (item.calcStatus === "WARN") {
    suggestions.push({
      icon: "⚠️",
      text: `Next-2/BI (${fmtN(a.next[1], 1)}) ใกล้ Sum MIN/BC (${fmt(item.sumMin, 0)})`,
    });
  } else {
    suggestions.push({ icon: "✅", text: "Stock อยู่ในระดับปกติ" });
  }
  if (a.trendPct > 8) {
    suggestions.push({ icon: "📈", text: `เทรนด์ขาขึ้น +${fmt(a.trendPct, 1)}% (AO-AT 6M)` });
  }
  if (a.trendPct < -8) {
    suggestions.push({ icon: "📉", text: `เทรนด์ขาลง ${fmt(a.trendPct, 1)}% (AO-AT 6M)` });
  }
  if (item.backorderQty > item.stockQty) {
    suggestions.push({ icon: "🚚", text: `SO/BF (${fmt(item.backorderQty, 0)}) > Stock/BE (${fmt(item.stockQty, 0)})` });
  }
  if (item.poQty > 0) {
    suggestions.push({ icon: "📦", text: `PO รอรับ ${fmt(item.poQty, 0)} ชิ้น (BD=M)` });
  }
  if ((item.prQtyCurrent ?? 0) > 0) {
    suggestions.push({ icon: "📋", text: `PR qty (BG) = ${fmt(item.prQtyCurrent, 0)}` });
  }
  if ((item.leadTimeDays ?? 0) > 0) {
    suggestions.push({ icon: "⏳", text: `Lead Time ${fmt(item.leadTimeDays, 0)} วัน (AX)` });
  }
  if (item.remark) {
    suggestions.push({ icon: "📝", text: item.remark });
  }
  if (item.forModel) {
    suggestions.push({ icon: "🔩", text: item.forModel });
  }
  if (item.packingRule) {
    suggestions.push({ icon: "🔢", text: `PR ต้องเป็นจำนวนคูณของ ${item.packingRule.multipleOf}` });
  }
  return suggestions;
}

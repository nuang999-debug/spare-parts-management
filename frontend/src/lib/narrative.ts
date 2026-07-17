import type { ItemDetail } from "../api/items";
import type { ItemAnalysis } from "./analysis";
import { safetyFactorFor } from "./analysis";

export interface NarrativeSection {
  title: string;
  lines: string[];
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function buildNarrative(item: ItemDetail, a: ItemAnalysis): NarrativeSection[] {
  const sections: NarrativeSection[] = [];

  // 1. Usage trend
  const continuityLine =
    a.nonZeroMonths === 6
      ? `มีการใช้งานต่อเนื่องทุกเดือน (6/6 เดือน) แสดงถึงความต้องการที่สม่ำเสมอ เหมาะเป็นอะไหล่หลัก`
      : a.nonZeroMonths >= 3
        ? `มีการใช้งาน ${a.nonZeroMonths}/6 เดือน ถือว่าใช้งานค่อนข้างสม่ำเสมอ`
        : `มีการใช้งานเพียง ${a.nonZeroMonths}/6 เดือน อาจเป็นอะไหล่ที่ใช้ไม่บ่อย ควรพิจารณาความจำเป็นของ Stock`;

  const volLabel = a.volatilityPct > 50 ? "ผันผวนสูง" : a.volatilityPct > 30 ? "ผันผวนปานกลาง" : "ผันผวนต่ำ";
  const volNote =
    a.volatilityPct > 50
      ? "การคาดการณ์อาจคลาดเคลื่อนได้มาก"
      : a.volatilityPct > 30
        ? "การคาดการณ์มีความคลาดเคลื่อนได้บ้าง"
        : "การคาดการณ์ค่อนข้างแม่นยำ";

  const trendDir = a.trendPct > 8 ? "ขาขึ้น" : a.trendPct < -8 ? "ขาลง" : "ทรงตัว";
  const trendNote =
    trendDir === "ขาลง"
      ? "ความต้องการกำลังลดลง อาจพิจารณาปรับลด MIN ในอนาคต"
      : trendDir === "ขาขึ้น"
        ? "ความต้องการกำลังเพิ่มขึ้น ควรพิจารณาปรับเพิ่ม MIN"
        : "ความต้องการค่อนข้างคงที่";

  sections.push({
    title: "1. แนวโน้มการใช้งาน",
    lines: [
      continuityLine,
      `เดือนที่ใช้มากที่สุด: ${a.max.label} (${fmt(a.max.value, 0)} หน่วย) · เดือนที่ใช้น้อยที่สุด: ${a.min.label} (${fmt(a.min.value, 0)} หน่วย)`,
      `ความผันผวนของการใช้งาน: ${volLabel} (${fmt(a.volatilityPct, 0)}%) ${volNote}`,
      `แนวโน้มรวม: ${trendDir} ${fmt(Math.abs(a.trendPct), 1)}% ${trendNote}`,
    ],
  });

  // 2. Stock risk
  const riskLine =
    a.triggerMonth === -1
      ? "ความเสี่ยงต่ำ — Stock คาดการณ์ยังคงสูงกว่า Sum MIN ตลอด 5 เดือนข้างหน้า"
      : a.allFiveBelowMin
        ? `ความเสี่ยงสูงมาก — Stock คาดการณ์ต่ำกว่า Sum MIN ตลอดทั้ง 5 เดือน เริ่มตั้งแต่ ${a.triggerMonthLabel} หากไม่ดำเนินการจะขาดสต็อกต่อเนื่อง`
        : `ความเสี่ยงสูง — Stock คาดการณ์จะต่ำกว่า Sum MIN ตั้งแต่เดือน ${a.triggerMonthLabel} เป็นต้นไป ควรวางแผนสั่งซื้อล่วงหน้า`;

  sections.push({ title: "2. ประเมินความเสี่ยง STOCK (5 เดือนข้างหน้า)", lines: [riskLine] });

  // 3. Order reasoning (only if a trigger exists)
  if (a.triggerMonth > 0) {
    const lines = [
      `ควรพิจารณาสั่งซื้อ จำนวนประมาณ ${fmt(a.orderQty, 0)} หน่วย`,
      `คำนวณจาก: Sum MIN (${fmt(item.sumMin, 0)}) – Stock คาดการณ์เดือน ${a.triggerMonthLabel} (${fmt(a.triggerValue, 1)}) = ${fmt(a.orderQty, 0)} หน่วย`,
    ];
    if (item.poQty > 0) {
      lines.push(`หมายเหตุ: มี PO รอรับอยู่แล้ว ${fmt(item.poQty, 0)} ซึ่งรวมอยู่ในตัวเลขคาดการณ์ข้างต้นแล้ว ไม่ต้องหักซ้ำ`);
    }
    sections.push({ title: "3. เหตุผลและจำนวนที่ควรสั่งซื้อ", lines });
  }

  // 4. Timing and cautions
  if (a.triggerMonth > 0) {
    const timingLines: string[] = [];
    if (a.daysToOrder <= 0) {
      timingLines.push(
        `ควรเปิด PR ทันที เนื่องจาก Lead Time (${fmt(item.leadTimeDays, 0)} วัน) ใกล้เคียงหรือมากกว่าเวลาที่เหลือก่อน Stock จะต่ำกว่าเกณฑ์`
      );
    } else {
      const dueDate = item.mustOrderByDate ? new Date(item.mustOrderByDate).toLocaleDateString("th-TH") : "-";
      timingLines.push(`ควรเปิด PR ภายในวันที่ ${dueDate} เพื่อให้ของมาทันก่อน Stock ต่ำกว่าเกณฑ์ในเดือน ${a.triggerMonthLabel}`);
    }
    const cautions: string[] = [];
    if ((item.leadTimeDays ?? 0) > 45) {
      cautions.push("Lead Time ค่อนข้างนาน ควรวางแผนล่วงหน้าและติดตามสถานะ PO อย่างใกล้ชิด");
    }
    if (item.backorderQty > 0) {
      cautions.push(`มี Sale Order ค้างอยู่ ${fmt(item.backorderQty, 0)} หน่วย ควรยืนยันว่าจำนวนที่สั่งซื้อครอบคลุมความต้องการนี้แล้ว`);
    }
    if (cautions.length) timingLines.push(`ข้อควรระวัง: ${cautions.join(" · ")}`);
    sections.push({ title: "4. ช่วงเวลาที่เหมาะสมและข้อควรระวัง", lines: timingLines });
  }

  // 5. Additional suggestions
  const extra: string[] = [];
  if (a.nonZeroMonths >= 5) {
    extra.push(
      `📦 การจัดเก็บ Stock: ควรจัดเก็บเป็น Stock หลัก (Core Stock Item) — ใช้งานต่อเนื่อง ${a.nonZeroMonths}/6 เดือน เป็นอะไหล่ที่มีความต้องการและสม่ำเสมอ ควรคง MIN Stock ไว้เสมอเพื่อป้องกันการขาดแคลน`
    );
  }
  if (a.minDiffPct != null && Math.abs(a.minDiffPct) > 15) {
    const ltMonths = (item.leadTimeDays ?? 0) / 30;
    const safetyFactor = safetyFactorFor(a.volatilityPct);
    extra.push(
      `🔄 การปรับ SUM MIN: จากข้อมูลการใช้งานจริง (AVG/M:${fmt(item.avgMonth, 1)}, Lead Time=${fmt(item.leadTimeDays, 0)} วัน, ความผันผวน:${fmt(a.volatilityPct, 0)}%) คำนวณ MIN ที่เหมาะสมได้ประมาณ ${fmt(item.recommendedMin, 0)} หน่วย (สูตร: AVG/M × Lead Time ${fmt(ltMonths, 1)} เดือน × Safety Factor ${safetyFactor})`
    );
    extra.push(
      a.minDiffPct > 0
        ? `SUM MIN ปัจจุบัน (${fmt(item.sumMin, 0)}) ต่ำกว่าค่าที่เหมาะสม (ต่างกัน ${fmt(Math.abs(a.minDiffPct), 0)}%) ควรพิจารณาปรับเพิ่ม`
        : `SUM MIN ปัจจุบัน (${fmt(item.sumMin, 0)}) สูงกว่าค่าที่เหมาะสม (ต่างกัน ${fmt(Math.abs(a.minDiffPct), 0)}%) ควรพิจารณาปรับลด`
    );
  } else if (a.minDiffPct != null) {
    extra.push(`SUM MIN ปัจจุบัน (${fmt(item.sumMin, 0)}) ใกล้เคียงกับค่าที่เหมาะสมแล้ว (ต่างกัน ${fmt(Math.abs(a.minDiffPct), 0)}%) ไม่จำเป็นต้องปรับ`);
  }
  if (extra.length) sections.push({ title: "5. ข้อเสนอแนะเพิ่มเติม", lines: extra });

  return sections;
}

export interface Suggestion {
  icon: string;
  text: string;
}

export function buildSuggestions(item: ItemDetail, a: ItemAnalysis): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (a.triggerMonth === 1) {
    suggestions.push({
      icon: "🔺",
      text: `วิกฤต — Next-1/${a.triggerLetter} (${fmt(a.triggerValue, 1)}) ต่ำกว่า Sum MIN/BC (${fmt(item.sumMin, 0)})`,
    });
  }
  if (a.trendPct < -8) {
    suggestions.push({ icon: "📉", text: `เทรนด์ขาลง ${fmt(a.trendPct, 1)}% (AO-AT 6M)` });
  }
  if (item.poQty > 0) {
    suggestions.push({ icon: "📦", text: `PO รอรับ ${fmt(item.poQty, 0)} ชิ้น (BD=M)` });
  }
  if (item.leadTimeDays != null) {
    suggestions.push({ icon: "⏱", text: `Lead Time ${fmt(item.leadTimeDays, 0)} วัน (AX)` });
  }
  if (item.packingRule) {
    suggestions.push({ icon: "📋", text: `PR ต้องเป็นจำนวนคูณของ ${item.packingRule.multipleOf}` });
  }
  if (item.forModel) {
    suggestions.push({ icon: "🏷", text: item.forModel });
  }
  return suggestions;
}

// Шкала комиссии риэлтора по числу закрытых сделок.
// Совпадает с calc_commission_rate() в backend/erp-api/index.py
export type Qualification = "novice" | "inTopic" | "pro";

export interface QualInfo {
  key: Qualification;
  label: string;
  rate: number;          // %
  minDeals: number;
  nextThreshold: number | null; // сколько сделок до следующего уровня (null = максимум)
}

export const QUALIFICATIONS: Record<Qualification, Omit<QualInfo, "nextThreshold">> = {
  novice:  { key: "novice",  label: "Новичок", rate: 3.0, minDeals: 0 },
  inTopic: { key: "inTopic", label: "В теме",  rate: 4.5, minDeals: 5 },
  pro:     { key: "pro",     label: "Профи",   rate: 5.5, minDeals: 9 },
};

export function qualificationFor(closedCount: number): Qualification {
  if (closedCount >= 9) return "pro";
  if (closedCount >= 5) return "inTopic";
  return "novice";
}

export function commissionRate(closedCount: number): number {
  return QUALIFICATIONS[qualificationFor(closedCount)].rate;
}

export function nextLevelInfo(closedCount: number): { remaining: number; next: Qualification } | null {
  if (closedCount < 5) return { remaining: 5 - closedCount, next: "inTopic" };
  if (closedCount < 9) return { remaining: 9 - closedCount, next: "pro" };
  return null;
}

export function progressToNext(closedCount: number): number {
  // % заполнения прогресс-бара до следующего уровня (0..100)
  if (closedCount >= 9) return 100;
  if (closedCount >= 5) {
    return Math.round(((closedCount - 5) / (9 - 5)) * 100);
  }
  return Math.round((closedCount / 5) * 100);
}

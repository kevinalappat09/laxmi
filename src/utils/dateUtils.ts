/**
 * @module dateUtils
 * @description Provides UTC date arithmetic helpers shared across scheduling and reminder logic.
 * @stability stable
 */

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

export function toDateOnly(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

export function createDateWithClampedDay(
    year: number,
    monthZeroBased: number,
    dayOfMonth: number
): Date {
    const maxDay = new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
    const clampedDay = Math.min(dayOfMonth, maxDay);
    return new Date(Date.UTC(year, monthZeroBased, clampedDay));
}

/**
 * Returns the next date (at UTC midnight) matching dayOfMonth on or after the reference date.
 * The day is clamped to the length of the target month.
 */
export function nextDayOfMonthOnOrAfter(reference: Date, dayOfMonth: number): Date {
    const refDateOnly = toDateOnly(reference);
    const candidate = createDateWithClampedDay(
        refDateOnly.getUTCFullYear(),
        refDateOnly.getUTCMonth(),
        dayOfMonth
    );

    if (candidate.getTime() >= refDateOnly.getTime()) {
        return candidate;
    }

    let month = refDateOnly.getUTCMonth() + 1;
    let year = refDateOnly.getUTCFullYear();
    if (month > 11) {
        month = 0;
        year += 1;
    }

    return createDateWithClampedDay(year, month, dayOfMonth);
}

/**
 * Returns the whole number of days from `from` to `to`, based on UTC midnight boundaries.
 */
export function daysBetween(from: Date, to: Date): number {
    const fromMs = toDateOnly(from).getTime();
    const toMs = toDateOnly(to).getTime();
    return Math.round((toMs - fromMs) / 86_400_000);
}

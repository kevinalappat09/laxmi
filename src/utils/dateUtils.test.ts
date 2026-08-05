import {
    addDays,
    createDateWithClampedDay,
    daysBetween,
    nextDayOfMonthOnOrAfter,
    toDateOnly,
} from "./dateUtils";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("dateUtils", () => {
    describe("addDays", () => {
        test("adds and subtracts days across month boundaries", () => {
            expect(addDays(utc(2024, 1, 31), 1).getTime()).toBe(utc(2024, 2, 1).getTime());
            expect(addDays(utc(2024, 3, 1), -1).getTime()).toBe(utc(2024, 2, 29).getTime());
        });
    });

    describe("toDateOnly", () => {
        test("strips time to UTC midnight", () => {
            const result = toDateOnly(new Date(Date.UTC(2024, 0, 5, 13, 30, 0)));
            expect(result.getTime()).toBe(utc(2024, 1, 5).getTime());
        });
    });

    describe("createDateWithClampedDay", () => {
        test("clamps day to the last day of the month", () => {
            expect(createDateWithClampedDay(2024, 1, 31).getTime()).toBe(
                utc(2024, 2, 29).getTime()
            );
            expect(createDateWithClampedDay(2023, 1, 31).getTime()).toBe(
                utc(2023, 2, 28).getTime()
            );
        });
    });

    describe("nextDayOfMonthOnOrAfter", () => {
        test("returns same month when the day is still upcoming", () => {
            expect(nextDayOfMonthOnOrAfter(utc(2024, 1, 8), 10).getTime()).toBe(
                utc(2024, 1, 10).getTime()
            );
        });

        test("returns the reference day itself when it matches", () => {
            expect(nextDayOfMonthOnOrAfter(utc(2024, 1, 10), 10).getTime()).toBe(
                utc(2024, 1, 10).getTime()
            );
        });

        test("rolls into the next month when the day has passed", () => {
            expect(nextDayOfMonthOnOrAfter(utc(2024, 1, 15), 10).getTime()).toBe(
                utc(2024, 2, 10).getTime()
            );
        });

        test("clamps when the next month is shorter", () => {
            expect(nextDayOfMonthOnOrAfter(utc(2024, 2, 15), 31).getTime()).toBe(
                utc(2024, 2, 29).getTime()
            );
        });

        test("rolls year boundary", () => {
            expect(nextDayOfMonthOnOrAfter(utc(2024, 12, 20), 5).getTime()).toBe(
                utc(2025, 1, 5).getTime()
            );
        });
    });

    describe("daysBetween", () => {
        test("counts whole UTC days", () => {
            expect(daysBetween(utc(2024, 1, 8), utc(2024, 1, 10))).toBe(2);
            expect(daysBetween(utc(2024, 1, 10), utc(2024, 1, 10))).toBe(0);
            expect(daysBetween(utc(2024, 1, 10), utc(2024, 1, 8))).toBe(-2);
        });
    });
});

/**
 * Standard 5-field cron expression parser.
 *
 * Fields: minute hour day-of-month month day-of-week
 *   minute:       0-59
 *   hour:         0-23
 *   day-of-month: 1-31
 *   month:        1-12 (or JAN-DEC)
 *   day-of-week:  0-6  (0=Sun, or SUN-SAT)
 *
 * Supports: wildcard (*), ranges (1-5), steps (star/5, 1-10/2), lists (1,3,5)
 */

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface CronField {
  /** Allowed values for this field. */
  values: Set<number>;
}

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
  raw: string;
}

export class CronParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CronParseError";
  }
}

// Parse a single cron field into a set of allowed values.
// Supports: wildcard, ranges (1-5), steps (e.g. star-slash-5), lists (1,3,5), single values.
function parseField(raw: string, min: number, max: number, names?: Record<string, number>): Set<number> {
  const values = new Set<number>();

  // Replace named values (day/month names) with their numeric equivalents
  let normalized = raw.toLowerCase();
  if (names) {
    for (const [name, val] of Object.entries(names)) {
      normalized = normalized.replace(new RegExp(name, "gi"), String(val));
    }
  }

  // Comma-separated parts
  const parts = normalized.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) throw new CronParseError(`Empty field part in "${raw}"`);

    // Step: */N or range/step
    const stepMatch = trimmed.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const base = stepMatch ? stepMatch[1] : trimmed;

    if (step < 1) throw new CronParseError(`Invalid step value in "${raw}"`);

    if (base === "*") {
      // All values with step
      for (let i = min; i <= max; i += step) {
        values.add(i);
      }
    } else if (base.includes("-")) {
      // Range: N-M
      const [startStr, endStr] = base.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) throw new CronParseError(`Invalid range "${base}" in "${raw}"`);
      if (start < min || end > max || start > end) {
        throw new CronParseError(`Range ${start}-${end} out of bounds [${min}-${max}] in "${raw}"`);
      }
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else {
      // Single value
      const val = parseInt(base, 10);
      if (isNaN(val)) throw new CronParseError(`Invalid value "${base}" in "${raw}"`);
      if (val < min || val > max) {
        throw new CronParseError(`Value ${val} out of bounds [${min}-${max}] in "${raw}"`);
      }
      if (step > 1) {
        for (let i = val; i <= max; i += step) {
          values.add(i);
        }
      } else {
        values.add(val);
      }
    }
  }

  return values;
}

/**
 * Parse a standard 5-field cron expression.
 * @throws {CronParseError} on invalid syntax
 */
export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new CronParseError(
      `Expected 5 fields (minute hour day-of-month month day-of-week), got ${parts.length} in "${expression}"`
    );
  }

  return {
    minute: { values: parseField(parts[0], 0, 59) },
    hour: { values: parseField(parts[1], 0, 23) },
    dayOfMonth: { values: parseField(parts[2], 1, 31) },
    month: { values: parseField(parts[3], 1, 12, MONTH_NAMES) },
    dayOfWeek: { values: parseField(parts[4], 0, 6, DAY_NAMES) },
    raw: expression,
  };
}

/**
 * Check if a given Date matches a parsed cron expression.
 * Both day-of-month and day-of-week must match (standard cron behavior: AND).
 */
export function matchesCron(cron: ParsedCron, date: Date): boolean {
  return (
    cron.minute.values.has(date.getMinutes()) &&
    cron.hour.values.has(date.getHours()) &&
    cron.dayOfMonth.values.has(date.getDate()) &&
    cron.month.values.has(date.getMonth() + 1) &&
    cron.dayOfWeek.values.has(date.getDay())
  );
}

/**
 * Find the next N trigger times after a given date.
 * Searches minute-by-minute (max 2 years lookahead to avoid infinite loops).
 */
export function nextTriggerTimes(cron: ParsedCron, after: Date, count: number = 5): Date[] {
  const results: Date[] = [];
  const cursor = new Date(after.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1); // start from next minute

  const maxIterations = 366 * 24 * 60; // ~2 years of minutes
  for (let i = 0; i < maxIterations && results.length < count; i++) {
    if (matchesCron(cron, cursor)) {
      results.push(new Date(cursor.getTime()));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return results;
}

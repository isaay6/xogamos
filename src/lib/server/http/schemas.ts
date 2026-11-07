// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Fecha de calendario `YYYY-MM-DD` que existe de verdad. */
export const LocalDate = z.string().refine((v) => {
	const m = LOCAL_DATE.exec(v);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const date = new Date(Date.UTC(y, mo - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}, 'Invalid calendar date');

/** Instante ISO 8601 con desfase (o Z), transformado a Date. */
export const IsoInstant = z
	.string()
	.regex(WITH_OFFSET, 'Instant must be ISO 8601 with offset')
	.transform((v, ctx) => {
		const date = new Date(v);
		if (Number.isNaN(date.getTime()) || !isRealCalendar(v)) {
			ctx.addIssue({ code: 'custom', message: 'Invalid instant' });
			return z.NEVER;
		}
		return date;
	});

function isRealCalendar(iso: string): boolean {
	return LocalDate.safeParse(iso.slice(0, 10)).success;
}

export const Uuid = z.uuid();

export const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const MAX_RANGE_DAYS = 92;

const DAY_MS = 86_400_000;
const utcDay = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** `from` y `to` (fechas locales, `to` incluido): `from <= to` y 92 días como mucho. */
export const DateRangeQuery = z
	.object({ from: LocalDate, to: LocalDate })
	.refine((r) => r.from <= r.to, { message: '`from` must not be after `to`', path: ['to'] })
	.refine((r) => (utcDay(r.to) - utcDay(r.from)) / DAY_MS + 1 <= MAX_RANGE_DAYS, {
		message: `Range must not exceed ${MAX_RANGE_DAYS} days`,
		path: ['to']
	});

/** Lunes de una semana (`YYYY-MM-DD`). */
export const MondayDate = LocalDate.refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, {
	message: 'Date must be a Monday'
});

// SPDX-License-Identifier: EUPL-1.2
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { facilities, facilityTypes, openingHours } from '../db/schema';

export const IMPORT_HEADERS = [
	'Instalación',
	'Tipo',
	'Unidades',
	'Aforo',
	'Duración (min)',
	'Prezo empadroada (€)',
	'Prezo non empadroada (€)',
	'Accesible',
	'Día',
	'Abre',
	'Pecha'
] as const;

export type ImportRow = {
	line: number;
	values: string[];
	error?: string;
	change?: 'create' | 'update';
};

const euro = (value: string) => {
	const n = Number(value.trim().replace(',', '.'));
	return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const positive = (value: string, min = 1) => {
	const n = Number(value);
	return Number.isInteger(n) && n >= min ? n : null;
};

/** Parser pequeno para CSV con punto e coma e comiñas dobres. */
export function parseFacilitiesCsv(text: string): string[][] {
	const source = text.replace(/^\ufeff/, '');
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < source.length; i++) {
		const c = source[i];
		if (c === '"') {
			if (quoted && source[i + 1] === '"') {
				cell += c;
				i++;
			} else quoted = !quoted;
		} else if (c === ';' && !quoted) {
			row.push(cell.trim());
			cell = '';
		} else if ((c === '\n' || c === '\r') && !quoted) {
			if (c === '\r' && source[i + 1] === '\n') i++;
			row.push(cell.trim());
			if (row.some(Boolean)) rows.push(row);
			row = [];
			cell = '';
		} else cell += c;
	}
	if (cell || row.length) rows.push([...row, cell.trim()]);
	return rows;
}

export async function previewFacilityImport(db: Db, municipalityId: string, text: string) {
	const parsed = parseFacilitiesCsv(text);
	const header = parsed.shift() ?? [];
	if (IMPORT_HEADERS.some((h, i) => header[i] !== h)) {
		return { error: 'adm.importar.cabeceiras', rows: [] as ImportRow[] };
	}
	const [existing, types] = await Promise.all([
		db.select().from(facilities).where(eq(facilities.municipalityId, municipalityId)),
		db.select().from(facilityTypes).where(eq(facilityTypes.municipalityId, municipalityId))
	]);
	const names = new Map(existing.map((f) => [f.name.toLocaleLowerCase(), f]));
	const rows = parsed.map((values, index) => {
		const [
			name,
			type,
			units,
			capacity,
			minutes,
			resident,
			nonResident,
			accessible,
			weekday,
			opens,
			closes
		] = values;
		let error: string | undefined;
		if (!name || !type) error = 'adm.importar.falta';
		else if (!types.some((t) => t.nameGl.toLocaleLowerCase() === type.toLocaleLowerCase()))
			error = 'adm.importar.tipo_inexistente';
		else if (
			[
				positive(units),
				positive(capacity),
				positive(minutes),
				euro(resident),
				euro(nonResident)
			].some((v) => v === null)
		)
			error = 'adm.importar.valores';
		else if (
			(opens || closes || weekday) &&
			(!Number.isInteger(Number(weekday)) ||
				Number(weekday) < 0 ||
				Number(weekday) > 6 ||
				!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(opens) ||
				!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(closes) ||
				opens >= closes)
		)
			error = 'adm.importar.horario';
		return {
			line: index + 2,
			values,
			error,
			change: names.has(name?.toLocaleLowerCase()) ? 'update' : 'create'
		} as ImportRow;
	});
	return { rows };
}

export async function confirmFacilityImport(db: Db, municipalityId: string, rows: ImportRow[]) {
	const verified = await previewFacilityImport(
		db,
		municipalityId,
		[IMPORT_HEADERS.join(';'), ...rows.map((r) => r.values.join(';'))].join('\r\n')
	);
	if ('error' in verified || verified.rows.some((r) => r.error)) return 0;
	const valid = verified.rows;
	for (const row of valid) {
		const [
			name,
			typeName,
			units,
			capacity,
			minutes,
			resident,
			nonResident,
			accessible,
			weekday,
			opens,
			closes
		] = row.values;
		const types = await db
			.select()
			.from(facilityTypes)
			.where(eq(facilityTypes.municipalityId, municipalityId));
		const type = types.find(
			(candidate) => candidate.nameGl.toLocaleLowerCase() === typeName.toLocaleLowerCase()
		);
		if (!type) continue;
		const values = {
			typeId: type.id,
			name,
			units: positive(units)!,
			capacity: positive(capacity)!,
			slotMinutes: positive(minutes)!,
			priceResidentCents: euro(resident)!,
			priceNonResidentCents: euro(nonResident)!,
			accessible: ['si', 'sí', 'true', '1'].includes(accessible.toLocaleLowerCase())
		};
		let [facility] = await db
			.select()
			.from(facilities)
			.where(and(eq(facilities.municipalityId, municipalityId), eq(facilities.name, name)));
		if (facility) {
			await db.update(facilities).set(values).where(eq(facilities.id, facility.id));
		} else {
			[facility] = await db
				.insert(facilities)
				.values({ municipalityId, ...values })
				.returning();
		}
		if (weekday && opens && closes) {
			const same = await db
				.select()
				.from(openingHours)
				.where(
					and(
						eq(openingHours.facilityId, facility.id),
						eq(openingHours.weekday, Number(weekday)),
						eq(openingHours.opens, opens),
						eq(openingHours.closes, closes)
					)
				);
			if (!same.length)
				await db
					.insert(openingHours)
					.values({ facilityId: facility.id, weekday: Number(weekday), opens, closes });
		}
	}
	return valid.length;
}

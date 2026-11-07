// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import {
	confirmFacilityImport,
	parseFacilitiesCsv,
	previewFacilityImport
} from './facility-import';
import { createTestDb } from '../db/test-db';
import { seedFixture } from './fixtures';
import { eq } from 'drizzle-orm';
import { facilities } from '../db/schema';

const csv =
	'\ufeffInstalación;Tipo;Unidades;Aforo;Duración (min);Prezo empadroada (€);Prezo non empadroada (€);Accesible;Día;Abre;Pecha\r\nPista nova;Pista de pádel;1;1;60;3,50;5,00;Si;0;09:00;22:00\r\n';

describe('importación de instalacións', () => {
	it('le CSV con BOM e punto e coma', () => {
		const rows = parseFacilitiesCsv(csv);
		expect(rows).toHaveLength(2);
		expect(rows[1][0]).toBe('Pista nova');
	});

	it('devolve erros por fila na previsualización', async () => {
		const db = await createTestDb();
		const fx = await seedFixture(db);
		const preview = await previewFacilityImport(
			db,
			fx.municipalityId,
			csv.replace('Pista de pádel', 'Inexistente')
		);
		expect('rows' in preview && preview.rows[0].error).toBe('adm.importar.tipo_inexistente');
	});

	it('confirma de maneira idempotente e sen borrar instalacións', async () => {
		const db = await createTestDb();
		const fx = await seedFixture(db);
		const preview = await previewFacilityImport(db, fx.municipalityId, csv);
		expect('rows' in preview).toBe(true);
		if (!('rows' in preview)) return;
		await confirmFacilityImport(db, fx.municipalityId, preview.rows);
		await confirmFacilityImport(db, fx.municipalityId, preview.rows);
		const imported = await db
			.select()
			.from(facilities)
			.where(eq(facilities.municipalityId, fx.municipalityId));
		expect(imported.filter((facility) => facility.name === 'Pista nova')).toHaveLength(1);
		expect(imported.some((facility) => facility.id === fx.facilityId)).toBe(true);
	});
});

// SPDX-License-Identifier: EUPL-1.2
import type { RequestHandler } from './$types';
import { requireMunicipality, requireStaff } from '../../../../../../../../lib/server/http/guards';
import { fail } from '../../../../../../../../lib/server/http/respond';
import { localDateOf } from '../../../../../../../../lib/server/domain/time';
import { toCsv, type CsvCell } from '../../../../../../../../lib/server/export/csv';
import { exportMunicipality } from '../../../../../../../../lib/server/services/exports';
import { ExportTable } from './table.openapi';

const text = (v: string | null | undefined) => v ?? null;

export const GET: RequestHandler = async (event) => {
	const municipality = await requireMunicipality(event);
	if (municipality instanceof Response) return municipality;
	const staff = await requireStaff(event, municipality.id, ['admin']);
	if (staff instanceof Response) return staff;
	const table = ExportTable.safeParse(event.params.table);
	if (!table.success) {
		return fail('VALIDATION_FAILED', { issues: [{ path: 'table', message: 'Unknown table' }] });
	}
	const now = event.locals.now();
	const data = await exportMunicipality(event.locals.db, municipality.id, now);
	let headers: string[];
	let rows: CsvCell[][];
	if (table.data === 'bookings') {
		headers = [
			'Identificador',
			'Instalación',
			'Perfil',
			'Unidade',
			'Prazas',
			'Comeza',
			'Remata',
			'Estado',
			'Código de acceso',
			'Prezo (céntimos)',
			'Canle',
			'Creada',
			'Cancelada'
		];
		rows = data.bookings.map((b) => [
			b.id,
			b.facilityId,
			b.profileId,
			b.unitIndex,
			b.seats,
			b.startsAt,
			b.endsAt,
			b.status,
			b.accessCode,
			b.priceCents,
			b.channel,
			b.createdAt,
			b.cancelledAt
		]);
	} else if (table.data === 'facilities') {
		headers = [
			'Identificador',
			'Tipo',
			'Nome',
			'Unidades',
			'Aforo',
			'Duración (min)',
			'Prezo empadroada (céntimos)',
			'Prezo non empadroada (céntimos)',
			'Accesible',
			'Normas',
			'Activa'
		];
		rows = data.facilities.map((f) => [
			f.id,
			f.typeId,
			f.name,
			f.units,
			f.capacity,
			f.slotMinutes,
			f.priceResidentCents,
			f.priceNonResidentCents,
			f.accessible,
			f.rules,
			f.active
		]);
	} else {
		headers = [
			'Identificador',
			'Identificador de persoa',
			'Nome',
			'Correo',
			'Teléfono',
			'Provedor',
			'Empadroada',
			'Faltas',
			'Penalización ata'
		];
		rows = data.profiles.map((p) => [
			p.id,
			p.userId,
			p.displayName,
			text(p.email),
			text(p.phone),
			p.provider,
			p.isResident,
			p.noShowCount,
			p.penaltyUntil
		]);
	}
	return new Response(toCsv(headers, rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'cache-control': 'no-store',
			'content-disposition': `attachment; filename="${municipality.slug}-${table.data}-${localDateOf(now)}.csv"`
		}
	});
};

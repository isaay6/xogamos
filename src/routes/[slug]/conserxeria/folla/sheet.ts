// SPDX-License-Identifier: EUPL-1.2
// Folla do día: papel que queda no mostrador, así que só leva inicial e apelido, nunca o nome
// enteiro nin o contacto. Se calcula no servidor para que nada máis chegue á páxina.
import { formatTime } from '../../../../lib/ui/format';
import type { AgendaFacility } from '../../../../lib/server/services/staff';

/**
 * Inicial e primeiro apelido:
 * - dúas palabras: «Nerea Veciña» → «U. Veciña»;
 * - tres: «Nome Apelido1 Apelido2», o habitual en Galicia e España, así que vai a segunda
 *   («Hadrián Seixo Mouriño» → «H. Seixo»). Un nome composto cun só apelido («Ana María Pérez»)
 *   sae como «A. María»: non hai xeito de distinguilo sen máis datos;
 * - catro ou máis: a penúltima, o primeiro apelido («María José Pérez López» → «M. Pérez»);
 * - unha: só a inicial («B.»).
 */
export function initialSurname(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '';
	const initial = `${Array.from(parts[0])[0].toUpperCase()}.`;
	if (parts.length === 1) return initial;
	if (parts.length <= 3) return `${initial} ${parts[1]}`;
	return `${initial} ${parts[parts.length - 2]}`;
}

export type SheetRow = {
	key: string;
	time: string;
	name: string;
	unitIndex: number | null;
	seats: number | null;
	/** PIN da reserva; `null` nas reservas de tempada. */
	code: string | null;
	attended: boolean;
	season: boolean;
};

export type SheetGroup = { facilityId: string; facilityName: string; rows: SheetRow[] };

/** Unha táboa por instalación con algo ese día; as reservas canceladas non saen. */
export function buildSheet(agenda: AgendaFacility[]): SheetGroup[] {
	const groups: SheetGroup[] = [];
	for (const f of agenda) {
		const rows = [
			...f.bookings
				.filter((b) => b.status !== 'cancelled')
				.map((b) => ({
					key: b.id,
					at: b.startsAt.getTime(),
					time: `${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`,
					name: b.entityName ?? initialSurname(b.displayName),
					unitIndex: f.bookingMode === 'capacity' ? null : b.unitIndex,
					seats: f.bookingMode === 'capacity' ? b.seats : null,
					code: b.accessCode,
					attended: b.status === 'attended',
					season: false
				})),
			...f.seasons.map((s) => ({
				key: `${s.id}-${s.unitIndex ?? 'all'}`,
				at: s.startsAt.getTime(),
				time: `${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`,
				name: s.entityName,
				unitIndex: s.unitIndex,
				seats: null,
				code: null,
				attended: false,
				season: true
			}))
		]
			.sort((a, b) => a.at - b.at)
			.map((r): SheetRow => ({
				key: r.key,
				time: r.time,
				name: r.name,
				unitIndex: r.unitIndex,
				seats: r.seats,
				code: r.code,
				attended: r.attended,
				season: r.season
			}));
		if (rows.length > 0)
			groups.push({ facilityId: f.facilityId, facilityName: f.facilityName, rows });
	}
	return groups;
}

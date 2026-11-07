// SPDX-License-Identifier: EUPL-1.2
// Portada en capas (mockup portada.html, opción 1): a túa próxima reserva, o libre agora, o
// consello das horas tranquilas, os avisos do concello e os deportes.
import { t } from '../../lib/i18n';
import { bookingQrValue } from '../../lib/server/auth/booking-qr-secret';
import type { Db } from '../../lib/server/db/client';
import { localDateOf } from '../../lib/server/domain/time';
import { homeBoard } from '../../lib/server/services/home';
import { getSummary } from '../../lib/server/services/me';
import { countUnread } from '../../lib/server/services/notifications';
import { walletBalance } from '../../lib/server/services/wallet';
import { listMyPasses, listPassTypes } from '../../lib/server/services/passes';
import { getProfile, listMyBookings } from '../../lib/server/services/profiles';
import {
	listMyTournamentEntries,
	listUpcomingTournaments
} from '../../lib/server/services/tournaments';
import { users } from '../../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { greeting } from '../../lib/ui/format';
import { requireMunicipality } from './municipality.server';
import { visibleNotices } from './notices.server';
import type { PageServerLoad } from './$types';

/** Avisos do concello que se resumen na portada; o resto está na pestana Avisos. */
const NOTICES_ON_HOME = 3;

async function nextBooking(
	db: Db,
	municipalityId: string,
	slug: string,
	userId: string,
	now: Date,
	url: URL
) {
	const profile = await getProfile(db, municipalityId, userId);
	if (!profile) return { next: null, streak: 0, passes: [] };
	const [rows, summary, passes] = await Promise.all([
		listMyBookings(db, municipalityId, profile.id, {
			scope: 'upcoming',
			now,
			includeOngoing: true
		}),
		getSummary(db, municipalityId, userId, now),
		listMyPasses(db, municipalityId, profile.id, now)
	]);
	const b = rows[0];
	return {
		streak: summary?.streak ?? 0,
		passes,
		next: b
			? {
					id: b.id,
					code: b.accessCode,
					qr: bookingQrValue(url, slug, b.id),
					color: b.color,
					mascot: b.mascot,
					bookingMode: b.bookingMode,
					sportGl: b.typeNameGl,
					sportEs: b.typeNameEs,
					facilityName: b.facilityName,
					unitIndex: b.unitIndex,
					entityName: b.entityName,
					startsAt: b.startsAt
				}
			: null
	};
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const municipality = await requireMunicipality(locals.db, params.slug);
	const now = locals.now();
	const user = locals.user;
	const [board, notices, mine, unread, passTypes, walletCents, tournaments, tournamentEntries] =
		await Promise.all([
			homeBoard(locals.db, municipality.id, now),
			// O mesmo conxunto ca na pestana Avisos (actual e seguidos): o número coincide.
			visibleNotices(locals.db, municipality.id, user?.id ?? null, now),
			user
				? nextBooking(locals.db, municipality.id, municipality.slug, user.id, now, url)
				: { next: null, streak: 0, passes: [] },
			user ? countUnread(locals.db, user.id) : 0,
			listPassTypes(locals.db, municipality.id),
			user ? walletBalance(locals.db, user.id) : null,
			listUpcomingTournaments(locals.db, municipality.id, now),
			user ? listMyTournamentEntries(locals.db, municipality.id, user.id) : []
		]);
	const joinedTournamentIds = new Set(
		tournamentEntries.filter((entry) => !entry.cancelledAt).map((entry) => entry.tournamentId)
	);

	// Saludo con el nombre de pila: la primera palabra del nombre que viene del proveedor.
	const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';
	const [settings] = user
		? await locals.db
				.select({ easyBooking: users.easyBooking })
				.from(users)
				.where(eq(users.id, user.id))
		: [];
	const saudo =
		user && firstName
			? t(locals.locale, 'vec.inicio.saudo', {
					saudo: greeting(locals.locale, now),
					nome: firstName
				})
			: null;
	return {
		saudo,
		now,
		today: localDateOf(now),
		sports: board.sports,
		// Os do concello actual primeiro; os doutro concello seguido levan o seu nome.
		notices: [...notices]
			.sort(
				(a, b) =>
					Number(b.municipalityId === municipality.id) -
					Number(a.municipalityId === municipality.id)
			)
			.slice(0, NOTICES_ON_HOME)
			.map((n) => ({
				id: n.id,
				title: n.title,
				body: n.body,
				from: n.municipalityId === municipality.id ? null : n.municipalityName
			})),
		noticeCount: notices.length,
		/** Avisos persoais sen ler: unha liña na portada que leva a Avisos. */
		unread,
		next: mine.next,
		streak: mine.streak,
		passes: mine.passes,
		passTypes,
		signedIn: user !== null,
		walletCents,
		easyBooking: settings?.easyBooking ?? false,
		tournaments: tournaments.slice(0, 2).map((row) => ({
			id: row.tournament.id,
			title: row.tournament.title,
			facilityName: row.facilityName,
			startsOn: row.tournament.startsOn,
			endsOn: row.tournament.endsOn,
			joined: joinedTournamentIds.has(row.tournament.id)
		}))
	};
};

// SPDX-License-Identifier: EUPL-1.2
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { GENERAL, priceFor } from '../../../lib/server/domain/policies';
import { localDateOf } from '../../../lib/server/domain/time';
import { requirePageUser } from '../../../lib/server/http/page-guards';
import { createBooking, getAvailability } from '../../../lib/server/services/bookings';
import { ensureProfile, getProfile } from '../../../lib/server/services/profiles';
import { getFacilityContext } from '../../../lib/server/services/reservar';
import { listFacilityPhotos } from '../../../lib/server/services/facility-photos';
import { municipalities, municipalityProfiles } from '../../../lib/server/db/schema';
import { walletBalance } from '../../../lib/server/services/wallet';
import { responsibleEntities } from '../../../lib/server/services/entities';
import { formatTime } from '../../../lib/ui/format';
import { requireMunicipality } from '../municipality.server';
import type { Actions, PageServerLoad } from './$types';

const Query = z.object({
	facility: z.uuid(),
	startsAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
	unit: z.preprocess(
		(v) => (v === '' || v === null ? undefined : v),
		z.coerce.number().int().min(0).optional()
	),
	para: z.preprocess((v) => (v === null ? undefined : v), z.uuid().optional())
});

/** Lo elegido viaja en la URL (`?facility=&startsAt=&unit=`): lo usan el `load` y la acción. */
function parseQuery(url: URL) {
	const parsed = Query.safeParse({
		facility: url.searchParams.get('facility'),
		startsAt: url.searchParams.get('startsAt'),
		unit: url.searchParams.get('unit'),
		para: url.searchParams.get('para')
	});
	if (!parsed.success) error(400);
	return parsed.data;
}

type Event = Pick<RequestEvent, 'params' | 'url' | 'locals'>;

async function context(event: Event) {
	const municipality = await requireMunicipality(event.locals.db, event.params.slug!);
	const query = parseQuery(event.url);
	const ctx = await getFacilityContext(event.locals.db, municipality.id, query.facility);
	if (!ctx) error(404);
	return { municipality, query, ctx };
}

const UNAVAILABLE = new Set(['SLOT_UNAVAILABLE', 'UNIT_UNAVAILABLE', 'CAPACITY_EXCEEDED']);

export const load: PageServerLoad = async (event) => {
	const { municipality, query, ctx } = await context(event);
	const { locals, url } = event;

	// La franja tiene que existir en el horario de la instalación ese día.
	const date = localDateOf(query.startsAt);
	const day = await getAvailability(locals.db, municipality.id, ctx.facilityId, date);
	const slot = day.ok
		? day.value.find((s) => s.startsAt.getTime() === query.startsAt.getTime())
		: undefined;
	if (!slot) error(404);

	// Con sesión, el precio de la persona con el mismo cálculo que al guardar (`priceFor`):
	// sin perfil todavía es el general; sin sesión, `null` (se enseñan los dos precios).
	let resident: boolean | null = null;
	let priceCents: number | null = null;
	let walletCents: number | null = null;
	let clubOptions: Awaited<ReturnType<typeof responsibleEntities>> = [];
	if (locals.user) {
		const profile = await getProfile(locals.db, municipality.id, locals.user.id);
		resident = profile?.isResident ?? false;
		priceCents = priceFor(ctx, profile ?? GENERAL, 1);
		walletCents = await walletBalance(locals.db, locals.user.id);
		clubOptions = await responsibleEntities(
			locals.db,
			municipality.id,
			locals.user.id,
			ctx.facilityId
		);
		const entity = query.para ? clubOptions.find((option) => option.id === query.para) : undefined;
		if (entity?.priceMode === 'free') priceCents = 0;
		if (entity?.priceMode === 'fixed') priceCents = entity.fixedPriceCents;
	}

	return {
		needsLogin: !locals.user,
		redirectTo: url.pathname + url.search,
		easy: url.searchParams.get('easy') === '1',
		facility: {
			id: ctx.facilityId,
			name: ctx.facilityName,
			location: ctx.location,
			rules: ctx.rules,
			accessInfo: ctx.accessInfo,
			accessInfoEs: ctx.accessInfoEs,
			nameGl: ctx.nameGl,
			nameEs: ctx.nameEs,
			mascot: ctx.mascot,
			color: ctx.color,
			bookingMode: ctx.bookingMode,
			typeId: ctx.typeId,
			stepFreeAccess: ctx.stepFreeAccess,
			adaptedToilet: ctx.adaptedToilet,
			adaptedChangingRoom: ctx.adaptedChangingRoom,
			accessibleParkingNearby: ctx.accessibleParkingNearby,
			hearingLoop: ctx.hearingLoop,
			supportContact: ctx.supportContact,
			accessibilityNotes: ctx.accessibilityNotes,
			accessibilityCheckedAt: ctx.accessibilityCheckedAt
		},
		photos: ctx.active ? await listFacilityPhotos(locals.db, ctx.facilityId) : [],
		startsAt: slot.startsAt,
		endsAt: slot.endsAt,
		unitIndex: query.unit ?? null,
		today: localDateOf(locals.now()),
		priceResidentCents: ctx.priceResidentCents,
		priceNonResidentCents: ctx.priceNonResidentCents,
		resident,
		priceCents,
		walletCents,
		clubOptions,
		selectedEntityId: query.para ?? null,
		cancellationDeadlineMinutes: ctx.cancellationDeadlineMinutes,
		rules: {
			...(await rulesOf(locals.db, municipality.id)),
			accepted: Boolean(
				locals.user &&
				(await getProfile(locals.db, municipality.id, locals.user.id))?.rulesAcceptedAt
			)
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requirePageUser(event);
		const { municipality, query, ctx } = await context(event);
		const { locals } = event;

		const profile = await ensureProfile(locals.db, municipality.id, user.id);
		// Sen formulario (p. ex. a API ou un envío baleiro) págase na instalación.
		const form = await event.request.formData().catch(() => new FormData());
		const paymentMethod = form.get('paymentMethod') === 'wallet' ? 'wallet' : 'facility';
		const entityId = form.get('entityId');
		if (!profile.rulesAcceptedAt) {
			if (form.get('rulesAccepted') !== 'yes') return fail(422, { error: 'RULES_NOT_ACCEPTED' });
			await locals.db
				.update(municipalityProfiles)
				.set({ rulesAcceptedAt: locals.now() })
				.where(eq(municipalityProfiles.id, profile.id));
		}
		const result = await createBooking(locals.db, {
			municipalityId: municipality.id,
			facilityId: ctx.facilityId,
			profileId: profile.id,
			entityId: typeof entityId === 'string' && entityId ? entityId : undefined,
			startsAt: query.startsAt,
			unitIndex: query.unit,
			channel: 'online',
			createdByUserId: user.id,
			paymentMethod,
			now: locals.now()
		});
		if (result.ok)
			redirect(
				303,
				`/${municipality.slug}/reserva/${result.value.id}/xa${event.url.searchParams.get('easy') === '1' ? '?easy=1' : ''}`
			);

		const code = result.error;
		if (UNAVAILABLE.has(code)) {
			// Alguien la cogió mientras miraba: de vuelta a «lo libre» con alternativas.
			const date = localDateOf(query.startsAt);
			const time = formatTime(query.startsAt);
			redirect(
				303,
				`/${municipality.slug}/reservar/${ctx.typeId}/libre?date=${date}&time=${time}&cheo=1`
			);
		}
		if (code === 'PENALIZED') return fail(403, { penaltyUntil: profile.penaltyUntil });
		return fail(422, { error: code });
	}
};

/** As normas do concello que se resumen antes de reservar. */
async function rulesOf(db: App.Locals['db'], municipalityId: string) {
	const [row] = await db
		.select({
			noShowThreshold: municipalities.noShowThreshold,
			penaltyDays: municipalities.penaltyDays,
			maxDaysAhead: municipalities.maxDaysAhead
		})
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	return row;
}

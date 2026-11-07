// SPDX-License-Identifier: EUPL-1.2
import { error, fail } from '@sveltejs/kit';
import { bookingQrSecret } from '../../../../lib/server/auth/booking-qr-secret';
import {
	lookupAccessCode,
	markAttended,
	type LookupMatch
} from '../../../../lib/server/services/bookings';
import { lookupPassAccess, type PassLookup } from '../../../../lib/server/services/passes';
import { ACCESS_WINDOW_BEFORE_MINUTES } from '../../../../lib/server/domain/access-code';
import { staffContext, UUID } from '../guard';
import type { Actions, PageServerLoad } from './$types';

// `opensAt`: se aínda é cedo para marcar a chegada, desde cando se pode (se non, null).
const toMatch = (now: Date) => (m: LookupMatch) => {
	const opens = new Date(m.startsAt.getTime() - ACCESS_WINDOW_BEFORE_MINUTES * 60_000);
	return {
		...matchFields(m),
		opensAt: now < opens ? opens.toISOString() : null
	};
};
const matchFields = (m: LookupMatch) => ({
	bookingId: m.bookingId,
	facilityName: m.facilityName,
	mascot: m.mascot,
	startsAt: m.startsAt.toISOString(),
	endsAt: m.endsAt.toISOString(),
	unitIndex: m.unitIndex,
	displayName: m.displayName,
	priceCents: m.priceCents
});
const toPass = (p: PassLookup) => ({
	passId: p.passId,
	name: p.name,
	displayName: p.displayName,
	endsOn: p.endsOn
});

export const load: PageServerLoad = async (event) => {
	const { municipality } = await staffContext(event);
	// Un QR escaneado llega como ?qr=<token>: misma búsqueda y misma tarjeta que con un PIN.
	const qr = event.url.searchParams.get('qr');
	if (!qr) return { lookup: null };
	const result = await lookupAccessCode(event.locals.db, {
		municipalityId: municipality.id,
		code: qr,
		now: event.locals.now(),
		qrSecret: bookingQrSecret()
	});
	const pass = await lookupPassAccess(event.locals.db, {
		municipalityId: municipality.id,
		code: qr,
		now: event.locals.now(),
		qrSecret: bookingQrSecret()
	});
	if (result.ok && pass.ok) {
		console.warn('Coinciden una reserva y un abono vigentes para el mismo PIN', {
			municipalityId: municipality.id
		});
	}
	return {
		lookup: {
			codigo: qr,
			matches: result.ok ? result.value.map(toMatch(event.locals.now())) : [],
			error: result.ok || pass.ok ? null : result.error,
			date: result.ok ? null : (result.date ?? null)
		},
		pass: !result.ok && pass.ok ? toPass(pass.value) : null
	};
};

export const actions: Actions = {
	buscar: async (event) => {
		const { municipality } = await staffContext(event);
		const data = await event.request.formData();
		const codigo = String(data.get('codigo') ?? '');
		const result = await lookupAccessCode(event.locals.db, {
			municipalityId: municipality.id,
			code: codigo,
			now: event.locals.now(),
			qrSecret: bookingQrSecret()
		});
		if (!result.ok) {
			const pass = await lookupPassAccess(event.locals.db, {
				municipalityId: municipality.id,
				code: codigo,
				now: event.locals.now(),
				qrSecret: bookingQrSecret()
			});
			if (pass.ok) return { codigo, matches: [], pass: toPass(pass.value) };
			return fail(422, { codigo, error: result.error, date: result.date ?? null });
		}
		const pass = await lookupPassAccess(event.locals.db, {
			municipalityId: municipality.id,
			code: codigo,
			now: event.locals.now(),
			qrSecret: bookingQrSecret()
		});
		if (pass.ok) {
			console.warn('Coinciden una reserva y un abono vigentes para el mismo PIN', {
				municipalityId: municipality.id
			});
		}
		return {
			codigo,
			matches: result.value.map(toMatch(event.locals.now()))
		};
	},
	chegada: async (event) => {
		const { municipality } = await staffContext(event);
		const data = await event.request.formData();
		const bookingId = String(data.get('bookingId') ?? '');
		const codigo = String(data.get('codigo') ?? '');
		if (!UUID.test(bookingId)) error(404);
		const result = await markAttended(event.locals.db, {
			municipalityId: municipality.id,
			bookingId,
			now: event.locals.now()
		});
		if (!result.ok) {
			if (result.error === 'NOT_FOUND') error(404);
			// Se repite la búsqueda para que la tarjeta siga en pantalla junto al error.
			const again = await lookupAccessCode(event.locals.db, {
				municipalityId: municipality.id,
				code: codigo,
				now: event.locals.now(),
				qrSecret: bookingQrSecret()
			});
			return fail(422, {
				chegadaError: result.error,
				codigo,
				matches: again.ok ? again.value.map(toMatch(event.locals.now())) : []
			});
		}
		return { attended: true };
	}
};

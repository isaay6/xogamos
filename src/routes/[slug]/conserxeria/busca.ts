// SPDX-License-Identifier: EUPL-1.2
// Buscador único do mostrador (busca-dni.html, opción 2): unha soa caixa para nome, teléfono ou
// DNI enteiro. O DNI nunca volve á páxina nin vai na URL: a busca é POST e a ficha leva o DNI
// tapado agás o final. Un anaco de DNI non busca por prefixo: é unha busca por nome ou teléfono.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Db } from '../../../lib/server/db/client';
import { dniSecret } from '../../../lib/server/auth/dni-secret';
import { normalizeDni } from '../../../lib/server/domain/dni';
import type { SocialTariff } from '../../../lib/server/domain/policies';
import {
	ensureProfileForStaff,
	findPersonByDni,
	getPersonDetail,
	searchPeople,
	type PersonOut
} from '../../../lib/server/services/staff';
import { dniHint } from '../../../lib/ui/dni-hint';
import { UUID } from './guard';

export type DniCard = {
	/** null: só ten perfil noutro concello (o nome sae abreviado). */
	profileId: string | null;
	userId: string;
	displayName: string;
	isResident: boolean;
	socialTariff: SocialTariff | null;
	noShowCount: number | null;
	/** `*****654P`: só as tres últimas cifras e a letra. */
	dniMasked: string;
	/** Dúas últimas cifras do teléfono, para a comprobación por teléfono. */
	phoneEnd: string | null;
	avatar: { key: string | null; hasPhoto: boolean };
	/** Sinatura para crear o perfil neste concello (só sen perfil): ver `confirmarDni`. */
	sinal: string | null;
};

export type Busca =
	| { mode: 'texto'; q: string; people: PersonOut[] }
	| { mode: 'dni'; q: ''; card: DniCard }
	| {
			mode: 'sen-dni';
			/** O DNI escrito: queda na caixa para repasalo cifra a cifra. */
			q: string;
			/** Letra que lle tocaría ao número se a escrita non cadra; null se cadra. */
			letra: string | null;
			escrita: string;
			suggestions: string[];
			/** DNI válido (letra correcta) para encher o alta da persoa nova; null se non. */
			dni: string | null;
	  };

const masked = (dni: string) => `*****${dni.slice(-4)}`;

const sign = (secret: string, municipalityId: string, userId: string) =>
	createHmac('sha256', secret)
		.update(`desk-confirm:${municipalityId}:${userId}`)
		.digest('base64url');

/** Busca do mostrador: DNI/NIE enteiro → busca exacta; calquera outra cousa → nome ou teléfono. */
export async function deskSearch(db: Db, municipalityId: string, raw: string): Promise<Busca> {
	const q = raw.trim();
	const dni = normalizeDni(q);
	const secret = dniSecret();
	if (!dni || !secret) {
		return { mode: 'texto', q, people: q ? await searchPeople(db, municipalityId, q) : [] };
	}
	const found = await findPersonByDni(db, municipalityId, dni, secret);
	if (found.status !== 'found') {
		const hint = dniHint(dni);
		return {
			mode: 'sen-dni',
			q: dni,
			letra: hint && !hint.ok ? hint.letra : null,
			escrita: dni[8],
			suggestions: found.status === 'not_found' ? found.suggestions : [],
			dni: hint?.ok ? dni : null
		};
	}
	const p = found.person;
	const detail = p.profileId ? await getPersonDetail(db, municipalityId, p.profileId) : null;
	const phoneDigits = detail?.phone?.replace(/\D/g, '') ?? '';
	return {
		mode: 'dni',
		q: '',
		card: {
			profileId: p.profileId,
			userId: p.userId,
			displayName: p.displayName,
			isResident: p.isResident,
			socialTariff: p.socialTariff,
			noShowCount: detail?.noShowCount ?? null,
			dniMasked: masked(dni),
			phoneEnd: phoneDigits.length >= 4 ? phoneDigits.slice(-2) : null,
			// Sen perfil aquí non se ve a súa foto (a API só a dá ao persoal dos seus concellos).
			avatar: detail?.avatar ?? { key: null, hasPhoto: false },
			sinal: p.profileId ? null : sign(secret, municipalityId, p.userId)
		}
	};
}

/** Acción `?/buscar` compartida por «Nova reserva» e «Buscar persoa» (tras `staffContext`). */
export async function buscarAction(event: RequestEvent, municipalityId: string) {
	const q = String((await event.request.formData()).get('q') ?? '');
	return { busca: await deskSearch(event.locals.db, municipalityId, q) };
}

/**
 * «Si, é esta persoa» para quen só ten perfil noutro concello (Ruling 1): créase o seu perfil
 * aquí, non empadroado, e segue a reserva. A sinatura evita crear perfís a partir dun id
 * calquera: só vale para a persoa que se acaba de atopar polo DNI neste concello.
 * Chámase tras `staffContext`.
 */
export async function confirmarDniAction(
	event: RequestEvent,
	municipality: { id: string; slug: string },
	personHref = (profileId: string) => `/${municipality.slug}/conserxeria/nova?persoa=${profileId}`
) {
	const data = await event.request.formData();
	const userId = String(data.get('usuario') ?? '');
	const sinal = Buffer.from(String(data.get('sinal') ?? ''));
	const secret = dniSecret();
	if (!UUID.test(userId) || !secret) error(404);
	const want = Buffer.from(sign(secret, municipality.id, userId));
	if (sinal.length !== want.length || !timingSafeEqual(sinal, want)) error(404);
	const r = await ensureProfileForStaff(event.locals.db, municipality.id, userId);
	if (!r.ok) error(404);
	redirect(303, personHref(r.value.profileId));
}

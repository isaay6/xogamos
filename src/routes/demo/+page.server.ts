// SPDX-License-Identifier: EUPL-1.2
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import type { TourKey } from '../../lib/demo/tour';
import { startSession } from '../../lib/server/auth/login';
import { DEMO_HOME, DEMO_PROFILES, demoStartUrl, isDemo } from '../../lib/server/demo';
import { DEMO_PEOPLE } from '../../lib/server/db/seed-people';
import { getMunicipalityShell } from '../../lib/server/services/municipalities';

export const load: PageServerLoad = async ({ locals }) => {
	if (!isDemo()) error(404);
	// O escudo do concello da demo (se o ten) para o botón «Concello».
	const home = await getMunicipalityShell(locals.db, DEMO_HOME);
	return {
		home: home && {
			slug: home.slug,
			name: home.name,
			primaryColor: home.primaryColor,
			hasLogo: home.hasLogo,
			logoVersion: home.logoVersion
		},
		profiles: DEMO_PROFILES.map((p) => ({
			key: p.key,
			name: p.identity.displayName,
			municipality: p.municipality?.name ?? null,
			avatarKey: p.avatarKey
		})),
		quickPeople: [
			['celestino', 'Celestino Arias Fervenza'],
			['telmo', 'Telmo Quiroga Busto'],
			['rebeca', 'Rebeca Viñas Toimil']
		].map(([key, name]) => {
			const person = DEMO_PEOPLE.find((candidate) => candidate.name === name);
			if (!person) throw new Error(`Falta a persoa de demostración ${name}`);
			return { key, name: person.name, subject: person.subject, provider: person.provider };
		})
	};
};

/** Entra directamente coa identidade do perfil (sen a pantalla do simulador) e abre o percorrido. */
function enter(key: TourKey) {
	return async (event: RequestEvent) => {
		if (!isDemo()) error(404);
		const profile = DEMO_PROFILES.find((p) => p.key === key)!;
		// Se xa había alguén dentro, `startSession` pecha a súa sesión antes de abrir a nova.
		await startSession(event, profile.identity);
		redirect(303, demoStartUrl(profile));
	};
}

function enterPerson(name: string) {
	return async (event: RequestEvent) => {
		if (!isDemo()) error(404);
		const person = DEMO_PEOPLE.find((candidate) => candidate.name === name);
		if (!person) error(404);
		await startSession(event, {
			provider: person.provider,
			subject: person.subject,
			displayName: person.name,
			email: person.email
		});
		redirect(303, `/${DEMO_HOME}`);
	};
}

export const actions: Actions = {
	vecina: enter('vecina'),
	conserxe: enter('conserxe'),
	concello: enter('concello'),
	deputacion: enter('deputacion'),
	celestino: enterPerson('Celestino Arias Fervenza'),
	telmo: enterPerson('Telmo Quiroga Busto'),
	rebeca: enterPerson('Rebeca Viñas Toimil')
};

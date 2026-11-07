// SPDX-License-Identifier: EUPL-1.2
// Modo demo (spec v1 §2): só con simulador e unha base de datos desbotable.
import { DATABASE_URL, DEMO, DEMO_DATABASE_IS_DISPOSABLE, IDENTITY_MODE } from '$app/env/private';
import type { TourKey } from '../demo/tour';
import { isDisposableDemoDatabase, readIdentityConfig } from './auth/config';
import type { VerifiedIdentity } from './auth/login';
import { DEMO_DEPUTACION, DEMO_STAFF, demoMunicipalityName, type DemoSlug } from './db/seed-data';
import { DEMO_PEOPLE, demoAvatarKey } from './db/seed-people';

/** Pura: recibe un obxecto plano para probala sen contorno. */
export function demoEnabled(env: {
	DEMO?: string | undefined;
	IDENTITY_MODE?: string | undefined;
	DATABASE_URL?: string | undefined;
	DEMO_DATABASE_IS_DISPOSABLE?: string | undefined;
}) {
	return env.DEMO === '1' && env.IDENTITY_MODE === 'simulated' && isDisposableDemoDatabase(env);
}

/** Le o contorno en cada chamada. */
export function isDemo(): boolean {
	const config = readIdentityConfig();
	return (
		demoEnabled({
			DEMO,
			IDENTITY_MODE,
			DATABASE_URL,
			DEMO_DATABASE_IS_DISPOSABLE
		}) && config.mode === 'simulated'
	);
}

/** O concello da demo: onde viven a veciña, o conserxe e a administradora. */
export const DEMO_HOME: DemoSlug = 'viana-do-bolo';

export type DemoProfile = {
	key: TourKey;
	identity: VerifiedIdentity;
	/** Concello do perfil (a Deputación non ten). */
	municipality: { slug: DemoSlug; name: string } | null;
	/** Pantalla de inicio do perfil, sen o parámetro do percorrido. */
	start: string;
	/** Avatar da semente (só a veciña ten). */
	avatarKey: string | null;
};

function staffOf(role: 'admin' | 'conserxe') {
	const s = DEMO_STAFF.find((x) => x.municipality === DEMO_HOME && x.role === role);
	if (!s) throw new Error(`Falta ${role} de ${DEMO_HOME} na semente`);
	return s;
}

function demoProfiles(): DemoProfile[] {
	// As identidades co nome propio da semente, non ids fixos.
	const index = DEMO_PEOPLE.findIndex((p) => p.featured && p.name === 'Nerea Cabaleiro');
	if (index < 0) throw new Error('Falta Nerea Cabaleiro na semente');
	const uxia = DEMO_PEOPLE[index];
	const conserxe = staffOf('conserxe');
	const admin = staffOf('admin');
	const home = { slug: DEMO_HOME, name: demoMunicipalityName(DEMO_HOME) };
	const ident = (p: { provider: 'clave' | 'chave365'; subject: string; name: string }) => ({
		provider: p.provider,
		subject: p.subject,
		displayName: p.name,
		email: null
	});
	return [
		{
			key: 'vecina',
			identity: ident(uxia),
			municipality: home,
			start: `/${DEMO_HOME}`,
			avatarKey: demoAvatarKey(index)
		},
		{
			key: 'conserxe',
			identity: ident(conserxe),
			municipality: home,
			start: `/${DEMO_HOME}/conserxeria`,
			avatarKey: null
		},
		{
			key: 'concello',
			identity: ident(admin),
			municipality: home,
			start: `/${DEMO_HOME}/admin`,
			avatarKey: null
		},
		{
			key: 'deputacion',
			identity: ident(DEMO_DEPUTACION),
			municipality: null,
			start: '/deputacion',
			avatarKey: null
		}
	];
}

export const DEMO_PROFILES: DemoProfile[] = demoProfiles();

/** Destino tras entrar: a pantalla do perfil co percorrido activo. */
export const demoStartUrl = (p: DemoProfile) => `${p.start}?tour=${p.key}`;

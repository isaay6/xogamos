// SPDX-License-Identifier: EUPL-1.2
// Percorridos guiados do modo demo: unha lista de pasos por perfil. Sen código de servidor.
// Cada paso sinala un elemento real da pantalla (`data-tour="…"`) e leva as claves dos seus textos.
import type { MessageKey } from '../i18n';

export const TOUR_KEYS = ['vecina', 'conserxe', 'concello', 'deputacion'] as const;
export type TourKey = (typeof TOUR_KEYS)[number];

export function isTourKey(value: unknown): value is TourKey {
	return TOUR_KEYS.includes(value as TourKey);
}

export type TourStep = {
	/**
	 * Patrón da ruta. Nos percorridos de concello vai detrás de `/{slug}` (`''` é o inicio);
	 * cada segmento `[nome]` vale por calquera segmento.
	 */
	path: string;
	/** Valor de `data-tour` do elemento que se resalta. */
	target: string;
	title: MessageKey;
	body: MessageKey;
	/**
	 * Para rutas con `[parámetros]`: `data-tour` do paso anterior cuxa primeira ligazón leva a
	 * esta pantalla (p. ex. o primeiro deporte con horas libres).
	 */
	via?: string;
};

export type Tour = {
	/** `concello`: as rutas van detrás do concello; `raiz`: rutas absolutas. */
	scope: 'concello' | 'raiz';
	steps: TourStep[];
};

const step = (path: string, target: string, via?: string): TourStep => ({
	path,
	target,
	title: `demo.paso.${target}.titulo` as MessageKey,
	body: `demo.paso.${target}.texto` as MessageKey,
	...(via ? { via } : {})
});

export const TOURS: Record<TourKey, Tour> = {
	vecina: {
		scope: 'concello',
		steps: [
			step('', 'deportes'),
			step('/reservar/[typeId]', 'dia-hora', 'deportes'),
			step('/reservas', 'chave'),
			step('/avisos', 'avisos'),
			step('/eu/perfil', 'perfil-accesibilidade'),
			step('/eu/datos', 'descargar-datos'),
			step('/eu', 'eu-historial'),
			step('', 'inicio-abonos')
		]
	},
	conserxe: {
		scope: 'concello',
		steps: [
			step('/conserxeria', 'axenda'),
			step('/conserxeria', 'axenda-vista'),
			step('/conserxeria', 'axenda-reserva'),
			step('/conserxeria/validar', 'validar'),
			step('/conserxeria/nova', 'nova-reserva'),
			step('/conserxeria/persoa', 'persoa-ficha'),
			step('/conserxeria/folla', 'folla')
		]
	},
	concello: {
		scope: 'concello',
		steps: [
			step('/admin', 'resumo-mapa'),
			step('/admin/instalacions', 'nova-instalacion'),
			step('/admin/horarios', 'horarios'),
			step('/admin/horarios', 'festivos'),
			step('/admin/temporadas', 'tempadas'),
			step('/admin/abonos', 'abonos'),
			step('/admin/informe', 'informe-mensual'),
			step('/admin/rexistro', 'rexistro'),
			step('/admin/normas', 'normas'),
			step('/admin/persoal', 'persoal')
		]
	},
	deputacion: {
		scope: 'raiz',
		steps: [
			step('/deputacion', 'comparativa'),
			step('/deputacion', 'comparativa-periodo'),
			step('/deputacion', 'comparativa-concello'),
			step('/deputacion/novo', 'novo-concello'),
			step('/deputacion/novo', 'novo-admin'),
			step('/deputacion/administradores', 'dep-admins')
		]
	}
};

/** Ruta completa do patrón do paso (`[parámetros]` incluídos). */
export function stepPattern(tour: TourKey, s: TourStep, slug: string | null): string {
	return TOURS[tour].scope === 'concello' ? `/${slug ?? ''}${s.path}` : s.path;
}

/** A ruta coincide co patrón do paso, segmento a segmento. */
export function matchesStep(
	tour: TourKey,
	s: TourStep,
	slug: string | null,
	pathname: string
): boolean {
	const want = stepPattern(tour, s, slug).replace(/\/+$/, '').split('/');
	const have = pathname.replace(/\/+$/, '').split('/');
	if (want.length !== have.length) return false;
	return want.every((seg, i) => (/^\[\w+\]$/.test(seg) ? have[i] !== '' : seg === have[i]));
}

/** URL directa do paso, ou `null` se ten parámetros e hai que chegar por unha ligazón. */
export function stepHref(tour: TourKey, s: TourStep, slug: string | null): string | null {
	const p = stepPattern(tour, s, slug);
	return /\[\w+\]/.test(p) ? null : p;
}

/** Percorrido que corresponde a unha ruta (para «Percorrido guiado» sen un previo). */
export function tourForPath(pathname: string): TourKey {
	if (pathname.startsWith('/deputacion')) return 'deputacion';
	const zone = pathname.split('/')[2];
	if (zone === 'admin') return 'concello';
	if (zone === 'conserxeria') return 'conserxe';
	return 'vecina';
}

/**
 * Con que percorrido e concello se pode (re)comezar desde a pantalla actual, ou `null` se antes
 * hai que escoller un perfil en /demo (p. ex. na lista de concellos, onde aínda non hai concello).
 */
export function restartPlan(
	current: { tour: TourKey; slug: string | null } | null,
	last: TourKey | null,
	pathname: string,
	slugParam: string | null
): { tour: TourKey; slug: string | null } | null {
	const inApp = slugParam !== null || pathname.startsWith('/deputacion');
	const tour = current?.tour ?? last ?? (inApp ? tourForPath(pathname) : null);
	if (!tour) return null;
	if (TOURS[tour].scope === 'raiz') return { tour, slug: null };
	const slug = current?.slug ?? slugParam;
	return slug ? { tour, slug } : null;
}

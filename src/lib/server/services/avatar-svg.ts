// SPDX-License-Identifier: EUPL-1.2
// Debuxo do catálogo como documento SVG autónomo: a insignia da cabeceira úsao nun <img>, así
// o catálogo enteiro (avatar-art.ts) só se descarga nas páxinas que escollen avatar.
import { isAvatarKey } from '../../avatars';
import { AVATAR_ART } from '../../ui/avatar-art';

/** SVG da clave, co fondo do círculo e o recorte resolto; null se a clave non existe. */
export function avatarSvg(key: string): string | null {
	if (!isAvatarKey(key)) return null;
	const art = AVATAR_ART[key];
	// O mesmo encadre ca Avatar.svelte: os personaxes de deporte son máis anchos.
	const viewBox = key.startsWith('deporte-') ? '11 13 78 78' : '7 12 86 86';
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
		`<rect x="0" y="0" width="100" height="100" fill="${art.bg}"/>` +
		'<defs><clipPath id="c" clipPathUnits="userSpaceOnUse"><circle cx="50" cy="60" r="38"/>' +
		'</clipPath></defs>' +
		art.svg.replaceAll('__clip__', 'c') +
		'</svg>'
	);
}

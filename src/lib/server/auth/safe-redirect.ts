// SPDX-License-Identifier: EUPL-1.2

/** Solo rutas locales: empiezan por `/` y no por `//` ni `/\`. Cualquier otra cosa va a `/`. */
export function safeRedirect(target: string | null): string {
	if (!target || !target.startsWith('/')) return '/';
	if (target.startsWith('//') || target.startsWith('/\\')) return '/';
	// Los navegadores ignoran tabuladores y saltos de línea al interpretar la URL.
	if (/[\u0000-\u001f\u007f\\]/.test(target)) return '/';
	return target;
}

// SPDX-License-Identifier: EUPL-1.2
import { AUTH_SECRET } from '$app/env/private';
import { deriveDniSecret } from '../domain/dni';

// La derivación vive en el dominio para que la semilla (tsx, sin `$app`) pueda usarla.
export { deriveDniSecret };

/** Clave del hash de DNI del entorno actual; null sin `AUTH_SECRET` (no se puede buscar ni guardar). */
export function dniSecret(): string | null {
	return AUTH_SECRET ? deriveDniSecret(AUTH_SECRET) : null;
}

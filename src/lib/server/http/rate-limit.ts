// SPDX-License-Identifier: EUPL-1.2

export type RateLimitRule = { name: string; limit: number; windowMs: number };

export const MINUTE_MS = 60_000;
export const IDENTITY_RATE_LIMIT: RateLimitRule = {
	name: 'identity',
	limit: 10,
	windowMs: MINUTE_MS
};
export const API_RATE_LIMIT: RateLimitRule = { name: 'api', limit: 120, windowMs: MINUTE_MS };
export const POST_RATE_LIMIT: RateLimitRule = { name: 'post', limit: 60, windowMs: MINUTE_MS };

/** Decide o límite antes de tocar a base de datos; GET de páxinas queda libre. */
export function rateLimitRule(pathname: string, method: string): RateLimitRule | null {
	if (pathname.startsWith('/api/')) return API_RATE_LIMIT;
	if (method.toUpperCase() !== 'POST') return null;
	if (
		pathname === '/auth' ||
		pathname.startsWith('/auth/') ||
		pathname === '/simulador' ||
		pathname.startsWith('/simulador/') ||
		/^\/[^/]+\/entrar(?:\/|$)/.test(pathname)
	) {
		return IDENTITY_RATE_LIMIT;
	}
	return POST_RATE_LIMIT;
}

export type RateLimitResult = { allowed: boolean; retryAfter: number };

/**
 * Limitador de xanela deslizante en memoria, unha instancia por proceso. Con varias réplicas
 * débese substituír por un almacén compartido (por exemplo Redis ou o proxy de entrada).
 */
export function createRateLimiter(now: () => number = Date.now) {
	// Clave «regra:IP»: cada tipo de petición ten o seu contador.
	const entries = new Map<string, number[]>();
	let lastSweep = 0;

	/** Borra as claves sen actividade recente; como moito unha vez por minuto. */
	function sweep(current: number) {
		if (current - lastSweep < MINUTE_MS) return;
		lastSweep = current;
		for (const [storedKey, timestamps] of entries) {
			if (timestamps[timestamps.length - 1] <= current - MINUTE_MS) entries.delete(storedKey);
		}
	}

	function check(key: string, rule: RateLimitRule): RateLimitResult {
		const current = now();
		sweep(current);
		const cutoff = current - rule.windowMs;
		const id = `${rule.name}:${key}`;
		const timestamps = (entries.get(id) ?? []).filter((timestamp) => timestamp > cutoff);
		if (timestamps.length >= rule.limit) {
			entries.set(id, timestamps);
			return {
				allowed: false,
				retryAfter: Math.max(1, Math.ceil((timestamps[0] + rule.windowMs - current) / 1000))
			};
		}
		timestamps.push(current);
		entries.set(id, timestamps);
		return { allowed: true, retryAfter: 0 };
	}

	return { check };
}

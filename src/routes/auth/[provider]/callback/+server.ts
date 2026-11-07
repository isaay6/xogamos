// SPDX-License-Identifier: EUPL-1.2
import { timingSafeEqual } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { verifyAssertion } from '../../../../lib/server/auth/assertion';
import { isProvider, readIdentityConfig } from '../../../../lib/server/auth/config';
import { startSession } from '../../../../lib/server/auth/login';
import { safeRedirect } from '../../../../lib/server/auth/safe-redirect';
import type { Db } from '../../../../lib/server/db/client';
import { staffRoles } from '../../../../lib/server/db/schema';
import { fail } from '../../../../lib/server/http/respond';

const stateCookie = z.object({
	state: z.string().min(1),
	redirectTo: z.string()
});

async function hasStaffRole(db: Db, userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: staffRoles.id })
		.from(staffRoles)
		.where(eq(staffRoles.userId, userId))
		.limit(1);
	return row !== undefined;
}

function sameString(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export const GET: RequestHandler = async ({ params, url, cookies, locals }) => {
	const config = readIdentityConfig();
	if (!isProvider(params.provider) || config.mode !== 'simulated') return fail('NOT_FOUND');

	const assertion = url.searchParams.get('assertion');
	const raw = cookies.get('auth_state');
	if (!assertion || !raw) return fail('VALIDATION_FAILED');
	let saved: z.infer<typeof stateCookie>;
	try {
		saved = stateCookie.parse(JSON.parse(raw));
	} catch {
		return fail('VALIDATION_FAILED');
	}

	const now = locals.now();
	const verified = verifyAssertion(assertion, config.secret!, now);
	if (!verified.ok) return fail('VALIDATION_FAILED');
	const payload = verified.value;
	if (payload.provider !== params.provider || !sameString(payload.state, saved.state)) {
		return fail('VALIDATION_FAILED');
	}

	// Nunca se reutiliza la sesión previa: `startSession` la invalida antes de abrir la nueva.
	const user = await startSession(
		{ locals, cookies },
		{
			provider: payload.provider,
			subject: payload.subject,
			displayName: payload.displayName,
			email: payload.email
		}
	);
	cookies.delete('auth_state', { path: '/' });
	// A primeira vez (sen benvida feita) pasa polos tres pasos, que despois volven ao destino.
	// O persoal (calquera fila en staff_roles) vai sempre directo: a benvida é da veciñanza.
	const target = safeRedirect(saved.redirectTo);
	const welcome = !user.onboardedAt && !(await hasStaffRole(locals.db, user.id));
	redirect(303, welcome ? `/benvida?redirectTo=${encodeURIComponent(target)}` : target);
};

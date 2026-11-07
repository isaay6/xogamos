// SPDX-License-Identifier: EUPL-1.2
import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { facilities, municipalities, staffRoles, users } from '../db/schema';
import { meanOccupancy, municipalityIndicators } from './indicators';
import { err, ok, type Result } from './result';

/** Rutas de primer nivel que no pueden ser un concello. */
export const RESERVED_SLUGS = [
	'manifest.webmanifest',
	'offline',
	'api',
	'auth',
	'simulador',
	'deputacion',
	'admin',
	'conserxeria',
	'entrar',
	'benvida',
	'demo'
];

/** ¿Tiene la persona el rol provincial `deputacion` (sin concello)? */
export async function hasDeputacionRole(db: Db, userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: staffRoles.id })
		.from(staffRoles)
		.where(
			and(
				eq(staffRoles.userId, userId),
				isNull(staffRoles.municipalityId),
				eq(staffRoles.role, 'deputacion')
			)
		);
	return Boolean(row);
}

export type MunicipalityAdmin = {
	roleId: string;
	userId: string;
	displayName: string;
};

export type MunicipalityWithAdmins = {
	id: string;
	slug: string;
	name: string;
	admins: MunicipalityAdmin[];
};

/** Concellos e as súas persoas administradoras, para a asignación provincial. */
export async function listMunicipalitiesWithAdmins(db: Db): Promise<MunicipalityWithAdmins[]> {
	const all = await db
		.select({ id: municipalities.id, slug: municipalities.slug, name: municipalities.name })
		.from(municipalities)
		.orderBy(asc(municipalities.name), asc(municipalities.id));
	const admins = await db
		.select({
			roleId: staffRoles.id,
			userId: users.id,
			displayName: users.displayName,
			municipalityId: staffRoles.municipalityId
		})
		.from(staffRoles)
		.innerJoin(users, eq(users.id, staffRoles.userId))
		.where(and(eq(staffRoles.role, 'admin'), sql`${staffRoles.municipalityId} is not null`))
		.orderBy(asc(users.displayName), asc(staffRoles.id));
	const byMunicipality = new Map<string, MunicipalityAdmin[]>();
	for (const admin of admins) {
		if (!admin.municipalityId) continue;
		const current = byMunicipality.get(admin.municipalityId) ?? [];
		current.push({ roleId: admin.roleId, userId: admin.userId, displayName: admin.displayName });
		byMunicipality.set(admin.municipalityId, current);
	}
	return all.map((municipality) => ({
		...municipality,
		admins: byMunicipality.get(municipality.id) ?? []
	}));
}

export type DeputacionStaffCandidate = {
	userId: string;
	displayName: string;
	provider: 'clave' | 'chave365';
	email: string | null;
};

const ACCENTED = 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç';
const PLAIN = 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc';

/** Busca identidades dixitais en todos os concellos por nome ou correo. */
export async function searchDeputacionStaffCandidates(
	db: Db,
	q: string
): Promise<DeputacionStaffCandidate[]> {
	const needle = q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
	if (!needle) return [];
	const rows = await db
		.select({
			userId: users.id,
			displayName: users.displayName,
			provider: users.provider,
			email: users.email
		})
		.from(users)
		.where(
			and(
				inArray(users.provider, ['clave', 'chave365']),
				or(
					ilike(sql`translate(${users.displayName}, ${ACCENTED}, ${PLAIN})`, `%${needle}%`),
					ilike(users.email, `%${needle}%`)
				)
			)
		)
		.orderBy(asc(users.displayName), asc(users.id))
		.limit(20);
	return rows as DeputacionStaffCandidate[];
}

export async function getDeputacionStaffCandidate(
	db: Db,
	userId: string
): Promise<DeputacionStaffCandidate | null> {
	const [candidate] = await db
		.select({
			userId: users.id,
			displayName: users.displayName,
			provider: users.provider,
			email: users.email
		})
		.from(users)
		.where(and(eq(users.id, userId), inArray(users.provider, ['clave', 'chave365'])));
	return (candidate as DeputacionStaffCandidate | undefined) ?? null;
}

/** Dá o rol de administración provincialmente; repetir a operación non duplica a fila. */
export async function addMunicipalityAdmin(
	db: Db,
	municipalityId: string,
	userId: string
): Promise<boolean> {
	const [municipality] = await db
		.select({ id: municipalities.id })
		.from(municipalities)
		.where(eq(municipalities.id, municipalityId));
	const candidate = await getDeputacionStaffCandidate(db, userId);
	if (!municipality || !candidate) return false;
	await db
		.insert(staffRoles)
		.values({ municipalityId, userId, role: 'admin' })
		.onConflictDoNothing();
	return true;
}

/** Crea a identidade se non existía e dálle administración sen modificar datos existentes. */
export async function addMunicipalityAdminIdentity(
	db: Db,
	municipalityId: string,
	identity: { provider: 'clave' | 'chave365'; subject: string; displayName: string }
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [municipality] = await tx
			.select({ id: municipalities.id })
			.from(municipalities)
			.where(eq(municipalities.id, municipalityId));
		if (!municipality) return false;
		await tx
			.insert(users)
			.values({ ...identity, email: null })
			.onConflictDoNothing({ target: [users.provider, users.subject] });
		const [user] = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.provider, identity.provider), eq(users.subject, identity.subject)));
		if (!user) return false;
		await tx
			.insert(staffRoles)
			.values({ municipalityId, userId: user.id, role: 'admin' })
			.onConflictDoNothing();
		return true;
	});
}

export const PROVINCES = ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra'] as const;

export type CreateMunicipalityInput = {
	slug: string;
	name: string;
	province: (typeof PROVINCES)[number];
	primaryColor: string;
	firstAdmin: { provider: 'clave' | 'chave365'; subject: string; displayName: string };
};

/** Crea el concello con las políticas por defecto y su primer administrador. */
export function createMunicipality(
	db: Db,
	input: CreateMunicipalityInput
): Promise<Result<typeof municipalities.$inferSelect, 'SLUG_TAKEN'>> {
	if (RESERVED_SLUGS.includes(input.slug)) return Promise.resolve(err('SLUG_TAKEN'));
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(municipalities)
			.values({
				slug: input.slug,
				name: input.name,
				province: input.province,
				primaryColor: input.primaryColor
			})
			.onConflictDoNothing({ target: municipalities.slug })
			.returning();
		if (!row) return err('SLUG_TAKEN');
		// Nunca se pisan los datos de una persona existente (spec 7.1).
		await tx
			.insert(users)
			.values({ ...input.firstAdmin, email: null })
			.onConflictDoNothing({ target: [users.provider, users.subject] });
		const [admin] = await tx
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					eq(users.provider, input.firstAdmin.provider),
					eq(users.subject, input.firstAdmin.subject)
				)
			);
		await tx
			.insert(staffRoles)
			.values({ userId: admin.id, municipalityId: row.id, role: 'admin' })
			.onConflictDoNothing();
		return ok(row);
	});
}

export type MunicipalityComparison = {
	id: string;
	slug: string;
	name: string;
	province: string;
	facilities: number;
	/** Instalacións con franxas ofertadas no período: as que entran na media de ocupación. */
	openFacilities: number;
	bookings: number;
	avgOccupancy: number;
	noShowRate: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Comparativa entre concellos: solo agregados, nunca datos de personas. */
export async function compareMunicipalities(
	db: Db,
	from: string,
	to: string
): Promise<MunicipalityComparison[]> {
	const all = await db.select().from(municipalities).orderBy(asc(municipalities.name));
	const out: MunicipalityComparison[] = [];
	for (const m of all) {
		const active = await db
			.select({ id: facilities.id })
			.from(facilities)
			.where(and(eq(facilities.municipalityId, m.id), eq(facilities.active, true)));
		const { byFacility } = await municipalityIndicators(db, m.id, from, to);
		const bookings = byFacility.reduce((n, f) => n + f.bookings, 0);
		const noShows = byFacility.reduce((n, f) => n + f.noShows, 0);
		out.push({
			id: m.id,
			slug: m.slug,
			name: m.name,
			province: m.province,
			facilities: active.length,
			openFacilities: byFacility.filter((f) => f.open).length,
			bookings,
			avgOccupancy: round3(meanOccupancy(byFacility)),
			noShowRate: bookings > 0 ? round3(noShows / bookings) : 0
		});
	}
	return out;
}

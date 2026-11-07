// SPDX-License-Identifier: EUPL-1.2
// Formularios do perfil compartidos pola benvida (/benvida) e por «Eu»: concellos seguidos,
// avatar (debuxo ou foto) e preferencias de avisos. Devolven un `fail` de Kit ou null se gardou.
import { fail } from '@sveltejs/kit';
import { asc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { isAvatarKey } from '../../avatars';
import type { Db } from '../db/client';
import { municipalities, users } from '../db/schema';
import { clearAvatarPhoto, setAvatarKey, setAvatarPhoto } from '../services/avatar';
import { MAX_LOGO_BYTES } from '../services/logo';
import { updateContact } from '../services/me';
import { setNotifyPrefs } from '../services/notifications';
import { declareResidency, followMunicipalities, listFollowed } from '../services/profiles';

export const AVATAR_TABS = ['persoas', 'deportes', 'foto'] as const;
export type AvatarTab = (typeof AVATAR_TABS)[number];

export const avatarTab = (raw: string | null): AvatarTab =>
	(AVATAR_TABS as readonly string[]).includes(raw ?? '') ? (raw as AvatarTab) : 'persoas';

const text = (form: FormData, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v : '';
};

/** Avatar actual e datos de avisos da persoa. */
export async function readProfileUser(db: Db, userId: string) {
	const [row] = await db
		.select({
			avatarKey: users.avatarKey,
			textSize: users.textSize,
			highContrast: users.highContrast,
			reduceMotion: users.reduceMotion,
			easyBooking: users.easyBooking,
			hasPhoto: isNotNull(users.avatarMime),
			email: users.email,
			notifyEmail: users.notifyEmail,
			onboardedAt: users.onboardedAt
		})
		.from(users)
		.where(eq(users.id, userId));
	return {
		avatar: { key: row?.avatarKey ?? null, hasPhoto: Boolean(row?.hasPhoto) },
		textSize: row?.textSize ?? 'normal',
		highContrast: row?.highContrast ?? false,
		reduceMotion: row?.reduceMotion ?? 'system',
		easyBooking: row?.easyBooking ?? false,
		email: row?.email ?? '',
		notifyEmail: row?.notifyEmail ?? false,
		onboardedAt: row?.onboardedAt ?? null
	};
}

/**
 * Todos os concellos da plataforma para escoller, co de `first` diante (o concello desde o que
 * se entrou) e o resto por nome; `checked` marca os seguidos.
 */
export async function municipalityChoices(db: Db, userId: string, first: string | null) {
	const [all, followed] = await Promise.all([
		db
			.select({
				id: municipalities.id,
				slug: municipalities.slug,
				name: municipalities.name,
				province: municipalities.province,
				primaryColor: municipalities.primaryColor,
				hasLogo: isNotNull(municipalities.logo),
				logoVersion: municipalities.logoVersion
			})
			.from(municipalities)
			.orderBy(asc(municipalities.name)),
		listFollowed(db, userId)
	]);
	const byId = new Map(followed.map((f) => [f.municipalityId, f]));
	const rows = all.map((m) => {
		const f = byId.get(m.id);
		return {
			...m,
			hasLogo: Boolean(m.hasLogo),
			checked: Boolean(f),
			isResident: f?.isResident ?? false,
			declared: f?.residencyDeclaredAt != null
		};
	});
	const lead = rows.filter((m) => m.slug === first);
	return [...lead, ...rows.filter((m) => m.slug !== first)];
}

/** Concellos marcados (`concello`, varios): polo menos un e todos existentes. */
export async function saveFollowed(db: Db, userId: string, form: FormData) {
	const ids = form.getAll('concello').filter((v): v is string => typeof v === 'string' && !!v);
	if (ids.length === 0) return fail(400, { erro: 'NINGUN' as const });
	if (!ids.every((id) => z.uuid().safeParse(id).success))
		return fail(400, { erro: 'NINGUN' as const });
	const result = await followMunicipalities(db, userId, ids);
	if (!result.ok) return fail(400, { erro: 'NINGUN' as const });
	return null;
}

/**
 * Debuxo do catálogo (`avatar`); a cadea baleira volve á inicial. Sen o campo (nada marcado
 * na pestana que se ve) non cambia nada.
 */
export async function saveAvatarKey(db: Db, userId: string, form: FormData) {
	if (!form.has('avatar')) return null;
	const key = text(form, 'avatar');
	if (key !== '' && !isAvatarKey(key)) return fail(400, { avatarErro: true as const });
	await setAvatarKey(db, userId, key === '' ? null : key);
	return null;
}

/** Foto propia (`foto`, multipart): os mesmos límites de tamaño e bytes máxicos ca a API. */
export async function saveAvatarPhoto(db: Db, userId: string, form: FormData) {
	const file = form.get('foto');
	if (!(file instanceof File) || file.size === 0)
		return fail(400, { foto: 'UNSUPPORTED_IMAGE' as const });
	// O tamaño antes de ler os bytes: unha foto grande non se carga enteira en memoria.
	if (file.size > MAX_LOGO_BYTES) return fail(400, { foto: 'PHOTO_TOO_LARGE' as const });
	const bytes = new Uint8Array(await file.arrayBuffer());
	const result = await setAvatarPhoto(db, userId, bytes, file.size);
	if (!result.ok) return fail(400, { foto: result.error });
	return null;
}

export async function removeAvatarPhoto(db: Db, userId: string) {
	await clearAvatarPhoto(db, userId);
	return null;
}

export type NoticeIssues = { email?: true; consentimento?: true };

/**
 * Avisos: «só na app» ou tamén por correo, co enderezo e o consentimento explícito. Apagar o
 * correo borra o consentimento (setNotifyPrefs); o enderezo gardado queda en «Os meus datos».
 */
export async function saveNoticePrefs(db: Db, userId: string, form: FormData, now: Date) {
	const avisos = text(form, 'avisos') === 'correo' ? 'correo' : 'app';
	const email = text(form, 'email').trim();
	// Volven tal cal se enviaron para repintar o formulario tras un erro.
	const values = { avisos, email, consentimento: text(form, 'consentimento') === 'si' };
	if (avisos === 'correo') {
		const issues: NoticeIssues = {};
		if (!z.email().max(200).safeParse(email).success) issues.email = true;
		if (text(form, 'consentimento') !== 'si') issues.consentimento = true;
		if (issues.email || issues.consentimento) return fail(400, { issues, values });
		const saved = await updateContact(db, userId, { email });
		if (!saved.ok) return fail(400, { issues: { email: true } as NoticeIssues, values });
	}
	await setNotifyPrefs(db, userId, { email: avisos === 'correo' }, now);
	return null;
}

/**
 * Declaración de empadroamento (`empadroado`: id dun concello seguido, ou baleiro). Valida sen
 * gardar; `declareChosenResidency` garda despois. Non verifica nada nin cambia o prezo: queda
 * «pendente de comprobar» ata que o concello o confirme.
 */
export async function checkResidency(db: Db, userId: string, form: FormData) {
	const id = text(form, 'empadroado');
	if (id === '') return { declare: null };
	const target = (await listFollowed(db, userId)).find((f) => f.municipalityId === id);
	if (!target) return fail(400, { empadroadoErro: true as const });
	// Xa verificado ou xa declarado: consérvase a data primeira.
	return { declare: target.isResident || target.residencyDeclaredAt ? null : id };
}

export async function declareChosenResidency(
	db: Db,
	userId: string,
	choice: { declare: string | null },
	now: Date
) {
	if (choice.declare) await declareResidency(db, userId, choice.declare, now);
}

/** Primeiro segmento dunha ruta local (`/viana-do-bolo/reservas` → `viana-do-bolo`). */
export function slugOfPath(path: string): string | null {
	const seg = path.split(/[/?#]/)[1];
	return seg ? seg : null;
}

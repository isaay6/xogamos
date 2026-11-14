// SPDX-License-Identifier: EUPL-1.2
// Claves de texto de los avisos personales. Sin código de servidor: lo usan también las pantallas.
import type { MessageKey } from './i18n';

export const NOTICE_KINDS = [
	'confirmed',
	'changed',
	'cancelled',
	'cancelled_by_staff',
	'reminder',
	'closure',
	'hours_changed',
	'residency_verified',
	'request_status',
	'tournament_published',
	'tournament_cancelled',
	'tournament_reminder',
	'opening',
	'waitlist_offer'
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/**
 * Lo único que lleva un aviso para redactarse: instalación, fecha y hora locales, motivo. Los
 * avisos que no son de una reserva (`residency_verified`) no llevan nada: ver `PersonalParams`.
 */
export type BookingNoticeParams = {
	facilityName: string;
	/** Fecha local 'YYYY-MM-DD' (Europe/Madrid). */
	date: string;
	/** Hora local 'HH:mm'. */
	time: string;
	reason?: string;
	/** Solo en avisos de cierre: identifica el cierre (un aviso por reserva y cierre). */
	closureId?: string;
	/**
	 * Cancelación por una reserva de temporada: nombre de la entidad. El motivo se redacta en el
	 * idioma de quien lo lee (`vec.aviso.motivo_tempada`), no se guarda ya escrito.
	 */
	season?: string;
	/** Aviso operativo para quen abre a instalación. */
	openingAction?: 'created' | 'cancelled';
	personName?: string;
	/** Límite ISO dunha oferta da lista de espera. */
	offeredUntil?: string;
};

export type RequestStatusNoticeParams = Partial<BookingNoticeParams> & {
	requestTitle: string;
	requestStatus: 'aprobada' | 'rexeitada' | 'mais_datos' | 'retirada';
	response?: string;
};

export type TournamentNoticeParams = {
	tournamentTitle: string;
	facilityName: string;
	tournamentId?: string;
};

/** Parámetros de un aviso cualquiera: los de reserva completos o ninguno (avisos de perfil). */
export type NoticeParams = BookingNoticeParams | RequestStatusNoticeParams | TournamentNoticeParams;

/** Parámetros de un aviso cualquiera: reserva, solicitud o aviso de perfil. */
export type PersonalParams = NoticeParams | Record<string, never>;

/** Clave de la frase del aviso; con motivo, la variante que lo añade. */
export function noticeKey(
	kind: NoticeKind,
	hasReason = false,
	params?: Partial<BookingNoticeParams> & Partial<RequestStatusNoticeParams>
): MessageKey {
	if (kind === 'request_status')
		return `vec.aviso.request_status.${params?.requestStatus ?? 'aprobada'}` as MessageKey;
	if (kind.startsWith('tournament_')) return `vec.aviso.${kind}` as MessageKey;
	if (kind === 'opening') return `vec.aviso.opening.${params?.openingAction ?? 'created'}`;
	if (hasReason && kind === 'cancelled_by_staff') return 'vec.aviso.cancelled_by_staff.motivo';
	if (hasReason && kind === 'closure') return 'vec.aviso.closure.motivo';
	return `vec.aviso.${kind}`;
}

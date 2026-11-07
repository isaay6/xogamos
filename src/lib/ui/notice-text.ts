// SPDX-License-Identifier: EUPL-1.2
// Frase de un aviso personal lista para mostrar: la fecha ISO local se escribe con el nombre del
// mes (Europe/Madrid) antes de pasar por `t()`, nunca se enseña cruda.
import {
	noticeKey,
	type BookingNoticeParams,
	type NoticeKind,
	type RequestStatusNoticeParams,
	type TournamentNoticeParams
} from '../avisos';
import { t, type Locale, type MessageKey } from '../i18n';
import { dayLabel } from './booking-text';
import { longDate } from './format';

/** 'YYYY-MM-DD' local → «23 de outubro» (tablas propias, ver `longDate`). */
export const noticeDate = longDate;

/** Días que van de `from` a `to` (fechas locales 'YYYY-MM-DD'). */
function daysBetween(from: string, to: string): number {
	const utc = (d: string) => {
		const [y, m, day] = d.split('-').map(Number);
		return Date.UTC(y, m - 1, day);
	};
	return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * Cando se publicou un aviso: «Hoxe», «Mañá» ou «Xov 22» ata 6 días atrás; máis vello, o día e
 * o mes («9 de outubro»), porque o día da semana xa non di cal foi.
 */
export function postedDay(locale: Locale, date: string, today: string): string {
	return daysBetween(date, today) > 6 ? longDate(locale, date) : dayLabel(locale, date, today);
}

export function noticeText(
	locale: Locale,
	kind: NoticeKind,
	params: Partial<BookingNoticeParams> &
		Partial<RequestStatusNoticeParams> &
		Partial<TournamentNoticeParams>
): string {
	const season = params.season?.trim();
	const reason = season
		? t(locale, 'vec.aviso.motivo_tempada', { entidade: season })
		: params.reason?.trim();
	const key =
		kind === 'request_status'
			? (`vec.aviso.request_status.${params.requestStatus ?? 'aprobada'}` as MessageKey)
			: kind === 'cancelled_by_staff' && params.closureId && reason
				? 'vec.aviso.cancelled_by_closure'
				: noticeKey(kind, Boolean(reason));
	return t(locale, key, {
		facilityName: params.facilityName ?? '',
		date: noticeDate(locale, params.date ?? ''),
		time: params.time ?? '',
		reason: reason ?? '',
		requestTitle: params.requestTitle ?? '',
		tournamentTitle: params.tournamentTitle ?? '',
		personName: params.personName ?? '',
		response: params.response ?? ''
	});
}

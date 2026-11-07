// SPDX-License-Identifier: EUPL-1.2
import { t, type Locale } from '../i18n';
import { longDate } from './format';

export function localDate(locale: Locale, closure: { startsOn: string; endsOn: string }) {
	return closure.startsOn === closure.endsOn
		? t(locale, 'peche.hoxe')
		: t(locale, 'peche.ata', { data: longDate(locale, closure.endsOn) });
}

// SPDX-License-Identifier: EUPL-1.2

/** Un evento de calendario: o que se precarga en Google Calendar ou Outlook. */
export type CalendarEvent = { title: string; start: Date; end: Date; location: string };

/** «20261125T170000Z»: o formato compacto en UTC que pide Google. */
const compact = (d: Date) =>
	d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

export function googleCalendarUrl(e: CalendarEvent): string {
	const q = new URLSearchParams({
		action: 'TEMPLATE',
		text: e.title,
		dates: `${compact(e.start)}/${compact(e.end)}`,
		location: e.location
	});
	return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
	const q = new URLSearchParams({
		path: '/calendar/action/compose',
		rru: 'addevent',
		subject: e.title,
		startdt: e.start.toISOString(),
		enddt: e.end.toISOString(),
		location: e.location
	});
	return `https://outlook.live.com/calendar/0/action/compose?${q}`;
}

// SPDX-License-Identifier: EUPL-1.2

export type IcsEvent = {
	uid: string;
	start: Date;
	end: Date;
	summary: string;
	location: string;
	description: string;
	status: 'CONFIRMED' | 'CANCELLED';
};

const encoder = new TextEncoder();

function escapeText(v: string): string {
	return v
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

function utc(d: Date): string {
	return d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/** Pliega a 75 octetos UTF-8 por línea sin partir caracteres; las continuaciones empiezan por un espacio. */
function fold(line: string): string {
	const out: string[] = [];
	let current = '';
	let size = 0;
	for (const ch of line) {
		const bytes = encoder.encode(ch).length;
		// La continuación gasta un octeto en el espacio inicial.
		const limit = out.length === 0 ? 75 : 74;
		if (size + bytes > limit) {
			out.push(current);
			current = '';
			size = 0;
		}
		current += ch;
		size += bytes;
	}
	out.push(current);
	return out.join('\r\n ');
}

/** iCalendar RFC 5545: horas en UTC, texto escapado, líneas plegadas, fin de línea `\r\n`. */
export function toIcs(calendarName: string, events: IcsEvent[]): string {
	const stamp = utc(new Date());
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//plataforma-reservas//GL',
		'CALSCALE:GREGORIAN',
		`X-WR-CALNAME:${escapeText(calendarName)}`
	];
	for (const e of events) {
		lines.push(
			'BEGIN:VEVENT',
			`UID:${e.uid}`,
			`DTSTAMP:${stamp}`,
			`DTSTART:${utc(e.start)}`,
			`DTEND:${utc(e.end)}`,
			`SUMMARY:${escapeText(e.summary)}`,
			`LOCATION:${escapeText(e.location)}`,
			`DESCRIPTION:${escapeText(e.description)}`,
			`STATUS:${e.status}`,
			'END:VEVENT'
		);
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}

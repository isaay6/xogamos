// SPDX-License-Identifier: EUPL-1.2
/** Escritor OOXML pequeno: celas de texto, número e data, e primeira fila conxelada. */
export type XlsxCell = string | number | Date | null;
export type XlsxSheet = {
	name: string;
	headers: string[];
	rows: XlsxCell[][];
	currencyColumns?: number[];
};

const xml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (n: number) => {
	let out = '';
	for (n++; n; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
	return out;
};
const excelDate = (date: Date) => date.getTime() / 86_400_000 + 25_569;
const bytes = (value: string) => new TextEncoder().encode(value);
const crc32 = (data: Uint8Array) => {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (n: number) => Uint8Array.of(n & 255, n >>> 8);
const u32 = (n: number) => Uint8Array.of(n & 255, n >>> 8, n >>> 16, n >>> 24);
const join = (parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
};

function zip(files: { name: string; content: string }[]): Uint8Array {
	const locals: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const file of files) {
		const name = bytes(file.name);
		const data = bytes(file.content);
		const crc = crc32(data);
		const local = join([
			u32(0x04034b50),
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			name,
			data
		]);
		locals.push(local);
		central.push(
			join([
				u32(0x02014b50),
				u16(20),
				u16(20),
				u16(0),
				u16(0),
				u16(0),
				u16(0),
				u32(crc),
				u32(data.length),
				u32(data.length),
				u16(name.length),
				u16(0),
				u16(0),
				u16(0),
				u16(0),
				u32(0),
				u32(offset),
				name
			])
		);
		offset += local.length;
	}
	const directory = join(central);
	return join([
		...locals,
		directory,
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(directory.length),
		u32(offset),
		u16(0)
	]);
}

function worksheet(sheet: XlsxSheet): string {
	const rows = [sheet.headers, ...sheet.rows]
		.map((row, r) => {
			const cells = row
				.map((value, c) => {
					const ref = `${col(c)}${r + 1}`;
					if (value === null || value === undefined) return '';
					if (value instanceof Date) return `<c r="${ref}" s="2"><v>${excelDate(value)}</v></c>`;
					if (typeof value === 'number')
						return `<c r="${ref}"${sheet.currencyColumns?.includes(c) ? ' s="1"' : ''}><v>${value}</v></c>`;
					return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
				})
				.join('');
			return `<row r="${r + 1}">${cells}</row>`;
		})
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`;
}

export function toXlsx(sheets: XlsxSheet[]): Uint8Array {
	const content = sheets
		.map(
			(_, i) =>
				`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
		)
		.join('');
	const rels = sheets
		.map(
			(_, i) =>
				`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
		)
		.join('');
	const names = sheets
		.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
		.join('');
	return zip([
		{
			name: '[Content_Types].xml',
			content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${content}</Types>`
		},
		{
			name: '_rels/.rels',
			content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
		},
		{
			name: 'xl/workbook.xml',
			content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names}</sheets></workbook>`
		},
		{
			name: 'xl/_rels/workbook.xml.rels',
			content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
		},
		{
			name: 'xl/styles.xml',
			content: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="€ #,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf numFmtId="164" applyNumberFormat="1" xfId="0"/><xf numFmtId="165" applyNumberFormat="1" xfId="0"/></cellXfs></styleSheet>`
		},
		...sheets.map((sheet, i) => ({
			name: `xl/worksheets/sheet${i + 1}.xml`,
			content: worksheet(sheet)
		}))
	]);
}

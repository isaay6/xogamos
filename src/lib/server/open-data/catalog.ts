// SPDX-License-Identifier: EUPL-1.2
import { asc } from 'drizzle-orm';
import type { Db } from '../db/client';
import { municipalities } from '../db/schema';

const theme = 'http://datos.gob.es/kos/sector-publico/sector/deporte';
const EUPL = 'https://eupl.eu/1.2/en/';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

export async function openDataCatalog(db: Db, origin: string) {
	const places = await db.select().from(municipalities).orderBy(asc(municipalities.name));
	const datasets = places.flatMap((place) => {
		const base = `${origin}/api/v1/m/${place.slug}/open-data`;
		return [
			{
				'@id': `${base}/facilities.geojson`,
				'@type': 'dcat:Dataset',
				'dct:title': {
					gl: `Instalacións deportivas de ${place.name}`,
					es: `Instalaciones deportivas de ${place.name}`
				},
				'dct:publisher': { '@type': 'foaf:Organization', 'foaf:name': place.name },
				'dct:spatial': place.name,
				'dcat:theme': theme,
				'dct:language': ['gl', 'es'],
				'dcat:distribution': [
					{
						'@type': 'dcat:Distribution',
						'dcat:accessURL': `${base}/facilities.geojson`,
						'dct:format': 'application/geo+json',
						'dct:license': EUPL
					}
				]
			},
			{
				'@id': `${base}/occupancy`,
				'@type': 'dcat:Dataset',
				'dct:title': {
					gl: `Ocupación semanal de ${place.name}`,
					es: `Ocupación semanal de ${place.name}`
				},
				'dct:publisher': { '@type': 'foaf:Organization', 'foaf:name': place.name },
				'dct:spatial': place.name,
				'dcat:theme': theme,
				'dct:language': ['gl', 'es'],
				'dcat:distribution': [
					{
						'@type': 'dcat:Distribution',
						'dcat:accessURL': `${base}/occupancy?week=AAAA-MM-DD`,
						'dct:format': 'application/json',
						'dct:license': CC_BY
					}
				]
			}
		];
	});
	return {
		'@context': {
			dcat: 'http://www.w3.org/ns/dcat#',
			dct: 'http://purl.org/dc/terms/',
			foaf: 'http://xmlns.com/foaf/0.1/'
		},
		'@id': `${origin}/api/v1/open-data/catalog.jsonld`,
		'@type': 'dcat:Catalog',
		'dct:title': 'Catálogo de datos abertos deportivos',
		'dcat:dataset': datasets
	};
}

const quote = (value: unknown) => JSON.stringify(String(value));
/** Serializador Turtle deliberadamente pequeno para o perfil de catálogo que xeramos. */
export function catalogTurtle(catalog: Awaited<ReturnType<typeof openDataCatalog>>) {
	const lines = [
		'@prefix dcat: <http://www.w3.org/ns/dcat#> .',
		'@prefix dct: <http://purl.org/dc/terms/> .',
		'@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
		''
	];
	for (const dataset of catalog['dcat:dataset']) {
		const title = dataset['dct:title'];
		const distribution = dataset['dcat:distribution'][0];
		lines.push(
			`<${dataset['@id']}> a dcat:Dataset ;`,
			`  dct:title ${quote(title.gl)}@gl, ${quote(title.es)}@es ;`,
			`  dct:publisher [ a foaf:Organization ; foaf:name ${quote(dataset['dct:publisher']['foaf:name'])} ] ;`,
			`  dct:spatial ${quote(dataset['dct:spatial'])} ;`,
			`  dcat:theme <${dataset['dcat:theme']}> ;`,
			`  dct:language "gl", "es" ;`,
			`  dcat:distribution [ a dcat:Distribution ; dcat:accessURL <${distribution['dcat:accessURL']}> ; dct:format ${quote(distribution['dct:format'])} ; dct:license <${distribution['dct:license']}> ] .`,
			''
		);
	}
	return lines.join('\n');
}

// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';
import { mapHref } from './map-link';

describe('mapHref', () => {
	it('coas coordenadas marca o punto en OpenStreetMap', () => {
		expect(mapHref({ latitude: 42.179, longitude: -7.113 })).toBe(
			'https://www.openstreetmap.org/?mlat=42.17900&mlon=-7.11300#map=17/42.17900/-7.11300'
		);
	});

	it('sen coordenadas busca o enderezo e o concello', () => {
		expect(
			mapHref({
				latitude: null,
				longitude: null,
				address: 'Rúa do Campo 3',
				municipalityName: 'Viana do Bolo'
			})
		).toBe(
			'https://www.openstreetmap.org/search?query=R%C3%BAa%20do%20Campo%203%2C%20Viana%20do%20Bolo'
		);
	});

	it('sen coordenadas nin enderezo non hai ligazón', () => {
		expect(mapHref({ latitude: null, longitude: null, address: ' ' })).toBeNull();
	});
});

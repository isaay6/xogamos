// SPDX-License-Identifier: EUPL-1.2
// Ligazón «Ver no mapa» a OpenStreetMap. É só unha ligazón: a páxina non carga mapas nin teselas
// de terceiros; a persoa decide se a abre.

export type MapPlace = {
	latitude: number | null;
	longitude: number | null;
	address?: string | null;
	municipalityName?: string | null;
};

/** URL de OpenStreetMap coas coordenadas da instalación, ou buscando o enderezo; `null` sen datos. */
export function mapHref(p: MapPlace): string | null {
	if (p.latitude !== null && p.longitude !== null) {
		const lat = p.latitude.toFixed(5);
		const lon = p.longitude.toFixed(5);
		return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
	}
	const query = [p.address, p.municipalityName].filter((x) => x && x.trim()).join(', ');
	return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : null;
}

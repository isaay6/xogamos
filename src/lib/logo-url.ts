// SPDX-License-Identifier: EUPL-1.2
// URL del escudo de un concello. Lleva la versión (`logo_version`, sube con cada escudo nuevo):
// con la versión vigente el servidor lo sirve como inmutable y un escudo nuevo cambia el URL.

export const logoUrl = (slug: string, version: number) =>
	`/api/v1/m/${encodeURIComponent(slug)}/logo?v=${version}`;

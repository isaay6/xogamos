// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { statusFor } from './respond';

export type RouteDef = {
	method: 'get' | 'post' | 'put' | 'patch' | 'delete';
	path: string;
	summary: string;
	auth: 'public' | 'user' | 'staff' | 'admin' | 'deputacion';
	params?: z.ZodObject;
	query?: z.ZodObject;
	body?: z.ZodType;
	/** Estado HTTP de éxito (por defecto 200). */
	status?: 200 | 201 | 204;
	/** Tipo de contenido del cuerpo de la petición si no es JSON (p. ej. `image/*`). */
	bodyContentType?: string;
	response: z.ZodType;
	/** Tipo de contenido de la respuesta de éxito si no es JSON (p. ej. `text/csv`). */
	contentType?: string;
	errors: string[];
};

const registry = new Map<string, RouteDef>();

// Idempotente: reevaluar un módulo (HMR) sustituye la definición.
export function registerRoute(def: RouteDef): void {
	registry.set(`${def.method} ${def.path}`, def);
}

const schemaOf = (s: z.ZodType) =>
	z.toJSONSchema(s, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' });

function parametersOf(where: 'path' | 'query', obj?: z.ZodObject) {
	if (!obj) return [];
	return Object.entries(obj.shape).map(([name, s]) => ({
		name,
		in: where,
		required: where === 'path' ? true : !(s as z.ZodType).safeParse(undefined).success,
		schema: schemaOf(s as z.ZodType)
	}));
}

const ISSUES_SCHEMA = {
	type: 'array',
	items: {
		type: 'object',
		required: ['path', 'message'],
		properties: { path: { type: 'string' }, message: { type: 'string' } }
	}
};

function errorResponses(codes: string[]) {
	const byStatus = new Map<number, string[]>();
	for (const code of codes) {
		const status = statusFor(code);
		byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
	}
	return Object.fromEntries(
		[...byStatus].map(([status, list]) => [
			String(status),
			{
				description: list.join(', '),
				content: {
					'application/json': {
						schema: {
							type: 'object',
							required: ['error'],
							properties: {
								error: { type: 'string', enum: list },
								...(list.includes('VALIDATION_FAILED') || list.includes('INVALID_CONFIG')
									? { issues: ISSUES_SCHEMA }
									: {}),
								// NOT_TODAY indica la fecha local de la próxima reserva con ese código.
								...(list.includes('NOT_TODAY') ? { date: { type: 'string', format: 'date' } } : {})
							}
						}
					}
				}
			}
		])
	);
}

export function buildOpenApiDocument(): object {
	const paths: Record<string, Record<string, unknown>> = {};
	const defs = [...registry.values()].sort((a, b) =>
		`${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)
	);
	for (const d of defs) {
		const op: Record<string, unknown> = {
			summary: d.summary,
			'x-auth': d.auth,
			security: d.auth === 'public' ? [] : [{ sesion: [] }],
			parameters: [...parametersOf('path', d.params), ...parametersOf('query', d.query)],
			responses: {
				[String(d.status ?? 200)]:
					d.status === 204
						? { description: 'No Content' }
						: {
								description: d.status === 201 ? 'Created' : 'OK',
								content: {
									[d.contentType ?? 'application/json']: { schema: schemaOf(d.response) }
								}
							},
				...errorResponses(d.errors)
			}
		};
		if (d.body) {
			op.requestBody = {
				required: true,
				content: { [d.bodyContentType ?? 'application/json']: { schema: schemaOf(d.body) } }
			};
		}
		(paths[d.path] ??= {})[d.method] = op;
	}
	return {
		openapi: '3.1.0',
		info: {
			title: 'Plataforma de reservas de instalacións deportivas',
			version: '1.0.0',
			license: { name: 'EUPL-1.2', url: 'https://eupl.eu/1.2/en/' }
		},
		components: {
			securitySchemes: { sesion: { type: 'apiKey', in: 'cookie', name: 'sesion' } }
		},
		paths
	};
}

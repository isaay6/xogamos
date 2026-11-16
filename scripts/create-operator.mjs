// SPDX-License-Identifier: EUPL-1.2
// Dá o papel de Deputación (operador da instalación) a unha persoa. É o primeiro paso dunha
// instalación real: esa persoa entra con Cl@ve ou Chave365 e dá de alta os concellos.
// Uso: node scripts/create-operator.mjs --provider clave --subject 12345678Z --name "Nome Apelido"
import { parseArgs } from 'node:util';
import postgres from 'postgres';

const USO =
	'Uso: node scripts/create-operator.mjs --provider clave|chave365 --subject IDENTIFICADOR --name "Nome"';

let values;
try {
	({ values } = parseArgs({
		options: {
			provider: { type: 'string' },
			subject: { type: 'string' },
			name: { type: 'string' }
		}
	}));
} catch {
	console.error(USO);
	process.exit(1);
}

const provider = values.provider;
const subject = values.subject?.trim();
const name = values.name?.trim();
if (
	(provider !== 'clave' && provider !== 'chave365') ||
	!subject ||
	subject.length > 64 ||
	!name ||
	name.length > 120
) {
	console.error(USO);
	process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('DATABASE_URL non está definida.');
	process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
try {
	await sql.begin(async (tx) => {
		await tx`
			insert into users (provider, subject, display_name)
			values (${provider}, ${subject}, ${name})
			on conflict (provider, subject) do nothing`;
		const [user] = await tx`
			select id from users where provider = ${provider} and subject = ${subject}`;
		const [existing] = await tx`
			select id from staff_roles
			where user_id = ${user.id} and municipality_id is null and role = 'deputacion'`;
		if (existing) {
			console.log('Esa persoa xa tiña o papel de Deputación. Non se cambiou nada.');
			return;
		}
		await tx`insert into staff_roles (user_id, municipality_id, role)
			values (${user.id}, null, 'deputacion')`;
		console.log(`Feito: ${name} xa pode entrar con ${provider} e dar de alta concellos.`);
	});
} catch (error) {
	console.error('Non se puido crear o operador:', error);
	process.exitCode = 1;
} finally {
	await sql.end();
}

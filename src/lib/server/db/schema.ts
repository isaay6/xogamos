// SPDX-License-Identifier: EUPL-1.2
import { sql } from 'drizzle-orm';
import {
	boolean,
	customType,
	check,
	date,
	foreignKey,
	index,
	integer,
	jsonb,
	uniqueIndex,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import { MASCOTS } from '../../mascots';

const tstz = (name: string) => timestamp(name, { withTimezone: true });

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
	dataType: () => 'bytea'
});

export const identityProvider = pgEnum('identity_provider', ['clave', 'chave365', 'local']);
export const staffRole = pgEnum('staff_role', ['admin', 'conserxe', 'apertura', 'deputacion']);
export const mascot = pgEnum('mascot', MASCOTS);
export const bookingMode = pgEnum('booking_mode', ['slot', 'unit', 'capacity', 'day']);
export const bookingStatus = pgEnum('booking_status', [
	'confirmed',
	'cancelled',
	'no_show',
	'attended'
]);
export const bookingChannel = pgEnum('booking_channel', ['online', 'phone', 'desk']);
export const bookingPayment = pgEnum('booking_payment', ['facility', 'wallet']);
export const notificationKind = pgEnum('notification_kind', [
	'confirmed',
	'changed',
	'cancelled',
	'cancelled_by_staff',
	'reminder',
	'closure',
	'hours_changed',
	'residency_verified',
	'request_status',
	'tournament_published',
	'tournament_cancelled',
	'tournament_reminder',
	'opening',
	'waitlist_offer'
]);
export const waitlistStatus = pgEnum('waitlist_status', [
	'waiting',
	'offered',
	'booked',
	'expired',
	'withdrawn'
]);
export const socialTariff = pgEnum('social_tariff', ['xove', 'maior', 'familia']);
export const holidayMode = pgEnum('holiday_mode', ['closed', 'sunday_hours']);
export const walletMovementKind = pgEnum('wallet_movement_kind', [
	'recarga_tarxeta',
	'recarga_mobil',
	'pago_reserva',
	'pago_abono',
	'devolucion',
	'axuste'
]);
export const entityPriceMode = pgEnum('entity_price_mode', ['normal', 'free', 'fixed']);
export const requestKind = pgEnum('request_kind', ['tempada', 'evento', 'outro']);
export const requestStatus = pgEnum('request_status', [
	'pendente',
	'mais_datos',
	'aprobada',
	'rexeitada',
	'retirada'
]);
export const closureKind = pgEnum('closure_kind', ['peche', 'evento']);
export const tournamentFormat = pgEnum('tournament_format', ['individual', 'parellas', 'equipos']);
export const tournamentStatus = pgEnum('tournament_status', ['publicado', 'cancelado']);
export const tournamentPayment = pgEnum('tournament_payment', ['monedero', 'instalacion']);

export const municipalities = pgTable(
	'municipalities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		province: text('province').notNull(),
		primaryColor: text('primary_color').notNull(),
		cancellationDeadlineMinutes: integer('cancellation_deadline_minutes').notNull().default(120),
		maxDaysAhead: integer('max_days_ahead').notNull().default(14),
		noShowThreshold: integer('no_show_threshold').notNull().default(3),
		penaltyDays: integer('penalty_days').notNull().default(7),
		legalNotice: text('legal_notice').notNull().default(''),
		privacyPolicy: text('privacy_policy').notNull().default(''),
		usageRules: text('usage_rules').notNull().default(''),
		seasonPriorityCriteria: text('season_priority_criteria').notNull().default(''),
		// Escudo: bytes y tipo verificados por bytes mágicos (services/logo.ts).
		logo: bytea('logo'),
		logoMime: text('logo_mime'),
		// Sube con cada escudo nuevo: el URL lleva `?v=` y se puede cachear como inmutable.
		logoVersion: integer('logo_version').notNull().default(0)
	},
	(t) => [
		check(
			'municipalities_logo_mime_allowed',
			sql`${t.logoMime} is null or ${t.logoMime} in ('image/png', 'image/jpeg', 'image/webp')`
		)
	]
);

// Identidad compartida entre concellos (spec 7.1)
export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		provider: identityProvider('provider').notNull(),
		subject: text('subject').notNull(),
		displayName: text('display_name').notNull(),
		email: text('email'),
		// Personas dadas de alta por teléfono (sin identidad digital propia).
		phone: text('phone'),
		// Aviso por correo: opt-in, con la fecha del consentimiento.
		notifyEmail: boolean('notify_email').notNull().default(false),
		notifyConsentAt: tstz('notify_consent_at'),
		// Fin del recorrido de bienvenida (null = aún no lo ha hecho).
		onboardedAt: tstz('onboarded_at'),
		// Dibujo del catálogo (`src/lib/avatars.ts`) y/o foto propia (bytes y tipo por bytes mágicos).
		avatarKey: text('avatar_key'),
		avatarPhoto: bytea('avatar_photo'),
		avatarMime: text('avatar_mime'),
		textSize: text('text_size').notNull().default('normal'),
		highContrast: boolean('high_contrast').notNull().default(false),
		reduceMotion: text('reduce_motion').notNull().default('system'),
		easyBooking: boolean('easy_booking').notNull().default(false),
		// HMAC-SHA256 del DNI/NIE normalizado (domain/dni.ts); el DNI nunca se guarda en claro.
		dniHash: text('dni_hash').unique('users_dni_hash_unique')
	},
	(t) => [
		unique('users_provider_subject_unique').on(t.provider, t.subject),
		check('users_text_size_allowed', sql`${t.textSize} in ('normal', 'large', 'very_large')`),
		check('users_reduce_motion_allowed', sql`${t.reduceMotion} in ('system', 'always', 'never')`),
		check(
			'users_avatar_mime_allowed',
			sql`${t.avatarMime} is null or ${t.avatarMime} in ('image/png', 'image/jpeg', 'image/webp')`
		)
	]
);

export const municipalityProfiles = pgTable(
	'municipality_profiles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		isResident: boolean('is_resident').notNull().default(false),
		noShowCount: integer('no_show_count').notNull().default(0),
		penaltyUntil: tstz('penalty_until'),
		// Concello seguido (aparece en su lista). Nunca se borra el perfil al dejar de seguir.
		followed: boolean('followed').notNull().default(true),
		// Declaración propia de empadronamiento; no verificada y sin efecto en el precio.
		residencyDeclaredAt: tstz('residency_declared_at'),
		// Empadronamiento comprobado por el personal (cuándo y quién); solo esto cambia el precio.
		residencyVerifiedAt: tstz('residency_verified_at'),
		residencyVerifiedBy: uuid('residency_verified_by').references(() => users.id, {
			onDelete: 'set null'
		}),
		// Tarifa social que asigna el personal (nunca la propia persona).
		socialTariff: socialTariff('social_tariff'),
		// A aceptación das normas é por persoa e concello, non por cada reserva.
		rulesAcceptedAt: tstz('rules_accepted_at')
	},
	(t) => [
		unique('profiles_municipality_user_unique').on(t.municipalityId, t.userId),
		// Destino de la FK compuesta de bookings (coherencia de concello).
		unique('profiles_id_municipality_unique').on(t.id, t.municipalityId)
	]
);

// O monedero pertence á persoa, non ao concello. O saldo vive só no libro maior de abaixo.
export const wallets = pgTable('wallets', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
		.unique(),
	createdAt: tstz('created_at').notNull().defaultNow()
});

export const walletMovements = pgTable(
	'wallet_movements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		walletId: uuid('wallet_id')
			.notNull()
			.references(() => wallets.id, { onDelete: 'restrict' }),
		amountCents: integer('amount_cents').notNull(),
		kind: walletMovementKind('kind').notNull(),
		municipalityId: uuid('municipality_id').references(() => municipalities.id, {
			onDelete: 'set null'
		}),
		reference: text('reference').notNull(),
		idempotencyKey: text('idempotency_key'),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('wallet_movements_wallet_created_idx').on(t.walletId, t.createdAt),
		unique('wallet_movements_idempotency_key_unique').on(t.idempotencyKey)
	]
);

export const rechargeCards = pgTable(
	'recharge_cards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
		amountCents: integer('amount_cents').notNull(),
		issuedBy: uuid('issued_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		issuedAt: tstz('issued_at').notNull().defaultNow(),
		usedByWalletId: uuid('used_by_wallet_id').references(() => wallets.id, {
			onDelete: 'restrict'
		}),
		usedAt: tstz('used_at')
	},
	(t) => [
		index('recharge_cards_municipality_issued_idx').on(t.municipalityId, t.issuedAt),
		check('recharge_cards_amount_allowed', sql`${t.amountCents} in (1000, 2000, 5000)`),
		check(
			'recharge_cards_used_together',
			sql`(${t.usedByWalletId} is null) = (${t.usedAt} is null)`
		)
	]
);

export const staffRoles = pgTable(
	'staff_roles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// null para el rol de deputación (ámbito provincial)
		municipalityId: uuid('municipality_id').references(() => municipalities.id, {
			onDelete: 'cascade'
		}),
		role: staffRole('role').notNull()
	},
	(t) => [
		unique('staff_roles_user_municipality_role_unique')
			.on(t.userId, t.municipalityId, t.role)
			.nullsNotDistinct()
	]
);

// Rexistro inmutable de accións do persoal. `params` leva datos neutros para redactar a frase
// no idioma da persoa que o consulta; nunca unha frase xa traducida.
export const activityLogs = pgTable(
	'activity_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		actorId: uuid('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [index('activity_logs_municipality_created_idx').on(t.municipalityId, t.createdAt)]
);

// Sesiones: `id` es el SHA-256 (hex) del token; el token nunca se guarda.
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: tstz('expires_at').notNull(),
	createdAt: tstz('created_at').notNull().defaultNow()
});

export const facilityTypes = pgTable(
	'facility_types',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		nameGl: text('name_gl').notNull(),
		nameEs: text('name_es').notNull(),
		mascot: mascot('mascot').notNull().default('sala'),
		color: text('color').notNull(),
		bookingMode: bookingMode('booking_mode').notNull()
	},
	(t) => [
		// Destino de la FK compuesta de facilities (coherencia de concello).
		unique('facility_types_id_municipality_unique').on(t.id, t.municipalityId)
	]
);

export const facilities = pgTable(
	'facilities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		// FK compuesta (type_id, municipality_id) abajo: el tipo es del mismo concello.
		typeId: uuid('type_id').notNull(),
		name: text('name').notNull(),
		location: text('location').notNull().default(''),
		address: text('address').notNull().default(''),
		units: integer('units').notNull().default(1),
		capacity: integer('capacity').notNull().default(1),
		slotMinutes: integer('slot_minutes').notNull().default(60),
		priceResidentCents: integer('price_resident_cents').notNull(),
		priceNonResidentCents: integer('price_non_resident_cents').notNull(),
		// Precio para quien tiene tarifa social; null = sin precio social.
		priceSocialCents: integer('price_social_cents'),
		accessible: boolean('accessible').notNull().default(false),
		// Ficha de accesibilidad: null = el concello aún no lo ha comprobado.
		stepFreeAccess: text('step_free_access', { enum: ['yes', 'no', 'partial'] }),
		adaptedToilet: boolean('adapted_toilet'),
		adaptedChangingRoom: boolean('adapted_changing_room'),
		accessibleParkingNearby: boolean('accessible_parking_nearby'),
		hearingLoop: boolean('hearing_loop'),
		supportContact: varchar('support_contact', { length: 120 }),
		accessibilityNotes: varchar('accessibility_notes', { length: 300 }),
		accessibilityCheckedAt: date('accessibility_checked_at', { mode: 'string' }),
		rules: text('rules').notNull().default(''),
		needsOpening: boolean('needs_opening').notNull().default(false),
		accessInfo: text('access_info').notNull().default(''),
		accessInfoEs: text('access_info_es'),
		active: boolean('active').notNull().default(true)
	},
	(t) => [
		// Destino de la FK compuesta de bookings (coherencia de concello).
		unique('facilities_id_municipality_unique').on(t.id, t.municipalityId),
		foreignKey({
			name: 'facilities_type_municipality_fk',
			columns: [t.typeId, t.municipalityId],
			foreignColumns: [facilityTypes.id, facilityTypes.municipalityId]
		}).onDelete('restrict'),
		check('facilities_slot_minutes_positive', sql`${t.slotMinutes} > 0`),
		check('facilities_units_positive', sql`${t.units} >= 1`),
		check('facilities_capacity_positive', sql`${t.capacity} >= 1`),
		check('facilities_price_resident_non_negative', sql`${t.priceResidentCents} >= 0`),
		check(
			'facilities_step_free_access_allowed',
			sql`${t.stepFreeAccess} is null or ${t.stepFreeAccess} in ('yes', 'no', 'partial')`
		),
		check('facilities_price_non_resident_non_negative', sql`${t.priceNonResidentCents} >= 0`),
		check(
			'facilities_price_social_non_negative',
			sql`${t.priceSocialCents} is null or ${t.priceSocialCents} >= 0`
		)
	]
);

// Clubs, escolas e outras entidades que poden reservar en nome propio.
export const entities = pgTable(
	'entities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		shortName: varchar('short_name', { length: 3 }).notNull(),
		phone: varchar('phone', { length: 40 }).notNull().default(''),
		active: boolean('active').notNull().default(true),
		priceMode: entityPriceMode('price_mode'),
		fixedPriceCents: integer('fixed_price_cents'),
		advanceDays: integer('advance_days'),
		maxActiveBookings: integer('max_active_bookings'),
		maxConsecutiveSlots: integer('max_consecutive_slots'),
		noShowsCount: boolean('no_shows_count').notNull().default(true),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('entities_municipality_idx').on(t.municipalityId),
		check('entities_short_name_length', sql`char_length(${t.shortName}) between 2 and 3`),
		check(
			'entities_fixed_price_non_negative',
			sql`${t.fixedPriceCents} is null or ${t.fixedPriceCents} >= 0`
		),
		check('entities_advance_days_positive', sql`${t.advanceDays} is null or ${t.advanceDays} >= 0`),
		check(
			'entities_max_active_positive',
			sql`${t.maxActiveBookings} is null or ${t.maxActiveBookings} >= 1`
		),
		check(
			'entities_max_consecutive_positive',
			sql`${t.maxConsecutiveSlots} is null or ${t.maxConsecutiveSlots} >= 1`
		),
		check(
			'entities_fixed_price_required',
			sql`${t.priceMode} <> 'fixed' or ${t.fixedPriceCents} is not null`
		)
	]
);

export const entityFacilities = pgTable(
	'entity_facilities',
	{
		entityId: uuid('entity_id')
			.notNull()
			.references(() => entities.id, { onDelete: 'cascade' }),
		facilityId: uuid('facility_id')
			.notNull()
			.references(() => facilities.id, { onDelete: 'cascade' })
	},
	(t) => [unique('entity_facilities_unique').on(t.entityId, t.facilityId)]
);

export const entityMembers = pgTable(
	'entity_members',
	{
		entityId: uuid('entity_id')
			.notNull()
			.references(() => entities.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => [
		unique('entity_members_unique').on(t.entityId, t.userId),
		index('entity_members_user_idx').on(t.userId)
	]
);

export const openingHours = pgTable(
	'opening_hours',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		facilityId: uuid('facility_id')
			.notNull()
			.references(() => facilities.id, { onDelete: 'cascade' }),
		// 0 = luns (Monday) … 6 = domingo
		weekday: integer('weekday').notNull(),
		opens: text('opens').notNull(), // 'HH:MM'
		closes: text('closes').notNull() // 'HH:MM'
	},
	(t) => [
		check('opening_hours_weekday_range', sql`${t.weekday} between 0 and 6`),
		check('opening_hours_opens_format', sql`${t.opens} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
		check('opening_hours_closes_format', sql`${t.closes} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
		// Con formato 'HH:MM' fijo, la comparación de texto equivale a la horaria.
		check('opening_hours_closes_after_opens', sql`${t.closes} > ${t.opens}`)
	]
);

export const closures = pgTable(
	'closures',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		facilityId: uuid('facility_id')
			.notNull()
			.references(() => facilities.id, { onDelete: 'cascade' }),
		startsAt: tstz('starts_at').notNull(),
		endsAt: tstz('ends_at').notNull(),
		reason: text('reason').notNull().default(''),
		kind: closureKind('kind').notNull().default('peche'),
		title: text('title'),
		requestId: uuid('request_id')
	},
	(t) => [check('closures_ends_after_starts', sql`${t.endsAt} > ${t.startsAt}`)]
);

// Solicitudes á administración: a persoa pode presentala no seu nome ou como responsable dun club.
export const requests = pgTable(
	'requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
		kind: requestKind('kind').notNull(),
		facilityId: uuid('facility_id').references(() => facilities.id, { onDelete: 'set null' }),
		unitIndex: integer('unit_index'),
		fromDate: date('from_date', { mode: 'string' }).notNull(),
		toDate: date('to_date', { mode: 'string' }).notNull(),
		weekdays: integer('weekdays').array(),
		startsTime: text('starts_time').notNull(),
		endsTime: text('ends_time').notNull(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		people: integer('people'),
		phone: text('phone').notNull().default(''),
		status: requestStatus('status').notNull().default('pendente'),
		response: text('response'),
		decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
		decidedAt: tstz('decided_at'),
		createdAt: tstz('created_at').notNull().defaultNow(),
		updatedAt: tstz('updated_at').notNull().defaultNow()
	},
	(t) => [
		index('requests_municipality_status_idx').on(t.municipalityId, t.status),
		index('requests_user_municipality_idx').on(t.userId, t.municipalityId),
		check('requests_dates_ordered', sql`${t.toDate} >= ${t.fromDate}`),
		check('requests_starts_format', sql`${t.startsTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
		check('requests_ends_format', sql`${t.endsTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
		check('requests_ends_after_starts', sql`${t.endsTime} > ${t.startsTime}`),
		check(
			'requests_weekdays_tempada',
			sql`${t.kind} <> 'tempada' or cardinality(${t.weekdays}) > 0`
		),
		check('requests_people_positive', sql`${t.people} is null or ${t.people} > 0`)
	]
);

// Torneos publicados polo concello ou por unha entidade organizadora.
export const tournaments = pgTable(
	'tournaments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		requestId: uuid('request_id').references(() => requests.id, { onDelete: 'set null' }),
		entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
		facilityId: uuid('facility_id')
			.notNull()
			.references(() => facilities.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		sportDescription: text('sport_description').notNull(),
		startsOn: date('starts_on', { mode: 'string' }).notNull(),
		endsOn: date('ends_on', { mode: 'string' }).notNull(),
		description: text('description').notNull().default(''),
		rules: text('rules').notNull().default(''),
		format: tournamentFormat('format').notNull(),
		teamSize: integer('team_size'),
		maxEntries: integer('max_entries').notNull(),
		signupDeadline: tstz('signup_deadline').notNull(),
		feeCents: integer('fee_cents').notNull().default(0),
		status: tournamentStatus('status').notNull().default('publicado'),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('tournaments_municipality_starts_idx').on(t.municipalityId, t.startsOn),
		check('tournaments_dates_ordered', sql`${t.endsOn} >= ${t.startsOn}`),
		check('tournaments_max_entries_positive', sql`${t.maxEntries} > 0`),
		check('tournaments_fee_non_negative', sql`${t.feeCents} >= 0`),
		check('tournaments_team_size_positive', sql`${t.teamSize} is null or ${t.teamSize} > 0`)
	]
);

export const tournamentEntries = pgTable(
	'tournament_entries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tournamentId: uuid('tournament_id')
			.notNull()
			.references(() => tournaments.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		teamName: text('team_name'),
		members: text('members'),
		paidWith: tournamentPayment('paid_with'),
		paidCents: integer('paid_cents').notNull().default(0),
		createdAt: tstz('created_at').notNull().defaultNow(),
		cancelledAt: tstz('cancelled_at')
	},
	(t) => [
		index('tournament_entries_tournament_idx').on(t.tournamentId),
		uniqueIndex('tournament_entries_active_user_unique')
			.on(t.tournamentId, t.userId)
			.where(sql`${t.cancelledAt} is null`)
	]
);

// Festivos de todo o concello, non dunha instalación concreta.
export const holidays = pgTable(
	'holidays',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		date: date('date', { mode: 'string' }).notNull(),
		name: text('name').notNull(),
		mode: holidayMode('mode').notNull().default('closed')
	},
	(t) => [unique('holidays_municipality_date_unique').on(t.municipalityId, t.date)]
);

export const facilityPhotos = pgTable(
	'facility_photos',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		facilityId: uuid('facility_id')
			.notNull()
			.references(() => facilities.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		photo: bytea('photo').notNull(),
		mime: text('mime').notNull(),
		altGl: text('alt_gl').notNull(),
		altEs: text('alt_es')
	},
	(t) => [
		unique('facility_photos_facility_position_unique').on(t.facilityId, t.position),
		check('facility_photos_position_range', sql`${t.position} between 0 and 2`),
		check(
			'facility_photos_mime_allowed',
			sql`${t.mime} in ('image/png', 'image/jpeg', 'image/webp')`
		)
	]
);

export const bookings = pgTable(
	'bookings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		// FK compuestas (id, municipality_id) abajo: la instalación y el perfil son del mismo concello.
		facilityId: uuid('facility_id').notNull(),
		profileId: uuid('profile_id').notNull(),
		entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
		unitIndex: integer('unit_index'),
		seats: integer('seats').notNull().default(1),
		startsAt: tstz('starts_at').notNull(),
		endsAt: tstz('ends_at').notNull(),
		status: bookingStatus('status').notNull().default('confirmed'),
		accessCode: varchar('access_code', { length: 6 }).notNull(),
		priceCents: integer('price_cents').notNull(),
		paymentMethod: bookingPayment('payment_method').notNull().default('facility'),
		channel: bookingChannel('channel').notNull(),
		createdByUserId: uuid('created_by_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: tstz('created_at').notNull().defaultNow(),
		cancelledAt: tstz('cancelled_at')
	},
	(t) => [
		index('bookings_facility_starts_idx').on(t.facilityId, t.startsAt),
		index('bookings_municipality_idx').on(t.municipalityId),
		index('bookings_profile_municipality_idx').on(t.profileId, t.municipalityId),
		foreignKey({
			name: 'bookings_facility_municipality_fk',
			columns: [t.facilityId, t.municipalityId],
			foreignColumns: [facilities.id, facilities.municipalityId]
		}).onDelete('cascade'),
		foreignKey({
			name: 'bookings_profile_municipality_fk',
			columns: [t.profileId, t.municipalityId],
			foreignColumns: [municipalityProfiles.id, municipalityProfiles.municipalityId]
		}).onDelete('restrict'),
		check('bookings_ends_after_starts', sql`${t.endsAt} > ${t.startsAt}`),
		check('bookings_seats_positive', sql`${t.seats} >= 1`)
	]
);

// Cola por instalación y franja. El índice parcial de la migración impide duplicar
// una espera viva aunque dos peticiones lleguen a la vez.
export const waitlistEntries = pgTable(
	'waitlist_entries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id').notNull(),
		facilityId: uuid('facility_id').notNull(),
		profileId: uuid('profile_id').notNull(),
		startsAt: tstz('starts_at').notNull(),
		createdAt: tstz('created_at').notNull().defaultNow(),
		status: waitlistStatus('status').notNull().default('waiting'),
		offeredUntil: tstz('offered_until')
	},
	(t) => [
		index('waitlist_entries_slot_idx').on(t.facilityId, t.startsAt, t.createdAt),
		index('waitlist_entries_profile_idx').on(t.profileId, t.status),
		foreignKey({
			name: 'waitlist_entries_facility_municipality_fk',
			columns: [t.facilityId, t.municipalityId],
			foreignColumns: [facilities.id, facilities.municipalityId]
		}).onDelete('cascade'),
		foreignKey({
			name: 'waitlist_entries_profile_municipality_fk',
			columns: [t.profileId, t.municipalityId],
			foreignColumns: [municipalityProfiles.id, municipalityProfiles.municipalityId]
		}).onDelete('cascade')
	]
);

// Reservas de temporada de clubs y escuelas: cada fila es un día de la semana con su tramo
// local, vigente de `from_date` a `to_date` (ambos incluidos). Ocupan la instalación (o una
// unidad) como si fuesen reservas: `loadDayAvailability` las cuenta.
export const seasonBookings = pgTable(
	'season_bookings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		// FK compuesta (facility_id, municipality_id) abajo: la instalación es del mismo concello.
		facilityId: uuid('facility_id').notNull(),
		// Solo en modo `unit`: la unidad ocupada; null = toda la instalación.
		unitIndex: integer('unit_index'),
		entityName: text('entity_name').notNull(),
		entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
		// 0 = luns (Monday) … 6 = domingo, como `opening_hours`.
		weekday: integer('weekday').notNull(),
		startsTime: text('starts_time').notNull(), // 'HH:MM'
		endsTime: text('ends_time').notNull(), // 'HH:MM'
		fromDate: date('from_date', { mode: 'string' }).notNull(),
		toDate: date('to_date', { mode: 'string' }).notNull(),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('season_bookings_facility_weekday_idx').on(t.facilityId, t.weekday),
		index('season_bookings_municipality_idx').on(t.municipalityId),
		foreignKey({
			name: 'season_bookings_facility_municipality_fk',
			columns: [t.facilityId, t.municipalityId],
			foreignColumns: [facilities.id, facilities.municipalityId]
		}).onDelete('cascade'),
		check('season_bookings_weekday_range', sql`${t.weekday} between 0 and 6`),
		check(
			'season_bookings_starts_format',
			sql`${t.startsTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`
		),
		check('season_bookings_ends_format', sql`${t.endsTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
		check('season_bookings_ends_after_starts', sql`${t.endsTime} > ${t.startsTime}`),
		check('season_bookings_dates_ordered', sql`${t.toDate} >= ${t.fromDate}`),
		check('season_bookings_unit_non_negative', sql`${t.unitIndex} is null or ${t.unitIndex} >= 0`)
	]
);

// Modalidades de abono por tipo de instalación. El precio queda fijado al venderlo.
export const passTypes = pgTable(
	'pass_types',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		facilityTypeId: uuid('facility_type_id').notNull(),
		name: text('name').notNull(),
		days: integer('days').notNull(),
		priceCents: integer('price_cents').notNull()
	},
	(t) => [
		index('pass_types_municipality_idx').on(t.municipalityId),
		foreignKey({
			name: 'pass_types_facility_type_municipality_fk',
			columns: [t.facilityTypeId, t.municipalityId],
			foreignColumns: [facilityTypes.id, facilityTypes.municipalityId]
		}).onDelete('cascade'),
		check('pass_types_days_positive', sql`${t.days} >= 1`),
		check('pass_types_price_non_negative', sql`${t.priceCents} >= 0`)
	]
);

export const passes = pgTable(
	'passes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		passTypeId: uuid('pass_type_id')
			.notNull()
			.references(() => passTypes.id, { onDelete: 'restrict' }),
		profileId: uuid('profile_id').notNull(),
		startsOn: date('starts_on', { mode: 'string' }).notNull(),
		endsOn: date('ends_on', { mode: 'string' }).notNull(),
		pin: varchar('pin', { length: 4 }).notNull(),
		priceCents: integer('price_cents').notNull(),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: tstz('created_at').notNull().defaultNow(),
		cancelledAt: tstz('cancelled_at')
	},
	(t) => [
		index('passes_profile_idx').on(t.profileId),
		index('passes_pin_dates_idx').on(t.pin, t.startsOn, t.endsOn),
		check('passes_dates_ordered', sql`${t.endsOn} >= ${t.startsOn}`),
		check('passes_pin_format', sql`${t.pin} ~ '^[0-9]{4}$'`),
		check('passes_price_non_negative', sql`${t.priceCents} >= 0`)
	]
);

// Avisos personales. `params` solo lleva lo que la interfaz necesita para redactar la frase
// (instalación, fecha y hora locales, motivo); nunca datos de la persona.
export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		municipalityId: uuid('municipality_id').references(() => municipalities.id, {
			onDelete: 'cascade'
		}),
		kind: notificationKind('kind').notNull(),
		bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
		tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),
		params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
		createdAt: tstz('created_at').notNull().defaultNow(),
		readAt: tstz('read_at')
	},
	(t) => [
		index('notifications_user_created_idx').on(t.userId, t.createdAt),
		// Una sola «lembranza» por reserva: hace idempotente el trabajo de recordatorios.
		uniqueIndex('notifications_reminder_unique')
			.on(t.bookingId, t.kind)
			.where(sql`${t.kind} = 'reminder'`),
		uniqueIndex('notifications_tournament_unique')
			.on(t.userId, t.tournamentId, t.kind)
			.where(sql`${t.tournamentId} is not null`)
	]
);

// Avisos del concello (obras, cierres, noticias) visibles para sus vecinos.
export const municipalityNotices = pgTable(
	'municipality_notices',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		municipalityId: uuid('municipality_id')
			.notNull()
			.references(() => municipalities.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		startsAt: tstz('starts_at').notNull(),
		endsAt: tstz('ends_at'),
		createdByUserId: uuid('created_by_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('municipality_notices_municipality_idx').on(t.municipalityId, t.startsAt),
		check(
			'municipality_notices_ends_after_starts',
			sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`
		)
	]
);

// Cola de correos: sin SMTP_URL las filas se quedan aquí (visibles en la demo).
export const outboxEmails = pgTable('outbox_emails', {
	id: uuid('id').primaryKey().defaultRandom(),
	toAddress: text('to_address').notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	createdAt: tstz('created_at').notNull().defaultNow(),
	sentAt: tstz('sent_at'),
	// Reclamado por un envío en curso (se libera si el fallo es transitorio).
	claimedAt: tstz('claimed_at'),
	error: text('error')
});

export type BookingRow = typeof bookings.$inferSelect;
export type ProfileRow = typeof municipalityProfiles.$inferSelect;
export type FacilityRow = typeof facilities.$inferSelect;
export type SeasonRow = typeof seasonBookings.$inferSelect;
export type PassRow = typeof passes.$inferSelect;
export type EntityRow = typeof entities.$inferSelect;
export type WaitlistEntryRow = typeof waitlistEntries.$inferSelect;

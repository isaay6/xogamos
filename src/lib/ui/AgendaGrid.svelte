<!-- SPDX-License-Identifier: EUPL-1.2 -->
<script lang="ts">
	import { t, type Locale } from '#lib/i18n/index.js';
	import { facilityLabel, nounFor } from './booking-text';
	import { formatTime, textOn } from './format';
	import Mascot from './Mascot.svelte';

	type Entry = {
		id: string;
		startsAt: Date;
		endsAt: Date;
		unitIndex: number | null;
		seats: number;
		channel: string;
		status: string;
		displayName: string;
	};
	type Season = {
		id: string;
		entityName: string;
		startsAt: Date;
		endsAt: Date;
		unitIndex: number | null;
	};
	type Facility = {
		facilityId: string;
		facilityName: string;
		mascot: string;
		color: string;
		bookingMode: string;
		units: number;
		capacity: number;
		bookings: Entry[];
		/** Reservas de temporada del día: solo lectura, con el nombre de la entidad. */
		seasons?: Season[];
		/** Sin horario ese día (o cerrada entera por un cierre). */
		closed?: boolean;
	};
	type Block = {
		key: string;
		id: string;
		start: number;
		end: number;
		label: string;
		aria: string;
		status: string;
		phone: boolean;
		color: string;
		time: string;
		/** Temporada: no se abre ninguna tarjeta. */
		season: boolean;
	};

	let {
		facilities,
		startMinute,
		endMinute,
		nowMinute,
		now = null,
		selectedId,
		query = '',
		locale
	}: {
		facilities: Facility[];
		startMinute: number;
		endMinute: number;
		/** Minuto local de «agora»; `null` si el día no es hoy. */
		nowMinute: number | null;
		/** Instante actual: unha reserva xa rematada e sen marcar dise «sen marcar». */
		now?: Date | null;
		selectedId: string | null;
		/** Parámetros que se conservan en cada enlace, p. ej. `&dia=2026-11-24&inst=…`. */
		query?: string;
		locale: Locale;
	} = $props();

	const minuteOf = (d: Date) => {
		const [h, m] = formatTime(d).split(':').map(Number);
		return h * 60 + m;
	};
	// «Lucía Rial» → «Lucía R.»
	const short = (name: string) => {
		const parts = name.trim().split(/\s+/);
		return parts.length < 2 ? name : `${parts[0]} ${Array.from(parts[parts.length - 1])[0]}.`;
	};

	const hours = $derived(
		Array.from(
			{ length: Math.max(0, Math.ceil((endMinute - startMinute) / 60)) },
			(_, i) => startMinute / 60 + i
		)
	);
	const span = $derived(endMinute - startMinute);
	const showNow = $derived(
		nowMinute !== null && nowMinute >= startMinute && nowMinute <= endMinute
	);
	const nowText = $derived(
		nowMinute === null
			? ''
			: `${String(Math.floor(nowMinute / 60)).padStart(2, '0')}:${String(nowMinute % 60).padStart(2, '0')}`
	);
	// Lo que pasa de medianoche acaba, en esta columna, a las 24:00.
	const endOf = (startsAt: Date, endsAt: Date) => {
		const end = minuteOf(endsAt);
		return end <= minuteOf(startsAt) ? 24 * 60 : end;
	};

	function entryBlock(b: Entry, color: string): Block {
		const time = `${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`;
		const unmarked = b.status === 'confirmed' && now !== null && b.endsAt <= now;
		return {
			key: b.id,
			id: b.id,
			start: minuteOf(b.startsAt),
			end: endOf(b.startsAt, b.endsAt),
			label: short(b.displayName),
			aria: t(locale, 'cons.bloque', {
				nome: b.displayName,
				hora: time,
				estado: unmarked
					? t(locale, 'cons.estado.sen_marcar')
					: t(locale, `cons.estado.${b.status}` as 'cons.estado.confirmed')
			}),
			status: unmarked ? 'sen_marcar' : b.status,
			phone: b.channel !== 'online',
			color,
			time,
			season: false
		};
	}

	function seasonBlock(s: Season, color: string, key: string): Block {
		const time = `${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`;
		return {
			key,
			id: s.id,
			start: minuteOf(s.startsAt),
			end: endOf(s.startsAt, s.endsAt),
			label: s.entityName,
			aria: t(locale, 'cons.axenda.tempada', { entidade: s.entityName, hora: time }),
			status: 'tempada',
			phone: false,
			color,
			time,
			season: true
		};
	}

	type Column = { key: string; label: string; f: Facility; blocks: Block[] };

	function columnsOf(f: Facility): Column[] {
		const live = f.bookings.filter((b) => b.status !== 'cancelled');
		const seasons = f.seasons ?? [];
		// Pechada e baleira: unha soa columna, aínda que teña varias pistas ou rúas.
		if (f.closed && live.length === 0 && seasons.length === 0) {
			return [{ key: f.facilityId, label: f.facilityName, f, blocks: [] }];
		}
		if (f.bookingMode === 'unit') {
			return Array.from({ length: Math.max(1, f.units) }, (_, i) => ({
				key: `${f.facilityId}-${i}`,
				label: facilityLabel(locale, f.facilityName, i, nounFor('unit', f.mascot)),
				f,
				blocks: [
					...seasons
						.filter((s) => s.unitIndex === null || s.unitIndex === i)
						.map((s) => seasonBlock(s, f.color, `${s.id}-${i}`)),
					...live.filter((b) => (b.unitIndex ?? 0) === i).map((b) => entryBlock(b, f.color))
				]
			}));
		}
		const seasonBlocks = seasons.map((s) => seasonBlock(s, f.color, s.id));
		if (f.bookingMode === 'capacity') {
			const slots = new Map<number, Entry[]>();
			for (const b of live) {
				const k = b.startsAt.getTime();
				slots.set(k, [...(slots.get(k) ?? []), b]);
			}
			const blocks = [...slots.values()].map((group) => {
				const first = group[0];
				const taken = group
					.filter((b) => b.status !== 'no_show')
					.reduce((sum, b) => sum + b.seats, 0);
				const time = `${formatTime(first.startsAt)}–${formatTime(first.endsAt)}`;
				return {
					...entryBlock(first, f.color),
					label: `${taken}/${f.capacity}`,
					aria: t(locale, 'cons.bloque.aforo', {
						ocupadas: taken,
						aforo: f.capacity,
						hora: time
					}),
					status: 'confirmed',
					phone: false,
					time
				};
			});
			return [
				{ key: f.facilityId, label: f.facilityName, f, blocks: [...seasonBlocks, ...blocks] }
			];
		}
		return [
			{
				key: f.facilityId,
				label: f.facilityName,
				f,
				blocks: [...seasonBlocks, ...live.map((b) => entryBlock(b, f.color))]
			}
		];
	}

	const columns = $derived(facilities.flatMap(columnsOf));
</script>

<div class="grid-wrap" data-tour="axenda">
	<div
		class="dv"
		role="group"
		aria-label={t(locale, 'cons.axenda.grella')}
		style:--cols={columns.length || 1}
		style:--horas={hours.length || 1}
	>
		<div class="dvh">
			<div></div>
			{#each columns as c (c.key)}
				<div class="dvc">
					<Mascot kind={c.f.mascot} size={20} animated={false} color={c.f.color} />
					<span>{c.label}</span>
				</div>
			{/each}
		</div>
		<div class="dvb">
			<div class="dvt" aria-hidden="true">
				{#each hours as h (h)}
					<div>{h}:00</div>
				{/each}
			</div>
			{#each columns as c (c.key)}
				<div class="dcol" class:closed={c.f.closed}>
					{#if c.f.closed}
						<span class="pech">{t(locale, 'cons.axenda.pechada')}</span>
					{/if}
					{#each c.blocks as b (b.key)}
						{#if b.season}
							<div
								class="vb tempada"
								style:top="{((b.start - startMinute) / span) * 100}%"
								style:height="{((b.end - b.start) / span) * 100}%"
								style:--c={b.color}
							>
								<b>{b.label}</b>
								<small>{b.time}</small>
							</div>
						{:else}
							<a
								data-tour="axenda-reserva"
								class="vb {b.status}"
								class:sel={b.id === selectedId}
								href="?reserva={b.id}{query}"
								aria-label={b.aria}
								aria-current={b.id === selectedId ? 'true' : undefined}
								style:top="{((b.start - startMinute) / span) * 100}%"
								style:height="{((b.end - b.start) / span) * 100}%"
								style:background={b.status === 'no_show' ? undefined : b.color}
								style:color={b.status === 'no_show' ? '#fff' : textOn(b.color)}
							>
								<b class="nm"
									>{b.label}{#if b.phone}<span class="mk" aria-hidden="true"> ☎</span>{/if}</b
								>
								<small>{b.time}</small>
								{#if b.status === 'attended'}<span class="mk ok" aria-hidden="true">✓</span>{/if}
								{#if b.status === 'sen_marcar'}<span class="mk" aria-hidden="true">?</span>{/if}
							</a>
						{/if}
					{/each}
				</div>
			{/each}
			{#if showNow}
				<div
					class="now"
					data-label={t(locale, 'cons.agora')}
					style:top="{((nowMinute! - startMinute) / span) * 100}%"
				>
					<span>{nowText}</span>
				</div>
			{/if}
		</div>
	</div>
	<p class="lg">
		<span><i style="background:var(--pista)"></i>{t(locale, 'cons.lenda.reservada')}</span>
		<span>{t(locale, 'cons.lenda.chegou')}</span>
		<span><i class="rayas"></i>{t(locale, 'cons.lenda.nonveu')}</span>
		<span>{t(locale, 'cons.lenda.telefono')}</span>
		<span><i class="raiado"></i>{t(locale, 'cons.lenda.tempada')}</span>
		<span><i class="pechado"></i>{t(locale, 'cons.lenda.pechada')}</span>
	</p>
</div>

<style>
	.grid-wrap {
		overflow-x: auto;
	}
	.dv {
		--hora: 56px;
		--tcol: 48px;
		min-width: calc(var(--tcol) + var(--cols) * 116px);
		font-size: 12px;
		font-weight: 700;
	}
	.dvh,
	.dvb {
		display: grid;
		grid-template-columns: var(--tcol) repeat(var(--cols), minmax(0, 1fr));
		gap: 4px;
	}
	.dvh {
		position: sticky;
		top: 0;
		z-index: 4;
		padding-bottom: 6px;
		background: var(--branco);
	}
	.dvc {
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		min-height: 44px;
		padding: 4px 6px;
		border-radius: 9px;
		background: var(--ceo);
		font-size: 12px;
		font-weight: 900;
		line-height: 1.1;
	}
	.dvc span {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow-wrap: anywhere;
	}
	.dvb {
		position: relative;
		margin-top: 6px;
	}
	.dvt div {
		height: var(--hora);
		font-size: 11px;
		font-weight: 800;
		color: var(--gris);
		transform: translateY(-7px);
	}
	.dcol {
		position: relative;
		height: calc(var(--horas) * var(--hora));
		border-radius: 6px;
		background-color: #fafbfb;
		background-image: linear-gradient(to bottom, #dde3e2 1px, transparent 1px);
		background-size: 100% var(--hora);
	}
	.dcol.closed {
		background: repeating-linear-gradient(135deg, #f3f5f5, #f3f5f5 6px, #e6eaea 6px, #e6eaea 12px);
	}
	.pech {
		position: absolute;
		top: 10px;
		left: 0;
		right: 0;
		text-align: center;
		font-size: 13px;
		font-weight: 900;
		color: var(--txt);
	}
	.vb {
		position: absolute;
		left: 3px;
		right: 3px;
		display: flex;
		flex-direction: column;
		min-height: 24px;
		padding: 4px 6px;
		border-radius: 8px;
		overflow: hidden;
		line-height: 1.15;
		text-decoration: none;
		z-index: 1;
	}
	.vb b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 900;
	}
	.vb small {
		font-size: 11px;
		font-weight: 700;
	}
	.vb .ok {
		position: absolute;
		top: 4px;
		right: 6px;
		font-weight: 900;
	}
	.vb.no_show {
		background: repeating-linear-gradient(45deg, #c2372a, #c2372a 4px, #a82f24 4px, #a82f24 8px);
	}
	/* Xa rematou e ninguén marcou chegada nin falta */
	.vb.sen_marcar {
		outline: 2px dashed var(--txt);
		outline-offset: -2px;
	}
	.vb.tempada {
		border: 2px solid var(--c);
		background: repeating-linear-gradient(135deg, #fff, #fff 6px, #eef2f1 6px, #eef2f1 12px);
		color: var(--txt);
	}
	.vb.sel {
		box-shadow: 0 0 0 3px var(--txt);
		z-index: 2;
	}
	.vb:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
		z-index: 3;
	}
	.now {
		position: absolute;
		left: var(--tcol);
		right: 0;
		border-top: 2px solid var(--perigo);
		pointer-events: none;
		z-index: 3;
	}
	.now span {
		position: absolute;
		left: calc(-1 * var(--tcol));
		top: -10px;
		padding: 1px 4px;
		border-radius: 5px;
		background: var(--perigo);
		color: #fff;
		font-size: 11px;
		font-weight: 900;
	}
	.lg {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin: 10px 0 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--texto-suave);
	}
	.lg span {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.lg i {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.rayas {
		background: repeating-linear-gradient(45deg, #c2372a, #c2372a 3px, #a82f24 3px, #a82f24 6px);
	}
	.raiado {
		border: 2px solid var(--txt);
		background: repeating-linear-gradient(135deg, #fff, #fff 2px, #dfe3e2 2px, #dfe3e2 4px);
	}
	.pechado {
		background: repeating-linear-gradient(135deg, #f3f5f5, #f3f5f5 3px, #d7dddc 3px, #d7dddc 6px);
	}
</style>

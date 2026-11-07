<!-- SPDX-License-Identifier: EUPL-1.2 -->
<!--
	Lector de QR coa cámara, só como mellora: sen JavaScript, sen cámara ou co permiso denegado
	non aparece e queda o campo do código. A cámara só se abre ao tocar o botón. Usa o
	`BarcodeDetector` do navegador se o ten; se non, `jsqr` (Apache-2.0, empaquetado, sen CDN),
	que se carga só nese momento.
-->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { t, type Locale } from '../i18n';

	let { locale, onDetect }: { locale: Locale; onDetect: (value: string) => void } = $props();

	type Detect = (video: HTMLVideoElement) => Promise<string | null>;

	// Só tras montar e se o navegador pode pedir a cámara (contexto seguro: https ou localhost).
	let available = $state(false);
	let active = $state(false);
	let failed = $state(false);
	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		available = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
	});

	type NativeDetector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
	type NativeCtor = {
		new (o: { formats: string[] }): NativeDetector;
		getSupportedFormats?: () => Promise<string[]>;
	};

	async function makeDetector(): Promise<Detect> {
		const Native = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
		if (Native) {
			const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code'];
			if (formats.includes('qr_code')) {
				const d = new Native({ formats: ['qr_code'] });
				return async (v) => (await d.detect(v))[0]?.rawValue ?? null;
			}
		}
		const { default: jsQR } = await import('jsqr');
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		return async (v) => {
			if (!ctx || v.videoWidth === 0) return null;
			// Basta con 640 px de ancho para un QR de pantalla de móbil.
			const scale = Math.min(1, 640 / v.videoWidth);
			canvas.width = Math.round(v.videoWidth * scale);
			canvas.height = Math.round(v.videoHeight * scale);
			ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
			const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
			return jsQR(img.data, img.width, img.height)?.data ?? null;
		};
	}

	function stop() {
		if (timer) clearTimeout(timer);
		timer = null;
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		active = false;
	}

	async function start() {
		failed = false;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false
			});
			active = true;
			const detect = await makeDetector();
			// O <video> aparece ao activar: agárdase a que Svelte o pinte.
			await tick();
			if (!video || !stream) return;
			video.srcObject = stream;
			await video.play();
			const scan = async () => {
				if (!active || !video) return;
				const value = await detect(video).catch(() => null);
				if (value) {
					stop();
					onDetect(value);
					return;
				}
				timer = setTimeout(scan, 200);
			};
			scan();
		} catch {
			// Permiso denegado, sen cámara ou sen decodificador: o lector desaparece.
			stop();
			failed = true;
			available = false;
		}
	}

	onDestroy(stop);
</script>

<div class="qr" data-qr-scanner>
	{#if available && !active}
		<button type="button" class="abrir" onclick={start}>
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
				<path
					d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M7 8h3v3H7zM14 8h3v3h-3zM7 13h3v3H7zM14 14h3v2"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
			</svg>
			{t(locale, 'cons.val.camara')}
		</button>
	{/if}
	{#if active}
		<div class="vista">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted aria-label={t(locale, 'cons.val.camara.vista')}
			></video>
			<span class="marco" aria-hidden="true"></span>
		</div>
		<p class="k" role="status">{t(locale, 'cons.val.camara.apunta')}</p>
		<button type="button" class="pechar" onclick={stop}>{t(locale, 'cons.val.camara.pechar')}</button>
	{/if}
	{#if failed}
		<p class="k" role="status">{t(locale, 'cons.val.camara.erro')}</p>
	{/if}
</div>

<style>
	.qr {
		display: grid;
		gap: 8px;
	}
	.qr:empty {
		display: none;
	}
	.k {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--gris);
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--toque);
		padding: 0 14px;
		border: 2px solid var(--txt);
		border-radius: 10px;
		background: var(--branco);
		color: var(--txt);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 3px solid var(--txt);
		outline-offset: 2px;
	}
	.vista {
		position: relative;
		overflow: hidden;
		border-radius: var(--radio);
		background: var(--txt);
		aspect-ratio: 4 / 3;
	}
	video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.marco {
		position: absolute;
		inset: 18%;
		border: 3px solid var(--foco);
		border-radius: 12px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.marco {
			animation: latexo 1.6s ease-in-out infinite;
		}
		@keyframes latexo {
			50% {
				inset: 20%;
			}
		}
	}
</style>

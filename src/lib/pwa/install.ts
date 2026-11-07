// SPDX-License-Identifier: EUPL-1.2
// Estado mínimo del aviso de instalación, compartido entre la capa raíz y «Eu».
import { writable } from 'svelte/store';

export type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const installPrompt = writable<InstallPromptEvent | null>(null);

/** Safari en iPhone/iPad no emite beforeinstallprompt. */
export function isIos(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

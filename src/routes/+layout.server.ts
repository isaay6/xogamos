// SPDX-License-Identifier: EUPL-1.2
import { isDemo } from '../lib/server/demo';
import type { LayoutServerLoad } from './$types';

// El idioma llega a todas las páginas, también a +error.svelte. `demo` monta la faixa y los
// percorridos guiados solo en la instancia de demostración.
export const load: LayoutServerLoad = ({ locals }) => ({ locale: locals.locale, demo: isDemo() });

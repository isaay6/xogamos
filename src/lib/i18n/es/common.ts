// SPDX-License-Identifier: EUPL-1.2
// Textos en castellano, el segundo idioma. Mismas claves que `gl/common.ts`.
import type { glCommon } from '../gl/common';

export const esCommon: Record<keyof typeof glCommon, string> = {
	'saudo.mana': 'Buenos días',
	'saudo.tarde': 'Buenas tardes',
	'saudo.noite': 'Buenas noches',

	'semana.0': 'Dom',
	'semana.1': 'Lun',
	'semana.2': 'Mar',
	'semana.3': 'Mié',
	'semana.4': 'Jue',
	'semana.5': 'Vie',
	'semana.6': 'Sáb',

	'prezo.balde': 'Gratis',

	'dia.lenda': 'Día',
	'dia.completo': 'completo',
	'hora.lenda': 'Hora',
	'hora.completa': '{hora}, completa',
	'hora.pasou': '{hora}, ya ha pasado',
	'hora.pasou.curto': 'ya ha pasado',
	'dia.non_abre': 'no abre',
	'dia.festivo': 'Festivo: {nome}',
	'hora.libres': '{n} libres',
	'dia.pechada': 'cerrada',
	'peche.hoxe': 'Cerrada hoy',
	'peche.ata': 'Cerrada hasta {data}',
	'dia.pechada.motivo': 'Cerrada: {motivo}',
	'hora.pechada': '{hora}, cerrada: {motivo}',
	'hora.pechada.sen_motivo': '{hora}, cerrada',
	'hora.pechada.curto': 'Cerrada',

	'chaveiro.codigo': 'PIN',
	'chaveiro.pin': 'PIN para entrar',

	'reservar.para': 'Reservar para {nome}',

	'erro.404.titulo': 'No encontramos esta página',
	'erro.404.texto': 'Puede que el enlace esté mal o que ya no exista.',
	'erro.403.titulo': 'Aquí no puedes entrar',
	'erro.403.texto':
		'Tu cuenta no tiene acceso a esta parte. Si crees que deberías tenerlo, habla con el ayuntamiento.',

	// Táboas anchas no móbil
	'taboa.desliza': 'Desplaza la tabla hacia los lados para verlo todo →',
	'taboa.rexion': 'Tabla con desplazamiento lateral',
	'erro.xeral.titulo': 'Algo ha salido mal',
	'erro.xeral.texto': 'Vuelve a intentarlo en un momento.',
	'erro.inicio': 'Volver al inicio',

	// Entrada al ayuntamiento
	'inicio.titulo': 'Elige tu ayuntamiento',
	'inicio.deputacion': 'Panel de la Diputación',
	'inicio.escudo': 'Escudo de {nome}',

	// Cabecera y barra inferior
	'cabeceira.entrar': 'Entrar',
	'cabeceira.perfil': 'Perfil: {nome}',
	'cabeceira.concellos': 'Tus ayuntamientos',
	'cabeceira.apertura': 'Apertura',
	'cabeceira.conserxeria': 'Conserjería',
	'cabeceira.admin': 'Administración',
	'nav.etiqueta': 'Menú principal',
	'nav.reservar': 'Reservar',
	'nav.reservas': 'Mis reservas',
	'nav.avisos': 'Avisos',
	'nav.avisos.sen_ler.un': '{n} aviso sin leer',
	'nav.avisos.sen_ler.varios': '{n} avisos sin leer',
	'nav.eu': 'Perfil',

	// Entrar (spec §5.4)
	'entrar.titulo': 'Entra una vez y ya está',
	'entrar.texto':
		'Usamos la identidad digital del Estado o de la Xunta. No tienes que crear contraseña.',
	'entrar.clave': 'Entrar con Cl@ve',
	'entrar.chave365': 'Entrar con Chave365',
	'entrar.agora_non': 'Ahora no',

	// Estrutura do persoal (menú lateral)
	'staff.sair': 'Salir',
	'staff.menu': 'Menú',
	'staff.ver_vecino': 'Ver como vecino',
	'staff.idioma': 'Idioma',
	'staff.idioma.gl': 'Galego',
	'staff.idioma.es': 'Castellano',
	'staff.deputacion': 'Diputación',
	'staff.navegacion': 'Menú principal',

	// Salto ao contido principal (teclado)
	'salto.contido': 'Saltar al contenido'
};

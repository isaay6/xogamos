// SPDX-License-Identifier: EUPL-1.2
// Textos en galego, o idioma por defecto. Isay revisa todo o galego.
// As claves fixan o tipo `MessageKey`; `es/common.ts` ten que ter as mesmas.

export const glCommon = {
	// Saúdo segundo a hora
	'saudo.mana': 'Bos días',
	'saudo.tarde': 'Boas tardes',
	'saudo.noite': 'Boas noites',

	// Días da semana curtos (0 = domingo)
	'semana.0': 'Dom',
	'semana.1': 'Lun',
	'semana.2': 'Mar',
	'semana.3': 'Mér',
	'semana.4': 'Xov',
	'semana.5': 'Ven',
	'semana.6': 'Sáb',

	// Prezos
	'prezo.balde': 'De balde',

	// Tira de días e reixa de horas
	'dia.lenda': 'Día',
	'dia.completo': 'completo',
	'hora.lenda': 'Hora',
	'hora.completa': '{hora}, completa',
	'hora.pasou': '{hora}, xa pasou',
	'hora.pasou.curto': 'xa pasou',
	'dia.non_abre': 'non abre',
	'dia.festivo': 'Festivo: {nome}',
	'hora.libres': '{n} libres',
	'dia.pechada': 'pechada',
	'peche.hoxe': 'Pechada hoxe',
	'peche.ata': 'Pechada ata {data}',
	'dia.pechada.motivo': 'Pechada: {motivo}',
	'hora.pechada': '{hora}, pechada: {motivo}',
	'hora.pechada.sen_motivo': '{hora}, pechada',
	'hora.pechada.curto': 'Pechada',

	// Chaveiro
	'chaveiro.codigo': 'PIN',
	'chaveiro.pin': 'PIN para entrar',

	// Conserxería
	'reservar.para': 'Reservar para {nome}',

	// Páxina de erro
	'erro.404.titulo': 'Non atopamos esta páxina',
	'erro.404.texto': 'Pode que a ligazón estea mal ou que xa non exista.',
	'erro.403.titulo': 'Aquí non podes entrar',
	'erro.403.texto':
		'A túa conta non ten acceso a esta parte. Se cres que deberías telo, fala co concello.',

	// Táboas anchas no móbil
	'taboa.desliza': 'Despraza a táboa cara aos lados para velo todo →',
	'taboa.rexion': 'Táboa con desprazamento lateral',
	'erro.xeral.titulo': 'Algo saíu mal',
	'erro.xeral.texto': 'Proba de novo nun momento.',
	'erro.inicio': 'Volver ao inicio',

	// Entrada ao concello
	'inicio.titulo': 'Escolle o teu concello',
	'inicio.deputacion': 'Panel da Deputación',
	'inicio.escudo': 'Escudo de {nome}',

	// Cabeceira e barra inferior
	'cabeceira.entrar': 'Entrar',
	'cabeceira.perfil': 'Perfil: {nome}',
	'cabeceira.concellos': 'Os teus concellos',
	'cabeceira.apertura': 'Apertura',
	'cabeceira.conserxeria': 'Conserxería',
	'cabeceira.admin': 'Administración',
	'nav.etiqueta': 'Menú principal',
	'nav.reservar': 'Reservar',
	'nav.reservas': 'As miñas reservas',
	'nav.avisos': 'Avisos',
	'nav.avisos.sen_ler.un': '{n} aviso sen ler',
	'nav.avisos.sen_ler.varios': '{n} avisos sen ler',
	'nav.eu': 'Perfil',

	// Entrar (spec §5.4)
	'entrar.titulo': 'Entra unha vez e xa está',
	'entrar.texto':
		'Usamos a identidade dixital do Estado ou da Xunta. Non tes que crear contrasinal.',
	'entrar.clave': 'Entrar con Cl@ve',
	'entrar.chave365': 'Entrar con Chave365',
	'entrar.agora_non': 'Agora non',

	// Estrutura do persoal (menú lateral)
	'staff.sair': 'Saír',
	'staff.menu': 'Menú',
	'staff.ver_vecino': 'Ver como veciño',
	'staff.idioma': 'Idioma',
	'staff.idioma.gl': 'Galego',
	'staff.idioma.es': 'Castelán',
	'staff.deputacion': 'Deputación',
	'staff.navegacion': 'Menú principal',

	// Salto ao contido principal (teclado)
	'salto.contido': 'Saltar ao contido'
};

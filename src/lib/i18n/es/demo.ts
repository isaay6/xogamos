// SPDX-License-Identifier: EUPL-1.2
// Textos en castellano de la zona «demo». Mismas claves que `gl/demo.ts`.
import type { glDemo } from '../gl/demo';

export const esDemo: Record<keyof typeof glDemo, string> = {
	'demo.paso.abonos.titulo': 'Abonos',
	'demo.paso.abonos.texto': 'Crea los abonos del ayuntamiento y véndelos a la vecindad desde aquí.',
	'demo.faixa': 'Datos de demostración',
	'demo.faixa.etiqueta': 'Modo demostración',
	'demo.faixa.volver': 'Volver a la demo',
	'demo.faixa.percorrido': 'Recorrido guiado',

	'demo.titulo': 'Prueba la plataforma',
	'demo.k': 'Demostración · Concellos de Ourense',
	'demo.pregunta': '¿Con quién quieres entrar?',
	'demo.intro':
		'Elige un perfil y entras directamente, con un recorrido corto por lo que puede hacer. Todos los datos son inventados.',
	'demo.perfis': 'Perfiles de la demostración',
	'demo.entrar_como': 'Entrar como {nome}, {rol}',
	'demo.perfil.vecina': 'Vecina',
	'demo.perfil.vecina.de': '{nome}, de {concello}',
	'demo.perfil.vecina.ve': 'Reserva una pista y mira tu llave, tus avisos y tu racha.',
	'demo.perfil.conserxe': 'Conserje',
	'demo.perfil.conserxe.de': '{nome}, de {concello}',
	'demo.perfil.conserxe.ve': 'La agenda del día, quién llega, las reservas por teléfono y la hoja.',
	'demo.perfil.concello': 'Concello',
	'demo.perfil.concello.de': '{nome}, administradora de {concello}',
	'demo.perfil.concello.ve':
		'Ocupación, instalaciones, horarios, normas, personal y la imagen del concello.',
	'demo.perfil.deputacion': 'Diputación de Ourense',
	'demo.perfil.deputacion.de': '{nome}',
	'demo.perfil.deputacion.ve': 'La comparativa de los concellos y el alta de un concello nuevo.',
	'demo.outra': 'Entrar como otra persona',
	'demo.persoas.titulo': 'Entrar como otra persona',
	'demo.persoas.axuda': 'Prueba estos casos preparados con datos de demostración.',

	'demo.tour.etiqueta': 'Recorrido guiado: {titulo}',
	'demo.tour.paso': 'Paso {n} de {total}',
	'demo.tour.seguinte': 'Siguiente',
	'demo.tour.atras': 'Atrás',
	'demo.tour.saltar': 'Saltar',
	'demo.tour.rematar': 'Terminar',
	'demo.tour.fin.titulo': 'Ya lo has visto todo',
	'demo.tour.fin.texto': 'Ahora puedes moverte por la aplicación a tu aire, o probar otro perfil.',
	'demo.tour.repetir': 'Repetir el recorrido',
	'demo.tour.volver': 'Volver a la demo',
	'demo.tour.pechar': 'Cerrar',

	'demo.paso.deportes.titulo': 'Elige un deporte',
	'demo.paso.deportes.texto': 'Toca un deporte para ver cuándo está libre.',
	'demo.paso.dia-hora.titulo': 'Día y hora',
	'demo.paso.dia-hora.texto': 'Elige el día y la hora. Las horas llenas salen apagadas.',
	'demo.paso.accesibilidade.titulo': 'Accesibilidad',
	'demo.paso.accesibilidade.texto': 'Consulta esta ficha antes de elegir la instalación.',
	'demo.paso.chave.titulo': 'Tu llave',
	'demo.paso.chave.texto': 'Cada reserva tiene un PIN y un QR. Enséñalo al llegar.',
	'demo.paso.avisos.titulo': 'Tus avisos',
	'demo.paso.avisos.texto': 'Aquí están tus avisos y los bandos del concello.',
	'demo.paso.eu-perfil.titulo': 'Esta eres tú',
	'demo.paso.eu-perfil.texto': 'Elige tu avatar y mira si constas como empadronada.',
	'demo.paso.eu-racha.titulo': 'Tu racha',
	'demo.paso.eu-racha.texto':
		'Cada semana que vas enciende un foco. Con cuatro, enciendes la torre.',
	'demo.paso.eu-historial.titulo': 'Tu historial',
	'demo.paso.eu-historial.texto': 'Aquí tienes todas las reservas que ya pasaron.',
	'demo.paso.instalar-app.titulo': 'Lleva las reservas contigo',
	'demo.paso.instalar-app.texto':
		'Instala la app para tener la llave con QR y PIN incluso sin cobertura.',
	'demo.paso.perfil-accesibilidade.titulo': 'Perfil y accesibilidad',
	'demo.paso.perfil-accesibilidade.texto':
		'Ajusta el tamaño del texto y activa Reserva fácil si te resulta más cómoda.',
	'demo.paso.descargar-datos.titulo': 'Descargar mis datos',
	'demo.paso.descargar-datos.texto':
		'Descarga una copia de tus reservas, abonos, avisos y configuración.',
	'demo.paso.inicio-abonos.titulo': 'Tus abonos',
	'demo.paso.inicio-abonos.texto':
		'Los abonos activos aparecen también en la portada para tenerlos a mano.',

	'demo.paso.axenda.titulo': 'La agenda de hoy',
	'demo.paso.axenda.texto': 'Todas las reservas del día. La línea de ahora marca la hora actual.',
	'demo.paso.axenda-vista.titulo': 'Día o semana',
	'demo.paso.axenda-vista.texto': 'Cambia entre el día y la semana entera.',
	'demo.paso.axenda-reserva.titulo': 'Una reserva',
	'demo.paso.axenda-reserva.texto': 'Toca una reserva para marcar «Llegó» o «No vino».',
	'demo.paso.validar.titulo': 'Validar código',
	'demo.paso.validar.texto':
		'Escribe el PIN de cuatro cifras o escanea el QR de la reserva con la cámara.',
	'demo.paso.nova-reserva.titulo': 'Nueva reserva',
	'demo.paso.nova-reserva.texto':
		'Para quien llama por teléfono: busca por el DNI completo, por el nombre o por el teléfono.',
	'demo.paso.persoa-ficha.titulo': 'Ficha de la persona',
	'demo.paso.persoa-ficha.texto':
		'Busca a alguien para ver sus reservas, comprobar el empadronamiento, poner la tarifa social o cancelar con un motivo.',
	'demo.paso.folla.titulo': 'Hoja del día',
	'demo.paso.folla.texto': 'Imprime la lista del día para tenerla a mano en la instalación.',

	'demo.paso.resumo-mapa.titulo': 'Cuándo se juega',
	'demo.paso.resumo-mapa.texto': 'El mapa de calor muestra las horas con más reservas.',
	'demo.paso.resumo-periodo.titulo': 'Periodo',
	'demo.paso.resumo-periodo.texto': 'Mira la última semana, el último mes o el último trimestre.',
	'demo.paso.nova-instalacion.titulo': 'Nueva instalación',
	'demo.paso.nova-instalacion.texto':
		'Toca aquí para dar de alta una pista, una piscina o una sala.',
	'demo.paso.asistente.titulo': 'El asistente',
	'demo.paso.asistente.texto': 'Elige un modelo y ya viene relleno con lo más habitual.',
	'demo.paso.horarios.titulo': 'Horarios',
	'demo.paso.horarios.texto': 'Todos los horarios en una tabla. Cámbialos fila a fila.',
	'demo.paso.festivos.titulo': 'Festivos',
	'demo.paso.festivos.texto':
		'Añade los días cerrados o con horario de domingo y revisa los que ya hay.',
	'demo.paso.informe-mensual.titulo': 'Informe mensual',
	'demo.paso.informe-mensual.texto':
		'Prepara un resumen imprimible con las reservas, ocupación y cierres del mes.',
	'demo.paso.rexistro.titulo': 'Registro',
	'demo.paso.rexistro.texto': 'Consulta quién cambió cada dato y cuándo lo hizo.',
	'demo.paso.normas.titulo': 'Tarifas y normas',
	'demo.paso.normas.texto': 'Precios, cancelaciones y con cuántos días se puede reservar.',
	'demo.paso.persoal.titulo': 'Personal',
	'demo.paso.persoal.texto': 'Quién lleva la conserjería y quién administra el concello.',
	'demo.paso.concello.titulo': 'Tu concello',
	'demo.paso.concello.texto':
		'Sube el escudo y elige el color: la aplicación se viste con el concello.',

	'demo.paso.comparativa.titulo': 'Todos los concellos',
	'demo.paso.comparativa.texto': 'Reservas, ocupación y ausencias de cada concello, lado a lado.',
	'demo.paso.comparativa-periodo.titulo': 'Periodo',
	'demo.paso.comparativa-periodo.texto': 'Mira esta semana, este mes o los últimos tres meses.',
	'demo.paso.comparativa-concello.titulo': 'Cada concello',
	'demo.paso.comparativa-concello.texto': 'Toca un nombre para abrir la página de ese concello.',
	'demo.paso.novo-concello.titulo': 'Nuevo concello',
	'demo.paso.novo-concello.texto': 'Da de alta un concello con su nombre, dirección y color.',
	'demo.paso.novo-admin.titulo': 'La primera persona administradora',
	'demo.paso.novo-admin.texto': 'Indica quién lo va a llevar. Desde ahí, el concello lo hace todo.',
	'demo.paso.dep-admins.titulo': 'Administración de los ayuntamientos',
	'demo.paso.dep-admins.texto':
		'Consulta quién administra cada ayuntamiento y asigna o retira permisos.',
	'demo.paso.avisos-compor.titulo': 'Avisos del concello',
	'demo.paso.avisos-compor.texto':
		'Escribe un aviso para toda la vecindad y mira cómo quedará antes de publicarlo.',
	'demo.paso.tempadas.titulo': 'Reservas de temporada',
	'demo.paso.tempadas.texto':
		'Guarda cada semana las horas de los clubes. Si coinciden con reservas, te avisa antes de cancelarlas.'
};

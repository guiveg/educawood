/*
   Copyright 2023, Guillermo Vega-Gorgojo

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import config from '../data/config.json';
import { alertQuestionnaireTemplate } from '../data/htmlTemplates.js';

import L from 'leaflet';
import 'leaflet-draw';
import _ from 'underscore';
import $ from "jquery";

import { Sesion, Datos, Layers, Mimapa, obtenerURL } from '../main.js';
import { getGrid, getGridBounds, getCeldaBounds, getCellSide } from './grid.js';
import { processTreesCell } from './dataManager.js';
import { renderAjustesCreacionArbolMapa } from './createTree.js';
import { pintarCeldaArboles } from './trees.js';
import { initMapEvent, sendTimedEvent, sendMapTimeoutEvent, addEventData } from './events.js';


////////////
// MAPA BASE
function obtenerConfigMapa(esMini) {
	if (esMini) {
		const url = Sesion.estado.esri? config.geoConfigs.esriMinimap.url : config.geoConfigs.osmMinimap.url;
		const opts = Sesion.estado.esri? config.geoConfigs.esriMinimap.options : config.geoConfigs.osmMinimap.options;
		return {url, opts};
	}
	else {
		const url = Sesion.estado.esri? config.geoConfigs.esriMap.url : config.geoConfigs.osmMap.url;
		const opts = Sesion.estado.esri? config.geoConfigs.esriMap.options : config.geoConfigs.osmMap.options;
		return {url, opts};
	}
}


/////////////////
// ANTIMERIDIANO
// conversión Leaflet a las consultas al triplestore
function quitarCiclosAntimeridiano(lng) {
	// OJO CON EL ANTIMERIDIANO: en Leaflet los bounds pueden estar fuera del rango de longitud [-180, 180]
	// https://stackoverflow.com/questions/40532496/wrapping-lines-polygons-across-the-antimeridian-in-leaflet-js		
	// solución para el antimeridiano
	while (lng < -180)
		lng += 360;
	while (lng > 180)
		lng -= 360;
	return lng;
}
// conversión coordenadas triplestore a Leaflet
function ponerCiclosAntimeridiano(lng, cellX, zoom) {
	// recupero cellSide
	const cellSide = getCellSide(zoom);
	// nciclos será un entero menor que 0 para longitudes menores de -180
	// nciclos será un entero mayor que 0 para longitudes mayores de -180
	const nciclos = Math.floor((cellX * cellSide + cellSide/2 + 180)/360);
	// devuelvo lng ajustada
	return lng + nciclos*360;
}


////////////////////////////
// BUCLE DE CONTROL DEL MAPA
function mapaMovido() {
	if (Sesion.errordataprov == undefined) {
		if (Sesion.actualizandoMapa) {
			Sesion.mapaMovido = true; // pendiente de actualizar el mapa...
			console.log("Mapa movido: actualización de mapa pendiente...");
		}
		else // llamo a actualizar el mapa
			actualizarMapa();
	}
}
async function actualizarMapa() {
	// si no estoy en modo mapa no continúo con la actualización
	if (Sesion.estado.path !== "map")
		return;
	
	// desactivo botón de descarga (no se reactivará hasta que termine felizmente finActualizarMapa)
	//$(".download").addClass("disabled");
	
	// ajustes en la sesión
	// actualizo info de filtro de taxón
	Sesion.txPrevio = Sesion.tx;
	Sesion.tx = Sesion.estado.taxon;
	Sesion.txUsados[Sesion.tx] = true; // para el cacheo

	// actualizo zoom
	Sesion.zoomPrevio = Sesion.zoom;
	Sesion.zoom = Mimapa.getZoom();
					
	// si hubo cambio de zoom aplico ajustes del mapa botón de creación
	if (Sesion.zoomPrevio !== Sesion.zoom) 
		renderAjustesCreacionArbolMapa();
		
	// limito el zoom en las celdas para evitar explosión en zooms muy altos que no aportan nada
	const zoomCelda = Sesion.zoom > config.zMaxCelda? config.zMaxCelda : Sesion.zoom;
	Sesion.zoomUsados[zoomCelda] = true; // para el cacheo	
	
	// obtengo grid de celdas para el mapa
	const grid = getGrid(Mimapa.getBounds(), zoomCelda);

	// inicializaciones progreso y estadísticos celdas
	Sesion.infoCeldas = {
		total: (1 + grid.cellE - grid.cellW) * (1 + grid.cellN - grid.cellS),
		finalizadas: [],
		cacheadas: [],
		npc: [], // número de peticiones a crafts
		ifn: Sesion.estado.ifn // sólo pediré datos de ifn si está activado
	};

	// inicialización primordial
	inicioActualizarMapa();
	const idtimeout = Sesion.idTimeoutActualizar;
	
		
	//
	// CELDAS ÁRBOLES
	//	
	// inicializo promesas de las celdas
	let promesasCeldas = [];
		
	// actualizo info celdas para GA
	addEventData('num_cells', Sesion.infoCeldas.total);
	
	// inicializo zoomout
	let zoomout = false;
	
	// si hubo un cambio de filtro de taxón borro todo
	if (Sesion.tx !== Sesion.txPrevio) {		
		Layers.arbs.clearLayers(); // quito marcadores árboles
		Layers.clarbs.clearLayers(); // quito marcadores clusters
		Sesion.celdasPintadas = {}; // ninguna celda pintada
		Sesion.arbsPintados = {}; // ningún marcador de árbol
	} 
	else if (Sesion.zoom != Sesion.zoomPrevio) { // CAMBIO DE ZOOM => fuera clusters y a repintar cada celda 	
		Layers.clarbs.clearLayers(); // quito marcadores clusters
		Sesion.celdasPintadas = {}; // obligo a pintar cada celda
		// marco zoomout
		if (Sesion.zoom < Sesion.zoomPrevio)
			zoomout = true;
	}
	
	// pregenero los taxones más generales y más específicos para el cacheo
	let txgen = [ 'undefined' ];
	let txesp = [ 'undefined', ..._.intersection(Object.keys(Sesion.txUsados), Object.keys(Datos.especies)) ];
	if (Sesion.tx != undefined) {
		txgen = [ 'undefined', ..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[Sesion.tx].superexpuris) ];
		txesp = _.intersection(Object.keys(Sesion.txUsados), Datos.especies[Sesion.tx].expuris);
	}
	
	// trabajo celda a celda
	for (let x=grid.cellW; x<=grid.cellE; x++) {
		for (let y=grid.cellS; y<=grid.cellN; y++) {
			// preparo objeto de la celda
			const objcelda = {
				zoomout: zoomout, // incluyo si hay zoomout para el render
				taxon: Sesion.tx,
				txgen: txgen,
				txesp: txesp,
				zoom: zoomCelda,
				cellX: x,
				cellY: y,
				npc: [], // inicializo array con número de peticiones a crafts
				et: 'z' + zoomCelda + '_x' + x + '_y' + y + '_' + Sesion.tx,
				ifn: Sesion.infoCeldas.ifn, // para coger los datos del ifn sólo si se requieren
				idtimeout: idtimeout // para actualizar Sesion.infoCeldas sólo si toca
			};
			// enchufo el progreso
			objcelda.progreso = pintarBarraProgreso;
			// enchufo el render
			objcelda.render = pintarCeldaArboles;			
			// hago la petición de datos de sitios de la celda
			promesasCeldas.push( processTreesCell(objcelda) );
		}
	}
	
	// hago borrado de los árboles no visibles (para evitar problemas con el antimeridiano:
	//	-> un árbol sólo puede estar pintado una vez)
	//	-> no me preocupo por el borrado de los clusters
	//console.time("Borrado de árboles en celdas no visibles");
	const gridBounds = getGridBounds(grid, zoomCelda); // bounds del grid
	//let numCellsBorradas = 0;
	//let numArbsBorrados = 0;	
	for (const cpet in Sesion.celdasPintadas) {
		// extraigo z, x, y de cpet
		const cpetZ = Number(cpet.substring(1, cpet.indexOf('_')));
		const cpetX = Number(cpet.substring(cpet.indexOf('_x') + 2, cpet.indexOf('_', cpet.indexOf('_x') + 1)));
		const cpetY = Number(cpet.substring(cpet.indexOf('_y') + 2, cpet.indexOf('_', cpet.indexOf('_y') + 1)));
		const cpgrid = getCeldaBounds(cpetX, cpetY, cpetZ);
		// si no lo contiene...
		if (!gridBounds.contains(cpgrid)) {
			const celdaborrar = Datos.celdasArboles[cpet];			
			const alltreesborrar = (Sesion.estado.ifn && celdaborrar.ifn.trees) ? 				
					(celdaborrar.edu.trees ? celdaborrar.ifn.trees.concat(celdaborrar.edu.trees) : celdaborrar.ifn.trees) : 
					(celdaborrar.edu.trees ? celdaborrar.edu.trees : [] );
			for (const airi of alltreesborrar) {
				if (Sesion.arbsPintados[airi]) {
					Layers.arbs.removeLayer(Sesion.arbsPintados[airi]);
					delete Sesion.arbsPintados[airi];
					//numArbsBorrados++;
				}
			}
			// la celda ya no está pintada
			delete Sesion.celdasPintadas[cpet];
			// estadístico celdas
			//numCellsBorradas++;
		}
	}
	//console.log("#celdas borradas: " + numCellsBorradas);
	//console.log("#árboles borrados: " + numArbsBorrados);
	//console.timeEnd("Borrado de árboles en celdas no visibles");
	
	// espero a que terminen todas las promesas de las celdas para hacer logging
	await Promise.all(promesasCeldas);

	// logging celdas si no ha vencido el temporizador de actualización...
	if (idtimeout == Sesion.idTimeoutActualizar) {		
		// logging celdas
		//console.log("Celdas totales: " + infoceldas.npc.length);
		//console.log("Celdas cacheadas: " + infoceldas.cacheadas.length);
		const tcc = _.reduce(Sesion.infoCeldas.cacheadas, function(memo, num){ return memo + num; }, 0);
		const npc = _.reduce(Sesion.infoCeldas.npc, function(memo, num){ return memo + num; }, 0);	
		console.info("#celdas I" + idtimeout  + " total: " + Sesion.infoCeldas.total + " - cacheadas: " 
			+ tcc + " - #npc: " + npc );
		// actualizo info celdas cacheadas para GA
		addEventData('cached_cells', tcc);
	}
		
	// rutina fin actualización del mapa si no ha vencido el temporizador de actualización
	if (idtimeout == Sesion.idTimeoutActualizar) 
		finActualizarMapa();
}
function inicioActualizarMapa() {
	// mapa actual
	Sesion.mapaMovido = false;
	// quito timeout anterior (importante llamar tras Sesion.mapaMovido = false)
	finActualizarMapa();
	// pongo bloqueo a actualizaciones
	Sesion.actualizandoMapa = true;
	
	// pinto la barra de progreso
	pintarBarraProgreso(true);
	
	// actualizo la localización del estado de la sesión
	Sesion.estado.loc.lat = Mimapa.getCenter().lat;
	Sesion.estado.loc.lng = Mimapa.getCenter().lng;
	Sesion.estado.loc.z = Mimapa.getZoom();
		
	// reajusto url y actualizo página en la historia si hay cambio en URL
	if (window.location !== obtenerURL())
		history.replaceState(Sesion.estado, "", obtenerURL());
	
	// ajuste propiedad meta de la url
	$("meta[property='og:url']").attr('content', window.location);
	
	// pongo timeout para que quite el bloqueo tras 10 segundos (por si acaso se bloquea indefinidamente)
	Sesion.idTimeoutActualizar = setTimeout(function(){	
		// mando evento de timeout a GA	
		sendMapTimeoutEvent();
		console.warn("Venció el temporizador de " +  Math.round(Sesion.timeout/1000) + " segundos antes de terminar de actualizar el mapa");
		console.groupEnd();
		Sesion.actualizandoMapa = false;
		Sesion.idTimeoutActualizar = null;
		// actualizo timeout
		Sesion.timeout += config.timeoutStep;
		Sesion.huboTimeout = true;		
		// y llamo a mapaMovido
		mapaMovido();
	}, Sesion.timeout);
	// logging
	console.group("I" + Sesion.idTimeoutActualizar + " - Actualizando mapa");
	console.time("Actualización I" + Sesion.idTimeoutActualizar);
	console.log("URL: " + window.location);
	console.log("Temporizador actualización: " +  Math.round(Sesion.timeout/1000) + " segundos")
	//console.log(" -> bloqueando actualizaciones y poniendo temporizador antibloqueo: " + Sesion.idTimeoutActualizar);
	
	// inicializo el evento para enviar a Google Analytics
	initMapEvent();
}
function finActualizarMapa() {
	//console.log(" -> fin de actualización del mapa, quito temporizador antibloqueo");
	Sesion.actualizandoMapa = false; // quito bloqueo
	// cancelo timeout anterior (si existiera)
	if (Sesion.idTimeoutActualizar != null) {
		clearTimeout(Sesion.idTimeoutActualizar);
		console.timeEnd("Actualización I" + Sesion.idTimeoutActualizar);
		console.info("I" + Sesion.idTimeoutActualizar + " - Fin actualización del mapa");
		console.groupEnd();
		Sesion.idTimeoutActualizar = null;
		// activo botón de descarga
		//$(".download").removeClass("disabled");		
		// escondo la barra de progreso
		pintarBarraProgreso(false);
		// actualización timeout
		if (!Sesion.huboTimeout && Sesion.timeout > config.timeout) // si no hubo timeout resto config.timeoutStep (sin superar el valor inicial)
			Sesion.timeout -= config.timeoutStep;
		Sesion.huboTimeout = false; // inicializo para la siguiente
		// mando evento de fin de actualización del mapa
		sendTimedEvent();	
	}
		
	// llamo a actualizar el mapa si es necesario
	if (Sesion.mapaMovido) {
		console.info("El mapa se había movido, vuelvo a actualizar");
		mapaMovido();
	}
	else if (Sesion.ponerAlertaCuestionario) {
		// miro si pongo el cuestionario
		const ahora = Date.now();
		if (ahora - Sesion.inicioSesion > config.intraSessionQGap) {
			// pongo el cuestionario
			$("#mapid").append(alertQuestionnaireTemplate);
			// ya no lo vuelvo a poner en la sesión
			Sesion.ponerAlertaCuestionario = false;
			// y pongo los handlers de los botones
			$("#questbotyes").click(function() {
				// vamos al questionario (nueva pestaña)
				const questurl = $(this).attr("questurl");
				const win = window.open(questurl, '_blank');
				win.focus();
				// no más cuestionarios
				localStorage.setItem('cuestionarioNo', true);
				// quito la alerta
				$("#questalert").alert('close');
			});
			$("#questbotno").click(function() {
				// no más cuestionarios
				localStorage.setItem('cuestionarioNo', true);
				// quito la alerta
				$("#questalert").alert('close');
			});
			$("#questbotlater").click(function() {
				// reajusto a ahora 
				localStorage.setItem('timestampPrimeraSesion', ahora);
				// quito la alerta
				$("#questalert").alert('close');
			});		
		}
	}
}
function pintarBarraProgreso(mostrar) {
	// variante sin JQuery para que vaya más rápida la actualización de la barra
	const mibarradiv = document.getElementById('mibarradiv');
	if (mostrar) {	
		// obtengo celdas completadas
		const celdascomp = _.reduce(Sesion.infoCeldas.finalizadas, function(memo, num){ return memo + num; }, 0);		
		// calculo porc (hasta 99)
		const porc = Math.floor( 99 * celdascomp / Sesion.infoCeldas.total );
		// ajusto barra
		let mibarra = document.getElementById('mibarra');
		mibarradiv.setAttribute('aria-valuenow', porc);
		mibarra.style.width = porc + '%';
		mibarra.innerHTML = porc + '%';
		// mensajillo de cargando
		let mibarraLoading = document.getElementById('mibarra_loading');
		const porcLoading = 100 - porc;
		if (porcLoading > 30) {
			mibarraLoading.classList.remove('d-none');
			mibarraLoading.style.width = porcLoading + '%';
		}
		else
			mibarraLoading.classList.add('d-none');
		// muestro la barra de progreso
		mibarradiv.classList.remove('d-none');
	} else 
		mibarradiv.classList.add('d-none');
}

export { mapaMovido, finActualizarMapa, obtenerConfigMapa, quitarCiclosAntimeridiano, ponerCiclosAntimeridiano }
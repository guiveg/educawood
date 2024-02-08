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

import config from './data/config.json';
import dict from './data/dictionary.json';
import { updateHTMLtemplates } from './data/htmlTemplates.js';

import "leaflet/dist/leaflet.css";
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'shepherd.js/dist/css/shepherd.css';
import './css/bootstrap-avatar.css';
import './css/educawood.css';

import L from 'leaflet';
import 'leaflet.locatecontrol';
import $ from "jquery";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";

import { getLiteral, loc2string, string2loc, configurarModal } from './modules/util.js';
import { getFirebaseApp, inicializarAutenticacion, verUsuario } from './modules/users.js';
import { CraftsAPI, TextEngine } from './modules/queryInterface.js';
import { getPlantPartsPhotoInfo, getSpeciesInfo } from './modules/dataManager.js';
import { obtenerConfigMapa, mapaMovido, finActualizarMapa } from './modules/map.js';
import { cargarPanel, cargarBotonesMapa, actualizarIFN, actualizarMapaBase, 
	actualizarIdiomaPanel } from './modules/mapControls.js';
import { renderEntradaLugares } from './modules/places.js';
import { visualizarFiltroTaxon, tratarSeleccionTaxon } from './modules/taxons.js';
import { generaIconos } from './modules/icons.js';
import { lanzarTour } from './modules/shepherd.js';
import { verLasttrees } from './modules/trees.js';
import { iniciarCreacionArbol } from './modules/createTree.js';
import { verEducatree } from './modules/viewAnnotateTree.js';
import { sendEvent } from'./modules/events.js';

// variables globales
let Sesion, Datos, Layers, Mimapa, Mitilelayer, Crafts, Solr;

// llamo a inicializar
inicializar();

// INICIALIZACIÓN APLICACIÓN
async function inicializar() {
	// genero plantillas HTML
	updateHTMLtemplates();

	// INICIALIZO Layers
	Layers = {};
	
	// INICIALIZACIÓN SESIÓN
	Sesion = {};
	
	// inicializo número de páginas en la historia para controlar el ir hacia atrás
	Sesion.npags = 0;
	
	// inicializo timeouts
	Sesion.timeout = config.timeout;
	Sesion.huboTimeout = false;	
	
	// bloqueo para pintar
	Sesion.actualizandoMapa = false; // bloqueo si se está actualizando el mapa
	Sesion.mapaMovido = false; // detecto si el mapa se movió para actualizar
	Sesion.idTimeoutActualizar = null; // id del timeout para actualización automática (para que no se bloquee)
	
	// no está dibujando el polígono de descarga
	Sesion.poligonero = false;
	
	// flag creación árbol
	Sesion.creandoArbol = false;
	
	// estado de la sesión (construido a partir de la URL)
	Sesion.estado = {};
		
	// inicialización zoom
	Sesion.zoom = undefined;
	Sesion.zoomPrevio = undefined;
	Sesion.zoomUsados = {}; // guardo los zooms usados en el mapa para facilitar el cacheo
	
	// progreso y estadísticos
	Sesion.infoCeldas = {};
	
	// inicializo nombres científicos con el valor de nomci en local storage o false
	Sesion.nomci = localStorage.getItem('nomci') === "true"? true : false;
	
	//datos del filtro de taxón
	Sesion.tx = undefined;
	Sesion.txPrevio = undefined;
	Sesion.txUsados = {}; // guardo los taxones usados en el mapa para facilitar el cacheo
	// inicializo sugerencias taxones 
	Sesion.txfocus = -1;
	// inicializo color a uno de los posibles
	Sesion.txcolor = config.coltxinds[Math.floor(Math.random()*config.coltxinds.length)];
	
	
	// inicializo las celdas y árboles pintados
	Sesion.celdasPintadas = {};
	Sesion.arbsPintados = {};
	
	// muestro tooltips si no es un touchscreen
	//Sesion.hayTooltips = 'ontouchstart' in window? false : true;
	
	
	// INICIALIZO DATOS
	Datos = {};
	Datos.especies = {};
	Datos.partesPlantasFoto = {};
	Datos.arboles = {}; // aquí meto la información de cada árbol del mapa
	Datos.educatrees = {}; // aquí meto la información de los educatrees para edición
	Datos.cellSide = {}; // aquí calculo el lado de cada celda por nivel de zoom
	Datos.celdasArboles = {}; // aquí meto la info de árboles de cada celda
	Datos.usuarios = {}; // aquí obtengo los datos de los usuarios (posiblemente 0 o 1)
	Datos.ultEducatrees = {}; // aquí obtengo el listado paginado de los últimos educatrees creados tanto globales (key: "global") como por usuario (key: uid) 
	Datos.ultAnotaciones = {}; // aquí obtengo el listado paginado de las últimas anotaciones a educatrees anotados tanto globales (key: "global") como por usuario (key: uid) 
	Datos.urlAPIWD = {}; // aquí guardo las respuestas de la API de Wikidata
	Datos.esTaxonWD = {}; // aquí guardo si una entidad de Wikidata es un taxón (según la consulta validTaxons)
	Datos.taxonesWD = {}; // aquí guardo los datos de los taxones extraídos de Wikidata (recurso WikidataTaxon)


	// CARGA INICIAL DE LA URL
	// 1) carga localización si la hay
	// 2) carga taxon sin comprobar existencia
	// 3) ajusta vista
	// 4) no hace nada en el mapa (que no está aún creado)
	cargarURL(true);
				
	// SI NO HAY POSICIÓN INICIAL Y ESTÁ EN MODO MAPA, CARGO LA DE LA CONFIGURACIÓN Y PEDIRÉ GEOPOSICIONAR
	let pedirgeopos = false;
	if (!Sesion.estado.loc) { // precargo localización de la configuración
		Sesion.estado.loc = {
			lat: config.geolocstart[0],
			lng: config.geolocstart[1],
			z: config.zStart
		};
		if (Sesion.estado.path === 'map' && !localStorage.getItem('tourCompletado')) // pido geopos si está en modo mapa y no ha hecho el tour
			pedirgeopos = true;
	}
	
	// CARGO MAPA CON LA LOCALIZACIÓN DE LA CONFIGURACIÓN
	// meto tap: false, que parece es una fuente de problemas
	// dec-23: incluyo scrollWheelZoom: 'center' para reducir saltos raros con el zoom en el ratón de Apple
	// dec-23: pongo preferCanvas: true que mejora mucho el borrado (y el resto parece que sigue bien)	
	Mimapa = L.map('mimapa', {zoomControl: false, tap: false, scrollWheelZoom: 'center', preferCanvas: true} ).setView([Sesion.estado.loc.lat, Sesion.estado.loc.lng], Sesion.estado.loc.z);
	// cargo el tile layer que corresponda tras cargar la URL
	const { url, opts } = obtenerConfigMapa(false);
	Mitilelayer = L.tileLayer(url, opts).addTo(Mimapa);
	
	// REPOSICIONO CONTROLES DE ZOOM Y MUESTRO ESCALA DEL MAPA
	L.control.scale( {imperial: false, position: 'bottomright'} ).addTo(Mimapa); // sin la escala imperial
	if (!L.Browser.mobile) { // sólo botones de zoom para dispositivos no móviles
		L.control.zoom( { position: 'bottomright',
			zoomInTitle: getLiteral(dict.zoomin),
			zoomOutTitle: getLiteral(dict.zoomout),
		} ).addTo(Mimapa);
	}

	// INCLUYO BOTÓN DE MI LOCALIZACIÓN CON Leaflet.Locate (ver https://github.com/domoritz/leaflet-locatecontrol)
	L.control.locate({
	    position: 'bottomright',
	    icon: 'bi bi-geo-fill',
		locateOptions: { animate: true, duration: 1 },
		initialZoomLevel: config.zCreacion,
	    flyTo: true,
	    showPopup: false,
	    drawCircle: false,
	    showCompass: true,
    	strings: {
        	title: getLiteral(dict.mylocation)
	    }
	}).addTo(Mimapa);
	// cambio estilo del control de mi posición y mando evento de activate_my_location o deactivate_my_location a GA
	Mimapa.on("locateactivate", function(e) {
		// estilo botón en modo edición
		$(".leaflet-control-locate a").attr("style", "background-color: #6c757d;");
		$(".leaflet-control-locate a span").attr("style", "color: white;");
		sendEvent( 'select_content', { content_type: 'activate_my_location' } );
	});	
	Mimapa.on("locatedeactivate", function(e) {
		// estilo botón normal
		$(".leaflet-control-locate a").removeAttr("style");
		$(".leaflet-control-locate a span").removeAttr("style");
		sendEvent( 'select_content', { content_type: 'deactivate_my_location' } );
	});
	
	// INCLUYO BOTONES DEL MAPA
	cargarBotonesMapa();
	
	// INICIALIZACIÓN FIREBASE
	getFirebaseApp();
	
	// INICIALIZACIÓN CRAFTS
	console.time("Configuración proveedor de datos");
	Crafts = new CraftsAPI(config.craftsConfig);
	Crafts.test()
		.then(() => {			
			// OK
			console.info("Proveedor de datos funciona");						
			console.timeEnd("Configuración proveedor de datos");
								
			// CARGO PANEL (inicialmente desactivado el filtro de taxón)
			cargarPanel();
			
			// INICIALIZACIÓN AUTENTICACIÓN FIREBASE
			inicializarAutenticacion();
			
			// CONFIGURACIÓN SOLR
			configurarSolr();
			
			// TODO: ¿hacer lo del puppeteer?
			
			// DETECCIÓN DE CAMBIOS EN EL MAPA
			Mimapa.on('moveend', mapaMovido);
			Sesion.listenerMoveend = true; // para ajustar localización si hay que inicializar a la posición del usuario
	
			// INICIALIZACIONES CRAFTS
			console.group("Inicialización de datos");

			// obtengo datos de los usos para las teselas
			console.time("Carga de datos partes plantas para fotos");
			getPlantPartsPhotoInfo()
				.then(() => {
					console.info("Info de partes plantas para fotos cargada");
					console.timeEnd("Carga de datos partes plantas para fotos");
				})
				.catch(error => console.error(error));

			// obtengo datos de todas las especies	
			console.time("Carga de datos de especies");
			getSpeciesInfo()
				.then(() => {
					console.info("Info de especies cargada");
					console.timeEnd("Carga de datos de especies");
					console.groupEnd();
										
					// habilito el botón de filtrar por taxón (desactivado hasta ahora)
					$("#bot_taxones").removeAttr('disabled');
					
					// AQUÍ SE HACE LA PRIMERA ACTUALIZACIÓN COMPLETA DEL MAPA
					// trato el caso de filtro de taxón
					if (Sesion.estado.taxon != undefined && Datos.especies[Sesion.estado.taxon] != undefined)
						tratarSeleccionTaxon(Sesion.estado.taxon);
					else
						cargarURL(); // aquí se eliminará el taxon espúreo si lo hubiera
				})
				.catch(error => console.error(error));
		})
		.catch(error => {
			console.error(error);
			console.timeEnd("Configuración proveedor de datos");
			// aviso error
			errorProveedorDatosIrrecuperable(error);
		});


	// DETECCIÓN EVENTOS POPSTATE
	// https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onpopstate
	window.onpopstate = function(event) {
		// cargo la URL
		cargarURL();
	};
	
	// DETECCIÓN CLICKS EN ENLACES NAVBAR Y BOTÓN SANDWICH (con event delegation)
	$(document).on("click", ".navbar-brand", function(e) {
		e.preventDefault(); // Prevents the default behavior of the click event
	    e.stopPropagation(); // Stops the propagation of the click event
	});
	$(document).on("click", ".nav-link, .dropdown-item", function(event) {
		event.preventDefault(); // Prevent the default behavior of the hyperlink
		if ($(this).hasClass("lasttrees")) {
			Sesion.estado.path = "lasttrees";
			delete Sesion.estado.etid;
			delete Sesion.estado.pae;
			delete Sesion.estado.pe;
			delete Sesion.estado.showann;
			// reajusto url y creo nueva página en la historia
			history.pushState(Sesion.estado, "", obtenerURL());
			Sesion.npags++; // una página más
			// cargoURL => me llevará a verLasttrees
			cargarURL();		
		}
		else if ($(this).hasClass("map")) {
			Sesion.estado.path = "map";
			delete Sesion.estado.etid;
			delete Sesion.estado.pae;
			delete Sesion.estado.pe;
			delete Sesion.estado.showann;
			// reajusto url y creo nueva página en la historia
			history.pushState(Sesion.estado, "", obtenerURL());
			Sesion.npags++; // una página más
			// cargoURL => me llevará al mapa
			cargarURL();	
		}
		else if ($(this).hasClass("home")) {
			// landing page
			window.location.href = getLiteral(dict.homelocrel); //'..';		
		}
		else if ($(this).hasClass("lang")) {
			// recupero y actualizo idioma
			let nlang = $(this).attr("tag");
			localStorage.setItem('lang', nlang);
			// actualizo plantillas HTML
			updateHTMLtemplates();
			// actualizo etiquetas mapa
			actualizarIdiomaPanel();
			// y cargo la URL (para las páginas no mapa)
			cargarURL();
		}
	});	
	
	// DETECCIÓN CLICKS EN ENLACES DE USUARIO (con event delegation)
	$(document).on("click", ".pagusuario", function(event) {
		event.preventDefault(); // Prevent the default behavior of the hyperlink
		// voy a la página del usuario							
		Sesion.estado.path = "user";
		Sesion.estado.etid = $(this).attr("uid");
		delete Sesion.estado.pae;
		delete Sesion.estado.pe;
		delete Sesion.estado.showann;	
		// reajusto url y creo nueva página en la historia
		history.pushState(Sesion.estado, "", obtenerURL());
		Sesion.npags++; // una página más
		// cargoURL => me llevará a verUsuario
		cargarURL();
	});
	
	// DETECCIÓN CLICKS EN ENLACES DE EDUCATREES (con event delegation)
	$(document).on("click", ".educatree", function(event) {
		event.preventDefault(); // Prevent the default behavior of the hyperlink
		// voy a la página del usuario							
		Sesion.estado.path = "tree";
		Sesion.estado.etid = $(this).attr("etid");
		delete Sesion.estado.pae;
		delete Sesion.estado.pe;
		delete Sesion.estado.showann;
		// reajusto url y creo nueva página en la historia
		history.pushState(Sesion.estado, "", obtenerURL());
		Sesion.npags++; // una página más
		// cargoURL => me llevará a verEducatree
		cargarURL();
	});	
	
	// INICIALIZO LayerGroup DE ÁRBOLES
	Layers.arbs = L.layerGroup().addTo(Mimapa);
	// INICIALIZO LayerGroup DE CLUSTERS DE ÁRBOLES
	Layers.clarbs = L.layerGroup().addTo(Mimapa);

	// GENERO ICONOS
	generaIconos();	
	
	// TIMESTAMP ACTUAL (para geoposición y para formulario)
	const ahora = Date.now();
		
	// VUELO A LA POSICIÓN DEL USUARIO SI QUIERE
	// sólo si usuario no dijo que no anteriormente o ha pasado el barbecho
	if (pedirgeopos && (!localStorage.getItem('timestampPedirLoc') || 
			Number(localStorage.getItem('timestampPedirLoc')) < ahora)) {
		navigator.geolocation.getCurrentPosition( function(pos) {
			// vamos a la localización del usuario
			Mimapa.flyTo([ pos.coords.latitude, pos.coords.longitude], config.zLugar, {animate: true, duration: 1});
			// reajusto la localización (si aún no se ha llamado al listener de 'moveend')
			if (!Sesion.listenerMoveend) {
				Sesion.estado.loc = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
					z: config.zLugar
				};					
			}
		}, function(err) {
			// pongo barbecho si el usuario dijo que no
			// err.code 1 => https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
			if (err.code == 1) // barbecho
				localStorage.setItem('timestampPedirLoc', ahora + config.mediumQuestGap); // barbecho de 4 días
		}, {timeout: 5000, maximumAge:10*60*1000});
	}			
	
	// INICIALIZACIÓN CUESTIONARIO
	// variables en localStorage
	// timestampPrimeraSesion: timestamp de la primera vez que utilizó el explorador (o que pulsó el botón más tarde)
	// cuestionarioNo: no mostrar más el cuestionario
	// si no había, guardo timestamp primera sesión
	if (!localStorage.getItem('timestampPrimeraSesion'))
		localStorage.setItem('timestampPrimeraSesion', Date.now());
	// detecto si debo mostrar el cuestionario en la sesión
	const gapinicio = Date.now() - Number(localStorage.getItem('timestampPrimeraSesion'));
	if (gapinicio > config.interSessionQGap && !localStorage.getItem('cuestionarioNo')) {
		Sesion.ponerAlertaCuestionario = true; // puede ponerse el cuestionario en la sesión
		Sesion.inicioSesion = Date.now(); // guardo inicio sesión
	}
	else
		Sesion.ponerAlertaCuestionario = false;
}


/////////////////////
// CONFIGURACIÓN SOLR
/////////////////////
function configurarSolr() {
	//console.group("Inicialización motor de texto");
	console.time("Configuración motor de texto");
	
	// inicializo Solr
	Solr = new TextEngine(config.solrConfig.path + config.solrConfig.suggestHandler,
		config.solrConfig.path + config.solrConfig.selectHandler);
	Solr.test()
		.then(() => {
			// OK
			console.info("Motor de texto funciona");						
			console.timeEnd("Configuración motor de texto");
			// muestro la entrada de los lugares
			renderEntradaLugares(true);
		})
		.catch(messageError => {			
			// log del error
			console.error(messageError);
			console.timeEnd("Configuración motor de texto");			
			// pongo Solr a null y escondo la entrada de los lugares
			Solr = null;
			renderEntradaLugares(true);			
		});
}

////////////////////////
// ERROR PROVEEDOR DATOS
////////////////////////
function errorProveedorDatosIrrecuperable(messageError) {
	// ya no tiene sentido pedir datos
	Sesion.errordataprov = true; 
		
	// pongo un modal para avisar de que no se puede explorar el inventario	
	configurarModal( { vertcent: true, nofooter: true }, 
		getLiteral(dict.errorEndpointTitle), getLiteral(dict.errorEndpointText), null);
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();

	// quito temporizador
	finActualizarMapa();
}


///////////////////
// CARGA DE LA URL
// la función clave
///////////////////
function cargarURL(inicial) {
	//console.warn(window.location);
	// 1) elimino alguna info del estado de la sesión
	delete Sesion.estado.path;
	delete Sesion.estado.taxon; // quizá no sea adecuado borrarlo
	delete Sesion.estado.etid;
	delete Sesion.estado.pe;
	delete Sesion.estado.pae;
	delete Sesion.estado.showann;
	delete Sesion.zoom; // no es estado, pero lo borro para evitar desajustes en las celdas

	// 2) actualizo el estado de la sesión a partir de la URL	
	// parseo del querystring de la URL
	const urlParams = new URLSearchParams(window.location.search);
	// actualizo localización si hay localización y está bien
	// en otro caso no borro la localización que hubiera
	const cadloc = urlParams.get('loc');
	if (cadloc != null) {
		const loc = string2loc(cadloc);
		if (loc != null) 
			Sesion.estado.loc = loc;
	}
	// obtengo el path y valido
	const pathels = window.location.pathname.split("/");
	switch(pathels[1]) { // sólo considero el elemento 1 del path (el 0 será "")
		case "user":
			if (pathels[2] != undefined) { // si hay uid sigo
				Sesion.estado.path = pathels[1];
				Sesion.estado.etid = pathels[2];
				// puede haber como query parámetros pe (num página educatree) y pae (num página educatree anotado)
				if (urlParams.get('pe') != null && /^[1-9]\d*$/.test(urlParams.get('pe')))
					Sesion.estado.pe = Number(urlParams.get('pe'));
				if (urlParams.get('pae') != null && /^[1-9]\d*$/.test(urlParams.get('pae')))
					Sesion.estado.pae = Number(urlParams.get('pae'));
				// también puede haber showann para mostrar las anotaciones
				if (urlParams.get('showann'))
					Sesion.estado.showann = true;			
			}
			else // en otro caso voy al mapa
				Sesion.estado.path = "map";
			break;
		case "lasttrees":
			Sesion.estado.path = pathels[1];
			// puede haber como query parámetros pe (num página educatree) y pae (num página educatree anotado)
			if (urlParams.get('pe') != null && /^[1-9]\d*$/.test(urlParams.get('pe')))
				Sesion.estado.pe = Number(urlParams.get('pe'));
			if (urlParams.get('pae') != null && /^[1-9]\d*$/.test(urlParams.get('pae')))
				Sesion.estado.pae = Number(urlParams.get('pae'));
			// también puede haber showann para mostrar las anotaciones
			if (urlParams.get('showann'))
				Sesion.estado.showann = true;
			break;
		case "map":
			Sesion.estado.path = pathels[1];
			if (urlParams.get('ifn') != null && urlParams.get('ifn') === "true")
				Sesion.estado.ifn = true;
			else
				Sesion.estado.ifn = false;
			if (urlParams.get('esri') != null && urlParams.get('esri') === "true")
				Sesion.estado.esri = true;
			else
				Sesion.estado.esri = false;
			break;
		case "tree":
			if (pathels[2] != undefined) { // si hay id de educatree sigo
				Sesion.estado.path = pathels[1];
				Sesion.estado.etid = pathels[2];
			}
			else // en otro caso voy al mapa
				Sesion.estado.path = "map";
			break;
		case "newtree":
			// sólo permito ir si el usuario está logueado y si hay localización
			if (Sesion.usuario && Sesion.estado.loc != undefined)
				Sesion.estado.path = pathels[1];
			else
				Sesion.estado.path = "map";
			break;		
		default:	// si no hay path o no es válido voy al mapa y a volar
			Sesion.estado.path = "map";
			break;
	}
	// en modo mapa incluyo filtro de taxón si está presente o si es el caso inicial (antes de cargar las especies)
	if (Sesion.estado.path === "map" && urlParams.get('taxon') != undefined) {
		let tx = urlParams.get('taxon');
		// incluyo el filtro de taxón si caso inicial o si existe
		if (inicial || Datos.especies[tx] != undefined) 
			Sesion.estado.taxon = tx;
	}

	//3) ajusto vista según el estado del path cargado
	switch(Sesion.estado.path) {
		case "user":
			// bloqueo actualizaciones del mapa
			Sesion.actualizandoMapa = true;			
			// quito vista mapa
			vistaMapa(false);
			
			// actualizo título de la página
			document.title = getLiteral(dict.user) + ' '+Sesion.estado.etid+' - EducaWood';
			// propiedades meta
			$("meta[property='og:title']").attr('content', document.title);
			$("meta[property='og:description']").attr('content', 'Page of user '+Sesion.estado.etid+' in EducaWood.');
				
			// llamo a mostrar la página del usuario
			if (!inicial)
				verUsuario();
			break;
		case "lasttrees":
			// bloqueo actualizaciones del mapa
			Sesion.actualizandoMapa = true;			
			// quito vista mapa
			vistaMapa(false);
			
			// actualizo título de la página
			document.title = getLiteral(dict.lastTrees) + ' - EducaWood';
			// propiedades meta
			$("meta[property='og:title']").attr('content', document.title);
			$("meta[property='og:description']").attr('content', 'Last trees created in EducaWood.');
			
			// llamo a mostrar la página de lasttrees
			if (!inicial)
				verLasttrees();
			break;
		case "tree":
			// bloqueo actualizaciones del mapa
			Sesion.actualizandoMapa = true;			
			// quito vista mapa
			vistaMapa(false);
			
			// actualizo título de la página
			document.title = getLiteral(dict.tree) + ' '+Sesion.estado.etid+' - EducaWood';
			// propiedades meta
			$("meta[property='og:title']").attr('content', document.title);
			$("meta[property='og:description']").attr('content', 'Page of tree '+Sesion.estado.etid+' in EducaWood.');
				
			// llamo a mostrar la página del árbol
			if (!inicial)
				verEducatree();
			break;
		case "newtree":
			// bloqueo actualizaciones del mapa
			Sesion.actualizandoMapa = true;			
			// quito vista mapa
			vistaMapa(false);
			
			// actualizo título de la página
			document.title = getLiteral(dict.newtree) + ' - EducaWood';
			// propiedades meta
			$("meta[property='og:title']").attr('content', document.title);
			$("meta[property='og:description']").attr('content', 'Form for creating a tree in EducaWood.');
			
			// llamo a mostrar la página de creación del árbol
			if (!inicial)
				iniciarCreacionArbol();
			break;
		case "map":
			// desbloqueo actualizaciones del mapa 
			Sesion.actualizandoMapa = false;			
			// pongo vista mapa
			vistaMapa(true);
			
			// actualizo título de la página
			document.title = getLiteral(dict.map) + ' - EducaWood';
			// propiedades meta
			$("meta[property='og:title']").attr('content', document.title);
			$("meta[property='og:description']").attr('content', 'Navigating the map of EducaWood.');
			
			// si no es la llamada inicial hago más cosas...
			if (!inicial) {
				// centro el mapa en la localización de la sesión
				// esto dispara un evento de mapa movido, disparando su actualización en MODO MAPA
				Mimapa.setView([Sesion.estado.loc.lat, Sesion.estado.loc.lng], Sesion.estado.loc.z);
		
				// incluyo esto para que el mapa se reajuste
				// parece que así se resuelve el problema que había al pasar de recurso a mapa
				// tengo que poner esto después del setview, en otro caso no reacciona al setview
				Mimapa.invalidateSize();
				
				// visualización filtro de taxón
				visualizarFiltroTaxon();
				// actualizo datos IFN
				actualizarIFN();
				// actualizo mapa base
				actualizarMapaBase();
			
				// tour inicial
				if (!localStorage.getItem('tourCompletado'))
					lanzarTour();			
			}
			break;
	} // fin del switch
}
function vistaMapa(esmapa) {
	// ajuste propiedad meta de la url
	$("meta[property='og:url']").attr('content', window.location.href);	
	if (esmapa) {
		// actualizo viewport (escala fijada)
		$("#miviewport").attr("content","width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no");
		// escondo miarbol y muestro mapa
		$("#miarbol").html(''); // borro contenido página
		$("#miarbol").addClass("d-none");
		$("#mimapa").removeClass("d-none");			
	}
	else {
		// actualizo viewport (puede ampliarse)
		$("#miviewport").attr("content","width=device-width, initial-scale=1, shrink-to-fit=no");
		// escondo mapa y muestro página del árbol
		$("#mimapa").addClass("d-none");
		$("#miarbol").html(''); // borro contenido página
		$("#miarbol").removeClass("d-none");
	}
}


//////////////////////////////////////////////
// GENERACIÓN DE LA URL A PARTIR DE LA SESIÓN
//////////////////////////////////////////////
function obtenerURL() { // devuelve la URL a partir de Sesion.estado
	// preparo la URL base con el path de Sesion.estado.path
	const { protocol, host } = window.location;
	let url = protocol + '//' + host + '/' + Sesion.estado.path;
	// caso etid (segunda variable de path)
	if (Sesion.estado.etid) 
		url += '/' + Sesion.estado.etid;	
	// preparo searchpars
	const searchpars = [];
	if (Sesion.estado.loc && (Sesion.estado.path === "map" || Sesion.estado.path === "newtree")) 
		searchpars.push('loc=' + loc2string(Sesion.estado.loc));
	if (Sesion.estado.ifn && Sesion.estado.path === "map") 
		searchpars.push('ifn=true');
	if (Sesion.estado.esri && Sesion.estado.path === "map") 
		searchpars.push('esri=true');
	if (Sesion.estado.taxon && Sesion.estado.path === "map") 
		searchpars.push('taxon=' + Sesion.estado.taxon);
	if (Sesion.estado.pe && (Sesion.estado.path === "user" || Sesion.estado.path === "lasttrees")) 
		searchpars.push('pe=' + Sesion.estado.pe);
	if (Sesion.estado.pae && (Sesion.estado.path === "user" || Sesion.estado.path === "lasttrees")) 
		searchpars.push('pae=' + Sesion.estado.pae);
	if (Sesion.estado.showann && (Sesion.estado.path === "user" || Sesion.estado.path === "lasttrees")) 
		searchpars.push('showann=true');
	// incluyo los searchpars
	for (let i=0; i<searchpars.length; i++) {
		const sep = i==0? '?' : '&';
		url += sep + searchpars[i];
	}
	return url;
}

/////////////////////////////////////////
// PARA IR ATRÁS O AL MAPA SI NO HAY NADA
/////////////////////////////////////////
function goBack() {
	// si hay más páginas en la historia simplemente voy para atrás
	if (Sesion.npags > 0) {
		Sesion.npags--;
		history.back();
	}
	else {	// en otro caso, voy al mapa
		// actualizo path y URL
	   	Sesion.estado.path = "map";
		history.replaceState(Sesion.estado, "", obtenerURL());
		
		// y cargo la URL para que me lleve al mapa completo
		cargarURL();
	}
}

export { Sesion, Datos, Layers, Mimapa, Mitilelayer, Crafts, Solr,
	cargarURL, obtenerURL, goBack };
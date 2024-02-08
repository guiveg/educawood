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
import dict from '../data/dictionary.json';
import { cardTemplate } from '../data/htmlTemplates.js';

import Mustache from 'mustache';
import $ from "jquery";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import L from 'leaflet';
import 'leaflet-draw';

import { Sesion, Datos, Layers, Mimapa, Mitilelayer, obtenerURL, cargarURL } from '../main.js';
import { getLiteral } from './util.js';
import { getSpeciesInfo } from './dataManager.js';
import { mapaMovido, obtenerConfigMapa } from './map.js';
import { handlerNombreCientifico, handlerInfoTaxon, handlerFiltrarTaxon } from './taxons.js';
import { obtenerSugerenciasLugares, renderSugerenciasLugares, ajustarLugarfocus } from './places.js';
import { renderAjustesCreacionArbolMapa } from './createTree.js';
import { sendEvent } from './events.js';
import { lanzarTour } from './shepherd.js';
import { prepararDescarga } from './download.js';
import { getIconoArbol } from './icons.js';

let drawControl;

// PANEL DE CONTROL
function cargarPanel() {
	// creo div con clase "usuario" sólo para dispositivos grandes
	const panuser = L.control({'position':'topright'});
	panuser.onAdd = function (map) {
		// creo div con clase "usuario"	
		const container = L.DomUtil.create('div', 'usuario me-2 mt-2 d-none d-sm-block');	// versión 5.3 bootstrap
		return container;
	};
	panuser.addTo(Mimapa);

	//  panel de control de info
	let panelInfo = L.control({'position':'topleft'});
	panelInfo.onAdd = function (map) {
		// creo div con clase "card" de bootstrap
		this._div = L.DomUtil.create('div', 'card ms-1 ms-sm-2 mt-1 mt-sm-2');	// versión 5.3 bootstrap
		return this._div;
	};
	panelInfo.init = function () {
		// inicializo el panel detectando si es móvil para poner padding
		// no consigo ajustar el padding por defecto, así que uso Mustache
		const obj = {
			esmovil: screen.width < 576,
			nomci: Sesion.nomci
		};
		const cardhtml = Mustache.render(cardTemplate, obj);
		$(".card").html(cardhtml);
		
		// pongo nombres localizados a los colores al filtro de taxón
		$('.dropdown_color_taxon').each(function(){
		    let cind = $(this).attr('cind');
		    $(this).html( getLiteral(dict["color"+cind]) );
		});
		// pongo color al filtro de taxón
		$('#filtro_taxon').css('background-color', config.colores[Sesion.txcolor][1]);
		
		// quitar filtro de taxón
		$("#bot_quitar_taxon").click(function() {
			// mando evento de quitar filtro de taxón a GA (sólo si hay filtro activo)
			if (Sesion.estado.taxon)			
				sendEvent( 'select_content', { content_type: 'remove_taxon_filter', content_id: Sesion.estado.taxon } );
							
			// elimino el taxón en la sesión y reajusto URL
			delete Sesion.estado.taxon;
			history.replaceState(Sesion.estado, "", obtenerURL());
	
			// cargo la URL
			cargarURL();
		});
		
		// handler del nombre científico
		$(".nomci").change(handlerNombreCientifico);
		
		// handler del popover taxón
		$("#bot_info_filtro_taxon").click(handlerInfoTaxon);
		
		// cambio color del filtro de taxón
		$(".dropdown_color_taxon").click(function() {
			// actualizo el color
			Sesion.txcolor =  Number($(this).attr("cind"));
			
			// cambio el color del filtro de taxón
			$('#filtro_taxon').css('background-color', config.colores[Sesion.txcolor][1]);
		
			// actualizo iconos de los árboles pintados
			const arburis = Object.keys(Sesion.arbsPintados);
			for (let arburi of arburis) {
				// recupero el árbol
				const arb = Datos.arboles[arburi];
				// obtengo su icono
				const ticon = getIconoArbol(arb);
				// cambio el icono si no coincide
				if (Sesion.arbsPintados[arburi].getIcon() != ticon)
					Sesion.arbsPintados[arburi].setIcon(ticon);
			};
		});
		
						
		// detecto cambios en la entrada de lugares
		// "search" es para detectar si el usuario hizo click en la X del formulario (clear button)
		$("#in_lugares").on("keyup search", async function(e) {				
			// trato las teclas de arriba, abajo y enter			
			if (e.which == 13) { // tecla ENTER
				// sólo actúo si hay al menos una sugerencia (y habilitada)
				if ($("#sugelugares").children(":enabled").length > 0) {
					// si no había ninguna sugerencia seleccionada activo la primera
					if (Sesion.lugarfocus == -1) {
						Sesion.lugarfocus = 0;
						ajustarLugarfocus();
					}
					// y ahora vamos al lugar seleccionado
					$("#sugelugares").children(":enabled").eq(Sesion.lugarfocus).click();
				}
			}
			else if (e.which == 40) { // tecla ABAJO			
				// incremento focus
				Sesion.lugarfocus++;
				ajustarLugarfocus();				
			}
			else if (e.which == 38) { // tecla ARRIBA
				// decremento focus
				Sesion.lugarfocus--;
				ajustarLugarfocus();
			}
			else if (e.which != undefined) { // caso normal
				// si había marcador de municipio, lo quito
				if (Sesion.lugarmarker != null) {
					Sesion.lugarmarker.remove();
					Sesion.lugarmarker = null;
					Sesion.lugar = null;
				}
				// actúo según la entrada
				let entrada = $(this).val();
				if (entrada.length == 0) {// no hay entrada
					$("#sugelugares").html("");
					$("#sugelugares").addClass("d-none");
				}
				else {// obtengo sugerencias y hago su render
					$("#sugelugares").removeClass("d-none");
					const sugs = await obtenerSugerenciasLugares(entrada);
					renderSugerenciasLugares(sugs);
					// mando evento GA si la entrada > 2
					if (entrada.length > 2) {
						sendEvent('search', {
							search_term: entrada,
							content_type: "places"
						});
					}
				}
			}
			else  {
				// caso de la X del formulario... (quito las sugerencias y el marcador si lo hay)
				let entrada = $(this).val();
				if (entrada.length == 0) {// no hay entrada
					$("#sugelugares").html("");
					$("#sugelugares").addClass("d-none");
					if (Sesion.lugarmarker != null) {
						Sesion.lugarmarker.remove();
						Sesion.lugarmarker = null;
						Sesion.lugar = null;
					}
				}
			}
		}).focusin(function() {			
			// vuelve el focus, muestro las sugerencias si hay algo
			let entrada = $(this).val();
			if (entrada.length > 0)
				$("#sugelugares").removeClass("d-none");			
		}).focusout(function() {
			// si pierde el focus escondemos las sugerencias tras un delay
			// el delay es importante para que se pueda clickar un botón antes de eliminar las sugerencias
			setTimeout(function(){
				if (!$("#in_lugares").is(":focus")) // si vuelve el focus no escondo
					$("#sugelugares").addClass("d-none");
			}, 300);			
		});

		// handler de taxón
		$("#bot_taxones").click(handlerFiltrarTaxon);		
	};
	
	// incluyo el panel en el mapa
	panelInfo.addTo(Mimapa);
		    
    // si es terminal táctil desactivo los eventos de dragging del mapa en el panel del formulario
    if (('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)) {
    	panelInfo.getContainer().addEventListener('touchstart', function () {
    		Mimapa.dragging.disable();
    	}); 
    	panelInfo.getContainer().addEventListener('touchend', function () {
    		Mimapa.dragging.enable();
    	});
    } else { // para terminales no táctiles desactivo los listeners del mapa al entrar en el panel del formulario
    	// Disable dragging, scrollWheelZoom and doubleClickZoom when user's cursor enters the element
		panelInfo.getContainer().addEventListener('mouseover', function () {
			Mimapa.dragging.disable();
			Mimapa.scrollWheelZoom.disable();
			Mimapa.doubleClickZoom.disable();
		});
		// Re-enable dragging, scrollWheelZoom and doubleClickZoom when user's cursor leaves the element
		panelInfo.getContainer().addEventListener('mouseout', function () {
			Mimapa.dragging.enable();
			Mimapa.scrollWheelZoom.enable();
			Mimapa.doubleClickZoom.enable();
		});
    }
	
	// inicializo panel
	panelInfo.init();
}


function cargarBotonesMinimapa(mm, mapas, tilelayers, volverMapa) {
	const controlBotones = L.Control.extend({
		options: {
			position: 'bottomright'
		},
		onAdd: function (map) {
			// preparo botonera vertical
			const container = L.DomUtil.create('div', "leaflet-bar leaflet-control btn-group-vertical");
			container.setAttribute("role", "group");
						
			// link esri
			const le = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single esri", container);
			le.title = getLiteral(dict.esri);
			le.href = "#";
			le.setAttribute("role", "button");
			const les = L.DomUtil.create('span', 'bi bi-layers-fill', le);
			if (Sesion.estado.esri) {
				le.setAttribute("style", "background-color: #6c757d;");
				les.setAttribute("style", "color: white;");
			}
			
			// listener esri
			le.addEventListener('click', function(e) {				
				event.preventDefault(); // Prevent the default behavior of the hyperlink
				// actualizo Sesion.estado.esri y reajusto URL
				Sesion.estado.esri = !Sesion.estado.esri;
				history.replaceState(Sesion.estado, "", obtenerURL());	
				
				// actualizo mapas y tilelayers con URL y atribución
				const { url, opts } = obtenerConfigMapa(true);
				for (let tl of tilelayers)
					tl.setUrl(url);
				for (let ma of mapas) {
					ma.attributionControl.removeAttribution(config.geoConfigs.esriMap.options.attribution);
					ma.attributionControl.removeAttribution(config.geoConfigs.osmMap.options.attribution);
					ma.attributionControl.addAttribution(opts.attribution);
				}
				// actualizo aspecto botón y mando evento de esri a GA
				if (Sesion.estado.esri) {					
					$(".esri").attr("style", "background-color: #6c757d;");
					$(".esri span").attr("style", "color: white;");
					sendEvent( 'select_content', { content_type: 'show_esri' } );
				}
				else {					
					$(".esri").removeAttr("style");
					$(".esri span").removeAttr("style");
					sendEvent( 'select_content', { content_type: 'show_osm' } );
				}
			});
			
			if (volverMapa) {
				// link volver mapa
				const lm = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single", container);
				lm.title = getLiteral(dict.fullmap);
				lm.href = "#";
				lm.setAttribute("role", "button");
				L.DomUtil.create('span', 'bi bi-fullscreen', lm);
				
				// listener volver mapa
				lm.addEventListener('click', function(e) {				
					event.preventDefault(); // Prevent the default behavior of the hyperlink
					
					// actualizo path
				   	Sesion.estado.path = "map";
				   	// reajusto url y creo nueva página en la historia
					history.pushState(Sesion.estado, "", obtenerURL());
					Sesion.npags++; // una página más
					// cargoURL => me llevará a verLasttrees
					cargarURL();
				});
			}
			return container;
		}
	});
	mm.addControl(new controlBotones());
}


// IDIOMA
function actualizarIdiomaPanel() {
	// actualizo etiquetas panel mapa
	$("#tarjeta-home").html(getLiteral(dict.home));
	$("#tarjeta-lasttrees").html(getLiteral(dict.lastTrees));
	$("#bot_taxones").html(getLiteral(dict.taxonfilter));
	$("#in_lugares").attr("placeholder", getLiteral(dict.searchplace));
	$("#in_lugares").attr("aria-label", getLiteral(dict.searchplace));
	
	// cierro bot_taxones e inicializo a "" el navegador de taxones
	if ($("#bot_taxones").hasClass("active"))
		$("#bot_taxones").click();	
	$("#taxones_block").html("");
	$("#taxones_block").addClass("d-none");
	
	// actualizo botones usuario mapa
	$(".userprofile").html(getLiteral(dict.viewProfile));
	$(".usersignout").html(getLiteral(dict.signout));
	
	// actualización tooltips panel lateral
	$(".createtree").attr("title", getLiteral(dict.createtree));
	$(".verifn").attr("title", getLiteral(dict.viewIFN));
	$(".esri").attr("title", getLiteral(dict.esri));
	$(".refresh").attr("title", getLiteral(dict.refresh));
	$(".download").attr("title", getLiteral(dict.downloadData));
	$(".tour").attr("title", getLiteral(dict.tour));
	
	// actualizamos etiquetas Leaflet Draw
	actualizarEtiquetasLDraw();
}



// BOTONES LATERALES MAPA
function cargarBotonesMapa() {
	// preparo botón de descarga con Leaflet Draw
	Layers.editableLayer = new L.FeatureGroup();
	Mimapa.addLayer(Layers.editableLayer);    
	const ldo = {
		position: 'bottomright',
		draw: {
			polyline: false,
			polygon: {
				allowIntersection: false, // Restricts shapes to simple polygons
				drawError: {
					//color: '#e1e100', // Color the shape will turn when intersects
					message: getLiteral(dict.errorPolygon)
				},
				shapeOptions: {
					//color: '#bada55'
				}
			},
			circle: false, // Turns off this drawing tool
			rectangle: false,
			marker: false,
			circlemarker: false
		},
		edit: false
	};    
	drawControl = new L.Control.Draw(ldo);
	Mimapa.addControl(drawControl);    
	Mimapa.on(L.Draw.Event.CREATED, function (e) {
		// actualizo flag
		Sesion.poligonero = false;
		// actualizo aspecto botón (sin pulsar)
		$(".download").removeAttr("style");
		$(".download span").removeAttr("style");
		// añado el polígono a la capa editable
		Layers.editableLayer.addLayer(e.layer);		
		// desde aquí llamo a la descarga de datos
		prepararDescarga();
	});
	// cambio icono polígono
	$(".leaflet-draw-draw-polygon").html('<span class="bi bi-cloud-download"></span>');
	// añado clase inicial "download"
	$(".leaflet-draw-draw-polygon").addClass("download");	
	// llamo a actualizar las etiquetas de Leaflet Draw
	actualizarEtiquetasLDraw();
	// listener botón
	$(".download").on('click', function(e) {
		// cojo ref al botón de cancelar
		//let cancelAnchor = $('ul.leaflet-draw-actions').find('li:eq(2) a');	
		let cancelAnchor = document.querySelector('ul.leaflet-draw-actions').querySelector('li:nth-child(3) a');
		// cambio el flag de poligonero
		Sesion.poligonero = !Sesion.poligonero;	
		if (Sesion.poligonero) {
			// muestro tostada
			$("#mitostadaBody").html(getLiteral(dict.toastDownloadPolygon));
			const tostada = bootstrap.Toast.getOrCreateInstance(document.getElementById('mitostada'));
			tostada.show();			
			// actualizo aspecto botón (pulsado)
			$(".download").attr("style", "background-color: #6c757d;");
			$(".download span").attr("style", "color: white;");
			// pongo listener para que quede bien el flag de poligonero
			cancelAnchor.addEventListener('click', function(event) {
				Sesion.poligonero = false;
				// actualizo aspecto botón (sin pulsar)
				$(".download").removeAttr("style");
				$(".download span").removeAttr("style");
			});
		}
		else  // llamo a cancelar
			cancelAnchor.click();
	});


	// BOTONERA (sin download)
	const controlBotones = L.Control.extend({
		options: {
			position: 'bottomright'
		},
		onAdd: function (map) {
			// preparo botonera vertical
			const container = L.DomUtil.create('div', "leaflet-bar leaflet-control btn-group-vertical");
			container.setAttribute("role", "group");
			
			// link arbol
			const la = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single createtree disabled", container);
			la.title = getLiteral(dict.createtree);
			la.href = "#";
			la.setAttribute("role", "button");
			L.DomUtil.create('span', 'bi bi-tree-fill', la);
			
			// link IFN
			const li = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single verifn", container);
			li.title = getLiteral(dict.viewIFN);
			li.href = "#";
			li.setAttribute("role", "button");
			const licon = L.DomUtil.create('img', '', li);
			if (Sesion.estado.ifn) {
				li.setAttribute("style", "background-color: #6c757d;");
				licon.setAttribute("src", new URL('../images/iconoIFNpushed.svg', import.meta.url));
				//licon.setAttribute("src", "/app/images/iconoIFNpushed.svg");
			}
			else
				licon.setAttribute("src", new URL('../images/iconoIFN.svg', import.meta.url));
				//licon.setAttribute("src", "/app/images/iconoIFN.svg");
			
			// link esri
			const le = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single esri", container);
			le.title = getLiteral(dict.esri);
			le.href = "#";
			le.setAttribute("role", "button");
			const les = L.DomUtil.create('span', 'bi bi-layers-fill', le);
			if (Sesion.estado.esri) {
				le.setAttribute("style", "background-color: #6c757d;");
				les.setAttribute("style", "color: white;");
			}
			
			// link refresh
			const lr = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single refresh", container);
			lr.title = getLiteral(dict.refresh);
			lr.href = "#";
			lr.setAttribute("role", "button");
			L.DomUtil.create('span', 'bi bi-arrow-clockwise', lr);
						
			// link tour
			const lt = L.DomUtil.create("a", "leaflet-bar-part leaflet-bar-part-single tour", container);
			lt.title = getLiteral(dict.tour);
			lt.href = "#";
			lt.setAttribute("role", "button");
			L.DomUtil.create('span', 'bi bi-question-lg', lt);
			
			// listener árbol
			la.addEventListener('click', function(e) {
				event.preventDefault(); // Prevent the default behavior of the hyperlink
				// si está deshabilitado muestro tostada
				if ($('.createtree:first').hasClass("disabled")) {
					const mensaje = Sesion.usuario ? getLiteral(dict.toastZoom) : getLiteral(dict.toastUser);
					$("#mitostadaBody").html(mensaje);
					const tostada = bootstrap.Toast.getOrCreateInstance(document.getElementById('mitostada'));
					tostada.show();
				}
				else { // llamada legítima		
					// cambio flag
					Sesion.creandoArbol = !Sesion.creandoArbol;
					// tostada de ayuda si estoy creando
					if (Sesion.creandoArbol) {
						$("#mitostadaBody").html(getLiteral(dict.toastCreateTree));
						const tostada = bootstrap.Toast.getOrCreateInstance(document.getElementById('mitostada'));
						tostada.show();
					}
					// llamo a renderAjustesCreacionArbolMapa
					renderAjustesCreacionArbolMapa(true);
				}
			});
	
			// listener ifn
			li.addEventListener('click', function(e) {				
				event.preventDefault(); // Prevent the default behavior of the hyperlink
				// actualizo Sesion.estado.ifn y reajusto URL
				Sesion.estado.ifn = !Sesion.estado.ifn;
				history.replaceState(Sesion.estado, "", obtenerURL());
				// llamo a actualizar la info del IFN
				actualizarIFN();
			});
			
			// listener esri
			le.addEventListener('click', function(e) {				
				event.preventDefault(); // Prevent the default behavior of the hyperlink
				// actualizo Sesion.estado.esri y reajusto URL
				Sesion.estado.esri = !Sesion.estado.esri;
				history.replaceState(Sesion.estado, "", obtenerURL());	
				// llamo a actualizar el mapa base
				actualizarMapaBase();
			});
			
			// listener refresh
			lr.addEventListener('click', function(e) {
				event.preventDefault(); // Prevent the default behavior of the hyperlink
				// borro datos
				// sólo me quedo con el usuario de la sesión
				if (Sesion.usuario) {
					const dus = Datos.usuarios[Sesion.usuario.uid];
					Datos.usuarios = {};
					Datos.usuarios[Sesion.usuario.uid] = dus;
				} 
				else
					Datos.usuarios = {};
				// fuera taxones
				Datos.especies = {};
				// fuera educatrees
				Datos.educatrees = {};
				// sólo me quedo con los árboles del ifn (con 'uri' en vez de 'iri')
				Datos.arboles = Object.fromEntries(
					Object.entries(Datos.arboles).filter(([key, value]) => 'uri' in value)
				);
				// fuera últimos educatrees y últimas anotaciones (salvo los del usuario)
				if (Sesion.usuario) {
					const uetus = Datos.ultEducatrees[Sesion.usuario.uid];
					Datos.ultEducatrees = {};
					Datos.ultEducatrees[Sesion.usuario.uid] = uetus;
					const uanus = Datos.ultAnotaciones[Sesion.usuario.uid];
					Datos.ultAnotaciones = {};
					Datos.ultAnotaciones[Sesion.usuario.uid] = uanus;
				} 
				else {
					Datos.ultEducatrees = {};
					Datos.ultAnotaciones = {};
				}
				// elimino datos de educatrees de las celdas				
				for (const key in Datos.celdasArboles)
					delete Datos.celdasArboles[key].edu;											
				// borro clusters y árboles
				Layers.arbs.clearLayers(); // quito marcadores árboles
				Layers.clarbs.clearLayers(); // quito marcadores clusters
				Sesion.celdasPintadas = {}; // ninguna celda pintada
				Sesion.arbsPintados = {}; // ningún marcador de árbol				
				// desactivo temporalmente el botón de taxones
				if ($("#bot_taxones").hasClass("active"))
					$("#bot_taxones").click();
				$("#bot_taxones").prop("disabled", true);
				$("#taxones_block").html(""); // y vacío para que repinte
				// espero a que cargue los taxones de nuevo
				getSpeciesInfo()
					.then(() => {
						// habilito de nuevo el botón
						$("#bot_taxones").removeAttr('disabled');
						// llamo a mover el mapa para que repinte
						mapaMovido();
					})
					.catch(error => console.error(error));								
				// mando evento de refrescar mapa a GA
				sendEvent( 'select_content', { content_type: 'refresh_map' } );
			});
			
			// listener tour
			lt.addEventListener('click', function(e) {
				lanzarTour();		
			});
			
			return container;
		}
	});
	Mimapa.addControl(new controlBotones());
}

// soporte IFN
function actualizarIFN() {
	// borro clusters y árboles
	Layers.arbs.clearLayers(); // quito marcadores árboles
	Layers.clarbs.clearLayers(); // quito marcadores clusters
	Sesion.celdasPintadas = {}; // ninguna celda pintada
	Sesion.arbsPintados = {}; // ningún marcador de árbol				
	// llamo a mover el mapa para que repinte
	mapaMovido();
	// actualizo aspecto botón y mando evento de IFN (show o hide) a GA
	if (Sesion.estado.ifn) {					
		$(".verifn").attr("style", "background-color: #6c757d;");
		//$(".verifn img").attr("src", "/app/images/iconoIFNpushed.svg");
		$(".verifn img").attr("src", new URL('../images/iconoIFNpushed.svg', import.meta.url));
		sendEvent( 'select_content', { content_type: 'show_IFN' } );
	}
	else {					
		$(".verifn").removeAttr("style");
		//$(".verifn img").attr("src", "/app/images/iconoIFN.svg");
		$(".verifn img").attr("src", new URL('../images/iconoIFN.svg', import.meta.url));
		sendEvent( 'select_content', { content_type: 'hide_IFN' } );
	}
}

// soporte mapa base
function actualizarMapaBase() {				
	// actualizo Mitilelayer: URL y atribución
	const { url, opts } = obtenerConfigMapa(false);
	Mitilelayer.setUrl(url);
	Mimapa.attributionControl.removeAttribution(config.geoConfigs.esriMap.options.attribution);
	Mimapa.attributionControl.removeAttribution(config.geoConfigs.osmMap.options.attribution);
	Mimapa.attributionControl.addAttribution(opts.attribution);
	// actualizo aspecto botón y mando evento de IFN (show o hide) a GA
	if (Sesion.estado.esri) {					
		$(".esri").attr("style", "background-color: #6c757d;");
		$(".esri span").attr("style", "color: white;");
		sendEvent( 'select_content', { content_type: 'show_esri' } );
	}
	else {					
		$(".esri").removeAttr("style");
		$(".esri span").removeAttr("style");
		sendEvent( 'select_content', { content_type: 'show_osm' } );
	}
}


// etiquetas Leaflet.Draw
function actualizarEtiquetasLDraw() {
	$(".leaflet-draw-draw-polygon").attr("title", getLiteral(dict.downloadData));
	L.drawLocal.draw.toolbar.actions.text = getLiteral(dict.cancel);
	L.drawLocal.draw.toolbar.actions.title = getLiteral(dict.cancelPolygon);
	L.drawLocal.draw.toolbar.finish.text = getLiteral(dict.finish);
	L.drawLocal.draw.toolbar.finish.title = getLiteral(dict.finishPolygon);
	L.drawLocal.draw.toolbar.undo.text = getLiteral(dict.deleteLastPoint);
	L.drawLocal.draw.toolbar.undo.title = getLiteral(dict.deleteLastPointDrawn);
	L.drawLocal.draw.toolbar.buttons.polygon = getLiteral(dict.downloadData);
	L.drawLocal.draw.handlers.polygon.tooltip.start = getLiteral(dict.startPolygon);
	L.drawLocal.draw.handlers.polygon.tooltip.cont = getLiteral(dict.contPolygon);
	L.drawLocal.draw.handlers.polygon.tooltip.end = getLiteral(dict.endPolygon);
	L.drawLocal.draw.handlers.polyline.error = getLiteral(dict.errorPolygon);
	drawControl.options.draw.polygon.drawError.message = getLiteral(dict.errorPolygon);
}


export { cargarPanel, cargarBotonesMapa, cargarBotonesMinimapa, actualizarIFN, actualizarMapaBase, actualizarIdiomaPanel };
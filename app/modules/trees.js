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
import { popupEdutreeTemplate, spinnerTemplate, lasttreesTemplate } from '../data/htmlTemplates.js';

import _ from 'underscore';
import Mustache from 'mustache';
import $ from "jquery";

import { Sesion, Datos, Layers, Mimapa, obtenerURL, cargarURL, goBack } from '../main.js';
import { getCeldaBounds } from './grid.js';
import { ponerCiclosAntimeridiano } from './map.js';
import { getTreePages } from './dataManager.js';
import { getMoreSpecificSpecies } from './taxons.js';
import { getIconoArbol } from './icons.js';
import { firstUppercase, getLiteral, extractAllElements, getCreatorLabel, uriToLiteral, 
	getDate, getCreator } from './util.js';
import { clickViewprofile, clickSignin, clickSignout } from './users.js';
import { initTimedEvent, sendTimedEvent } from './events.js';


///////////////////
// PÁGINA lasttrees
///////////////////
async function verLasttrees(noborrarcache) {	
	// pongo spinner con mensaje de cargando	
	$("#miarbol").html(spinnerTemplate);
	window.scrollTo(0, 0);
	
	// inicializo el evento para enviar a GA
	initTimedEvent( { content_type: 'lasttrees', crafts_reqs: 0 } );
	
	// pido datos a CRAFTS de las páginas de últimos educatrees
	const pe = Sesion.estado.pe? Sesion.estado.pe : 0;	// por defecto la 0
	const pae = Sesion.estado.pae? Sesion.estado.pae : 0;	// por defecto la 0
	await getTreePages(pe, pae);
	
	// si están mal ajustadas las páginas (por no tener resultados y no ser 0), reajusto la URL
	let actualizar = false;
	if (pe > 0 && Datos.ultEducatrees.global[pe].length == 0) {
		delete Sesion.estado.pe;
		actualizar = true;
	}
	if (pae > 0 && Datos.ultAnotaciones.global[pae].length == 0) {
		delete Sesion.estado.pae;
		actualizar = true;
	}
	if (actualizar) {
		//console.log("URL nueva: "+obtenerURL());
		// actualizo URL
		history.replaceState(Sesion.estado, "", obtenerURL());
		// y lllamo de nuevo al método para que obtenga los datos de nuevo
		verLasttrees(true);
		return;
	}
	
	// caso normal: hago el render
	renderLasttrees();
}

async function renderLasttrees() {
	// detecto llamada espúrea por la autenticación
	if (!Datos.ultEducatrees.global || !Datos.ultAnotaciones.global) 
		return;

	// obtengo info páginas
	const pe = Sesion.estado.pe? Sesion.estado.pe : 0;	// por defecto la 0
	const pae = Sesion.estado.pae? Sesion.estado.pae : 0;	// por defecto la 0
	
	// preparo objeto plantilla
	const objltt = {
		usuario: Sesion.usuario != undefined, // para mostrar botón de signin o avatar
		usuarioImg: Sesion.usuario? Sesion.usuario.photoURL : null, // foto para el avatar
		enPagLastrees: true,
		showann: Sesion.estado.showann
	}
	// ultEducatrees
	const uet = Datos.ultEducatrees.global[pe];
	objltt.hayUltedutrees = uet.length > 0;
	objltt.hayUltedutreesPrev = pe > 0;
	objltt.hayUltedutreesSig = uet.length > config.page;
	objltt.pagUltedutrees = pe + 1;
	objltt.ultedutrees = [];
	for (let i=0; i<uet.length && i < config.page; i++) { // no muestro el config.page + 1
		const uetel = uet[i];
		const etid = uetel.iri.split("/")[uetel.iri.split("/").length -1];
		// cojo primero el nick en Datos.educatrees[iri] (por si actualizó su nick),
		// en segunda opción el nick del objeto y si no, el etid
		let etl = (Datos.educatrees[uetel.iri] && Datos.educatrees[uetel.iri].nick)? getLiteral(Datos.educatrees[uetel.iri].nick) :
			(uetel.nick? getLiteral(uetel.nick) : etid);
		etl = etl.length > 14? etl.substring(0, 10) + "…" : etl;
		const uid = uetel.creator.iri.split("/")[uetel.creator.iri.split("/").length -1];
		objltt.ultedutrees.push(
			{ etid: etid, treeLabel: etl,
			treeHref: "/tree/" + etid, created: getDate(uetel),
			userHref: "/user/" + uid, uid: uid, userLabel: getCreator(uetel)}
		);	
	}
	// ultAnotaciones
	const uaet = Datos.ultAnotaciones.global[pae];
	objltt.hayUltanns = uaet.length > 0;
	objltt.hayUltannsPrev = pae > 0;
	objltt.hayUltannsSig = uaet.length > config.page;
	objltt.pagUltanns = pae + 1;	
	objltt.ultanns = [];
	for (let i=0; i<uaet.length && i < config.page; i++) { // no muestro el config.page + 1
		const uaetel = uaet[i];
		const etid = uaetel.iri.split("/")[uaetel.iri.split("/").length -1];
		// cojo primero el nick en Datos.educatrees[iri] (por si actualizó su nick),
		// en segunda opción el nick del objeto y si no, el etid
		let etl = (Datos.educatrees[uaetel.iri] && Datos.educatrees[uaetel.iri].nick)? getLiteral(Datos.educatrees[uaetel.iri].nick) :
			(uaetel.nick? getLiteral(uaetel.nick) : etid);
		etl = etl.length > 14? etl.substring(0, 10) + "…" : etl;
		const uid = uaetel.creator.iri.split("/")[uaetel.creator.iri.split("/").length -1];
		const atl = config.annotationTypeLabels[ uaetel.type ];
		const typeLabel = getLiteral(atl, getLiteral(config.annotationTypeLabels.pordefecto));		
		objltt.ultanns.push(
			{ etid: etid, treeLabel: etl, treeHref: "/tree/" + etid, 
			annotationType: typeLabel, annotated: getDate(uaetel),
			userHref: "/user/" + uid, uid: uid, userLabel: getCreator(uaetel)}
		);	
	}
	
	// renderizo
	const htmlcontent = Mustache.render(lasttreesTemplate, objltt);
	$("#miarbol").html(htmlcontent);
	
	// envío GA evento ver página lasttrees
	sendTimedEvent();
	console.info("Página lasttrees cargada");

	// pongo listener del botón de volver
	$("#goBackButton").on("click", goBack);
	
	// pongo listeners a clickViewprofile, clickSignin y clickSignout
	$(".userprofile").click(clickViewprofile);
	$(".usersignin").click(clickSignin);
	$(".usersignout").click(clickSignout);
	
	// handlers de páginas
	$(".pagina").click(function() {
		// detecto target de la página
		let target = $(this).hasClass("created")? "pe" : "pae";
		Sesion.estado.showann = $(this).hasClass("annotated");
		// detecto si retrocedo o avanzo
		if ( $(this).hasClass("prev") ) {
			Sesion.estado[target]--;
			if (Sesion.estado[target] == 0)
				delete Sesion.estado[target];
		}
		else { // avanzo, cuidado si no existiera
			if (!Sesion.estado[target])
				Sesion.estado[target] = 1;
			else
				Sesion.estado[target]++;		
		}
		// actualizo URL
		history.replaceState(Sesion.estado, "", obtenerURL());
		// y cargo la URL para que obtenga los datos de nuevo
		verLasttrees(true);
	});
}


// ÁRBOLES
function pintarCeldaArboles(objcelda) {
	// sólo hago el rendering si me toca (objcelda.idtimeout es el mismo que Sesion.idTimeoutActualizar)
	if (objcelda.idtimeout == Sesion.idTimeoutActualizar) {
		if (Sesion.celdasPintadas[objcelda.et] == undefined) {
			// referencia a la celda
			const celda = Datos.celdasArboles[objcelda.et];
			// objeto bounds de la celda (se usa en un par de sitios)
			const bounds = getCeldaBounds(objcelda.cellX, objcelda.cellY, objcelda.zoom);
						
			// detecto si hay cluster, ajustando etiqueta y z-index
			let etCluster = null;
			let zCluster = null;
			if (celda.edu.mmil || (Sesion.estado.ifn && celda.ifn.mmil)) {
				etCluster = "+1K";
				zCluster = 1000;
			} 
			else if (celda.edu.ntrees > config.treeThreshold 
					|| (Sesion.estado.ifn && (celda.edu.ntrees + celda.ifn.ntrees > config.treeThreshold) ) ) {
				etCluster = Sesion.estado.ifn? celda.edu.ntrees + celda.ifn.ntrees : celda.edu.ntrees;
				zCluster = etCluster;					
			}			
			
			// LIMPIEZA CASO ZOOM-OUT (si toca cluster borramos los marcadores que aglutina)
			if (objcelda.zoomout && etCluster) { // hay que borrar todo lo que había en la celda!
				// borrado de árboles en la celda
				let aborrar = [];
				Layers.arbs.eachLayer(function(a) {
					if( bounds.contains(a.getLatLng()) ) {
						// guardo el árbol
						aborrar.push(a);
					}
				});							
				for (let i=0; i<aborrar.length; i++) {						
					Layers.arbs.removeLayer(aborrar[i]);
					// borro también el árbol de Sesion.arbsPintados
					delete Sesion.arbsPintados[ aborrar[i].uri ];
				}
			}
			
			// CLUSTERS
			if (etCluster != undefined) {
				// pongo el cluster en la localización de un árbol de la celda o si no hay en el centro de la celda
				const mLatLng = celda.edu.locCluster?
					L.latLng( celda.edu.locCluster.lat, ponerCiclosAntimeridiano(celda.edu.locCluster.lng, objcelda.cellX, objcelda.zoom) ) :
					((Sesion.estado.ifn && celda.ifn.locCluster)? L.latLng( celda.ifn.locCluster.lat, ponerCiclosAntimeridiano(celda.ifn.locCluster.lng, objcelda.cellX, objcelda.zoom) ) : bounds.getCenter());
				// preparo icono
				const micon = new L.divIcon({
					html: '<div class="marcadorTexto"><span>' + etCluster + '</span></div>',
					className: '',	
					iconSize: [52, 52],
					iconAnchor:   [26, 26], // point of the icon which will correspond to marker's location
					tooltipAnchor:[12, 0] // point from which tooltips will "open", relative to the icon anchor
				});
				// creo marcador y añado a la capa de clusters
				const cpint = L.marker(mLatLng, { icon: micon, zIndexOffset: zCluster } )
					.addTo(Layers.clarbs);
				// ajusto cursor y handler de click con +3 de zoom
				ajustarCursorClickCluster(cpint);
				// añado tooltip si no es táctil
				if (Sesion.hayTooltips)					
					cpint.bindTooltip(etCluster + getLiteral(dict.ntrees));
				// (no ajusto condicionalmente el tooltip porque me da un error al clickar tras un unbindTooltip)
			}
			else {
				// no es un cluster, agrego los dos arrays de árboles y los trato de manera indiferente
				const alltrees = (Sesion.estado.ifn && celda.ifn.trees) ? 				
					(celda.edu.trees ? celda.ifn.trees.concat(celda.edu.trees) : celda.ifn.trees) : 
					(celda.edu.trees ? celda.edu.trees : [] );
				// pinto árbol a árbol
				for (const turi of alltrees) {
					// sólo pinto árbol si no estaba libre (para evitar efectos borde entre celdas)
					if (Sesion.arbsPintados[turi] == undefined) {
						// recupero el árbol
						const arb = Datos.arboles[turi];
						// obtengo icono
						const aicon = getIconoArbol(arb);
						// reajuste de longitud por el antimeridiano
						const lng = ponerCiclosAntimeridiano(arb.lng, objcelda.cellX, objcelda.zoom);
						// pinto el marcador del árbol
						let apint = L.marker([arb.lat, lng], {icon: aicon}).addTo(Layers.arbs);
						// le añado también la uri (para poder borrarlo en caso de zoom out)
						apint.uri = turi;
						// y lo guardo
						Sesion.arbsPintados[turi] = apint;
						// pongo tooltips si es un ifntree (siempre)
						// (no lo ajustaré condicionalmente con el modo de edición porque me da un error al clickar tras un unbindTooltip)
						if (arb.iri == undefined)
							apint.bindTooltip(tooltipArbol(arb));
						// ajusto el cursor y el popup
						ajustarCursorPopupArbol(turi);
					}			
				}
			}	
			// actualizo las celdas pintadas
			Sesion.celdasPintadas[objcelda.et] = true;
		}
	}
}

function ajustarCursorClickCluster(cpint) {
	// actúo según esté en modo de creación de árbol o no
	if (Sesion.creandoArbol) {
		// cursor edición
		cpint.getElement().style.cursor = "crosshair";
		// fuera click handler
		cpint.off('click');
	}
	else { // Sesion.creandoArbol == false
		// cursor normal
		cpint.getElement().style.cursor = "";
		// pongo handler con +3 de zoom al hacer click
		cpint.on('click', function(e) {
			Mimapa.flyTo(cpint.getLatLng(), Sesion.zoom + 3); 
		});
	}
}

function ajustarCursorPopupArbol(auri) {
	// recupero árbol y árbol pintado
	const arb = Datos.arboles[auri];
	const apint = Sesion.arbsPintados[auri];
	if (arb != undefined && apint != undefined) {
		// actúo según esté en modo de creación de árbol o no
		if (Sesion.creandoArbol) {
			// cursor edición
			apint.getElement().style.cursor = "crosshair";
			// fuera popup para edutrees
			if (arb.iri != undefined)
				apint.unbindPopup();
		}
		else { // Sesion.creandoArbol == false
			// cursor normal
			apint.getElement().style.cursor = "";
			// añado popup para edutrees
			if (arb.iri != undefined) {
				// añado popup
				apint.bindPopup(popupArbol(arb));				
				// detecto si hay un error en la carga de la imagen y en tal caso la escondo (gracias, ChatGPT)
				apint.on('popupopen', function(e) {
					const img = e.popup._contentNode.querySelector('img');
					if (img) {
						img.addEventListener('error', function() {
							img.style.display = "none";
							console.warn('Fallo al cargar esta imagen: ' +img.src);
						}); 
					}
				});
			}
		} // else Sesion.creandoArbol == false
	}
}

// TOOLTIPS
function tooltipArbol(arb) {
	return arb.iri == undefined? tooltipIfntree(arb) : tooltipEdutree(arb);
}
function tooltipIfntree(arb) {
	let tooltip = "<strong>"+getLiteral(dict.tree)+" " + uriToLiteral(arb.uri) + "</strong>";
	tooltip += "<br><i>"+getLiteral(dict.createdByIFN) + "</i>";
	const espuri = getMoreSpecificSpecies(arb.species);
	// especie
	if (espuri != undefined && espuri != null && Datos.especies[espuri].vulgarName != undefined) {		
		let nesp = firstUppercase(getLiteral(Datos.especies[espuri].vulgarName, uriToLiteral(espuri)));
		// si hay nombre científico...
		if (Sesion.nomci) {
			nesp = '<i>' + firstUppercase(getLiteral(Datos.especies[espuri].scientificName,
				nesp)) + '</i>';
		}
		tooltip += '<br>' + nesp;
	}
	// altura
	if (arb.heightM != undefined)
		tooltip += "<br>"+getLiteral(dict.height)+": " + Number(getLiteral(arb.heightM)).toFixed(2) + "m";
	// diámetro
	if (arb.dbh1mm && arb.dbh2mm) {
		// calculo media aritmética
		const dbh = ((arb.dbh1mm + arb.dbh2mm)/2).toFixed(0);
		tooltip += '<br>'+getLiteral(dict.diameter)+': '+dbh+'mm';
	}
	return tooltip;
}
function tooltipEdutree(arb) {
	let tooltip = "<strong>"+getLiteral(dict.tree)+" " + uriToLiteral(arb.iri) + "</strong>";
	if (arb.creator != undefined) 
		tooltip += "<br><i>"+getCreatorLabel(arb, getLiteral(dict.createdBy))+"</i>";
	const espuri = getMoreSpecificSpecies(arb.species);
	// especie
	if (espuri != undefined && espuri != null && Datos.especies[espuri].vulgarName != undefined) {		
		let nesp = firstUppercase(getLiteral(Datos.especies[espuri].vulgarName, uriToLiteral(espuri)));
		// si hay nombre científico...
		if (Sesion.nomci) {
			nesp = '<i>' + firstUppercase(getLiteral(Datos.especies[espuri].scientificName,
				nesp)) + '</i>';
		}
		tooltip += '<br>' + nesp;
	}
	// altura
	if (arb.height != undefined)
		tooltip += "<br>"+getLiteral(dict.height)+": " + Number(getLiteral(arb.height)).toFixed(2) + "m";
	// diámetro
	if (arb.dbh != undefined)
		tooltip += '<br>'+getLiteral(dict.diameter)+': ' + Number(getLiteral(arb.dbh)).toFixed(0) + 'mm';
	return tooltip;
}

// POPUPS
function popupArbol(arb) {
	// preparo objeto para el popup con Mustache
	let pobj = {
		'iri': arb.iri,
		'etid': arb.iri.split("/").pop(),
		//'label': getLiteral(dict.tree)+" " + uriToLiteral(arb.iri)
	};
	// nick
	if (arb.nick)
		pobj.nick = getLiteral(arb.nick);
	// taxón
	const espuri = getMoreSpecificSpecies(arb.species);
	if (espuri != undefined && espuri != null && Datos.especies[espuri].vulgarName != undefined) {		
		let nesp = firstUppercase(getLiteral(Datos.especies[espuri].vulgarName, uriToLiteral(espuri)));
		// si hay nombre científico...
		if (Sesion.nomci) {
			nesp = '<i>' + firstUppercase(getLiteral(Datos.especies[espuri].scientificName,
				nesp)) + '</i>';
		}
		pobj.taxon = nesp;
	}
	// recupero todas las imágenes
	const images = extractAllElements(arb, [ "images" ]);
	if (images.length) {
		if (images.length == 1)	// sólo una imagen
			pobj.image = images[0];
		else { // varias, preparo un carrusel
			pobj.multimages = true;
			pobj.images = [];
			const inda = Math.floor(Math.random()*images.length);
			for (let i=0; i<images.length; i++) {
				let obji = { srcimg: images[i] };
				if (i==inda) obji.active = true;
				pobj.images.push(obji);			
			}
		}
	}		
	// voy con la descripción
	pobj.desc = "";	
	// treeStatus
	if (arb.treeStatus) {
		const ts = _.find(config.estadoArboles, function(el) { return el.iri === arb.treeStatus;});
		if (ts) 
			pobj.desc += getLiteral(ts.label) + "<br>";
	}
	// altura
	if (arb.height)
		pobj.desc += getLiteral(dict.height)+": " + Number(getLiteral(arb.height)).toFixed(2) + "m<br>";
	// diámetro
	if (arb.dbh)
		pobj.desc += getLiteral(dict.diameter)+': ' + Number(getLiteral(arb.dbh)).toFixed(0) + 'mm<br>';
	// reajusto cadena descripción para quitar el <br> final
	const libr = pobj.desc.lastIndexOf("<br>");
	if (libr !== -1)
		pobj.desc = pobj.desc.substring(0, libr);		
	// creador y fecha
	pobj.creator = getCreatorLabel(arb, getLiteral(dict.createdBy));	
	// devuelvo el html...
	return Mustache.render(popupEdutreeTemplate, pobj);
}

export { verLasttrees, renderLasttrees, pintarCeldaArboles, tooltipArbol, ajustarCursorClickCluster, ajustarCursorPopupArbol };
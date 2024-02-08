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
import { spinnerTemplate, viewEducatreeForm, handlerTreeStatusInfo, 
	treeStatusTemplate, treePartsPhotoTemplate, changeTreeNickTemplateBody, 
	treeDeletionBody, annotators, footers } from '../data/htmlTemplates.js';

import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import $ from "jquery";
import Mustache from 'mustache';
import _ from 'underscore';
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import L from 'leaflet';

import { Sesion, Datos, Mimapa, Mitilelayer, Datos, 
	cargarURL, obtenerURL, goBack } from '../main.js';
import { getDatosEducatree, setTreeNick, deleteEducatree, annotateEducatree, 
	deleteAnnotationEducatree } from './dataManager.js';
import { procesarTreesMinimapa, handlerTreePhotoChange, handlerDiameterPerimeter, 
	handlerTreeStatusInfo, handlerDeleteTreePhoto, handlerCamera } from './createTree.js';
import { handlerNombreCientifico, visualizarTaxonFormulario,
	 handlerSetTreeTaxonEd, handlerDeleteTreeTaxonEd } from './taxons.js';
import { obtenerConfigMapa } from './map.js';
import { cargarBotonesMinimapa } from './mapControls.js';
import { initTimedEvent, sendEvent, sendTimedEvent } from './events.js';
import { getLiteral, getDate, getCreator, getCreatorLabel, getPosition, extractAllElements,
	getPreferredLang, generateId, configurarModal } from './util.js';
import { getFirebaseApp, clickViewprofile, clickSignin, clickSignout } from './users.js';
import { getIconoArbol, getIconoDiana } from './icons.js';


let Minimapa, Minimapann, Minitilelayer;

async function verEducatree() {
	// obtengo iri del árbol
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	
	// pongo spinner con mensaje de cargando	
	$("#miarbol").html(spinnerTemplate);
	window.scrollTo(0, 0);
	
	// inicializo el evento para enviar a GA
	initTimedEvent( { content_type: 'tree', content_id: iri, crafts_reqs: 0 } );

	// pido datos a CRAFTS del educatree
	await getDatosEducatree(iri);
	//console.log(Datos.educatrees[iri]);
	
	// hago el render
	renderEducatree();
}
async function renderEducatree() {
	// obtengo iri del árbol
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	
	// detecto llamada espúrea por la autenticación
	if (!Datos.educatrees[iri]) 
		return;	
	
	// si no hay posición asumo que el educatree no existe...	
	if (Datos.educatrees[iri].position == undefined) {		
		educatreeNoExiste();
		return;
	}
	
	// obtengo info del usuario
	const usiri = Sesion.usuario? config.edubase + "/user/" + Sesion.usuario.uid : null;
	const isMaster = Sesion.usuario && Datos.usuarios[Sesion.usuario.uid] 
		&& Datos.usuarios[Sesion.usuario.uid].isMasterAnnotator;
	const cannotAnnotate = !Sesion.usuario || (Sesion.usuario && Datos.usuarios[Sesion.usuario.uid] 
		&& Datos.usuarios[Sesion.usuario.uid].cannotAnnotate);			
	
	// 0) preparo objeto para el render del árbol
	let objet = {
		etid: Sesion.estado.etid,
		title: Datos.educatrees[iri].nick? getLiteral(Datos.educatrees[iri].nick) : getLiteral(dict.tree)+' '+Sesion.estado.etid,
		nickButtonLabel: Datos.educatrees[iri].nick? getLiteral(dict.changeNick) : getLiteral(dict.newNick),
		treeCreator: getCreatorLabel(Datos.educatrees[iri], getLiteral(dict.createdBy)),
		editable: !cannotAnnotate,
		removable: (isMaster ||	(Datos.educatrees[iri].creator && 
			(Datos.educatrees[iri].creator.iri === usiri || Datos.educatrees[iri].creator === usiri))),
		usuario: Sesion.usuario != undefined, // para mostrar botón de signin o avatar
		usuarioImg: Sesion.usuario? Sesion.usuario.photoURL : null, // foto para el avatar
	}
	// NOTA: permito siempre borrar al creador del árbol (aunque haya anotaciones de otros)
	
	// si hay nick reajusto título de la página
	if (Datos.educatrees[iri].nick)
		document.title = getLiteral(Datos.educatrees[iri].nick)+' - EducaWood';
		
	// position
	objet.position = {
		iri: Datos.educatrees[iri].position.iri,
		value: getPosition(Datos.educatrees[iri].position),
		creator: getCreatorLabel(Datos.educatrees[iri].position, getLiteral(dict.annotatedBy))
	}
	// posiciones previas
	objet.formerPositions = [];
	const fpels = extractAllElements(Datos.educatrees[iri], ["positionAnnotations"]);
	for (const fpel of fpels) {
		if (fpel.iri !== objet.position.iri) {
			objet.formerPositions.push( {
				iri: fpel.iri,
				value: getPosition(fpel),
				creator: getCreatorLabel(fpel, getLiteral(dict.annotatedBy)),
				created: fpel.created,
				removable: (isMaster ||	(fpel.creator && (fpel.creator.iri === usiri || fpel.creator === usiri)))
			} );
		}
	}
	objet.formerPositions = _.sortBy(objet.formerPositions, 
		function(obj) { return new Date(obj.created); }).reverse();
	objet.hasFormerPositions = objet.formerPositions.length > 0;
	// ajusto removable de position (especial porque no puede haber árbol sin posición)
	objet.position.removable = objet.hasFormerPositions && (isMaster ||
		(Datos.educatrees[iri].position.creator && 
			(Datos.educatrees[iri].position.creator.iri === usiri || Datos.educatrees[iri].position.creator === usiri)));
	
	// tree taxon
	if (objet.editable)
		objet.treeTaxon = {}; // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].species && Datos.educatrees[iri].species.species) {
		objet.treeTaxon = {
			iri: Datos.educatrees[iri].species.iri,
			value:  Datos.educatrees[iri].species.species.iri,
			creator: getCreatorLabel(Datos.educatrees[iri].species, getLiteral(dict.annotatedBy)),
			removable: (isMaster ||	(Datos.educatrees[iri].species.creator 
				&& (Datos.educatrees[iri].species.creator.iri === usiri || Datos.educatrees[iri].species.creator === usiri)))
		}
		/* TODO previo
		if (Datos.educatrees[iri].species.species.dbpedia)
			objet.treeTaxon.dbr = Datos.educatrees[iri].species.species.dbpedia;*/
		// 2023-11 ahora detecto si hay datos de wikidata en las especies
		if (Datos.especies[Datos.educatrees[iri].species.species.iri].wikidata)
			objet.treeTaxon.wikidata = true;
		// taxones previos
		objet.formerTaxa = [];
		const ftxels = extractAllElements(Datos.educatrees[iri], ["speciesAnnotations"]);
		for (const ftxel of ftxels) {
			if (ftxel.iri !== objet.treeTaxon.iri) {
				let objtx = {
					iri: ftxel.iri,
					value: ftxel.species.iri,
					creator: getCreatorLabel(ftxel, getLiteral(dict.annotatedBy)),
					created: ftxel.created,
					removable: (isMaster ||	(ftxel.creator && (ftxel.creator.iri === usiri || ftxel.creator === usiri)))
				};
				/* TODO previo
				if (ftxel.species.dbpedia)
					objtx.dbr = ftxel.species.dbpedia;*/
				// 2023-11 ahora detecto si hay datos de wikidata en las especies
				if (Datos.especies[ftxel.species.iri].wikidata)
					objtx.wikidata = true;
				objet.formerTaxa.push(objtx );
			}
		}
		objet.formerTaxa = _.sortBy(objet.formerTaxa, 
			function(obj) { return new Date(obj.created); }).reverse();
		objet.hasFormerTaxa = objet.formerTaxa.length > 0;
	}
	
	// tree status
	if (objet.editable)
		objet.treeStatus = {}; // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].treeStatus && Datos.educatrees[iri].treeStatus.treeStatus) {
		const ts = _.find(config.estadoArboles, function(el) { return el.iri === Datos.educatrees[iri].treeStatus.treeStatus;});
		if (ts) {
			objet.treeStatus = {
				iri: Datos.educatrees[iri].treeStatus.iri,
				value: getLiteral(ts.label),
				creator: getCreatorLabel(Datos.educatrees[iri].treeStatus, getLiteral(dict.annotatedBy)),
				removable: (isMaster ||	(Datos.educatrees[iri].treeStatus.creator && 
					(Datos.educatrees[iri].treeStatus.creator.iri === usiri || Datos.educatrees[iri].treeStatus.creator === usiri)))
			}
		}
		// status previos
		objet.formerStatus = [];
		const ftsels = extractAllElements(Datos.educatrees[iri], ["treeStatusAnnotations"]);
		for (const ftsel of ftsels) {
			if (ftsel.iri !== objet.treeStatus.iri) {
				const tsel = _.find(config.estadoArboles, function(el) { return el.iri === ftsel.treeStatus; });
				if (tsel) {
					objet.formerStatus.push( {
						iri: ftsel.iri,
						value: getLiteral(tsel.label),
						creator: getCreatorLabel(ftsel, getLiteral(dict.annotatedBy)),
						created: ftsel.created,
						removable: (isMaster || (ftsel.creator && (ftsel.creator.iri === usiri || ftsel.creator === usiri)))
					} );
				}
			}
		}
		objet.formerStatus = _.sortBy(objet.formerStatus, 
			function(obj) { return new Date(obj.created); }).reverse();
		objet.hasFormerStatus = objet.formerStatus.length > 0;
	}
	
	// photos
	if (objet.editable)
		objet.photoLabel = getLiteral(dict.photo); // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].imageAnnotations) {
		objet.hasPhotos = true;
		objet.photoLabel = getLiteral(dict.photo);
		objet.photos = [];
		const photos = extractAllElements(Datos.educatrees[iri], ["imageAnnotations"]);
		if (photos.length > 1)
			objet.photoLabel += 's'; // plural
		else
			objet.onePhoto = true; // para quitar congtroles de navegación
		for (let i = 0; i < photos.length; i++) {
			let phobj = {};
			phobj.index = i;
			if (i==0)
				phobj.first = true;
			phobj.iri = photos[i].iri;
			phobj.src = photos[i].image.imageURL;
			if (photos[i].image.plantPart && Datos.partesPlantasFoto[photos[i].image.plantPart])
				phobj.plantPart = getLiteral(Datos.partesPlantasFoto[photos[i].image.plantPart].label);
			phobj.creator = getCreatorLabel(photos[i], getLiteral(dict.annotatedBy));			
			phobj.removable = (isMaster || (photos[i].creator && (photos[i].creator.iri === usiri || photos[i].creator === usiri)))
			objet.photos.push(phobj);
		}
	}
	
	// height
	if (objet.editable)
		objet.height = {}; // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].height && Datos.educatrees[iri].height.meters) {
		objet.height = {
			iri: Datos.educatrees[iri].height.iri,
			value: Datos.educatrees[iri].height.meters,
			creator: getCreatorLabel(Datos.educatrees[iri].height, getLiteral(dict.annotatedBy)),
			removable: (isMaster ||	(Datos.educatrees[iri].height.creator && 
				(Datos.educatrees[iri].height.creator.iri === usiri || Datos.educatrees[iri].height.creator === usiri)))
		}
		// alturas previas
		objet.formerHeights = [];
		const fhels = extractAllElements(Datos.educatrees[iri], ["heightAnnotations"]);
		for (const fhel of fhels) {
			if (fhel.iri !== objet.height.iri) {
				objet.formerHeights.push( {
					iri: fhel.iri,
					value: fhel.meters,
					creator: getCreatorLabel(fhel, getLiteral(dict.annotatedBy)),
					created: fhel.created,
					removable: (isMaster || (fhel.creator && (fhel.creator.iri === usiri || fhel.creator === usiri)))
				} );
			}
		}
		objet.formerHeights = _.sortBy(objet.formerHeights, 
			function(obj) { return new Date(obj.created); }).reverse();
		objet.hasFormerHeight = objet.formerHeights.length > 0;
	}
	
	// diameter
	if (objet.editable)
		objet.diameter = {}; // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].diameter && Datos.educatrees[iri].diameter.millimeters) {
		objet.diameter = {
			iri: Datos.educatrees[iri].diameter.iri,
			value: Datos.educatrees[iri].diameter.millimeters,
			creator: getCreatorLabel(Datos.educatrees[iri].diameter, getLiteral(dict.annotatedBy)),
			removable: (isMaster || (Datos.educatrees[iri].diameter.creator && 
				(Datos.educatrees[iri].diameter.creator.iri === usiri || Datos.educatrees[iri].diameter.creator === usiri)))
		}
		// diámetros previos
		objet.formerDiameters = [];
		const fdels = extractAllElements(Datos.educatrees[iri], ["diameterAnnotations"]);
		for (const fdel of fdels) {
			if (fdel.iri !== objet.diameter.iri) {
				objet.formerDiameters.push( {
					iri: fdel.iri,
					value: fdel.millimeters,
					creator: getCreatorLabel(fdel, getLiteral(dict.annotatedBy)),
					created: fdel.created,
					removable: (isMaster || (fdel.creator && (fdel.creator.iri === usiri || fdel.creator === usiri)))
				} );
			}
		}
		objet.formerDiameters = _.sortBy(objet.formerDiameters, 
			function(obj) { return new Date(obj.created); }).reverse();
		objet.hasFormerDiameter = objet.formerDiameters.length > 0;
	}
	
	// observaciones	
	if (objet.editable)
		objet.observation = {}; // para mostrar la etiqueta y editar incluso si no hay valor
	if (Datos.educatrees[iri].observations) {	
		let obss = extractAllElements(Datos.educatrees[iri], ["observations"]);
		// elimino las observaciones sin texto o con menos de 3 caracteres
		obss = _.filter(obss, function(obs) { return obs.text && getLiteral(obs.text).length > 3; } );
		obss = _.sortBy(obss, function(obj) { return new Date(obj.created); }).reverse();
		// pongo observación primera
		objet.observation = {
			iri: obss[0].iri,
			value: getLiteral(obss[0].text),
			creator: getCreatorLabel(obss[0], getLiteral(dict.annotatedBy)),
			removable: (isMaster || (obss[0].creator && 
				(obss[0].creator.iri === usiri || obss[0].creator === usiri)))
		}
		// observaciones anteriores
		if (obss.length > 1) {
			objet.hasMoreObservations = true;
			objet.moreObservations = [];
			for (let i=1; i<obss.length; i++) {
				objet.moreObservations.push( {
					iri: obss[i].iri,
					value: getLiteral(obss[i].text),
					creator: getCreatorLabel(obss[i], getLiteral(dict.annotatedBy)),
					removable: (isMaster || (obss[i].creator && 
						(obss[i].creator.iri === usiri || obss[i].creator === usiri)))
				});
			}
		}
	}
	//console.log(objet);
	
	// 1) hago el rendering
	const htmlcontent = Mustache.render(viewEducatreeForm, objet);
	$("#miarbol").html(htmlcontent);

	// envío GA evento ver página árbol
	sendTimedEvent();
	console.info("Página árbol cargada: " + iri);
	
	// listener goBack
	$(".goBack").click(goBack);
	
	// listener borrarArbol
	$("#deleteEducaTree").click(handlerDeleteEducatree);
		
	// pongo listeners a clickViewprofile, clickSignin y clickSignout
	$(".userprofile").click(clickViewprofile);
	$(".usersignin").click(clickSignin);
	$(".usersignout").click(clickSignout);
	
	// listener a cambiar el nick del árbol
	$("#changeTreeNick").click(changeTreeNick);
	
	// listener ayuda treeStatusInfo
	$("#botTreeStatusInfo").click(handlerTreeStatusInfo);
	
	// 2) ajustes taxón y fotos	
	// tree taxon => ajusto nomci, hago rendering del taxón y pongo handler del popver del taxón
	// ajusto nomci 
	$("#viewchecknomci").prop('checked', Sesion.nomci);
	$("#viewchecknomci").change(handlerNombreCientifico);
	// llamo a visualizarTaxonFormulario para que haga el rendering del taxón (incluye el listener para mostrar popover)
	visualizarTaxonFormulario();
	
	// photos => detecto cambios en el carrusel para mostrar la info de creación apropiada
	$('#miCarrusel').on('slid.bs.carousel', function() {
		let indice = $(this).find('.carousel-item.active').index();
    	// ajusto visibilidad creadores imágenes (con sus botones de borrado y edición, claro)
    	$('.photoCreator').addClass('d-none');
    	$('.photoCreator').filter('[index="'+indice+'"]').removeClass('d-none');
    });
	
	// 3) listeners de creación y borrado de anotaciones
	$(".create").click(handlerNewAnnotation);
	$(".delete").click(handlerDeleteAnnotation);
	
	// 4) ajusto coordenadas y cargo mapa
	Sesion.estado.loc.lat = Datos.educatrees[iri].position.latWGS84;
	Sesion.estado.loc.lng = Datos.educatrees[iri].position.lngWGS84;
	Sesion.estado.loc.z = config.zMiniMapa;
	// preparo primero los bounds para que no se vaya a Cuenca
	const offset = 0.0004; // 1km es aproximadamente 0,008 grados en WGS84
	const bounds = L.latLngBounds(
		L.latLng(Sesion.estado.loc.lat - offset, Sesion.estado.loc.lng - 3*offset), //southWest
		L.latLng(Sesion.estado.loc.lat + offset, Sesion.estado.loc.lng + 3*offset)); //northEast	
	// meto tap: false, que parece es una fuente de problemas	
	Minimapa = L.map('mapaedutree', 
			{maxBounds: bounds, maxBoundsViscosity: 1.0, zoomControl: false, tap: false, scrollWheelZoom: 'center', preferCanvas: true} )
		.setView([Sesion.estado.loc.lat, Sesion.estado.loc.lng], config.zMiniMapa);
	// cargo el tile layer que corresponda
	const { url, opts } = obtenerConfigMapa(true);
	Minitilelayer = L.tileLayer(url, opts).addTo(Minimapa);		
	// muestro escala del mapa
	L.control.scale( {imperial: false, position: 'bottomright'} ).addTo(Minimapa); // sin la escala imperial
	if (!L.Browser.mobile) { // sólo botones de zoom para dispositivos no móviles
		L.control.zoom( { position: 'bottomright',
			zoomInTitle: getLiteral(dict.zoomin),
			zoomOutTitle: getLiteral(dict.zoomout),
		} ).addTo(Minimapa);
	}
	// Disable dragging
	Minimapa.dragging.disable();
	// cargo botones esri y volverMapa
	cargarBotonesMinimapa(Minimapa, [Minimapa, Mimapa], [Minitilelayer, Mitilelayer], true);
		
	// 5) pido ifntrees y edutrees del mapa y pinto
	await procesarTreesMinimapa(Minimapa, bounds);
	// pongo color al educatree
	const arb = Datos.arboles[iri];
	// obtengo icono con color
	const aicon = getIconoArbol(arb, true);
	// y se lo asigno
	if (Minimapa.arbsPintados[iri])
		Minimapa.arbsPintados[iri].setIcon(aicon);
	//quito el overlay con el que escondía el mapa y habilito el dragging
	$("#overlay").addClass('d-none');
	Minimapa.dragging.enable();
}


///////////////////////
// CREACIÓN ANOTACIONES
function handlerNewAnnotation() {
	// recupero iri
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;

	// inicialización modal
	configurarModal( { static: true, vertcent: true, nobody: true}, 
		getLiteral(dict.newAnnotation), null, footers.crearAnotacion);

	// detecto el tipo de anotación y cargo el body correspondiente
	if ($(this).hasClass('position')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.position, null);		
		// pinto posición
		$("#inputPositionAnn").val(getPosition( {latWGS84: Sesion.estado.loc.lat, lngWGS84: Sesion.estado.loc.lng} ));
		// espero a que el modal se haya mostrado
		document.getElementById('mimodal').addEventListener('shown.bs.modal', async function () {
			// preparo primero los bounds para que no se vaya a Cuenca
			const offset = 0.0004; // 1km es aproximadamente 0,008 grados en WGS84
			const bounds = L.latLngBounds(
				L.latLng(Sesion.estado.loc.lat - offset, Sesion.estado.loc.lng - 2.5*offset), //southWest
				L.latLng(Sesion.estado.loc.lat + offset, Sesion.estado.loc.lng + 2.5*offset)); //northEast	
			// meto tap: false, que parece es una fuente de problemas
			// meto scrollWheelZoom: 'center' para que no dé saltos raros la diana al cambiar el zoom
			Minimapann = L.map('mapaAnn', 
					{maxBounds: bounds, maxBoundsViscosity: 1.0, zoomControl: false, tap: false, scrollWheelZoom: 'center', preferCanvas: true} )
				.setView([Sesion.estado.loc.lat, Sesion.estado.loc.lng], config.zMiniMapa);
			// cargo el tile layer que corresponda
			const { url, opts } = obtenerConfigMapa(true);
			const minianntl = L.tileLayer(url, opts).addTo(Minimapann);
			// muestro escala del mapa
			L.control.scale( {imperial: false, position: 'bottomright'} ).addTo(Minimapann); // sin la escala imperial
			if (!L.Browser.mobile) { // sólo botones de zoom para dispositivos no móviles
				L.control.zoom( { position: 'bottomright',
					zoomInTitle: getLiteral(dict.zoomin),
					zoomOutTitle: getLiteral(dict.zoomout),
				} ).addTo(Minimapann);
			}
			// Disable dragging
			Minimapann.dragging.disable();
			// cargo botón esri
			cargarBotonesMinimapa(Minimapann, [Minimapann, Minimapa, Mimapa], [minianntl, Minitilelayer, Mitilelayer]);			

			// 3) pido ifntrees y edutrees del mapa y pinto
			await procesarTreesMinimapa(Minimapann, bounds);
		
			// 4) al acabar hago múltiples ajustes
			// quito el icono del árbol
			Minimapann.removeLayer(Minimapann.arbsPintados[iri]);
			// quito el overlay con el que escondía el mapa, pongo la pista y habilito el dragging
			$("#overlayAnn").addClass('d-none');
			$("#mapclueAnn").removeClass('d-none');
			Minimapann.dragging.enable();
	
			// 5) pinto marcador de diana
			const diana = L.marker([Sesion.estado.loc.lat, Sesion.estado.loc.lng], 
					{icon: getIconoDiana(), zIndexOffset: 100}).addTo(Minimapann);	
			
			// 6) detecto eventos "move" y ajusto la diana	
			Minimapann.on('move', function(event) {
				const center = Minimapann.getCenter();  // Get the new center position of the map
				diana.setLatLng(center);  // Set the marker position to the new center
			});
			// como hay muchos eventos 'move', actualizo cosas sólo con 'moveend'
			Minimapann.on('moveend', function(event) {
				const center = Minimapann.getCenter();  // Get the new center position of the map
				diana.setLatLng(center);  // Set the marker position to the new center
				// ajusto texto
				$("#inputPositionAnn").val(getPosition( {latWGS84: center.lat, lngWGS84: center.lng} ));
				// detecto si hay cambio respecto a lo anterior
				if (Datos.educatrees[iri].position.latWGS84.toFixed(6) === center.lat.toFixed(6) &&
						Datos.educatrees[iri].position.lngWGS84.toFixed(6) === center.lng.toFixed(6)) {
					// console.log("Misma posición que antes (!)");
					$("#statusAnnotation").text(getLiteral(dict.sameAnnotation));
					$("#statusAnnotation").removeClass("d-none")
					$("#botcreatemodalannotation").prop("disabled", true);
				}					
				else {
					//console.log("Todo OK");
					$("#statusAnnotation").addClass("d-none")
					$("#botcreatemodalannotation").prop("disabled", false);
				}
			});
		}, { once: true }); // para que sólo se ejecute una vez
	}
	else if ($(this).hasClass('treeTaxon')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.treeTaxon, null);
		// ajusto nomci 
		$("#anchecknomci").prop('checked', Sesion.nomci);
		$("#anchecknomci").change(handlerNombreCientifico);
		// listeners taxón
		$("#setTreeTaxonEd").click(handlerSetTreeTaxonEd);
		$("#deleteTreeTaxon").click(handlerDeleteTreeTaxonEd);
		// detecto cambio en treeTaxon
		$("#inputTreeTaxonEd").change(function() { // he hecho un trigger de evento change en species.js para detectar esto
			const ttiri = $("#inputTreeTaxonEd").attr("iri");
			// preinicializo
			$("#statusAnnotation").removeClass("d-none")
			$("#botcreatemodalannotation").prop("disabled", true);
			if (!ttiri) {
				//console.log("No hay nada");
				$("#statusAnnotation").text(getLiteral(dict.noAnnotation));
			}
			else if (Datos.educatrees[iri].species && Datos.educatrees[iri].species.species &&						
					ttiri === Datos.educatrees[iri].species.species.iri) {
				//console.log("Misma iri que antes (!)");
				$("#statusAnnotation").text(getLiteral(dict.sameAnnotation));	
			}
			else {
				//console.log("Todo OK");
				$("#statusAnnotation").addClass("d-none")
				$("#botcreatemodalannotation").prop("disabled", false);
			}
		});
	}
	else if ($(this).hasClass('treeStatus')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.treeStatus, null);
		// cargo tipos de estado del árbol en #selectTreeStatus
		let testarb = [];
		for (const el of config.estadoArboles) {
			testarb.push( {"iri": el.iri, "label": getLiteral(el.label), "pref": el.pref} );
		}
		const htmltest = Mustache.render(treeStatusTemplate, testarb);
		$("#selectTreeStatus").html(htmltest);
		// detecto cambio en selectTreeStatus	
		$("#selectTreeStatus").change(function() { // he hecho un trigger de evento change en species.js para detectar esto
			const tstiri = $('#selectTreeStatus').val();
			// preinicializo
			$("#statusAnnotation").removeClass("d-none")
			$("#botcreatemodalannotation").prop("disabled", true);
			if (!tstiri) {
				//console.log("No hay nada");
				$("#statusAnnotation").text(getLiteral(dict.noAnnotation));
			}
			else if (Datos.educatrees[iri].treeStatus && Datos.educatrees[iri].treeStatus.treeStatus &&						
					tstiri === Datos.educatrees[iri].treeStatus.treeStatus) {
				//console.log("Misma iri que antes (!)");
				$("#statusAnnotation").text(getLiteral(dict.sameAnnotation));
			}
			else {
				//console.log("Todo OK");
				$("#statusAnnotation").addClass("d-none")
				$("#botcreatemodalannotation").prop("disabled", false);
			}	
		});
	}
	else if ($(this).hasClass('photo')) {
		// preparo el anotador
		const oa = {
			esMovil: L.Browser.mobile, // para mostrar o no el botón de la cámara
			camera: localStorage.getItem('camera') === "false"? false : true // por defecto true
		};
		const htmlann = Mustache.render(annotators.photo, oa);
		// pongo body adecuado en el modal
		configurarModal(null, null, htmlann, null);
		// listener de la foto => compresión en #resizedTreePhoto y muestro thumbnail
		$("#treePhoto").change(handlerTreePhotoChange); // más actualización estado anotación
		// listener borrar foto (antes de subir a Firebase)
		$("#deleteTreePhoto").click(handlerDeleteTreePhoto);
		// cargo partes de árboles fotos en #selectTreePartPhoto
		let parbfotos = [];
		for (const paf in Datos.partesPlantasFoto)
			parbfotos.push( {"uri": paf, "label": getLiteral(Datos.partesPlantasFoto[paf].label)} );
		const htmlcontent = Mustache.render(treePartsPhotoTemplate, parbfotos);
		$("#selectTreePartPhoto").html(htmlcontent);
		// cambio de modo a cámara (sólo valdrá para móvil)
		$("#checkCamera").change(handlerCamera);
	}
	else if ($(this).hasClass('height')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.height, null);
		// listener de cambio de altura
		$("#treeHeight").change(function() {
			const alt = Number($('#treeHeight').val());
			// preinicializo
			$("#statusAnnotation").removeClass("d-none")
			$("#botcreatemodalannotation").prop("disabled", true);
			if (!alt) {
				//console.log("No hay nada");
				$("#statusAnnotation").text(getLiteral(dict.noAnnotation));
			}
			else if (alt < 0 || alt > 150) {
				//console.log("Fuera de rango");
				$("#statusAnnotation").text(getLiteral(dict.outOfRangeAnnotation));
			}				
			else if (Datos.educatrees[iri].height && Datos.educatrees[iri].height.meters &&						
					alt === Datos.educatrees[iri].height.meters) {
				//console.log("Misma altura que antes (!)");				
				$("#statusAnnotation").text(getLiteral(dict.sameAnnotation));
			}
			else {
				//console.log("Todo OK");
				$("#statusAnnotation").addClass("d-none")
				$("#botcreatemodalannotation").prop("disabled", false);
			}			
		});
	}
	else if ($(this).hasClass('diameter')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.diameter, null);
		// listener de medida de perímetro
		$("#checkPerimeter").change(handlerDiameterPerimeter);
		// listener de cambio de perímetro		
		$("#treeDiameter").change(function() {
			let diam = Number($('#treeDiameter').val());
			// preinicializo
			$("#statusAnnotation").removeClass("d-none")
			$("#botcreatemodalannotation").prop("disabled", true);
			if (!diam) {
				//console.log("No hay nada");
				$("#statusAnnotation").text(getLiteral(dict.noAnnotation));
			}
			else {
				// reajuste por el modo perímetro
				if ($("#checkPerimeter").prop("checked"))
					diam = Number((diam / Math.PI).toFixed(0));
				if (diam < 0 || diam > 20000) {
					//console.log("Fuera de rango");
					$("#statusAnnotation").text(getLiteral(dict.outOfRangeAnnotation));
				}			
				else if (Datos.educatrees[iri].diameter && Datos.educatrees[iri].diameter.millimeters &&						
						diam === Datos.educatrees[iri].diameter.millimeters) {
					//console.log("Mismo diámetro que antes (!)");
					$("#statusAnnotation").text(getLiteral(dict.sameAnnotation));
				}
				else {
					//console.log("Todo OK");
					$("#statusAnnotation").addClass("d-none")
					$("#botcreatemodalannotation").prop("disabled", false);
				}
			}
		});
	}
	else if ($(this).hasClass('observation')) {
		// pongo body adecuado en el modal
		configurarModal(null, null, annotators.observation, null);
		// listener de cambio de altura
		$("#observation").on('input', function() {
			const obs = $('#observation').val();
			// preinicializo
			$("#statusAnnotation").removeClass("d-none")
			$("#botcreatemodalannotation").prop("disabled", true);
			if (obs.length == 0) {
				//console.log("No hay nada");
				$("#statusAnnotation").text(getLiteral(dict.noAnnotation));
			}
			else if (obs.length < 5) {
				//console.log("Fuera de rango");
				$("#statusAnnotation").text(getLiteral(dict.typesomethingmore));
			}
			else {
				//console.log("Todo OK");
				$("#statusAnnotation").addClass("d-none")
				$("#botcreatemodalannotation").prop("disabled", false);
			}			
		});
	}
	else
		return; // no debería llegar aquí, pero por si acaso
	
	// muestro el modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	
	// handler al botón de procesar anotación
	$("#botcreatemodalannotation").click(procesarAnotacion);
}
async function procesarAnotacion() {
	// recupero iri del árbol
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	// constantes de anotación
	const annid = generateId(12);	
	const ahora = new Date().toISOString();
	const creador = config.edubase + "/user/" + Sesion.usuario.uid;
	
	// inicializo tipo de anotación y anniri para el evento a GA
	let tipoann = null;
	let anniri = null;
	
	// preparo clones
	const tobjclon = JSON.parse(JSON.stringify( Datos.educatrees[iri] ));
	const bobjclon = Datos.arboles[iri]? JSON.parse(JSON.stringify( Datos.arboles[iri] )) : null; // puede no existir	
	// inicializo patch
	const patch = [];
	// detecto tipo de anotación
	if ($('#mapaAnn').length) {	
		tipoann = 'position_annotation';
		//console.log("Anotación de posición");		
		const center = Minimapann.getCenter();
		const posann = {
			iri: config.edubase + "/posann/" + annid,
			creator: creador,
			created: ahora,
			latWGS84: center.lat,
			lngWGS84: center.lng,
			types: config.edubase + "/sta/ontology/PositionAnnotation"
		};
		anniri = posann.iri;
		// preparo patch con la nueva anotación de posición	
		patch.push(	{ op: "replace", path: "/position", value: posann }	);
		// preparo el path adecuado en el array de posiciones 
		// (debería existir Datos.educatrees[iri].positionAnnotations, pero por si acaso)
		const pospath =  Datos.educatrees[iri].positionAnnotations? "/positionAnnotations/-" : "/positionAnnotations";		
		patch.push(	{ op: "add", path: pospath, value: posann.iri } );
		// reajusto clones
		tobjclon.position = posann;
		tobjclon.positionAnnotations = !(Datos.educatrees[iri].positionAnnotations)? posann : Array.isArray(Datos.educatrees[iri].positionAnnotations)?
			[posann, ...tobjclon.positionAnnotations] : [ posann, Datos.educatrees[iri].positionAnnotations ];
		if (bobjclon) {
			bobjclon.lat = center.lat;
			bobjclon.lng = center.lng;
		}
	}
	else if ($('#inputTreeTaxonEd').length) {
		tipoann = 'taxon_annotation';
		//console.log("Anotación de taxón");
		const ttiri = $("#inputTreeTaxonEd").attr("iri");
		const ttann = {
			iri: config.edubase + "/spann/" + annid,
			creator: creador,
			created: ahora,
 			species: ttiri,
			types: config.edubase + "/sta/ontology/SpeciesAnnotation"
		};
		anniri = ttann.iri;
		// preparo patch con la nueva anotación de taxón
		const oper = Datos.educatrees[iri].species? "replace" : "add";
		patch.push(	{ op: oper, path: "/species", value: ttann }	);
		// preparo el path adecuado en el array de taxones
		const ttpath =  Datos.educatrees[iri].speciesAnnotations? "/speciesAnnotations/-" : "/speciesAnnotations";		
		patch.push(	{ op: "add", path: ttpath, value: ttann.iri } );
		// reajusto clones (aquí más complejo para incorporar la info de especie)
		const ttannclon = JSON.parse(JSON.stringify(ttann));
		ttannclon.species = {
			iri: ttiri,
			scientificName: Datos.especies[ttiri].scientificName,
			vulgarName: Datos.especies[ttiri].vulgarName,
			dbpedia: Datos.especies[ttiri].dbpedia,
			wikipediaPage: Datos.especies[ttiri].wikipediaPage		
		};		
		tobjclon.species = ttannclon;
		tobjclon.speciesAnnotations = !(Datos.educatrees[iri].speciesAnnotations)? ttannclon : Array.isArray(Datos.educatrees[iri].speciesAnnotations)?
			[ttannclon, ...tobjclon.speciesAnnotations] : [ ttannclon, Datos.educatrees[iri].speciesAnnotations ];
		if (bobjclon) 
			bobjclon.species = ttiri;
	}
	else if ($('#selectTreeStatus').length) { 
		tipoann = 'status_annotation';
		//console.log("Anotación de estado de árbol");
		const tstiri = $('#selectTreeStatus').val();
		const tstann = {
			iri: config.edubase + "/treestann/" + annid,
			creator: creador,
			created: ahora,
 			treeStatus: tstiri
		};
		anniri = tstann.iri;
		// preparo patch con la nueva anotación de tree status
		const oper = Datos.educatrees[iri].treeStatus? "replace" : "add";
		patch.push(	{ op: oper, path: "/treeStatus", value: tstann }	);
		// preparo el path adecuado en el array de taxones
		const tstpath =  Datos.educatrees[iri].treeStatusAnnotations? "/treeStatusAnnotations/-" : "/treeStatusAnnotations";		
		patch.push(	{ op: "add", path: tstpath, value: tstann.iri } );
		// reajusto clones
		tobjclon.treeStatus = tstann;
		tobjclon.treeStatusAnnotations = !(Datos.educatrees[iri].treeStatusAnnotations)? tstann : Array.isArray(Datos.educatrees[iri].treeStatusAnnotations)?
			[tstann, ...tobjclon.treeStatusAnnotations] : [ tstann, Datos.educatrees[iri].treeStatusAnnotations ];
		if (bobjclon)
			bobjclon.treeStatus = tstiri;
	}
	else if ($('#treePhoto').length) {
		tipoann = 'photo_annotation';
		//console.log("Anotación de foto");			
		// guardo primero en Firebase
		const imgDataUrl = $("#resizedTreePhoto").val();
		let imgFirebasePath = 'images/'+ Sesion.usuario.uid + '/' + annid + '.png';	
		let imgDownloadURL = null; 
		// Get a reference to the storage service, which is used to create references in your storage bucket		
		const storage = getStorage(getFirebaseApp());
		// Create a storage reference from our storage service
		//const storageRef = storage.ref();
		// preparo referencia a imagen para guardar
		const imgRef = ref(storage, imgFirebasePath);
		
		// recupero el tree part para que no se borre con el spinner
		const tppiri =  $('#selectTreePartPhoto').val();
		
		// pongo spinner (porque aquí hay que esperar y en el resto de casos no)
		configurarModal( { static: true, vertcent: true, spinner: true, spinnerMessage: getLiteral(dict.pleasewait), nofooter: true },
			getLiteral(dict.creatingannotation), null, null);			
	
		// guardo foto del árbol
		try {
			const snapshot = await uploadString(imgRef, imgDataUrl, 'data_url');
			imgDownloadURL = await getDownloadURL(snapshot.ref);
			// mando evento de creación de foto en firebase a GA
			sendEvent( "create_content", { content_type: 'photo', content_id: imgDownloadURL, uid: Sesion.usuario.uid } );
			console.info("Foto subida a Firebase: " + imgDownloadURL);
		} catch(error) {
			console.error('Error: ' + error.message);
			const be = "<code>" + error + "</code>";		
			configurarModal( { static: true, vertcent: true, }, 
				getLiteral(dict.uploadingphotoerror), be, footers.anotacionError);		
			return; // terminamos
		}
		
		// ahora voy con la anotación
		const fotann = {
			iri: config.edubase + "/imgann/" + annid,
			creator: creador,
			created: ahora,
 			image: {
				iri: config.edubase + "/img/" + annid,
				imageURL: imgDownloadURL,
				firebasePath: imgFirebasePath,
				types: config.edubase + "/sta/ontology/Image"
			},
			types: config.edubase + "/sta/ontology/ImageAnnotation"
		};
		anniri = fotann.iri;
		// si ha seleccionado el tipo de foto...
		if (tppiri !== "") 
			fotann.image.plantPart = tppiri;
		// preparo el path adecuado en el array de fotos
		const fotpath =  Datos.educatrees[iri].imageAnnotations? "/imageAnnotations/-" : "/imageAnnotations";		
		patch.push(	{ op: "add", path: fotpath, value: fotann } );
		// reajusto clones
		tobjclon.imageAnnotations = !(Datos.educatrees[iri].imageAnnotations)? fotann : Array.isArray(Datos.educatrees[iri].imageAnnotations)?
			[fotann, ...tobjclon.imageAnnotations] : [ fotann, Datos.educatrees[iri].imageAnnotations ];
		if (bobjclon) {
			bobjclon.images = !(Datos.educatrees[iri].images)? imgDownloadURL : Array.isArray(Datos.educatrees[iri].images)?
				[imgDownloadURL, ...bobjclon.images] : [ imgDownloadURL, bobjclon.images ];		
		}
	}
	else if ($('#treeHeight').length) { 
		tipoann = 'height_annotation';
		//console.log("Anotación de altura");
		const alt = Number($('#treeHeight').val());
		const altann = {
			iri: config.edubase + "/heightann/" + annid,
			creator: creador,
			created: ahora,
 			meters: alt,
			types: config.edubase + "/sta/ontology/HeightAnnotation"
		};
		anniri = altann.iri;
		// preparo patch con la nueva anotación de altura
		const oper = Datos.educatrees[iri].height? "replace" : "add";
		patch.push(	{ op: oper, path: "/height", value: altann }	);
		// preparo el path adecuado en el array de taxones
		const altpath =  Datos.educatrees[iri].heightAnnotations? "/heightAnnotations/-" : "/heightAnnotations";		
		patch.push(	{ op: "add", path: altpath, value: altann.iri } );
		// reajusto clones
		tobjclon.height = altann;
		tobjclon.heightAnnotations = !(Datos.educatrees[iri].heightAnnotations)? altann : Array.isArray(Datos.educatrees[iri].heightAnnotations)?
			[altann, ...tobjclon.heightAnnotations] : [ altann, Datos.educatrees[iri].heightAnnotations ];
		if (bobjclon) 
			bobjclon.height = alt;
	}
	else if ($('#treeDiameter').length) { 
		tipoann = 'diameter_annotation';
		//console.log("Anotación de diámetro");
		let diam = Number($('#treeDiameter').val());
		// reajuste por el modo perímetro
		if ($("#checkPerimeter").prop("checked"))
			diam = Number((diam / Math.PI).toFixed(0));
		const diann = {
			iri: config.edubase + "/diamann/" + annid,
			creator: creador,
			created: ahora,
 			millimeters: diam,
			types: config.edubase + "/sta/ontology/DiameterAnnotation"
		};
		anniri = diann.iri;
		// preparo patch con la nueva anotación de diámetro
		const oper = Datos.educatrees[iri].diameter? "replace" : "add";
		patch.push(	{ op: oper, path: "/diameter", value: diann }	);
		// preparo el path adecuado en el array de diámetros
		const dipath =  Datos.educatrees[iri].diameterAnnotations? "/diameterAnnotations/-" : "/diameterAnnotations";		
		patch.push(	{ op: "add", path: dipath, value: diann.iri } );
		// reajusto clones
		tobjclon.diameter = diann;
		tobjclon.diameterAnnotations = !(Datos.educatrees[iri].diameterAnnotations)? diann : Array.isArray(Datos.educatrees[iri].diameterAnnotations)?
			[diann, ...tobjclon.diameterAnnotations] : [ diann, Datos.educatrees[iri].diameterAnnotations ];
		if (bobjclon) 
			bobjclon.dbh = diam;
	}
	else if ($('#observation').length) { 
		tipoann = 'observation_annotation';
		//console.log("Anotación de altura");
		const obs = $('#observation').val();
		const obsann = {
			iri: config.edubase + "/observann/" + annid,
			creator: creador,
			created: ahora,
 			text: { [getPreferredLang()] : obs },
			types: config.edubase + "/sta/ontology/ObservationAnnotation"
		};
		anniri = obsann.iri;
		// preparo el path adecuado en el array de observaciones
		const obspath =  Datos.educatrees[iri].observations? "/observations/-" : "/observations";		
		patch.push(	{ op: "add", path: obspath, value: obsann } );
		// reajusto clones
		tobjclon.observations = !(Datos.educatrees[iri].observations)? obsann : Array.isArray(Datos.educatrees[iri].observations)?
			[obsann, ...tobjclon.observations] : [ obsann, Datos.educatrees[iri].observations ];
		if (bobjclon) {
			bobjclon.observations = !(Datos.educatrees[iri].observations)? { [getPreferredLang()] : obs } : Array.isArray(Datos.educatrees[iri].observations)?
				[{ [getPreferredLang()] : obs }, ...bobjclon.observations] : [{ [getPreferredLang()] : obs }, bobjclon.observations];
		}		
	}
	else 
		return; // no debería llegar aquí, pero por si acaso
	
	//console.log(patch);
	
    // inicializo evento de creación de anotación a GA
	initTimedEvent( { content_type: tipoann, content_id: anniri, tree_id: iri,
		 uid: Sesion.usuario.uid, crafts_reqs: 0 });
	
	// hago la llamada para procesar el patch
	try {
		// pongo spinner (porque aquí hay que esperar y en el resto de casos no)
		configurarModal( { static: true, vertcent: true, spinner: true, 
			spinnerMessage: getLiteral(dict.pleasewait), nofooter: true },
			getLiteral(dict.creatingannotation), null, null);	
		await annotateEducatree(iri, patch, tobjclon, bobjclon);
		// envío datos creación de anotación a GA
		sendTimedEvent("create_content");
		console.info("Anotación creada con IRI: " + anniri); // log
	} catch(err) {
		console.error(err.message);
		// actualizo modal
		const be = "<code>" + err.message + "<br>" + JSON.stringify(err.error) + "</code>";		
		configurarModal( { static: true, vertcent: true, }, 
			getLiteral(dict.treeannotationerror), be, footers.anotacionError);		
		return; // terminamos
	}	
		
	// ajustes finales footer
	// /app/images/treeAnnotation.png
	const htmlbody = '<img id="imgTreeAnnotation" src="" class="d-block w-100">';
	configurarModal( { static: true, vertcent: true}, 
		getLiteral(dict.treeannotationsuccess), htmlbody, footers.anotacionExito);
	$("#imgTreeAnnotation").attr("src", new URL('../images/treeAnnotation.png', import.meta.url));
	$("#botAnotacionExito").click(renderEducatree);
}


///////////////////////
// BORRADO ANOTACIONES
function handlerDeleteAnnotation() {
	// recupero iri del árbol
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	const edutree = Datos.educatrees[iri];
	// recupero iri de la anotación
	const anniri = $(this).attr('iri');
	//console.log(anniri);
	if (!anniri)
		return; // no debería llegar aquí, pero por si acaso
		
	// inicializo tipo de anotación para el evento a GA
	let tipoann = null;
	
	// preparo clones
	const tobjclon = JSON.parse(JSON.stringify(edutree));
	const bobjclon = Datos.arboles[iri]? JSON.parse(JSON.stringify( Datos.arboles[iri] )) : null; // puede no existir	
	// inicializo patch
	const patch = [];
	// inicializo objetos a borrar para el dataManager 
	// (siempre 1, salvo en el caso de la foto en la que son 2)
	const objsborrar = [];
	// inicializo path de firebase a borrar para el caso de una imagen
	let pathFirebaseBorrar = null;
	// preparo patch y ajusto clones por tipo de anotación a borrar
	if ($(this).hasClass('position')) {
		tipoann = 'position_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'PositionAnnotation' } );
		// llamada para preparar patch y ajustar tobjclon
		ajustarPatchClonBorradoAnotacion(edutree, "position", "positionAnnotations", anniri, patch, tobjclon);
		// reajuste clon básico
		if (bobjclon) {
			if (tobjclon.position) {
				bobjclon.lat = tobjclon.position.latWGS84;
				bobjclon.lng = tobjclon.position.lngWGS84;			
			}
			else {
				delete bobjclon.lat;
				delete bobjclon.lng;			
			}
		}
	}
	else if ($(this).hasClass('treeTaxon')) {
		tipoann = 'taxon_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'SpeciesAnnotation' } );
		// llamada para preparar patch y ajustar tobjclon
		ajustarPatchClonBorradoAnotacion(edutree, "species", "speciesAnnotations", anniri, patch, tobjclon);	
		// reajuste clon básico
		if (bobjclon) {
			if (tobjclon.species)
				bobjclon.species = tobjclon.species.species.iri;
			else 
				delete bobjclon.species;
		}
	}
	else if ($(this).hasClass('treeStatus')) {
		tipoann = 'status_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'TreeStatusAnnotation' } );
		// llamada para preparar patch y ajustar tobjclon
		ajustarPatchClonBorradoAnotacion(edutree, "treeStatus", "treeStatusAnnotations", anniri, patch, tobjclon);	
		// reajuste clon básico
		if (bobjclon) {
			if (tobjclon.treeStatus) 
				bobjclon.treeStatus = tobjclon.treeStatus.treeStatus;	
			else 
				delete bobjclon.treeStatus;
		}
	}
	else if ($(this).hasClass('photo')) {
		tipoann = 'photo_annotation';
		// caso especial
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'ImageAnnotation' } );
		// analizo anotaciones
		if (edutree.imageAnnotations) {
			let imageURL = null; // localizo para borrar en bobjclon
			// si es un array...
			if (Array.isArray(edutree.imageAnnotations)) {
				// localizo índice anotación
				const indice = _.findIndex(edutree.imageAnnotations, { iri: anniri	});
				if (indice != -1) {
					// marco para borrar
					patch.push(	{ op: "remove", path: "/imageAnnotations/" + indice } );
					// localizo también la imagen a borrar
					if (edutree.imageAnnotations[indice].image) {
						objsborrar.push( { iri: edutree.imageAnnotations[indice].image.iri, id: 'Image' } );
						imageURL = edutree.imageAnnotations[indice].image.imageURL;
						// extraigo pathFirebaseBorrar
						if (edutree.imageAnnotations[indice].image.firebasePath)
							pathFirebaseBorrar = getLiteral(edutree.imageAnnotations[indice].image.firebasePath);					
					}
					// borro del clon
					tobjclon.imageAnnotations.splice(indice, 1);					
				}
			}
			else { // si es un objeto...
				if (edutree.imageAnnotations.iri === anniri) {
					// marco para borrar
					patch.push(	{ op: "remove", path: "/imageAnnotations" } );
					// localizo también la imagen a borrar
					if (edutree.imageAnnotations.image) {
						objsborrar.push( { iri: edutree.imageAnnotations.image.iri, id: 'Image' } );
						imageURL = edutree.imageAnnotations.image.imageURL;
						// extraigo pathFirebaseBorrar
						if (edutree.imageAnnotations.image.firebasePath)
							pathFirebaseBorrar = getLiteral(edutree.imageAnnotations.image.firebasePath);
					}
					// borro del clon
					delete tobjclon.imageAnnotations;
				}
			}
			// reajuste clon básico
			if (imageURL && bobjclon && bobjclon.images) {
				// si es un array...
				if (Array.isArray(bobjclon.images))
					bobjclon.images = _.without(bobjclon.images, imageURL);
				else if (bobjclon.images === imageURL)
					delete bobjclon.images;
			}
		}
	}
	else if ($(this).hasClass('height')) {
		tipoann = 'height_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'HeightAnnotation' } );
		// llamada para preparar patch y ajustar tobjclon
		ajustarPatchClonBorradoAnotacion(edutree, "height", "heightAnnotations", anniri, patch, tobjclon);	
		// reajuste clon básico
		if (bobjclon) {
			if (tobjclon.height)
				bobjclon.height = tobjclon.height.meters;
			else 
				delete bobjclon.height;
		}
	}
	else if ($(this).hasClass('diameter')) {
		tipoann = 'diameter_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'DiameterAnnotation' } );
		// llamada para preparar patch y ajustar tobjclon
		ajustarPatchClonBorradoAnotacion(edutree, "diameter", "diameterAnnotations", anniri, patch, tobjclon);	
		// reajuste clon básico
		if (bobjclon) {
			if (tobjclon.diameter)
				bobjclon.dbh = tobjclon.diameter.millimeters;
			else 
				delete bobjclon.dbh;
		}
	} 
	else if ($(this).hasClass('observation')) {
		tipoann = 'observation_annotation';
		// incluyo la anotación a borrar
		objsborrar.push( { iri: anniri, id: 'ObservationAnnotation' } );
		// analizo anotaciones
		if (edutree.observations) {
			// si es un array...
			if (Array.isArray(edutree.observations)) {
				// localizo índice anotación
				const indice = _.findIndex(edutree.observations, { iri: anniri	});
				if (indice != -1) {
					// marco para borrar
					patch.push(	{ op: "remove", path: "/observations/" + indice } );
					// borro del clon
					tobjclon.observations.splice(indice, 1);
					// compruebo si hay que borrar el array del clon por estar vacío
					if (tobjclon.observations.length == 0)
						delete tobjclon.observations;
				}
			}
			else { // si es un objeto...
				if (edutree.observations.iri === anniri) {
					// marco para borrar
					patch.push(	{ op: "remove", path: "/observations" } );
					// borro del clon
					delete tobjclon.observations;
				}
			}
		}
		// reajuste clon básico
		if (bobjclon) {			
			delete bobjclon.observations;
			// genero a partir de las observaciones de tobjclon
			if (tobjclon.observations) {
				bobjclon.observations = [];
				for (let obs of tobjclon.observations)
					bobjclon.observations.push(obs.text);
			}
		}
	}
	else 
		return; // no debería llegar aquí, pero por si acaso
	
	// inicialización modal con petición de confirmación
	configurarModal( { static: true, vertcent: true}, 
		getLiteral(dict.deleteAnnotation), getLiteral(dict.deleteAnnotationInfo), footers.confirmarBorradoAnotacion);		
	// muestro el modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	
	// handler de borrado de anotación
	$("#botonBorradoAnotacion").click(async function() {
		//console.log("Borrando anotación " +anniri+ " del árbol " + iri);		
		//console.log(patch);
	    // inicializo evento de borrado de anotación a GA
		initTimedEvent( { content_type: tipoann, content_id: anniri, tree_id: iri,
			 uid: Sesion.usuario.uid, crafts_reqs: 0 });
		// hago la llamada para borrar la anotación
		try {
			// pongo spinner (porque aquí hay que esperar y en el resto de casos no)
			configurarModal( { static: true, vertcent: true, spinner: true, 
				spinnerMessage: getLiteral(dict.pleasewait), nofooter: true },
				getLiteral(dict.deletingAnnotation), null, null);	
			await deleteAnnotationEducatree(iri, patch, objsborrar, tobjclon, bobjclon);
			// envío datos borrado de anotación a GA
			sendTimedEvent("delete_content");
			console.info("Anotación borrada con IRI: " + anniri); // log
		} catch(err) {
			console.error(err.message);
			// actualizo modal
			const be = "<code>" + err.message + "\n" + JSON.stringify(err.error) + "</code>";		
			configurarModal( { static: true, vertcent: true, }, 
				getLiteral(dict.treeannotationerror), be, footers.anotacionError);		
			return; // terminamos
		}		
		// si hay que borrar la imagen en Firebase...
		if (pathFirebaseBorrar) {
			const storage = getStorage(getFirebaseApp());
			// Create a storage reference from our storage service
			//const storageRef = storage.ref();
			// ref a la imagen
			const imgRef = ref(storage, pathFirebaseBorrar);
			// borro foto del árbol
			try {
				// compruebo primero que exista
				const imgDownloadURL = await getDownloadURL(imgRef);
				//console.log('File exists at: ' + imgDownloadURL);
				// ahora borro
				// cuidado con las reglas de seguridad de Firebase storage
				// para el borrado simplemente pongo que sea un usuario autenticado
				// para permitir así que un usuario de tipo máster pueda borrar fotos
				// creadas por otros usuarios
				await deleteObject(imgRef);
				// mando evento de borrado de foto en firebase a GA
				sendEvent( "delete_content", { content_type: 'photo', content_id: imgDownloadURL, uid: Sesion.usuario.uid } );
				console.info("Foto borrada de Firebase: " + imgDownloadURL);
			} catch(error) {
				if (error.code === 'storage/object-not-found') // este error se enmascara
					console.error('File does not exist.');
				else { // éste no, aquí avisamos al usuario y dejamos de borrar
					console.error('Error: ' + error.message);
					// ajustes finales modal
					const be = "<code>" + error + "</code>";		
					configurarModal( { static: true, vertcent: true, }, 
						getLiteral(dict.deletingphotoerror), be, footers.anotacionExito);
					// pongo el footer de anotación de éxito porque así ha sido, sólo ha fallado el borrado de la foto						
					return; // terminamos
				}
			}			
		}		
		// ajustes finales footer
		// /app/images/treeAnnotationRemoval.png
		const htmlbody = '<img id="imgTreeAnnotationRemoval" src="" class="d-block w-100">';
		configurarModal( { static: true, vertcent: true}, 
			getLiteral(dict.deleteAnnotationSuccess), htmlbody, footers.anotacionExito);		
		$("#imgTreeAnnotationRemoval").attr("src", new URL('../images/treeAnnotationRemoval.png', import.meta.url));
		// y al cerrar renderizamos de nuevo...
		$("#botAnotacionExito").click(renderEducatree);
	});
}
function ajustarPatchClonBorradoAnotacion(edutree, annprim, anotaciones, anniri, patch, tobjclon) {
	// preinicializo posición de reemplazo 
	let reemplazo = null;
	// analizo anotaciones
	if (edutree[anotaciones]) {		
		// si es un array...
		if (Array.isArray(edutree[anotaciones])) {
			// localizo índice anotación
			const indice = _.findIndex(edutree[anotaciones], {
				iri: anniri
			});
			if (indice != -1) {
				// marco para borrar
				patch.push(	{ op: "remove", path: "/" + anotaciones + "/" + indice } );
				// borro del clon
				tobjclon[anotaciones].splice(indice, 1);
			}
			// obtengo reemplazo (si lo hay)
			if (tobjclon[anotaciones].length > 0)
				reemplazo = _.sortBy(tobjclon[anotaciones], 
					function(obj) { return new Date(obj.created); }).reverse()[0];
			// compruebo si hay que borrar el array del clon por estar vacío
			// (importante para preparar bien los patches, ya que es diferente asignar un valor, 
			// ej. "/speciesAnnotations" que meter al final de un array existente, ej. "/speciesAnnotations/-")
			if (tobjclon[anotaciones].length == 0)
				delete tobjclon[anotaciones];
		}
		else { // si es un objeto...
			if (edutree[anotaciones] && 
					edutree[anotaciones].iri === anniri) {
				// marco para borrar
				patch.push(	{ op: "remove", path: "/" + anotaciones } );
				// borro del clon
				delete tobjclon[anotaciones];
			}
		}
	}
	// analizo la anotación primaria
	if (edutree[annprim] && edutree[annprim].iri === anniri) {
		if (reemplazo) {
			// marco para reemplazar
			patch.push(	{ op: "replace", path: "/" + annprim, value: reemplazo.iri } );
			// reemplazo en el clon
			tobjclon[annprim] = reemplazo;
		}
		else {
			// marco para borrar
			patch.push(	{ op: "remove", path: "/" + annprim } );
			// borro en el clon
			delete tobjclon[annprim];
		}
	}
}



///////////////////////
// BORRADO ÁRBOL
function handlerDeleteEducatree() {
	// preparo contenido modal
	let tit = getLiteral(dict.deleteTree);				
	let body = getLiteral(dict.deleteTreeInfo);
	configurarModal( { vertcent: true, static: true},
		tit, body, footers.confirmarBorradoArbol);
	// muestro modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));	
	mimodal.show();
	// handler procesarBorradoArbol
	$("#procesarBorradoArbol").click(procesarBorradoArbol);
}
async function procesarBorradoArbol() {
	// recupero iri del árbol
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	
    // inicializo evento de borrado de árbol a GA
	initTimedEvent( { content_type: 'tree', content_id: iri, uid: Sesion.usuario.uid, crafts_reqs: 0 });
	
	// actualizo modal
	configurarModal( { vertcent: true, static: true, spinner: true, spinnerMessage: getLiteral(dict.pleasewait), nofooter: true},
		getLiteral(dict.deletingtree), null, null);	
	
	// cojo datos de las imágenes para borrar en Firebase, pero borro siempre antes el LOD
	// al ser strings sin etiqueta de idioma, los paths se guardan como objetos con clave "nolang"
	const pathsFirebaseBorrar = extractAllElements(Datos.educatrees[iri], ["imageAnnotations", "image", "firebasePath"]);
		
	// hago la petición para borrar el árbol
	try {
		await deleteEducatree(iri); // aquí se hace el borrado y la sincronización con el mapa si tiene éxito
		// envío datos borrado del árbol a GA
		sendTimedEvent("delete_content");
		console.info("Árbol borrado con IRI: " + iri); // log
	} catch(err) {
		console.error(err.message);
		// actualizo modal
		const be = "<code>" + err.message + "\n" + JSON.stringify(err.error) + "</code>";		
		configurarModal( { static: true, vertcent: true, }, 
			getLiteral(dict.treedeletionerror), be, footers.borradoArbolError);
		$(".goBack").click(goBack);
		return; // terminamos
	}
	
	// borro las imágenes que haya en Firebase
	if (pathsFirebaseBorrar.length > 0) {
		const storage = getStorage(getFirebaseApp());
		// Create a storage reference from our storage service
		//const storageRef = storage.ref();
		// voy imagen por imagen
		for (const pathobj of pathsFirebaseBorrar) {
			const path = getLiteral(pathobj);
			const imgRef = ref(storage, path);
			// borro foto del árbol
			try {
				// compruebo primero que exista
				const imgDownloadURL = await getDownloadURL(imgRef);
				//console.log('File exists at: ' + imgDownloadURL);
				// ahora borro
				// cuidado con las reglas de seguridad de Firebase storage
				// para el borrado simplemente pongo que sea un usuario autenticado
				// para permitir así que un usuario de tipo máster pueda borrar fotos
				// creadas por otros usuarios
				await deleteObject(imgRef);
				// mando evento de borrado de foto en firebase a GA
				sendEvent( "delete_content", { content_type: 'photo', content_id: imgDownloadURL, uid: Sesion.usuario.uid } );
				console.info("Foto borrada de Firebase: " + imgDownloadURL);
			} catch(error) {
				if (error.code === 'storage/object-not-found') // este error se enmascara
					console.error('File does not exist.');
				else { // éste no, aquí avisamos al usuario y dejamos de borrar
					console.error('Error: ' + error.message);
					// ajustes finales modal
					const be = "<code>" + error + "</code>";		
					configurarModal( { static: true, vertcent: true, }, 
						getLiteral(dict.deletingphotoerror), be, footers.borradoArbolExito);
					$(".goBack").click(goBack);
					// pongo el footer de borrado de éxito porque así ha sido, sólo ha fallado el borrado de la foto						
					return; // terminamos
				}
			}
		}
	}
	
	// ajustes finales modal
	configurarModal( { static: true, vertcent: true}, 
		getLiteral(dict.treedeletionsuccess), treeDeletionBody, footers.borradoArbolExito);
	$("#imgTreeDeletion").attr("src", new URL('../images/treeDeletion.png', import.meta.url));
	$(".goBack").click(goBack);
}


function educatreeNoExiste() {
	// pongo página en blanco
	$("#miarbol").html("");	
	// pongo un modal para avisar de que no se puede explorar el inventario
	const body = getLiteral(dict.errorEducatreeText) + ' "' + Sesion.estado.etid + '".';
	configurarModal( { vertcent: true, nofooter: true},
		getLiteral(dict.errorEducatreeTitle), body, null);	
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	// handler al esconderse
	document.getElementById('mimodal').addEventListener('hidden.bs.modal', event => {
		// voy para atrás
  		goBack();  		
	}, { 'once': true });
}


function changeTreeNick() {
	const iri = config.edubase + "/tree/" + Sesion.estado.etid;
	// preparo contenido modal
	let tit = getLiteral(dict.newTreeNick);
	configurarModal( { vertcent: true, static: true},
		tit, changeTreeNickTemplateBody, footers.cambiarNick);
	// muestro modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));	
	mimodal.show();
	// listener de cambio de nick del árbol
	$("#newTreeNick").change(function() {
		const newtreenick = $('#newTreeNick').val();
		// preinicializo
		$("#statusNick").removeClass("d-none")
		$("#botonCambioNick").prop("disabled", true);
		if (!newtreenick) {
			//console.log("No hay nada");
			$("#statusNick").text(getLiteral(dict.noNick));
		}
		else if (newtreenick.length < 3 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickTooshort));
		}
		else if (newtreenick.length > 30 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickToolong));
		}	
		else {
			//console.log("Todo OK");
			$("#statusNick").addClass("d-none")
			$("#botonCambioNick").prop("disabled", false);
		}
	});
	// listener del botón de cambio de nick
	$("#botonCambioNick").click(async function() {
		// desabilito la entrada y quito el footer
		$("#newTreeNick").prop("disabled", true);
		configurarModal( { vertcent: true, static: true, nofooter: true},
			null, null, null);
		// recupero el nick
		const newtreenick = $('#newTreeNick').val();
		
		// inicializo evento nuevo nick a GA
		initTimedEvent( { value: newtreenick, crafts_reqs: 0 });
		// vamos con el cambio
		try {
			// preparo patch con el cambio de nick
			const patch = [];
			const oper = Datos.educatrees[iri].nick? "replace" : "add";
			patch.push(	{ op: oper, path: "/nick", value: newtreenick }	);
			//console.log(patch);
			await setTreeNick(iri, patch);
			// envío evento nuevo nick a GA
			sendTimedEvent('new_nick');
			console.info("Nick del árbol cambiado: " + newtreenick);
		} catch(err) {
			console.error(err.message);
			// actualizo modal
			const be = "<code>" + err.message + "\n" + JSON.stringify(err.error) + "</code>";		
			configurarModal( { static: true, vertcent: true, }, 
				getLiteral(dict.changeTreeNickFailure), be, footers.anotacionError);
			return; // terminamos
		}
		// modal de éxito
		// escondo campos y muestro imagen
		$("#newTreeNick").addClass("d-none");
		$("#statusNick").addClass("d-none");
		$("#imgNewTreeNick").attr("src", new URL('../images/newNick.png', import.meta.url));
		$("#imgNewTreeNick").removeClass("d-none");
		//const htmlbody = '<img src="/app/images/newNick.png" class="d-block w-100">';
		configurarModal( { vertcent: true, static: true},
			getLiteral(dict.changeTreeNickSuccess), null, footers.treeNickCambiado);
		// listener cierre modal
		document.getElementById('mimodal').addEventListener('hidden.bs.modal', event => {
			renderEducatree();
		}, { once: true });
	});	
}

export { Minimapa, verEducatree, renderEducatree, procesarAnotacion };
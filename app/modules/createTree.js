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
import { createEducatreeForm, treeStatusTemplate, treePartsPhotoTemplate, footers } from '../data/htmlTemplates.js';

import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import $ from "jquery";
import Mustache from 'mustache';
import _ from 'underscore';
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import L from 'leaflet';

import { Sesion, Datos, Layers, Mimapa, Mitilelayer, obtenerURL, cargarURL, goBack } from '../main.js';
import { getGrid, getCeldaBounds } from './grid.js';
import { processTreesCell, createEducatree } from './dataManager.js';
import { obtenerConfigMapa, ponerCiclosAntimeridiano, quitarCiclosAntimeridiano } from './map.js';
import { cargarBotonesMinimapa } from './mapControls.js';
import { handlerNombreCientifico, handlerSetTreeTaxonEd, handlerDeleteTreeTaxonEd } from './taxons.js';
import { getLiteral, loc2string, getPosition, generateId, configurarModal, getPreferredLang } from './util.js';
import { tooltipArbol, ajustarCursorClickCluster, ajustarCursorPopupArbol } from './trees.js';
import { getFirebaseApp,  clickViewprofile, clickSignin, clickSignout } from './users.js';
import { getIconoArbol, getIconoDiana } from './icons.js';
import { initTimedEvent, sendTimedEvent, sendEvent } from'./events.js';

/////////////////////// 
// BOTÓN DE CREAR ÁRBOL
///////////////////////

let Minimapa, Minitilelayer;

// función clave para comprobar si se habilita el botón (si hay usuario logueado y suficiente zoom)
// y para hacer los ajustes en la vista del mapa
function renderAjustesCreacionArbolMapa(huboclick) {
	// 1) inicializo hayajuste a si hubo click en el botón (o undefined en caso contrario)
	let hayajuste = huboclick;
	// 2) detecto si hay que mostrar el botón de crear árbol o no
	const hayboton = (Sesion.usuario && Mimapa.getZoom() >= config.zCreacion);
	if (hayboton)
		$(".createtree").removeClass("disabled");//.removeClass("d-none");
	else
		$(".createtree").addClass("disabled");//.addClass("d-none");
	// 3) si no hay botón y está en modo creando árbol, hay que cambiar de estado y hacer ajuste
	if (!hayboton && Sesion.creandoArbol) {
		Sesion.creandoArbol = false;
		hayajuste = true;
	}
	// 4) hago los ajustes si es necesario
	if (hayajuste) {
		// ajusto popups, tooltips y cursor en árboles pintados (autoajustado con Sesion.creandoArbol)
		for (const auri in Sesion.arbsPintados)
			ajustarCursorPopupArbol(auri);
		
		// ajusto handler click, tooltips y cursor en clusters
		Layers.clarbs.eachLayer(function (cpint) {
			ajustarCursorClickCluster(cpint);
		});
	
		// si estamos en modo creación de árbol...
		if (Sesion.creandoArbol) {
			// estilo botón en modo edición	
			$(".createtree").attr("style", "background-color: #6c757d;");
			$(".createtree span").attr("style", "color: white;");
	
			// estilo cursor creación árbol en mapa
			Mimapa.getContainer().style.cursor = "crosshair";
		
			// pongo listener para capturar la posición y abrir una pantalla de creación de Educatree
			Mimapa.on('click', onTreeCreationClick);
		}
		else { // si ya no estamos en modo creación de árbol...	
			// estilo botón normal
			$(".createtree").removeAttr("style");
			$(".createtree span").removeAttr("style");
	
			// estilo cursor normal
			Mimapa.getContainer().style.cursor = "";
	
			// quito listener onTreeCreationClick
			Mimapa.off('click', onTreeCreationClick);
		}	
	}
}


//////////////////////////
// PANTALLA CREACIÓN ÁRBOL
//////////////////////////
function onTreeCreationClick(e) {	
	// detecto si el click se hace en un control del mapa
	const target = e.originalEvent.target;
	const escontrol = L.DomUtil.hasClass(target, 'leaflet-control') ||  target.closest('.leaflet-control') !== null;
	// en tal caso, no hago nada
	if (escontrol)
	    return;	
	
	// The event object (e) contains information about the clicked location
	//console.warn('Clicked at ' + e.latlng);
   	   	
   	// desactivo modo edición en el mapa
   	Sesion.creandoArbol = false;
	// llamo a renderAjustesCreacionArbolMapa para actualizar vista mapa grande
	renderAjustesCreacionArbolMapa(true);   	
   	
	// actualizo estado con la posición y el path de creación de educatree
	Sesion.estado.loc.lat = e.latlng.lat;
	Sesion.estado.loc.lng = e.latlng.lng;
	Sesion.estado.loc.z = Mimapa.getZoom();		
	Sesion.estado.path = "newtree";
   	
	// reajusto url y creo nueva página en la historia
	history.pushState(Sesion.estado, "", obtenerURL());
	Sesion.npags++; // una página más
	
	// cargoURL => me llevará a iniciarCreacionArbol
	cargarURL();
}
function iniciarCreacionArbol() {
	// cambio el zoom a 20 y reajusto la URL
	Sesion.estado.loc.z = config.zMiniMapa;
	history.replaceState(Sesion.estado, "", obtenerURL());
	// mando evento de creando árbol a GA
	sendEvent( 'select_content', { content_type: 'create_tree_form', content_id: loc2string(Sesion.estado.loc) } );	
	console.info("Creando árbol en posición: " + loc2string(Sesion.estado.loc) );	
	// llamo al render
	renderFormularioCreacionArbol();	
}
async function renderFormularioCreacionArbol() {
	// 1) cargo formulario y realizo ajustes
	// preparo objeto plantilla
	const ocat = {
		usuario: Sesion.usuario != undefined, // para mostrar botón de signin o avatar
		usuarioImg: Sesion.usuario? Sesion.usuario.photoURL : null, // foto para el avatar
		esMovil: L.Browser.mobile, // para mostrar o no el botón de la cámara
		camera: localStorage.getItem('camera') === "false"? false : true // por defecto true
	};
	const htmlcontent = Mustache.render(createEducatreeForm, ocat);
	$("#miarbol").html(htmlcontent);
	
	// pongo listeners a clickViewprofile, clickSignin y clickSignout
	$(".userprofile").click(clickViewprofile);
	$(".usersignin").click(clickSignin);
	$(".usersignout").click(clickSignout);
	// ajusto crchecknomci 
	$("#crchecknomci").prop('checked', Sesion.nomci);
	$("#crchecknomci").change(handlerNombreCientifico);
	// pongo etiqueta de posición
	$("#inputPosition").val(getPosition( {latWGS84: Sesion.estado.loc.lat, lngWGS84: quitarCiclosAntimeridiano(Sesion.estado.loc.lng)} ));
	// listener info de estado árbol
	$("#botTreeStatusInfo").click(handlerTreeStatusInfo);
	// cambio de diámetro a perímetro
	$("#checkPerimeter").change(handlerDiameterPerimeter);	
	// cambio de modo a cámara (sólo valdrá para móvil)
	$("#checkCamera").change(handlerCamera);
	
	// quito el envío preventivo del formulario
	// esto es para evitar que envíe el formulario,
	// afecta al navegar por las sugerencias de taxones
	$("#createTreeForm").on('keypress', function(event) {
        if (event.keyCode == 13) {
            event.preventDefault();
        }
    });
    
    // listener de cambio de nick
	$("#inputTreeNick").change(function() {
		const treenick = $('#inputTreeNick').val();
		// preinicializo
		$("#statusNick").removeClass("d-none")
		if (!treenick) {
			//console.log("No hay nada");
			$("#statusNick").text(getLiteral(dict.noNick));
		}
		else if (treenick.length < 3 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickTooshort));
		}
		else if (treenick.length > 30 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickToolong));
		}	
		else {
			//console.log("Todo OK");
			$("#statusNick").addClass("d-none")
		}
	});
	
	// listeners taxón
	$("#setTreeTaxonEd").click(handlerSetTreeTaxonEd);
	$("#deleteTreeTaxon").click(handlerDeleteTreeTaxonEd);
    
	// cargo tipos de estado del árbol en #selectTreeStatus
	let testarb = [];
	for (const el of config.estadoArboles) {
		testarb.push( {"iri": el.iri, "label": getLiteral(el.label), "pref": el.pref} );
	}
	const htmltest = Mustache.render(treeStatusTemplate, testarb);
	$("#selectTreeStatus").html(htmltest);
	
    // listener de la foto => compresión en #resizedTreePhoto y muestro thumbnail
	$("#treePhoto").change(handlerTreePhotoChange);	
	// listener borrar foto (antes de subir a Firebase)
	$("#deleteTreePhoto").click(handlerDeleteTreePhoto);
	// cargo partes de árboles fotos en #selectTreePartPhoto
	let parbfotos = [];
	for (const paf in Datos.partesPlantasFoto) {
		parbfotos.push( {"uri": paf, "label": getLiteral(Datos.partesPlantasFoto[paf].label)} );
	}
	const htmlpaf = Mustache.render(treePartsPhotoTemplate, parbfotos);
	$("#selectTreePartPhoto").html(htmlpaf);
		
	// botones finales
	// pongo listener del botón de crear árbol
	$("#createTreeButton").on("click", handlerCreateTree);
	// pongo listener del botón de volver
	$("#goBackButton").on("click", goBack);
	
	// 2) cargo mapa
	// preparo primero los bounds para que no se vaya a Cuenca
	const offset = 0.0004; // 1km es aproximadamente 0,008 grados en WGS84
	const bounds = L.latLngBounds(
		L.latLng(Sesion.estado.loc.lat - offset, Sesion.estado.loc.lng - 3*offset), //southWest
		L.latLng(Sesion.estado.loc.lat + offset, Sesion.estado.loc.lng + 3*offset)); //northEast	
	// meto tap: false, que parece es una fuente de problemas
	// meto scrollWheelZoom: 'center' para que no dé saltos raros la diana al cambiar el zoom
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
	// cargo botón esri
	cargarBotonesMinimapa(Minimapa, [Minimapa, Mimapa], [Minitilelayer, Mitilelayer]);

	// 3) pido ifntrees y edutrees del mapa y pinto
	await procesarTreesMinimapa(Minimapa, bounds);
	
	// 4) al acabar quito el overlay con el que escondía el mapa, pongo la pista y habilito el dragging
	$("#overlay").addClass('d-none');
	$("#mapclue").removeClass('d-none');
	Minimapa.dragging.enable();
		
	// 5) pinto marcador de diana
	const diana = L.marker([Sesion.estado.loc.lat, Sesion.estado.loc.lng], 
			{icon: getIconoDiana(), zIndexOffset: 100})
		.addTo(Minimapa);
	
	// 6) detecto eventos "move" y ajusto la diana	
	Minimapa.on('move', function(event) {
	 	const center = Minimapa.getCenter();  // Get the new center position of the map
	  	diana.setLatLng(center);  // Set the marker position to the new center
	});
	// como hay muchos eventos 'move', actualizo cosas sólo con 'moveend'
	Minimapa.on('moveend', function(event) {
	 	const center = Minimapa.getCenter();  // Get the new center position of the map
	  	diana.setLatLng(center);  // Set the marker position to the new center
	  	// ajusto localización en el estado de la sesión
		Sesion.estado.loc.lat = center.lat;
		Sesion.estado.loc.lng = center.lng;
		Sesion.estado.loc.z = Minimapa.getZoom();
		// ajusto texto
		$("#inputPosition").val(getPosition( {latWGS84: Sesion.estado.loc.lat, lngWGS84: quitarCiclosAntimeridiano(Sesion.estado.loc.lng)} ));
		// reajusto también la URL
		history.replaceState(Sesion.estado, "", obtenerURL());
	});
}
function handlerTreePhotoChange() {
	// recupero fichero
	const file = $(this).prop('files')[0];
	//console.log(file);	
	if (file) {
		// muestro botón de borrar foto
		$("#deleteTreePhoto").removeClass("d-none");
		// preparo imagen a diferente resolución con thumbnail
		const image = new Image();
		image.onload = function() {
			// creo una imagen png de 400 píxeles de ancho, misma relación de aspecto y resolución 0.5 
			const aspectRatio = image.height / image.width;
			const canvas = $('<canvas>')[0];
			canvas.width = image.width < 400? image.width : 400;
			canvas.height = canvas.width * aspectRatio;
			const context = canvas.getContext('2d');
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			const dataUrl = canvas.toDataURL("image/png", 0.5);
			$("#resizedTreePhoto").val(dataUrl);  			
			// actualizo mensaje imagen
			$("#textTreePhoto").text(getLiteral(dict.photouploaded));
			// muestro #selectTreePartPhoto
			$("#selectTreePartPhoto").removeClass("d-none");
			// muestro thumbnail a partir de la imagen redimensionada creada
			$("#treeThumbnail").removeClass("d-none");
			$("#treeThumbnail").attr('src', dataUrl);      			
		};
		const reader = new FileReader();
		reader.onload = function(event) {
			image.src = event.target.result;
		};
		reader.readAsDataURL(file);
		
		// actualización estado anotación		
		$("#botcreatemodalannotation").prop("disabled", false);
	}
	else // creo que no hace falta, pero por si acaso
		handlerDeleteTreePhoto();
}
function handlerDeleteTreePhoto() {
	// elimino entrada foto
   	$("#treePhoto").val('');
   	// eliminado entrada foto redimensionada
   	$("#resizedTreePhoto").val('');   	
	// actualizo mensaje imagen y escondo thumbnail y selectTreePartPhoto
	$("#textTreePhoto").text(getLiteral(dict.nophoto));
	$("#treeThumbnail").addClass("d-none");   	
	$("#selectTreePartPhoto").addClass("d-none");
   	// escondo botón borrar foto
   	$("#deleteTreePhoto").addClass("d-none");
   	   	
   	// actualización estado anotación 
	$("#botcreatemodalannotation").prop("disabled", true);
}
// preparo contenido modal botón ayuda
function handlerTreeStatusInfo() {
	// preparo contenido modal
	let tit = getLiteral(dict.treeStatus);				
	//let hmtlcontent = '<img class="img-fluid" src="'+getLiteral(dict.treeStatusFile)+'">';	
	let hmtlcontent = '<img id="imgTreeStatusInfo" class="img-fluid" src="">';	
	configurarModal( { vertcent: true, nofooter: true }, 
		tit, hmtlcontent, null);
	// muestro modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	if (getPreferredLang() === "es")
		$("#imgTreeStatusInfo").attr("src", new URL('../images/treeStatus_es.png', import.meta.url));	
	else
		$("#imgTreeStatusInfo").attr("src", new URL('../images/treeStatus_en.png', import.meta.url));
}
// reajuste de diámetro a perímetro y viceversa
function handlerDiameterPerimeter() {
	// recupero el valor
	const valor = Number($('#treeDiameter').val());	
	// reajusto según el modo
	if ($("#checkPerimeter").prop("checked")) {
		//console.log("CAMBIO A PERÍMETRO");
		// cambio a perímetro
		$("#labelTreeDiameter").text(getLiteral(dict.perimetermm));
		$("#treeDiameter").prop('placeholder', getLiteral(dict.enterperimetermm));
		$("#treeDiameter").prop('max', (20000 * Math.PI).toFixed(0));
		if (valor)
			$("#treeDiameter").val((valor * Math.PI).toFixed(0));
	} else {
		//console.log("CAMBIO A DIÁMETRO");
		// cambio a diámetro
		$("#labelTreeDiameter").text(getLiteral(dict.diametermm));
		$("#treeDiameter").prop('placeholder', getLiteral(dict.enterdiametermm));
		$("#treeDiameter").prop('max', 20000);
		if (valor)
			$("#treeDiameter").val((valor / Math.PI).toFixed(0));
	}
}
// reajuste modo cámara
function handlerCamera() {
	// reajusto según el modo
	if ($("#checkCamera").prop("checked")) {
		// ajusto localStorage
		localStorage.setItem('camera', 'true');
		// atributo capture a "environment"
		$("#treePhoto").attr('capture', 'environment');
	} else {
		// ajusto localStorage
		localStorage.setItem('camera', 'false');
		// borro atributo capture
		$("#treePhoto").removeAttr('capture');
	}
}


/////////////////////////////
// CREO ÁRBOL CON LO QUE HAYA
/////////////////////////////
async function handlerCreateTree(e) {
	if (e != undefined) {
    	// Consume the click event
	    e.preventDefault(); // Prevents the default behavior of the click event
	    e.stopPropagation(); // Stops the propagation of the click event
    }
    
	// 1) pongo el modal: estático, con spinner y sin footer
	configurarModal( { static: true, vertcent: true, spinner: true, 
		spinnerMessage: getLiteral(dict.pleasewait), nofooter: true }, 
		getLiteral(dict.creatingtree), null, null);
	// muestro modal		
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));	
	mimodal.show();
	    
	// 2) genero un id de árbol => nanoid de 12 caracteres
	const etid = generateId(12);
	const ahora = new Date().toISOString();
	const creador = config.edubase + "/user/" + Sesion.usuario.uid;	// cojo el uid del usuario en firebase
	
    // inicializo evento de creación de árbol a GA
	initTimedEvent( { content_type: 'tree', content_id: config.edubase + "/tree/" + etid, 
		uid: Sesion.usuario.uid, crafts_reqs: 0 });
	
	// 3) si hay foto la guardo primero en Firebase
	const imgDataUrl = $("#resizedTreePhoto").val();
	let imgDownloadURL = null;
	let imgFirebasePath = null;
	if (imgDataUrl) {
		//console.log("hay imagen");
		// Get a reference to the storage service, which is used to create references in your storage bucket
		const storage = getStorage(getFirebaseApp());
		// Create a storage reference from our storage service
		//const storageRef = ref();
		// preparo referencia a imagen para guardar
		imgFirebasePath = 'images/'+ Sesion.usuario.uid + '/' + etid + '.png';
		const imgRef = ref(storage, imgFirebasePath);		
		// guardo foto del árbol
		try {
			//const snapshot = await imgRef.putString(imgDataUrl, 'data_url');			
			//imgDownloadURL = await snapshot.ref.getDownloadURL();
			const snapshot = await uploadString(imgRef, imgDataUrl, 'data_url');
			imgDownloadURL = await getDownloadURL(snapshot.ref);
			// mando evento de creación de foto en firebase a GA
			sendEvent( "create_content", { content_type: 'photo', content_id: imgDownloadURL, uid: Sesion.usuario.uid } );
			console.info("Foto subida a Firebase: " + imgDownloadURL);
		} catch(error) {
			console.error('Error: ' + error.message);
			const be = "<code>" + error + "</code>";		
			configurarModal( { static: true, vertcent: true, }, 
				getLiteral(dict.uploadingphotoerror), be, footers.creacionError);
			$(".goBack").click(goBack);
			return; // terminamos
		}
	}
	
	// 4) preparo objetos JSON con los datos del árbol a crear
	// tobj de tipo EducaTree y bobj de tipo BasicEducaTree (éste es para actualizar los datos guardados)
	// datos básicos y posición
	let tobj = {
		"iri": config.edubase + "/tree/" + etid,
		"creator": creador,
		"created": ahora,
		"position": {
			"iri": config.edubase + "/posann/" + etid,
			"creator": creador,
			"created": ahora,
			"latWGS84": Number(Sesion.estado.loc.lat),
 			"lngWGS84": quitarCiclosAntimeridiano(Number(Sesion.estado.loc.lng)),
			"types": config.edubase + "/sta/ontology/PositionAnnotation"
		},
		"positionAnnotations": config.edubase + "/posann/" + etid,
		"types": config.edubase + "/sta/ontology/Tree"
	};
	let bobj = {
		"iri": config.edubase + "/tree/" + etid,
		"creator": creador,
		"created": ahora,
		"lat": Number(Sesion.estado.loc.lat),
		"lng": quitarCiclosAntimeridiano(Number(Sesion.estado.loc.lng))
	};
	// nick
	const treenick = $('#inputTreeNick').val();
	if (treenick && treenick.length >= 3) {
		tobj.nick = treenick;
		bobj.nick = treenick;	
	}
	// taxón
	const turi = $("#inputTreeTaxonEd").attr("iri");
	if (turi != undefined) {
		tobj.species = {
			"iri": config.edubase + "/spann/" + etid,
			"creator": creador,
			"created": ahora,
 			"species": turi,
			"types": config.edubase + "/sta/ontology/SpeciesAnnotation"
		};
		tobj.speciesAnnotations = config.edubase + "/spann/" + etid;
		// el básico...
		bobj.species = turi;
	}
	// estado árbol
	const tstiri = $('#selectTreeStatus').val();
	if (tstiri !== "") {
		tobj.treeStatus = {
			"iri": config.edubase + "/treestann/" + etid,
			"creator": creador,
			"created": ahora,
			"treeStatus": tstiri
		};
		tobj.treeStatusAnnotations = config.edubase + "/treestann/" + etid;	
		// el básico... 
		bobj.treeStatus = tstiri;
	}	
	// foto
	if (imgDownloadURL) {
		tobj.imageAnnotations = {
			"iri": config.edubase + "/imgann/" + etid,
			"creator": creador,
			"created": ahora,
			"image": {
				"iri": config.edubase + "/img/" + etid,
				"imageURL": imgDownloadURL,
				"firebasePath": imgFirebasePath,
				"types": config.edubase + "/sta/ontology/Image"
			},
			"types": config.edubase + "/sta/ontology/ImageAnnotation"
		};
		// si ha seleccionado el tipo de foto...
		const tppiri =  $('#selectTreePartPhoto').val();
		if (tppiri !== "") 
			tobj.imageAnnotations.image.plantPart = tppiri;
		// el básico...
		bobj.images = imgDownloadURL;
	}	
	// altura
	const alt = Number($('#treeHeight').val());
	if (alt && alt > 0 && alt <150) {
		// hay altura y tiene un valor correcto
		tobj.height = {
			"iri": config.edubase + "/heightann/" + etid,
			"creator": creador,
			"created": ahora,
			"meters": alt,
			"types": config.edubase + "/sta/ontology/HeightAnnotation"
		};
		tobj.heightAnnotations = config.edubase + "/heightann/" + etid;
		// el básico...
		bobj.height = alt;
	}
	// diámetro
	let diam = Number($('#treeDiameter').val());
	if (diam) {
		// reajuste por el modo perímetro
		if ($("#checkPerimeter").prop("checked"))
			diam = Number((diam / Math.PI).toFixed(0));	
		if (diam > 0 && diam <20000) {	
			// hay diámetro y tiene un valor correcto
			tobj.diameter = {
				"iri": config.edubase + "/diamann/" + etid,
				"creator": creador,
				"created": ahora,
				"millimeters": diam,
				"types": config.edubase + "/sta/ontology/DiameterAnnotation"
			};
			tobj.diameterAnnotations = config.edubase + "/diamann/" + etid;
			// el básico...
			bobj.dbh = diam;
		}
	}
	// observación
	const observation = $('#treeObservation').val();
	if (observation && observation.length > 4) {
		// hay una observación
		tobj.observations = {
			"iri": config.edubase + "/observann/" + etid,
			"creator": creador,
			"created": ahora,
			"text": { [getPreferredLang()] : observation },
			"types": config.edubase + "/sta/ontology/ObservationAnnotation"
		};
		// el básico...
		bobj.observations = { [getPreferredLang()] : observation };
	}
	
	//console.log(tobj);
	//console.log(bobj);
	
	// 5) hago la llamada para crear el educatree
	try {
		configurarModal( null, getLiteral(dict.creatingtree), null, null);
		await createEducatree(tobj, bobj); // aquí se hace la creación y la sincronización con el mapa si tiene éxito		
		// envío datos creación del árbol a GA
		sendTimedEvent("create_content");
		console.info("Árbol creado con IRI: " + config.edubase + "/tree/" + etid); // log
	} catch(err) {
		console.error(err.message);
		// actualizo modal
		const be = "<code>" + err.message + "<br>" + JSON.stringify(err.error) + "</code>";
		configurarModal( { static: true, vertcent: true, }, 
			getLiteral(dict.treecreationerror), be, footers.creacionError);
		$(".goBack").click(goBack);
		return; // terminamos
	}
	
	
	// 6) dejo preparada la URL para ir a la página del educatree creado
	Sesion.estado.path = "tree";
	Sesion.estado.etid = etid;
	history.replaceState(Sesion.estado, "", obtenerURL());
	
	// 7) ajustes finales modal
	// /app/images/treeCreation.png
	const htmlbody = '<img id="imgTreeCreation" src="" class="d-block w-100">';
	configurarModal( { static: true, vertcent: true},
		getLiteral(dict.treecreationsuccess), htmlbody, footers.creacionExito);
	$("#imgTreeCreation").attr("src", new URL('../images/treeCreation.png', import.meta.url));
	$(".goBack").click(goBack);
	$(".cargarURL").click(function() { cargarURL();	});
}


//////////////////////////
// MINIMAPA CREACIÓN ÁRBOL
//////////////////////////
async function procesarTreesMinimapa(mm, bounds) {
	// reajusto zoom a config.zMaxCelda (18) para reducir peticiones (respecto a 20)
	const zoom = config.zMaxCelda; // 18;

	// incluyo zoom para el cacheo
	//Sesion.zoomUsados[Sesion.estado.loc.z] = true; 
	Sesion.zoomUsados[zoom] = true;
	
	// obtengo grid de celdas para el mapa
	//const grid = getGrid(bounds, Sesion.estado.loc.z);
	const grid = getGrid(bounds, zoom);

	// inicializo infoCeldas
	Sesion.infoCeldas = {
		total: (1 + grid.cellE - grid.cellW) * (1 + grid.cellN - grid.cellS), 
		finalizadas: [],
		cacheadas: [],
		npc: [] // número de peticiones a crafts
	};
	
	// inicializo arbsPintados en Minimapa
	mm.arbsPintados = {};

	// inicializo promesas
	let promesas = [];		
	// trabajo celda a celda
	for (let x=grid.cellW; x<=grid.cellE; x++) {
		for (let y=grid.cellS; y<=grid.cellN; y++) {
			// preparo objeto de la celda
			const objcelda = {
				zoom: zoom,//Sesion.estado.loc.z,
				txgen: [ 'undefined' ],
				txesp: [ 'undefined', ..._.intersection(Object.keys(Sesion.txUsados), Object.keys(Datos.especies)) ],
				cellX: x,
				cellY: y,
				npc: [],
				minimapa: mm,
				ifn: Sesion.infoCeldas.ifn, // para coger los datos del ifn sólo si se requieren
				et: 'z' + zoom + '_x' + x + '_y' + y+'_undefined'
			}
			// enchufo el render
			objcelda.render = pintarCeldaMinimapa;			
			// hago la petición de datos de árboles de la celda
			promesas.push( processTreesCell(objcelda) );
		}
	}
	// espero a que terminen todas las promesas
	await Promise.all(promesas);	
}
function pintarCeldaMinimapa(objcelda) {
	// referencia a la celda
	const celda = Datos.celdasArboles[objcelda.et];
	// objeto bounds de la celda
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
	
	// CLUSTERS
	if (etCluster != undefined) {
		// pongo el cluster en el centro de la celda
		const mLatLng = bounds.getCenter();						
		// preparo icono
		const micon = new L.divIcon({
			html: '<div class="marcadorTexto"><span>' + etCluster + '</span></div>',
			className: '',	
			iconSize: [52, 52],
			iconAnchor:   [26, 26], // point of the icon which will correspond to marker's location
			tooltipAnchor:[12, 0] // point from which tooltips will "open", relative to the icon anchor
		});
		// creo marcador y añado al minimapa
		const cpint = L.marker(mLatLng, { icon: micon } ).addTo(objcelda.minimapa);
		// añado tooltip si no es táctil
		if (Sesion.hayTooltips)								
			cpint.bindTooltip(etCluster + getLiteral(dict.ntrees));
	}
	else {
		// no es un cluster, agrego los dos arrays de árboles y los trato de manera indiferente
		const alltrees = (Sesion.estado.ifn && celda.ifn.trees) ? 				
					(celda.edu.trees ? celda.ifn.trees.concat(celda.edu.trees) : celda.ifn.trees) : 
					(celda.edu.trees ? celda.edu.trees : [] );		
		// pinto árbol a árbol
		for (const turi of alltrees) {
			// sólo pinto árbol si no estaba libre (para evitar efectos borde entre celdas)
			if (objcelda.minimapa.arbsPintados[turi] == undefined) {
				// recupero el árbol
				const arb = Datos.arboles[turi];
				// obtengo icono
				const aicon = getIconoArbol(arb);
				// reajuste de longitud por el antimeridiano
				const lng = ponerCiclosAntimeridiano(arb.lng, objcelda.cellX, objcelda.zoom);
				// pinto el marcador del árbol
				let apint = L.marker([arb.lat, lng], {icon: aicon}).addTo(objcelda.minimapa);
				// y lo guardo
				objcelda.minimapa.arbsPintados[turi] = apint;
				// pongo tooltips en cualquier caso y a volar
				apint.bindTooltip(tooltipArbol(arb));			
			}
		}
	}
}

export { renderAjustesCreacionArbolMapa, renderFormularioCreacionArbol, 
	Minimapa, iniciarCreacionArbol, procesarTreesMinimapa, 
	handlerTreePhotoChange, handlerDiameterPerimeter, handlerTreeStatusInfo, 
	handlerCamera, handlerDeleteTreePhoto };
	
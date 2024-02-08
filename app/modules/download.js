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
import { downloadTemplateBody, downloadingTemplateBody, footers } from '../data/htmlTemplates.js';

import _ from "underscore";
import $ from "jquery";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import { point, booleanPointInPolygon } from '@turf/turf';
import { saveAs } from 'file-saver';

import { Sesion, Layers, Datos } from '../main.js';
import { getGrid, getCeldaBounds } from './grid.js';
import { ponerCiclosAntimeridiano } from './map.js';
import { processTreesCell, getDatosLoteEducatrees } from './dataManager.js';
import { getMoreSpecificSpecies } from './taxons.js';
import { sendEvent } from './events.js';
import { getLiteral, getCreatorObj, getNumericDate, firstUppercase, extractAllElements, 
	configurarModal } from './util.js';


function prepararDescarga() {
	// obtengo zoom del mapa
	const zoomCelda = Sesion.zoom > config.zMaxCelda? config.zMaxCelda : Sesion.zoom;
	// obtengo grid a partir del polígono
	if (Layers.editableLayer.getLayers().length == 0)
		return; // nada que hacer	
	const polygon = Layers.editableLayer.getLayers()[0]; // sólo debería haber un polígono
	const geojsonpoly = polygon.toGeoJSON();
	const grid = getGrid(polygon.getBounds(), zoomCelda);
		
	// inicialización modal con petición de confirmación
	configurarModal( { static: true, vertcent: true}, 
		getLiteral(dict.downloadData), downloadTemplateBody, footers.descargaDatos);		
	// muestro el modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	
	// listener al modal para que borre el polígono al cerrar
	document.getElementById('mimodal').addEventListener('hidden.bs.modal', event => {
 		Layers.editableLayer.clearLayers();
	});
	
	// pongo listener a los checks de descarga para mensajillo y para habilitar el botón de descarga
	$('.check-download').on('change', function() {
		const alguncheck = $('.check-download').is(':checked');
		if (alguncheck) {
			$('#downloadNothing').addClass("d-none");
			const algunradio = $('.downloadRadio').is(':checked');
			$('#downloadData').prop('disabled', !algunradio);
		}
		else {
			$('#downloadNothing').removeClass("d-none");
			$('#downloadData').prop('disabled', true);
		}
	});
	
	// pongo listener al radio para habilitar el botón de descarga
	$('.downloadRadio').on('change', function() {
		$('#downloadNoFormat').addClass("d-none");
		const alguncheck = $('.check-download').is(':checked');
		if (alguncheck)
			$('#downloadData').prop('disabled', false);
	});
	
	// listener al botón de descarga
	$('#downloadData').click(function() {
		// miro qué cosas quiere descargar
		let cosasDescargar = {
			trees: $('#checkTrees').is(':checked'),
			annotations: $('#checkAnnotations').is(':checked')
		};	
		// detecto el formato de descarga y preparo nombre del fichero
		let format = "GeoJSON"; // valor por defecto
		if ($('#CSV').is(':checked'))
			format = "CSV";
		else if ($('#KML').is(':checked'))
			format = "KML";
		// llamo a descargar los datos
		descargarDatos(cosasDescargar, grid, zoomCelda, format, geojsonpoly);
	});
}
async function descargarDatos(cosasDescargar, grid, zoomCelda, format, geojsonpoly) {
	// actualizo modal
	configurarModal( { static: true, vertcent: true, nofooter: true}, null, downloadingTemplateBody);
	
	// inicializo array de salidas
	const outputs = [];
		
	// obtengo los educatrees de las celdas del polígono
	$("#downloadingTrees").removeClass("d-none");
	
	// inicializaciones celdas
	let promesasCeldas = [];
	Sesion.infoCeldas = {
		total: (1 + grid.cellE - grid.cellW) * (1 + grid.cellN - grid.cellS),
		finalizadas: [],
		cacheadas: [],
		npc: [], // número de peticiones a crafts
		ifn: false
	};
	Sesion.idTimeoutActualizar = 0; // para que no salten timeouts
	
	// pregenero los taxones más generales y más específicos para el cacheo
	let txgen = [ 'undefined' ];
	let txesp = [ 'undefined', ..._.intersection(Object.keys(Sesion.txUsados), Object.keys(Datos.especies)) ];
	if (Sesion.tx != undefined) {
		txgen = [ 'undefined', ..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[Sesion.tx].superexpuris) ];
		txesp = _.intersection(Object.keys(Sesion.txUsados), Datos.especies[Sesion.tx].expuris);
	}	

	// descarga de educatrees celda a celda
	for (let x=grid.cellW; x<=grid.cellE; x++) {
		for (let y=grid.cellS; y<=grid.cellN; y++) {
			// preparo objeto de la celda
			const objcelda = {
				zoomout: false,
				taxon: Sesion.tx,
				txgen: txgen,
				txesp: txesp,
				zoom: zoomCelda,
				cellX: x,
				cellY: y,
				npc: [], // inicializo array con número de peticiones a crafts
				et: 'z' + zoomCelda + '_x' + x + '_y' + y + '_' + Sesion.tx,
				ifn: false,
				idtimeout: 0  // predefino el id de timeout
			};
			// enchufo el progreso
			objcelda.progreso = pintarBarraProgresoDescarga;
			// hago la petición de datos
			promesasCeldas.push( processTreesCell(objcelda) );
		}
	}
	await Promise.all(promesasCeldas);

	// logging celdas parcelas
	const tcc = _.reduce(Sesion.infoCeldas.cacheadas, function(memo, num){ return memo + num; }, 0);
	const npc = _.reduce(Sesion.infoCeldas.npc, function(memo, num){ return memo + num; }, 0);	
	console.info("#celdas download total: " + Sesion.infoCeldas.total + " - cacheadas: " 
		+ tcc + " - #npc: " + npc );
	
	// obtengo iris de educatrees y preparo clusters
	let ediris = [];
	let clusters = [];
	for (let x=grid.cellW; x<=grid.cellE; x++) {
		for (let y=grid.cellS; y<=grid.cellN; y++) {
			const et = 'z' + zoomCelda + '_x' + x + '_y' + y + '_' + Sesion.tx;
			const celda = Datos.celdasArboles[et];
			if (celda.edu.trees)			
				ediris = _.union(ediris, celda.edu.trees);
			else if (celda.edu.mmil || celda.edu.ntrees > config.treeThreshold) {
				const bounds = getCeldaBounds(x, y, zoomCelda);
				const lat = celda.edu.locCluster? celda.edu.locCluster.lat : bounds.getCenter().lat;
				const lng = celda.edu.locCluster? celda.edu.locCluster.lng : bounds.getCenter().lng;
				const taxon = Sesion.tx? { id: Sesion.tx, scientificName: firstUppercase(getLiteral(Datos.especies[Sesion.tx].scientificName)) } : "any";
				clusters.push( {
					id: 'cluster_z' + zoomCelda + '_x' + x + '_y' + y,
					type: "cluster",
					clusterValue: celda.edu.mmil? "+1K" : celda.edu.ntrees,
					latWGS84: lat,
					lngWGS84: lng,
					taxon: taxon
				});
			}
		}
	}
	
	// filtro con turf los educatrees que caen dentro del polígono
	//console.log("#educatrees inicio: " + ediris.length);
	ediris = _.filter(ediris, function(ediri) {
		const turfpoint = point([ponerCiclosAntimeridiano(Datos.arboles[ediri].lng, grid.cellW, zoomCelda),
			 Datos.arboles[ediri].lat]);
		return booleanPointInPolygon(turfpoint, geojsonpoly);		
	});
	//console.log("#educatrees fin: " + ediris.length);		
	// ordeno
	ediris = _.sortBy(ediris);
	
	// filtro con turf los clusters que caen dentro del polígono
	//console.log("#clusters inicio: " + clusters.length);
	clusters = _.filter(clusters, function(cluster) {
		const turfpoint = point([ponerCiclosAntimeridiano(cluster.lngWGS84, grid.cellW, zoomCelda),
			 cluster.latWGS84]);
		return booleanPointInPolygon(turfpoint, geojsonpoly);		
	});
	//console.log("#clusters fin: " + clusters.length);
	
	// quito mensajillo de descargando árboles
	$("#downloadingTrees").addClass("d-none");
	
	// procesamiento árboles y clusters
	if (cosasDescargar.trees) {
		let arbcls = []
		// preparo los edutrees
		for (let ediri of ediris) {
			const arb = Datos.arboles[ediri];
			const txarb = getMoreSpecificSpecies(arb.species);
			// preparo objeto
			const objarb = {
				id: ediri,
				type: "tree",
				creator: getCreatorObj(arb),
				created: getNumericDate(arb),
				latWGS84: arb.lat,
				lngWGS84: arb.lng
			};
			if (arb.nick)
				objarb.nick = getLiteral(arb.nick);
			if (txarb)
				objarb.taxon = { id: txarb, scientificName: firstUppercase(getLiteral(Datos.especies[txarb].scientificName))};
			if (arb.height)
				objarb.heightMeters = Number(Number(getLiteral(arb.height)).toFixed(2));
			if (arb.dbh)
				objarb.dbhMillimeters = Number(Number(getLiteral(arb.dbh)).toFixed(0));
			if (arb.treeStatus) {
				const ts = _.find(config.estadoArboles, function(el) { return el.iri === arb.treeStatus;});
				if (ts) 
					objarb.treeStatus = getLiteral(ts.label);
			}
			const images = extractAllElements(arb, [ "images" ]);
			if (images.length)
				objarb.photos = images;
			const observations = extractAllElements(arb, [ "observations" ]);
			if (observations.length) { 
				objarb.observations = [];
				for (let obs of observations) // quito los prefijos
					objarb.observations.push( getLiteral(obs) );
			}
			// guardo
			arbcls.push(objarb);
		}
		// agrego los clusters
		arbcls = arbcls.concat(clusters);
			
		// generación datos descarga
		if (arbcls.length > 0)  {		
			// preparo la salida y guardo
			const output = {
				data: formatearArbolesClusters(arbcls, format),
				nfich: format === 'GeoJSON'? 'EducaWood_trees.json' :
					format === 'CSV'? 'EducaWood_trees.csv' : 'EducaWood_trees.kml'
			}
			outputs.push(output);
			// preparo mensaje de info con el número de árboles y clusters
			let mens = ediris.length > 0?			
				'<i class="bi bi-hand-thumbs-up"></i>' + ediris.length + " " + getLiteral(dict.educawoodTrees) : "";
			if (clusters.length > 0)
				mens += mens === "" ? '<i class="bi bi-hand-thumbs-up"></i>' + clusters.length + " " + getLiteral(dict.educawoodClusters)
					: '<br><i class="bi bi-hand-thumbs-up"></i>' + clusters.length + " " + getLiteral(dict.educawoodClusters);
			$("#treesDownloaded").html(mens);
			$("#treesDownloaded").removeClass("d-none");
		}
		else
			$("#noTreesDownloaded").removeClass("d-none");
	}	
		
	// si pidió las anotaciones extraigo los educatrees completos
	if (cosasDescargar.annotations) {
		$("#downloadingAnnotations").removeClass("d-none");
		// para el progreso
		Sesion.infoCeldas = {
			total: 10, // se actualizará en getDatosLoteEducatrees
			finalizadas: [],
			cacheadas: [],
			npc: [], // número de peticiones a crafts
			ifn: false
		};
		// pido los educawoods completos
		await getDatosLoteEducatrees(ediris, pintarBarraProgresoDescarga);
			
		// preparo las anotaciones
		let geojsonAnns = []; // para geoJSON
		let allAnss = []; // para CSV o KML
		for (let ediri of ediris) {
			// extraigo edutree
			const edutree = Datos.educatrees[ediri];
			// inicializo objeto de anotaciones del edutree para GeoJSON
			let geojsonObjann = {
				id: ediri,
				type: "tree",
				creator: getCreatorObj(edutree),
				created: getNumericDate(edutree),
				latWGS84: edutree.position.latWGS84,
				lngWGS84: edutree.position.lngWGS84,
				positionAnnotations: [],
				treeStatusAnnotations: [],
				speciesAnnotations: [],
				diameterAnnotations: [],
				heightAnnotations: [],
				imageAnnotations: [],
				observations: []
			};			
			if (edutree.nick)
				geojsonObjann.nick = getLiteral(edutree.nick);
			// preparo extracto común para CSV y KML
			const anncomun = {
				treeId: ediri, // común (Educatree)
				latWGS84: edutree.position.latWGS84, // común (Educatree)
				lngWGS84: edutree.position.lngWGS84, // común (Educatree)
			};
			// posiciones
			if (edutree.positionAnnotations) {
				const posanns = extractAllElements(edutree, [ "positionAnnotations" ]);
				for (let annel of posanns) {
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común 
						type: "PositionAnnotation",
						primary: edutree.position && annel.iri === edutree.position.iri,
						value: {
							latWGS84: annel.latWGS84,
							lngWGS84: annel.lngWGS84
						}
					};
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.positionAnnotations.push(annbas);
					allAnss.push(ann);
				}			
			}
			// tree status
			if (edutree.treeStatusAnnotations) {
				const tsanns = extractAllElements(edutree, [ "treeStatusAnnotations" ]);
				for (let annel of tsanns) {
					const ts = _.find(config.estadoArboles, function(el) { return el.iri === annel.treeStatus;});
					if (ts) {
						// preparo objetos
						let annbas = {
							id: annel.iri, // común 
							creator: getCreatorObj(annel), // común 
							created: getNumericDate(annel), // común
							type: "TreeStatusAnnotation",
							primary: edutree.treeStatus && annel.iri === edutree.treeStatus.iri,
							value: { ts: getLiteral(ts.label) }
						};
						let ann = Object.assign({}, annbas, anncomun);
						// guardo
						geojsonObjann.treeStatusAnnotations.push(annbas);
						allAnss.push(ann);
					}
				}			
			}
			// especies
			if (edutree.speciesAnnotations) {
				const spanns = extractAllElements(edutree, [ "speciesAnnotations" ]);
				for (let annel of spanns) {
					const txarb = getMoreSpecificSpecies(annel.species.iri);
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común
						type: "SpeciesAnnotation",
						primary: edutree.species && annel.iri === edutree.species.iri,
						value: {
							id: txarb,
							scientificName: firstUppercase(getLiteral(Datos.especies[txarb].scientificName))
						}
					};
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.speciesAnnotations.push(annbas);
					allAnss.push(ann);
				}			
			}
			// diámetros
			if (edutree.diameterAnnotations) {
				const diamanns = extractAllElements(edutree, [ "diameterAnnotations" ]);
				for (let annel of diamanns) {
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común
						type: "DiameterAnnotation",
						primary: edutree.diameter && annel.iri === edutree.diameter.iri,
						value: {
							dbhMillimeters: Number(Number(getLiteral(annel.millimeters)).toFixed(0))
						}
					};
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.diameterAnnotations.push(annbas);
					allAnss.push(ann);
				}			
			}
			// alturas
			if (edutree.heightAnnotations) {
				const posanns = extractAllElements(edutree, [ "heightAnnotations" ]);
				for (let annel of posanns) {
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común 
						type: "HeightAnnotation",
						primary: edutree.height && annel.iri === edutree.height.iri,
						value: {
							heightMeters: Number(Number(getLiteral(annel.meters)).toFixed(2))
						}
					};
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.heightAnnotations.push(annbas);
					allAnss.push(ann);
				}			
			}
			// fotos
			if (edutree.imageAnnotations) {
				const posanns = extractAllElements(edutree, [ "imageAnnotations" ]);
				for (let annel of posanns) {
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común
						type: "ImageAnnotation",
						value: {
							imageURL: annel.image.imageURL
						}
					};
					if (annel.image.plantPart && Datos.partesPlantasFoto[annel.image.plantPart])
						annbas.value.plantPart = getLiteral(Datos.partesPlantasFoto[annel.image.plantPart].label);
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.imageAnnotations.push(annbas);
					allAnss.push(ann);
				}			
			}
			// observaciones
			if (edutree.observations) {
				const posanns = extractAllElements(edutree, [ "observations" ]);
				for (let annel of posanns) {
					// preparo objetos
					let annbas = {
						id: annel.iri, // común 
						creator: getCreatorObj(annel), // común 
						created: getNumericDate(annel), // común
						type: "ObservationAnnotation",
						value: { text: getLiteral(annel.text) }
					};
					let ann = Object.assign({}, annbas, anncomun);
					// guardo
					geojsonObjann.observations.push(annbas);
					allAnss.push(ann);
				}			
			}			
			// guardo todas las anotaciones del edutree en geojsonAnns
			geojsonAnns.push(geojsonObjann);
		}
				
		// generación datos descarga
		if (allAnss.length > 0)  {		
			// preparo la salida y guardo
			const output = {
				data: formatearAnotacionesArboles(geojsonAnns, allAnss, format),
				nfich: format === 'GeoJSON'? 'EducaWood_annotations.json' :
					format === 'CSV'? 'EducaWood_annotations.csv' : 'EducaWood_annotations.kml'
			}
			outputs.push(output);
			// preparo mensaje de info con el número de anotaciones
			let mens = '<i class="bi bi-hand-thumbs-up"></i>' + allAnss.length + " " + getLiteral(dict.educawoodAnnotations);
			$("#annotationsDownloaded").html(mens);
			$("#annotationsDownloaded").removeClass("d-none");
		}
		else
			$("#noAnnotationsDownloaded").removeClass("d-none");
		// actualizo mensajillos de info
		$("#downloadingAnnotations").addClass("d-none");		
	}	
	
	// hago las descargas
	for (let out of outputs) {
		const blob = new Blob([out.data], {type: "text/plain;charset=utf-8"});
		saveAs(blob, out.nfich);
	}
	// actualizo mensajillo de info
	$("#downloadSuccess").removeClass("d-none");
	
	// escondo barra de progreso
	pintarBarraProgresoDescarga(false);
	
	// envío evento GA descarga datos
	const datosga = { content_type: 'download_'+format, trees: cosasDescargar.trees, annotations: cosasDescargar.annotations };
	if (Sesion.estado.taxon)
		datosga.taxon = Sesion.estado.taxon;
	sendEvent( 'select_content', datosga );
		
	// actualizo modal
	$("#imgDownload").removeClass("d-none");
	const nuevotit = outputs.length == 0? getLiteral(dict.downloadNothing) : getLiteral(dict.downloadSuccess);
	configurarModal( { static: true, vertcent: true}, 
		nuevotit, null, footers.anotacionExito);
}


function formatearAnotacionesArboles(geojsonAnns, allAnss, format) {
	let output;
	switch(format) {
		case 'GeoJSON':
			const features = [];
			for (const feat of geojsonAnns) {
				// Extract relevant properties from each feature
				const {
					id,
					type,
					latWGS84,
					lngWGS84,
					nick,
					creator,
					created,
					positionAnnotations,
					treeStatusAnnotations,
					speciesAnnotations,
					diameterAnnotations,
					heightAnnotations,
					imageAnnotations,
					observations
				} = feat;
				// Create a GeoJSON feature object
				const feature = {
					type: 'Feature',
						geometry: {
						type: 'Point',
						coordinates: [lngWGS84, latWGS84] // [longitude, latitude]
					},
					properties: {
						id,
						type,
						nick,
						creator,
						created,
						positionAnnotations,
						treeStatusAnnotations,
						speciesAnnotations,
						diameterAnnotations,
						heightAnnotations,
						imageAnnotations,
						observations
					}
				};
				features.push(feature);
			}
			// Create the GeoJSON object
			const geoJSON = {
				type: 'FeatureCollection',
				features
			};
			output = JSON.stringify(geoJSON, null, 2);	
			break;
		case 'CSV':
			// Extract the keys from the first tree object to create the CSV header
			const header = [ "id",
					"treeId",
					"latWGS84",
					"lngWGS84",
					"creator.id",
					"creator.nick",
					"created",
					"type",
					"primary",
					"value.latWGS84",
					"value.lngWGS84",
					"value.ts",
					"value.id",
					"value.scientificName",
					"value.dbhMillimeters",
					"value.heightMeters",
					"value.imageURL",
					"value.plantPart",
					"value.text"];
			// Generate the CSV rows
			const rows = Object.values(allAnss).map(feature => {
				return header.map(key => {
					if (key.indexOf(".") !== -1) {
						// caso anidado, extraigo las dos claves
						const subkeys = key.split(".");
						if (feature[subkeys[0]] && feature[subkeys[0]][subkeys[1]])	// si existen las dos subclaves, devuelvo el valor
							return feature[subkeys[0]][subkeys[1]];
						else // en otro caso no está definido
							return undefined;
					}
					else if (Array.isArray(feature[key])) // If the value is an array, join the elements with a semicolon
						return feature[key].join('; ');
					else if (typeof feature[key] === 'object') // If the value is an object, stringify it
						return JSON.stringify(feature[key]);
					else // Otherwise, return the value as is
					  return feature[key];
				});
			});
			// Combine the header and rows into a single CSV string
			output = [header.join(', ')].concat(rows.map(row => row.join(', '))).join('\n');
			break;
		case 'KML':
			output = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>`;
			for (const feat of allAnss) {
				// Extract relevant properties from each feature
				const {
					id,
					treeId,
					latWGS84,
					lngWGS84,
					creator,
					created,
					type,
					primary,
					value
				} = feat;				
				// preparo extendedData de las cosas opcionales
				const extendedData = [];
				if (creator && creator.id) 
					extendedData.push(`        <Data name="creator.id"><value>${creator.id}</value></Data>`);
				if (creator && creator.nick) 
					extendedData.push(`        <Data name="creator.nick"><value>${creator.nick}</value></Data>`);
				if (created) 
					extendedData.push(`        <Data name="created"><value>${created}</value></Data>`);
				if (value.latWGS84) 
					extendedData.push(`        <Data name="value.latWGS84"><value>${value.latWGS84}</value></Data>`);
				if (value.lngWGS84) 
					extendedData.push(`        <Data name="value.lngWGS84"><value>${value.lngWGS84}</value></Data>`);
				if (value.ts) 
					extendedData.push(`        <Data name="value.ts"><value>${value.ts}</value></Data>`);
				if (value.id) 
					extendedData.push(`        <Data name="value.id"><value>${value.id}</value></Data>`);
				if (value.scientificName) 
					extendedData.push(`        <Data name="value.scientificName"><value>${value.scientificName}</value></Data>`);
				if (value.dbhMillimeters) 
					extendedData.push(`        <Data name="value.dbhMillimeters"><value>${value.dbhMillimeters}</value></Data>`);
				if (value.heightMeters) 
					extendedData.push(`        <Data name="value.heightMeters"><value>${value.heightMeters}</value></Data>`);
				if (value.imageURL) 
					extendedData.push(`        <Data name="value.imageURL"><value>${value.imageURL}</value></Data>`);
				if (value.plantPart) 
					extendedData.push(`        <Data name="value.plantPart"><value>${value.plantPart}</value></Data>`);
				if (value.text) 
					extendedData.push(`        <Data name="value.text"><value>${value.text}</value></Data>`);
				// Generate the Placemark element for each feature
				const placemark = `
    <Placemark>
      <Point>
        <coordinates>${lngWGS84},${latWGS84}</coordinates>
      </Point>
      <ExtendedData>
        <Data name="id"><value>${id}</value></Data>
        <Data name="treeId"><value>${treeId}</value></Data>
        <Data name="type"><value>${type}</value></Data>
${extendedData.join('\n')}
      </ExtendedData>
    </Placemark>`;
				output += placemark;
			}
			output += `
  </Document>
</kml>`;
			break;	
	}
	return output;
}


function formatearArbolesClusters(arbcls, format) {
	let output;
	switch(format) {
		case 'GeoJSON':
			const features = [];
			for (const feat of arbcls) {
				// Extract relevant properties from each feature
				const {
					id,
					type,
					latWGS84,
					lngWGS84,
					nick,
					taxon,
					clusterValue,
					creator,
					created,			
					heightMeters,
					dbhMillimeters,
					treeStatus,
					photos,
					observations
				} = feat;
				// Create a GeoJSON feature object
				const feature = {
					type: 'Feature',
						geometry: {
						type: 'Point',
						coordinates: [lngWGS84, latWGS84] // [longitude, latitude]
					},
					properties: {
						id,
						type,
						clusterValue,
						nick,
						taxon,
						creator,
						created,			
						heightMeters,
						dbhMillimeters,
						treeStatus,
						observations,
						photos
					}
				};
				features.push(feature);
			}
			// Create the GeoJSON object
			const geoJSON = {
				type: 'FeatureCollection',
				features
			};
			output = JSON.stringify(geoJSON, null, 2);	
			break;
		case 'CSV':
			// Extract the keys from the first tree object to create the CSV header
			const header = [ "id",
					"type",
					"latWGS84",
					"lngWGS84",
					"nick",
					"taxon.id",
					"taxon.scientificName",
					"clusterValue",
					"creator.id",
					"creator.nick",
					"created",			
					"heightMeters",
					"dbhMillimeters",
					"treeStatus",
					"observations",
					"photos"];
			// Generate the CSV rows
			const rows = Object.values(arbcls).map(feature => {
				return header.map(key => {
					if (key.indexOf(".") !== -1) {
						// caso anidado, extraigo las dos claves
						const subkeys = key.split(".");
						if (feature[subkeys[0]] && feature[subkeys[0]][subkeys[1]])	// si existen las dos subclaves, devuelvo el valor
							return feature[subkeys[0]][subkeys[1]];
						else if (feature[subkeys[0]] && !feature[subkeys[0]][subkeys[1]] && subkeys[1] === "id") // sólo está la primera subclave y la segunda es "id"
							return feature[subkeys[0]];
						else // en otro caso no está definido
							return undefined;
					}
					else if (Array.isArray(feature[key])) // If the value is an array, join the elements with a semicolon
						return feature[key].join('; ');
					else if (typeof feature[key] === 'object') // If the value is an object, stringify it
						return JSON.stringify(feature[key]);
					else // Otherwise, return the value as is
					  return feature[key];
				});
			});
			// Combine the header and rows into a single CSV string
			output = [header.join(', ')].concat(rows.map(row => row.join(', '))).join('\n');
			break;
		case 'KML':
			output = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>`;
			for (const feat of arbcls) {
				// Extract relevant properties from each feature
				const {
					id,
					type,
					latWGS84,
					lngWGS84,
					nick,
					taxon,
					clusterValue,
					creator,
					created,			
					heightMeters,
					dbhMillimeters,
					treeStatus,
					photos,
					observations
				} = feat;
				// preparo extendedData de las cosas opcionales
				const extendedData = [];
				if (nick) 
					extendedData.push(`        <Data name="nick"><value>${nick}</value></Data>`);
				if (taxon && taxon.id) 
					extendedData.push(`        <Data name="taxon.id"><value>${taxon.id}</value></Data>`);
				if (taxon && taxon.scientificName) 
					extendedData.push(`        <Data name="taxon.scientificName"><value>${taxon.scientificName}</value></Data>`);
				if (clusterValue) 
					extendedData.push(`        <Data name="clusterValue"><value>${clusterValue}</value></Data>`);
				if (creator && creator.id) 
					extendedData.push(`        <Data name="creator.id"><value>${creator.id}</value></Data>`);
				if (creator && creator.nick) 
					extendedData.push(`        <Data name="creator.nick"><value>${creator.nick}</value></Data>`);
				if (created) 
					extendedData.push(`        <Data name="created"><value>${created}</value></Data>`);
				if (heightMeters) 
					extendedData.push(`        <Data name="heightMeters"><value>${heightMeters}</value></Data>`);
				if (dbhMillimeters) 
					extendedData.push(`        <Data name="dbhMillimeters"><value>${dbhMillimeters}</value></Data>`);
				if (treeStatus) 
					extendedData.push(`        <Data name="treeStatus"><value>${treeStatus}</value></Data>`);
				if (observations) 
					extendedData.push(`        <Data name="observations"><value>${Array.isArray(observations) ? observations.join('; ') : observations}</value></Data>`);
				if (photos) 
					extendedData.push(`        <Data name="photos"><value>${Array.isArray(photos) ? photos.join('; ') : photos}</value></Data>`);		
				// Generate the Placemark element for each feature
				const placemark = `
    <Placemark>
      <Point>
        <coordinates>${lngWGS84},${latWGS84}</coordinates>
      </Point>
      <ExtendedData>
        <Data name="id"><value>${id}</value></Data>
        <Data name="type"><value>${type}</value></Data>
${extendedData.join('\n')}
      </ExtendedData>
    </Placemark>`;
				output += placemark;
			}
			output += `
  </Document>
</kml>`;
			break;	
	}
	return output;
}

function pintarBarraProgresoDescarga(mostrar) {
	// variante sin JQuery para que vaya más rápida la actualización de la barra
	const mibarradiv = document.getElementById('mibarradescarga_div');
	if (mostrar) {
		// obtengo celdas completadas
		const celdascomp = _.reduce(Sesion.infoCeldas.finalizadas, function(memo, num){ return memo + num; }, 0);		
		// calculo porc (hasta 99)
		const porc = Math.floor( 99 * celdascomp / Sesion.infoCeldas.total );
		// ajusto barra
		let mibarra = document.getElementById('mibarradescarga');
		mibarradiv.setAttribute('aria-valuenow', porc);
		mibarra.style.width = porc + '%';
		mibarra.innerHTML = porc + '%';
		// muestro la barra de progreso
		mibarradiv.classList.remove('d-none');		
	} 
	else // escondo la barra
		mibarradiv.classList.add('d-none');
}

export { prepararDescarga };
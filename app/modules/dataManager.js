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

import _ from 'underscore';
import { parse } from 'wkt';

import { Sesion, Datos, Layers, Crafts } from '../main.js';
import { quitarCiclosAntimeridiano, ponerCiclosAntimeridiano } from './map.js';
import { getGrid, getCeldaBounds, getCeldaGridMatrix } from './grid.js';
import { getMoreSpecificSpecies } from './taxons.js';
import { extractAllElements, getLiteral } from './util.js';


// DESCOMPOSICIÓN LLAMADA RESOURCES
function descomponerCraftsResources(id, uris) {
	// array a devolver con la descomposición
	let devolver = [];
	// array de huérfanos (para combinar)
	let huerfanos = [];

	// organizo las uris por sus namespaces
	let nsuris = {};
	// analizo cada uri y la meto por su namespace
	for (let i=0; i<uris.length; i++) {
		const uri = uris[i];
		// obtengo namespace
		const indfin = Math.max( uri.lastIndexOf('/'), uri.lastIndexOf('#') );
		const ns = uri.substring(0, indfin + 1);
		// guardo
		if (nsuris[ns] == undefined)
			nsuris[ns] = [];
		nsuris[ns].push(uri);
	}
	
	// analizo cada namespace encontrado
	const nss = Object.keys(nsuris);
	for (let i=0; i<nss.length; i++) {
		// obtengo el namespace y sus uris
		const mins = nss[i];
		const misuris = nsuris[mins];
		// preparo lotes de 200
		const lote = 200;
		for (let ind=0; misuris.length > ind*lote; ind++) {
			const begin = ind*lote;
			const end = misuris.length > (ind + 1)*lote? (ind + 1)*lote : misuris.length;
			// si este lote es inferior a 10, los meto en huérfanos
			if (end - begin < 10) 
				huerfanos = huerfanos.concat( misuris.slice( begin, end ) );
			else {
				// creo un objeto para este lote
				let obj = {};
				obj.id = id;
				obj.ns = mins;
				obj.nspref = 'p'; // arbitrario
				obj.iris = [];
				// meto cada iri con prefijo en el lote
				for (let j=begin; j<end; j++) {
					const uri = misuris[j];
					const prefuri = 'p:' + uri.substring(mins.length);
					obj.iris.push(prefuri);				
				}
				// y guardo el objeto en devolver
				devolver.push(obj);
			}
		}
	}
	
	// proceso los huérfanos en lotes de 40
	const lote = 40;
	for (let ind=0; huerfanos.length > ind*lote; ind++) {
		const begin = ind*lote;
		const end = huerfanos.length > (ind + 1)*lote? (ind + 1)*lote : huerfanos.length;
		// creo un objeto para este lote
		let obj = {};
		obj.id = id;
		obj.iris = huerfanos.slice( begin, end );
		// y guardo el objeto en devolver
		devolver.push(obj);
	}
		
	// devuelvo la descomposición
	return devolver;
}

// INICIALIZACIONES PROVEEDOR DE DATOS
// datos tipos de partes de plantas para fotos
async function getPlantPartsPhotoInfo() {
	// preparo objeto para la petición a CRAFTS de pares de superclase-subclase a partir de config.usoTop
	const qobj = { 'ancestor': config.plantPartPhoto };
	const datos = await Crafts.getData(config.craftsConfig.queryInfoClasses, qobj);
	// fue todo bien, guardo partes de plantas de fotos
	// analizo fila a fila
	for (const row of datos.results.bindings) {
		// preparo objeto
		let obj = {
			uri: row.class.value,  // guardo uri
			label: {}
		};
		// guardo labeles
		if (row.labes.value != undefined)
			obj.label.es = row.labes.value;		
		// guardo labelen
		if (row.laben.value != undefined)
			obj.label.en = row.laben.value;		
		// y guardo en los datos
		Datos.partesPlantasFoto[obj.uri] = obj;		
	}	
}
// info de todas las especies
async function getSpeciesInfo() {
	// obtengo info de subclases de las especies
	for (let espTop of config.especiesTop) {
		// preparo objeto para la petición a CRAFTS de pares de superclase-subclase a partir de config.especiesTop
		const qobj = { 'ancestor': espTop };
		const datos = await Crafts.getData(config.craftsConfig.querySubclasses, qobj);
		// fue todo bien, inicializo clase config.especiesTop[i]		
		initClass(Datos.especies, espTop);
		// analizo cada fila de los resultados
		for (let row of datos.results.bindings) {
			// obtengo datos
			const supuri = row.sup.value;
			const suburi = row.sub.value;
			// inicializo clases
			initClass(Datos.especies, supuri);
			initClass(Datos.especies, suburi);
			// guardo subclase
			Datos.especies[supuri].subclasses.push(suburi);
			// guardo superclase
			Datos.especies[suburi].superclasses.push(supuri);
		};
	}	
	// obtengo especies expandidas
	obtenerEspeciesExpandidas();
	
	// ahora pido a CRAFTS la info de cada especie
	const suris = Object.keys(Datos.especies);
	let promesas = []; // inicializo promesas
	// pido descomponer en objetos para la llamada resources de CRAFTS
	const objrs = descomponerCraftsResources('Species', suris);
	// ya tengo los objetos a pedir, lanzo las peticiones en paralelo a CRAFTS
	for (const objr of objrs) {
		// creo una promesa para cada petición
		promesas.push( new Promise(async function(resolve, reject) {
			try {
				// hago la llamada a CRAFTS	y espero resultados
				let datos = await Crafts.getData(config.craftsConfig.resourcesTemplate, objr);
				// convierto en array si es necesario
				if (!Array.isArray(datos))
					datos = [ datos ];			
				// actualizo especie a especie, fusionando con lo que tenía
				for (let dato of datos) 
					Object.assign(Datos.especies[dato.iri], dato);
				// resuelvo la promesa
				resolve(true);
			} catch(err) {
				reject(err);
			}
		}) );
	}
	
	// espero a que terminen todas las promesas
	await Promise.all(promesas);
}
// util para usos y especies
function initClass(objbase, cluri) {
	if (objbase[cluri] == undefined) {
		objbase[cluri] = {
			"uri": cluri, 
			"subclasses": [], 
			"superclasses": []
		};
	}
}
function obtenerEspeciesExpandidas(borrar) {
	// obtengo las uris
	let evsuris = Object.keys(Datos.especies);
	if (borrar) {
		// borro la info inicial que tuviera de nivel y especies expandidas
		for (let txuri of evsuris) {
			delete Datos.especies[txuri].nivel;
			delete Datos.especies[txuri].expuris;
			delete Datos.especies[txuri].superexpuris;
		}
	}
	// obtengo las especies expandidas
	while(evsuris.length > 0) {
		let newevsuris = [];
		for (let suri of evsuris) {
			// recupero especie
			const especie = Datos.especies[suri];
			// ajusto nivel (para determinar si es especie/género/familia/clase)
			if (especie.nivel == undefined)
				especie.nivel = 0;
			else
				especie.nivel++;
			// obtengo la uri de cualquier subespecie sin expandir
			const algsubsuri = _.find(especie.subclasses, function(subsuri) {
				return Datos.especies[subsuri].expuris == undefined;					
			});
			// si no está definida, puedo hacer la expansión de uris
			if (algsubsuri == undefined) {
				// inicializo con la uri de la propia especie
				especie.expuris = [suri];
				// y ahora incluimos las de la subclases
				for (let subsuri of especie.subclasses)
					especie.expuris = _.union(especie.expuris, Datos.especies[subsuri].expuris);
			}
			else // hay que esperar a la siguiente iteración
				newevsuris.push(suri);
		};				
		// actualizo lista de tipos a evaluar
		evsuris = newevsuris;
	}
	// recalculo para obtener especies expandidas superiores
	evsuris = Object.keys(Datos.especies);
	while(evsuris.length > 0) {
		let newevsuris = [];
		for (let suri of evsuris) {
			// recupero especie
			const especie = Datos.especies[suri];
			// obtengo la uri de cualquier superespecie sin expandir
			const algsupersuri = _.find(especie.superclasses, function(supersuri) {
				return Datos.especies[supersuri].superexpuris == undefined;					
			});
			// si no está definida, puedo hacer la expansión de uris
			if (algsupersuri == undefined) {
				// inicializo con la uri de la propia especie
				especie.superexpuris = [suri];
				// y ahora incluimos las de la superclases
				for (let supersuri of especie.superclasses)
					especie.superexpuris = _.union(especie.superexpuris, Datos.especies[supersuri].superexpuris);
			}
			else // hay que esperar a la siguiente iteración
				newevsuris.push(suri);
		};				
		// actualizo lista de tipos a evaluar
		evsuris = newevsuris;
	}
}


/////////
// TAXONS
/////////
async function getValidTaxons(resAPI) {
	// extraigo las IRIS de las entidades
	const entsWD = _.pluck(resAPI, "concepturi");
	// extraigo las entidades que requieren consulta a Wikidata
	const entsconsultar = _.filter(entsWD, function(ent){ return Datos.esTaxonWD[ent] == undefined; });
	if (entsconsultar.length > 0) {
		// hago la llamada a CRAFTS
		const datos = await Crafts.getData(config.craftsConfig.queryValidTaxons, { eiri: entsconsultar });
		// guardo fila a fila (resultados positivos)
		for (const row of datos.results.bindings) {
			Datos.esTaxonWD[row.taxon.value] = true;
			// incluyo los datos del punto SPARQL y de la API
			const res = _.find(resAPI, function(el){ return el.concepturi === row.taxon.value; });			
			Datos.taxonesWD[row.taxon.value] = { 
				iri: row.taxon.value,
				label: res.display.label.value,
				description: res.description,
				sitelinks: Number(row.sitelinks.value), 
				statements: Number(row.statements.value),
				pending: true
			};
		}
		// y ahora guardo los resultados negativos
		for (let ent of entsconsultar) {
			if (!Datos.esTaxonWD[ent])
				Datos.esTaxonWD[ent] = false;
		}
	}
	// extraigo los taxones válidos (ya está todo listo en Datos.esTaxonWD)
	return  _.filter(entsWD, function(ent){ return Datos.esTaxonWD[ent]; });
}

async function extractWikidataTaxon(wdiri) {
	// detecto si tengo los datos de la llamada getValidTaxons
	if (!Datos.taxonesWD[wdiri]) {
		// hago la llamada a CRAFTS
		const datos = await Crafts.getData(config.craftsConfig.queryValidTaxons, {eiri: wdiri});
		// guardo el resultado (habrá al menos uno)
		for (const row of datos.results.bindings) {
			Datos.esTaxonWD[row.taxon.value] = true;
			// incluyo los datos del punto SPARQL
			Datos.taxonesWD[row.taxon.value] = { 
				iri: row.taxon.value,
				sitelinks: Number(row.sitelinks.value), 
				statements: Number(row.statements.value),
				pending: true
			};
		}	
	}
	// luego detecto si tengo los datos completos
	if (Datos.taxonesWD[wdiri] && Datos.taxonesWD[wdiri].pending) {
		// debería tener ya algo en Datos.taxonesWD[wdiri], si no, no hago nada
		// hago la llamada a CRAFTS	y espero resultados
		const datos = await Crafts.getData(config.craftsConfig.resourceTemplate, { id: "WikidataTaxon" , iri: wdiri } );
		// fusiono con lo que tenía
		Object.assign(Datos.taxonesWD[wdiri], datos);
		// caso especial si no vino de getValidTaxons para rellenar label
		if (!Datos.taxonesWD[wdiri].label)
			Datos.taxonesWD[wdiri].label = getLiteral(datos.scientificName);
		// borro el flag de pending
		delete Datos.taxonesWD[wdiri].pending;
	}
}

async function getExistingWikidataTaxons(wdiris) {
	let existing = []
	if (wdiris.length > 0) {
		// hago la llamada a CRAFTS
		const datos = await Crafts.getData(config.craftsConfig.queryExistingWikidataTaxons, {wdiri: wdiris});
		// guardo fila a fila
		for (const row of datos.results.bindings)
			existing.push(row.wdiri.value);
	}
	return existing;
}

// CREACIÓN DEL TAXÓN
async function createTaxonFromWikidata(txobj) {
	// preparo objeto parámetros plantilla
	const objpars = {
		iri: txobj.iri,
		id: "Species"
	};
	// hago la llamada a CRAFTS
	// creo el árbol y sus anotaciones asociadas
	//console.log("CREANDO EDUCATREE...");
	await Crafts.putData(config.craftsConfig.resourceTemplate, objpars, txobj);
	// todo OK
	return Promise.resolve(true);
}


////////
// USERS
////////
async function getUserData(uid) {
	if (Datos.usuarios[uid] != undefined) 
		return Promise.resolve(true); // ya los tenía
	// preparo objeto parámetros consulta
	const objpars = {
		iri: config.edubase + "/user/" + uid,
		id: "Person"
	};
	try {
		// hago la llamada a CRAFTS
		const datos = await Crafts.getData(config.craftsConfig.resourceTemplate, objpars);
		// guardo datos
		Datos.usuarios[uid] = datos;	
		// todo OK
		return Promise.resolve(true);
	} catch(err) {	
		// si hay algún error rechazo la promesa
		console.error(err);
		return Promise.reject(err);
	}
}
async function nickExists(nick) {
	// nunca cacheo esta petición
	// preparo objeto parámetros consulta
	let qobj = { nick: nick	};
	try {
		// hago la llamada a CRAFTS
		const datos = await Crafts.getData(config.craftsConfig.queryUsernick, qobj);
		// extraigo resultado
		const existe = datos.results.bindings.length;
		// todo OK
		return Promise.resolve(existe);
	} catch(err) {	
		// si hay algún error rechazo la promesa
		console.error(err);
		return Promise.reject(err);
	}
}
async function setNick(uid, patch) {
	// preparo objeto plantilla recurso
	const objpars = {
		iri: config.edubase + "/user/" + uid,
		id: "Person"
	};
	// hago la llamada a CRAFTS con el patch
	//console.log("CAMBIANDO NICK...");
	try {
		await Crafts.patchData(config.craftsConfig.resourceTemplate, objpars, patch);
		// actualizo nick
		Datos.usuarios[uid].nick = patch[0].value;
		// todo OK
		return Promise.resolve(true);
	} catch(err) {	
		// si hay algún error rechazo la promesa
		console.error(err);
		return Promise.reject(err);
	}	
}

async function getTreePages(pe, pae, uid) {
	// si no hay uid, entonces las páginas son de todos (global)
	// tamaño de página depende de si es de usuario o de todos (global)
	const page = uid? config.pageus : config.page;	
	// preparo objeto parámetros consulta
	let qobj = { limit: page +1, offset: page*pe };
	if (uid)
		qobj.user = config.edubase + "/user/" + uid;
	// NOTA: el límite está preconfigurado a 11 para saber si hay datos en la siguiente página (que son de 10 elementos)

	// selecciono el objeto adecuado dependiendo de si es petición del usuario  o si es global
	const clave = uid? uid : "global";
	
	// petición ultEducatrees
	// inicializo el array
	if (!Datos.ultEducatrees[clave])
		Datos.ultEducatrees[clave] = [];
	// compruebo si está cacheada
	if (!Datos.ultEducatrees[clave][pe]) {
		try {
			// hago la llamada a CRAFTS		
			const datos = await Crafts.getData(config.craftsConfig.queryMostRecentEducatrees, qobj);
			// inicializo array resultados
			Datos.ultEducatrees[clave][pe] = [];			
			// guardo fila a fila
			for (const row of datos.results.bindings) {
				Datos.ultEducatrees[clave][pe].push(
					{ iri: row.tree.value, created: row.date.value, nick: row.tnick? row.tnick.value : undefined, creator: { iri: row.creator.value, nick: row.unick? row.unick.value : undefined} }
				);		
			}
		} catch(err) {	
			// si hay algún error rechazo la promesa
			console.error(err);
			return Promise.reject(err);
		}
	}
	
	// petición ultAnotaciones
	// actualizo offset
	qobj.offset = page*pae;
	// inicializo el array	
	if (!Datos.ultAnotaciones[clave])
		Datos.ultAnotaciones[clave] = [];
	// compruebo si está cacheada
	if (!Datos.ultAnotaciones[clave][pae]) {
		try {
			// hago la llamada a CRAFTS		
			const datos = await Crafts.getData(config.craftsConfig.queryMostRecentAnnotations, qobj);
			// inicializo array resultados
			Datos.ultAnotaciones[clave][pae] = [];			
			// guardo fila a fila
			for (const row of datos.results.bindings) {
				Datos.ultAnotaciones[clave][pae].push(
					{ iri: row.tree.value, created: row.date.value, type: row.annType.value, nick: row.tnick? row.tnick.value : undefined,
						creator: { iri: row.annotator.value, nick: row.unick? row.unick.value : undefined} }
				);		
			}	
		} catch(err) {	
			// si hay algún error rechazo la promesa
			console.error(err);
			return Promise.reject(err);
		}
	}	

	// todo OK
	return Promise.resolve(true);
}



////////
// TREES
////////
// cambio del nick del árbol
async function setTreeNick(iri, patch) {
	// preparo objeto plantilla recurso
	const objpars = {
		iri: iri,
		id: "EducaTree"
	};
	// hago la llamada a CRAFTS con el patch
	//console.log("CAMBIANDO NICK...");
	try {
		await Crafts.patchData(config.craftsConfig.resourceTemplate, objpars, patch);
		// actualizo nick
		Datos.educatrees[iri].nick = patch[0].value;
		// todo OK
		return Promise.resolve(true);
	} catch(err) {	
		// si hay algún error rechazo la promesa
		console.error(err);
		return Promise.reject(err);
	}	
}

// RECUPERACIÓN DE EDUCATREE
async function getDatosEducatree(iri) {
	// no hago nada si ya están los datos
	if (Datos.educatrees[iri] !== undefined)
		return;
	// preparo objeto para la llamada
	const objr = {
		id: 'EducaTree',
		iri: iri
	};
	// hago la llamada a CRAFTS	y espero resultados
	let datos = await Crafts.getData(config.craftsConfig.resourceTemplate, objr);
	
	// guardo y a volar
	Datos.educatrees[iri] = datos;
}
// lote de educatrees (para la descarga de anotaciones de educatrees)
async function getDatosLoteEducatrees(iris, progreso) {
	// obtengo los educatrees de los que no tengo datos
	let pendingiris = _.filter(iris, function(iri) {
		return Datos.educatrees[iri] == undefined;
	});
	if (pendingiris.length > 0) {
		// pido descomponer en objetos para la llamada resources de CRAFTS	
		const objrs = descomponerCraftsResources('EducaTree', pendingiris);
		// actualizo progreso
		if (progreso) {
			Sesion.infoCeldas.total = objrs.length; // aquí tengo el total
			progreso(true);
		}		
		// pido en secuencia
		try {	
			for (let objr of objrs) {
				// hago la llamada a CRAFTS	y espero resultados
				let datos = await Crafts.getData(config.craftsConfig.resourcesTemplate, objr);
				// convierto en array si es necesario
				if (!Array.isArray(datos))
					datos = [ datos ];			
				// actualizo educatree a educatree
				for (let dato of datos) 
					Datos.educatrees[dato.iri] = dato;
				// actualizo progreso
				if (progreso) {
					Sesion.infoCeldas.npc.push(1);
					Sesion.infoCeldas.finalizadas.push(1);
					progreso(true);
				}
			}
		} catch(err) {
			console.error(err);
			return;
		}
	}
}


// CREACIÓN DE EDUCATREE
// tobj es el árbol en formato EducaTree y bobj en formato BasicEducaTree
async function createEducatree(tobj, bobj) {
	// preparo objeto parámetros plantilla
	const objpars = {
		iri: tobj.iri,
		id: "EducaTree"
	};
	// hago la llamada a CRAFTS
	// creo el árbol y sus anotaciones asociadas
	//console.log("CREANDO EDUCATREE...");
	await Crafts.putData(config.craftsConfig.resourceTemplate, objpars, tobj);
		
	// actualizo datos usuario para que cuente la nueva anotación
	delete Datos.usuarios[Sesion.usuario.uid]; 
	await getUserData(Sesion.usuario.uid);
	
	// guardo árbol básico y me aseguro de borrar el árbol en formato EducaTree
	Datos.arboles[bobj.iri] = bobj;
	delete Datos.educatrees[bobj.iri]; // para obligar a recuperar la info completa si quiere visualizarlo
	
	// borro también las páginas de árboles del usuario y globales
	delete Datos.ultEducatrees.global;
	delete Datos.ultEducatrees[Sesion.usuario.uid];
	delete Datos.ultAnotaciones.global;
	delete Datos.ultAnotaciones[Sesion.usuario.uid];
	
	// obtengo los taxones candidatos (igual o más generales que los del árbol 
	// y encajándolos con los filtros de taxón usados en la sesión)
	let txcands = [ 'undefined' ];
	if (bobj.species) {
		txcands = [ 'undefined', 
			..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[bobj.species].superexpuris) ]; }
	// inserto el árbol de las celdas
	insertarArbolCeldas(bobj.iri, txcands);

	// borro clusters y árboles pintados en el mapa
	Layers.arbs.clearLayers(); // quito marcadores árboles
	Layers.clarbs.clearLayers(); // quito marcadores clusters
	Sesion.celdasPintadas = {}; // ninguna celda pintada
	Sesion.arbsPintados = {}; // ningún marcador de árbol

	// todo OK
	return Promise.resolve(true);
}

// ANOTACIÓN DE EDUCATREE
async function annotateEducatree(iri, patch, tobjclon, bobjclon) {
	// preparo objeto parámetros plantilla
	const objpars = {
		iri: iri,
		id: "EducaTree"
	};
	// hago la llamada a CRAFTS con el patch
	//console.log("ANOTANDO EDUCATREE...");	
	await Crafts.patchData(config.craftsConfig.resourceTemplate, objpars, patch);
	
	// actualizo datos usuario para que cuente la nueva anotación
	delete Datos.usuarios[Sesion.usuario.uid]; 
	await getUserData(Sesion.usuario.uid);
	
	// actualizo datos del árbol
	Datos.educatrees[iri] = tobjclon;
	if (bobjclon) {
		// detecto cambio de posición o de taxón 
		if (Datos.arboles[iri] && (Datos.arboles[iri].lat != bobjclon.lat || 
				Datos.arboles[iri].lng != bobjclon.lng || Datos.arboles[iri].species !== bobjclon.species) ) {
			// elimino el árbol "previo" de las celdas
			let txcands = [ 'undefined' ];
			if (Datos.arboles[iri].species) {
				txcands = [ 'undefined', 
					..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[Datos.arboles[iri].species].superexpuris) ]; }
			eliminarArbolCeldas(iri, txcands);
			
			// ahora actualizo el árbol básico para que coja bien los cambios de posición
			Datos.arboles[iri] = bobjclon;

			// inserto el árbol "nuevo" de las celdas
			txcands = [ 'undefined' ];
			if (bobjclon.species) {
				txcands = [ 'undefined', 
					..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[bobjclon.species].superexpuris) ]; }
			insertarArbolCeldas(iri, txcands);		
		}
		// y ahora actualizo el árbol básico (para resto de casos)
		Datos.arboles[iri] = bobjclon;	
	}
	
	// borro también las páginas de árboles del usuario y globales
	delete Datos.ultEducatrees.global;
	delete Datos.ultEducatrees[Sesion.usuario.uid];
	delete Datos.ultAnotaciones.global;
	delete Datos.ultAnotaciones[Sesion.usuario.uid];
	
	// borro clusters y árboles pintados en el mapa
	Layers.arbs.clearLayers(); // quito marcadores árboles
	Layers.clarbs.clearLayers(); // quito marcadores clusters
	Sesion.celdasPintadas = {}; // ninguna celda pintada
	Sesion.arbsPintados = {}; // ningún marcador de árbol

	// todo OK
	return Promise.resolve(true);
}

// BORRADO DE ANOTACIÓN DE EDUCATREE
async function deleteAnnotationEducatree(iri, patch, objsborrar, tobjclon, bobjclon) {
	// preparo objeto parámetros plantilla
	const objpars = {
		iri: iri,
		id: "EducaTree"
	};
	// hago la llamada a CRAFTS con el patch
	//console.log("BORRANDO ANOTACIÓN DE EDUCATREE...");
	await Crafts.patchData(config.craftsConfig.resourceTemplate, objpars, patch);
	// llamadas a CRAFTS para borrar las anotaciones
	for (const elobj of objsborrar) {
		//console.log("Borrando IRI "  + elobj.iri + " de tipo " + elobj.id);
		await Crafts.deleteData(config.craftsConfig.resourceTemplate, elobj);
	}
	
	// actualizo datos usuario para que actualice anotaciones
	delete Datos.usuarios[Sesion.usuario.uid]; 
	await getUserData(Sesion.usuario.uid);
	
	// actualizo datos del árbol
	Datos.educatrees[iri] = tobjclon;
	if (bobjclon) {	
		// detecto cambio de posición o de taxón 
		if (Datos.arboles[iri] && (Datos.arboles[iri].lat != bobjclon.lat || 
				Datos.arboles[iri].lng != bobjclon.lng || Datos.arboles[iri].species !== bobjclon.species) ) {
			// elimino el árbol "previo" de las celdas
			let txcands = [ 'undefined' ];
			if (Datos.arboles[iri].species) {
				txcands = [ 'undefined', 
					..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[Datos.arboles[iri].species].superexpuris) ]; }
			eliminarArbolCeldas(iri, txcands);
			
			// ahora actualizo el árbol básico para que coja bien los cambios de posición
			Datos.arboles[iri] = bobjclon;

			// inserto el árbol "nuevo" de las celdas
			txcands = [ 'undefined' ];
			if (bobjclon.species) {
				txcands = [ 'undefined', 
					..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[bobjclon.species].superexpuris) ]; }
			insertarArbolCeldas(iri, txcands);		
		}	
		// y ahora actualizo el árbol básico (para resto de casos)
		Datos.arboles[iri] = bobjclon;	
	}
	
	// borro también las páginas de árboles del usuario y globales
	delete Datos.ultEducatrees.global;
	delete Datos.ultEducatrees[Sesion.usuario.uid];
	delete Datos.ultAnotaciones.global;
	delete Datos.ultAnotaciones[Sesion.usuario.uid];
	
	// borro clusters y árboles pintados en el mapa
	Layers.arbs.clearLayers(); // quito marcadores árboles
	Layers.clarbs.clearLayers(); // quito marcadores clusters
	Sesion.celdasPintadas = {}; // ninguna celda pintada
	Sesion.arbsPintados = {}; // ningún marcador de árbol

	// todo OK
	return Promise.resolve(true);
}


// BORRADO DE EDUCATREE
async function deleteEducatree(iri) {
	// pido datos a CRAFTS del educatree (ya debería tenerlos)
	await getDatosEducatree(iri);
	const et = Datos.educatrees[iri];
	
	// analizo los datos para preparar los borrados con CRAFTS
	const objpars = [
		{ 	iri: iri,
			id: "EducaTree" } ];
	// posiciones (funciona aunque no existan posiciones)
	const piris = _.union( extractAllElements(et, [ 'position', 'iri']),
		extractAllElements(et, [ 'positionAnnotations', 'iri']) );
	for (const piri of piris) {
		objpars.push( { iri: piri, id: 'PositionAnnotation'} );
	}
	// especies (funciona aunque no existan especies)
	const eiris = _.union( extractAllElements(et, [ 'species', 'iri']),
		extractAllElements(et, [ 'speciesAnnotations', 'iri']) );
	for (const eiri of eiris) {
		objpars.push( { iri: eiri, id: 'SpeciesAnnotation'} );
	}
	// tree status (funciona aunque no existan)
	const tsiris = _.union( extractAllElements(et, [ 'treeStatus', 'iri']),
		extractAllElements(et, ['treeStatusAnnotations', 'iri']) );
	for (const tsiri of tsiris) {
		objpars.push( { iri: tsiri, id: 'TreeStatusAnnotation'} );
	}
	// fotos (funciona aunque no existan)
	const firis = extractAllElements(et, ['imageAnnotations', 'iri']);
	for (const firi of firis) {
		objpars.push( { iri: firi, id: 'ImageAnnotation'} );
	}
	// imágenes de las fotos (funciona aunque no existan)
	const iiris = extractAllElements(et, ['imageAnnotations', 'image', 'iri']);
	for (const iiri of iiris) {
		objpars.push( { iri: iiri, id: 'Image'} );
	}	
	// alturas (funciona aunque no existan)
	const airis = _.union( extractAllElements(et, ['height', 'iri']),
		extractAllElements(et, ['heightAnnotations', 'iri']) );
	for (const airi of airis) {
		objpars.push( { iri: airi, id: 'HeightAnnotation'} );
	}
	// diámetros (funciona aunque no existan)
	const diris = _.union( extractAllElements(et, ['diameter', 'iri']),
		extractAllElements(et, [ 'diameterAnnotations', 'iri' ]) );
	for (const diri of diris) {
		objpars.push( { iri: diri, id: 'DiameterAnnotation'} );
	}
	// observaciones (funciona aunque no existan)
	const oiris = extractAllElements(et, ['observations', 'iri']);
	for (const oiri of oiris) {
		objpars.push( { iri: oiri, id: 'ObservationAnnotation'} );
	}
	//console.log(objpars);

	// borrados en CRAFTS
	//console.log("BORRANDO EDUCATREE...");
	for (const elobj of objpars) {
		//console.log("Borrando IRI "  + elobj.iri + " de tipo " + elobj.id);
		await Crafts.deleteData(config.craftsConfig.resourceTemplate, elobj);
	}

	// obtengo los taxones candidatos (igual o más generales que los del árbol 
	// y encajándolos con los filtros de taxón usados en la sesión)
	let txcands = [ 'undefined' ];
	if (et.species && et.species.species) {
		txcands = [ 'undefined', 
			..._.intersection(Object.keys(Sesion.txUsados), Datos.especies[et.species.species.iri].superexpuris) ]; }
	// elimino el árbol de las celdas
	eliminarArbolCeldas(iri, txcands);

	// elimino los datos del árbol
	delete Datos.educatrees[iri];
	delete Datos.arboles[iri];
	
	// borro también las páginas de árboles del usuario y globales
	delete Datos.ultEducatrees.global;
	delete Datos.ultEducatrees[Sesion.usuario.uid];
	delete Datos.ultAnotaciones.global;
	delete Datos.ultAnotaciones[Sesion.usuario.uid];
		
	// por último borro clusters y árboles pintados en el mapa
	Layers.arbs.clearLayers(); // quito marcadores árboles
	Layers.clarbs.clearLayers(); // quito marcadores clusters
	Sesion.celdasPintadas = {}; // ninguna celda pintada
	Sesion.arbsPintados = {}; // ningún marcador de árbol
}


// ACTUALIZACIÓN CELDAS POR INSERCIÓN ÁRBOL
function insertarArbolCeldas(iri, txcands) {
	const arb = Datos.arboles[iri];
	if (arb) { // sólo actúo si existe el árbol básico (el usado en el mapa)
		// obtengo bounds con la posición del árbol
		const bounds = L.latLngBounds([	[ arb.lat, arb.lng ], [ arb.lat, arb.lng ] ]);
		// recorro todos los niveles de zoom usados en el mapa
		for (const z in Sesion.zoomUsados) {
			// obtengo el grid (siempre se corresponderá con una celda al ser bounds un punto)
			const grid = getGrid(bounds, z);
			//console.log(" - Zoom: " + z + " - S: " + grid.cellS+ " - N: " + grid.cellN
			//	+ " - W: " + grid.cellW+ " - E: " + grid.cellE);
			// recorro txcands
			for (const tx of txcands) {
				// genero etiqueta de celda
				const et = 'z' + z + '_x' + grid.cellW + '_y' + grid.cellN + '_' + tx;
				// si la celda existe...
				let celda = Datos.celdasArboles[et];
				if (celda) {
					if (celda.edu && !celda.edu.mmil) { // sólo en este caso se hará algo
						// actualización array edutrees
						if (!celda.edu.trees)
							celda.edu.trees = [];
						celda.edu.trees.push(iri);
						// actualización ntrees
						if (!celda.edu.ntrees)
							celda.edu.ntrees = 0;
						celda.edu.ntrees++;		
					}			
				}
			}
		}
	}
}
// ACTUALIZACIÓN CELDAS POR ELIMINACIÓN ÁRBOL
function eliminarArbolCeldas(iri, txcands) {
	const arb = Datos.arboles[iri];
	if (arb) { // sólo actúo si existe el árbol básico (el usado en el mapa)
		// obtengo bounds con la posición del árbol
		const bounds = L.latLngBounds([	[ arb.lat, arb.lng ],	[ arb.lat,	arb.lng ] ]);
		// elimino árbol en las celdas pertinentes
		// recorriendo todos los niveles de zoom usados en el mapa
		for (const z in Sesion.zoomUsados) {
			// obtengo el grid (siempre se corresponderá con una celda al ser bounds un punto)
			const grid = getGrid(bounds, z);
			// recorro txcands
			for (const tx of txcands) {
				// genero etiqueta de celda
				const et = 'z' + z + '_x' + grid.cellW + '_y' + grid.cellN + '_' + tx;
				// si la celda existe...
				let celda = Datos.celdasArboles[et];
				if (celda) {
					if (celda.edu && !celda.edu.mmil) { // sólo en este caso se hará algo
						// actualización array edutrees => elimino árbol
						if (celda.edu.trees)
							celda.edu.trees = celda.edu.trees.filter(item => item !== iri);
						// actualización ntrees
						if (!celda.edu.ntrees && celda.edu.ntrees != 0)
							celda.edu.ntrees--;
					}			
				}
			}
		}
	}
}


///////////////////////
// PROCESAMIENTO CELDAS
///////////////////////

// función clave para obtener los candidatos para cachear datos
function getCeldasCandidatas(arriba, ocgm, cz, taxones) {
	// calculo rango de zooms permitidos
	const zini = config.minZoom;
	// hacia abajo permito un máximo de 3 niveles para evitar explosión
	const zfin = cz + 3 > config.zMaxCelda? config.zMaxCelda : cz + 3;
	// obtengo candidatos sin incluir el zoom cz
	let objc = {};
	for (let z=zini; z<=zfin; z++) {
		// aquí es donde miro si es hacia arriba o hacia abajo
		if ( (arriba && z < cz) || (!arriba && z > cz) ) {
			if (ocgm[z]) { // sólo procedo si existe el nivel correspondiente de zoom
				objc[z] = {}; // un objeto por nivel de zoom
				for (const tx of taxones) {
					objc[z][tx] = []; // un array por taxón
					for (let x=ocgm[z].cellW; x<=ocgm[z].cellE; x++) {
						for (let y=ocgm[z].cellS; y<=ocgm[z].cellN; y++) {
							const et = 'z' + z + '_x' + x + '_y' + y+'_' + tx;
							objc[z][tx].push(et); // le enchufo la etiqueta
						}
					}
				}
			}		
		}
	}
	return objc;
}
function getQueryCeldaBounds(cellX, cellY, z) {
	// obtengo primero los bounds
	const bounds = getCeldaBounds(cellX, cellY, z);
	// preparo objeto consulta celda quitando ciclos por el antimeridiano
	let qobj = {	
		"latsouth" : bounds.getSouth(),
		"latnorth" : bounds.getNorth(),
		"lngwest" : quitarCiclosAntimeridiano(bounds.getWest()),
		"lngeast" : quitarCiclosAntimeridiano(bounds.getEast())
	};
	// devuelvo
	return qobj;
}
// RECUPERAR IFNTREES Y EDUCATREES POR CELDA
async function processTreesCell(objcell) {
	// preparo qobj por si tengo que hacer una petición a CRAFTS
	let qobj = getQueryCeldaBounds(objcell.cellX, objcell.cellY, objcell.zoom);
	qobj.species = objcell.taxon;
	
	// referencia a mi celda
	let mycell = Datos.celdasArboles[objcell.et];
	
	// OBTENGO CANDIDATOS PARA EL CACHEO
	// obtengo matriz de grids para esta celda (pero sólo para los zooms usados)
	const ocgm = getCeldaGridMatrix(objcell.cellX, objcell.cellY, objcell.zoom, Sesion.zoomUsados);
	// aquí tengo las celdas candidatas por nivel de zoom y taxón (generales y específicas, incluyendo la etiqueta de mycell)
	const candgen = getCeldasCandidatas(true, ocgm, objcell.zoom, objcell.txgen);
	const candesp = getCeldasCandidatas(false, ocgm, objcell.zoom, objcell.txesp);
	
	// preinicializo la celda si no existe
	if (mycell == undefined) {
		Datos.celdasArboles[objcell.et] = {	};
		mycell = Datos.celdasArboles[objcell.et];
	}
	
	// detección +1000 árboles para caso ("ifn" y "edu"")  si no hay nada
	const casos = objcell.ifn? ["ifn", "edu"] : ["edu"];
	for (const caso of casos) {
		if (!mycell[caso]) {			
			// comprobación especial de zona para el IFN
			if (caso === "ifn") {
				// compruebo primero si la celda cae en España
				// (si no, no tiene sentido pedir datos del IFN)
				let hayIFN = false;
				const celdabounds = getCeldaBounds(objcell.cellX, objcell.cellY, objcell.zoom);
				for (const zona of config.zonasIFN) {
					// reajusto zona por el antimeridiano
					const zonareajustada = [
						[zona[0][0], ponerCiclosAntimeridiano(zona[0][1], objcell.cellX, objcell.zoom) ],
						[zona[1][0], ponerCiclosAntimeridiano(zona[1][1], objcell.cellX, objcell.zoom) ]
					];	
					const zonabounds = L.latLngBounds(zonareajustada);
					if (zonabounds.intersects( celdabounds ) )
						hayIFN = true;
				}			
				// si no está en España, asigno mmil a false y ntrees a 0
				if (!hayIFN)
					mycell[caso] = { mmil: false, ntrees: 0};
			}			
			// si no hay datos sigo
			if (!mycell[caso]) {
				// inicializo
				mycell[caso] = {};			
				// CACHEO: miro si me puedo ahorrar la petición
				let bingo = false;
				hayMmilLoop:
				for (const z in candesp) { // me basta con que haya una celda de un nivel igual o más específica con mmil==true
					for (const tx in candesp[z]) { 
						for (const et of candesp[z][tx]) {
							if (Datos.celdasArboles[et] && Datos.celdasArboles[et][caso] 
									&& Datos.celdasArboles[et][caso].mmil) {
								bingo = true;
								mycell[caso].mmil = true;
								mycell[caso].locCluster = Datos.celdasArboles[et][caso].locCluster;
								//console.warn("cantamos bingo => deducción mmil=true por celda más específica");
								break hayMmilLoop;
							}
						}
					}
				}
				if (!bingo) { // insisto, analizando ahora las generales si hay alguna con mmil==false
					noHayMmilLoop:
					for (const z in candgen) { // me basta con que haya una celda de un nivel igual o más general con mmil==false
						for (const tx in candgen[z]) { 
							for (const et of candgen[z][tx]) {
								if (Datos.celdasArboles[et] && Datos.celdasArboles[et][caso] 
										&& Datos.celdasArboles[et][caso].mmil != undefined && !Datos.celdasArboles[et][caso].mmil) {
									bingo = true;
									mycell[caso].mmil = false;
									//console.warn("cantamos bingo => deducción mmil=false por celda más general");
									break noHayMmilLoop;
								}
							}
						}
					}		
				}
				// FIN CACHEO	
				if (!bingo) { // hay que hacer la petición	
					qobj.limit = 1;
					qobj.offset = 1000;
					const template = caso === "ifn"? config.craftsConfig.queryTreesinboxbasico : config.craftsConfig.queryEducatreesinbox;
					// hago la llamada a CRAFTS	y espero resultados
					objcell.npc.push(1);
					const datos = await Crafts.getData(template, qobj);
						
					// inicializo mmil a false
					mycell[caso].mmil = false;
					// analizo primera fila, si la hay
					if (datos.results.bindings.length > 0) {
						// si hay datos es que hay más de mil árboles
						mycell[caso].mmil = true;
						// aprovecho para guardar esa localización para posicionar el cluster
						mycell[caso].locCluster = {
							lat: Number(datos.results.bindings[0].lat.value),
							lng: Number(datos.results.bindings[0].lng.value)
						};		
					}
				}			
			}
		}
	}
	
	// aquí hago un split de ifntrees y de educatrees
	let promesas = [];
	for (let caso of casos)
		promesas.push( getCellTrees(mycell, candgen, objcell, qobj, caso) );
	
	// espero a que terminen todas las promesas
	await Promise.all(promesas);
	
	
	// actualizo info del número de consultas y si la celda estaba cacheada (si no hizo falta hacer consultas)
	if (objcell.idtimeout == Sesion.idTimeoutActualizar) { // sólo si no ha vencido el temporizador	
		Sesion.infoCeldas.finalizadas.push(1);
		const totnpc = _.reduce(objcell.npc, function(memo, num){ return memo + num; }, 0);
		if (totnpc == 0)
			Sesion.infoCeldas.cacheadas.push(1);
		Sesion.infoCeldas.npc.push(totnpc);
		
		// actualizo la barra de progreso (sólo si no ha vencido el temporizador)
		if (objcell.progreso)
			objcell.progreso(true);
	}	
	
	// hacemos el render
	if (objcell.render)
		objcell.render(objcell);	

	// fue todo bien, resuelvo la promesa
	return Promise.resolve();	
}
async function getCellTrees(mycell, candgen, objcell, qobj, caso) {
	try {
		// si hay menos de mil árboles y no hay cuenta de trees, hay que calcularlo
		if (!mycell[caso].mmil && mycell[caso].ntrees == undefined) {			
			// CACHEO: miro si me puedo ahorrar la petición
			let bingo = false;
			// obtengo los zooms de candgen de mayor a menor
			// (para empezar por las celdas de similar tamaño y así ahorrarme la comprobación del bounds)
			const zooms = Object.keys(candgen).map(Number).sort((a, b) => b - a);
			cuentaLoop: // analizo sólo las celdas más generales
			for (const z of zooms) {
				for (const tx in candgen[z]) { 
					for (const et of candgen[z][tx]) {
						// compruebo si la cuenta de una celda más general es 0											
						if (Datos.celdasArboles[et] && Datos.celdasArboles[et][caso]
								&& Datos.celdasArboles[et][caso].ntrees == 0) {
							bingo = true;
							mycell[caso].ntrees = 0;
							//console.warn("cantamos bingo => deducción ntrees 0");
							break cuentaLoop;
						} // si tengo los árboles de la celda más general puedo contar
						else if (Datos.celdasArboles[et] && Datos.celdasArboles[et][caso]
								&& Datos.celdasArboles[et][caso].trees != undefined) {
							bingo = true;
							// inicializo datos
							mycell[caso].trees = [];
							mycell[caso].ntrees = 0;
							// si no coincide el zoom obtengo los bounds para comprobar si el árbol cae dentro
							const bounds = z != objcell.zoom? getCeldaBounds(objcell.cellX, objcell.cellY, objcell.zoom) : null;
							// miro árbol a árbol en la celda más general en la que me baso							
							for (const arbiri of Datos.celdasArboles[et][caso].trees) {							
								const arb = Datos.arboles[arbiri];
								// si no coincide el zoom tengo que comprobar que el árbol esté contenido en la celda
								const llarb = L.latLng(arb.lat, 
											ponerCiclosAntimeridiano(arb.lng, objcell.cellX, objcell.zoom));
								if (bounds && !bounds.contains(llarb))
									continue; // siguiente árbol...
								// si hay filtro de taxón compruebo que esté incluido
								if (objcell.taxon) {
									const spuri = getMoreSpecificSpecies(arb.species);
									if (spuri == undefined || !_.contains(Datos.especies[objcell.taxon].expuris, spuri))
										continue; // siguiente árbol...
								}
								// si llega aquí está todo bien e incluyo los datos
								mycell[caso].trees.push(arbiri);
								mycell[caso].ntrees++;
							}
							//console.warn("cantamos bingo => deducción análisis trees");
							break cuentaLoop;
						}
					}
				}
			}
			// FIN CACHEO			
			if (!bingo) { // hay que hacer la petición	
				// pido número de árboles de la celda
				// hago la llamada a CRAFTS	y espero resultados
				objcell.npc.push(1);
				const temp = caso === "ifn"? config.craftsConfig.queryCountTreesinbox : config.craftsConfig.queryCountEducatreesinbox;
				const datos = await Crafts.getData(temp, qobj);
							
				// inicializo (por si acaso, pero no debería hacer falta)
				mycell[caso].ntrees = 0;
				// guardo el dato de la cuenta
				for (const row of datos.results.bindings)
					mycell[caso].ntrees = Number(row.count.value);
			}		
		}
	
		// pido los datos de los árboles de la celda si no los tiene y si pasa el umbral
		if (!mycell[caso].mmil && 
				mycell[caso].ntrees <= config.treeThreshold && 
				mycell[caso].ntrees > 0 && 
				mycell[caso].trees == undefined) {
			// quito offset y pongo un límite de  1000, más que suficiente para la petición
			delete qobj.offset;
			qobj.limit = 1000;
			// hago la llamada a CRAFTS	y espero resultados
			objcell.npc.push(1);
			const temp = caso === "ifn"? config.craftsConfig.queryTreesinbox : config.craftsConfig.queryEducatreesinbox;
			const datos = await Crafts.getData(temp, qobj);
									
			// inicializo array resultados
			mycell[caso].trees = [];
			// analizo fila a fila
			for (const row of datos.results.bindings) {
				// uri del árbol
				const arbiri = row.tree.value;
				// incluyo en la celda si no estaba
				if (!_.contains(mycell[caso].trees, arbiri))
					mycell[caso].trees.push(arbiri);
				// guardo objeto con datos del árbol si no estaba
				if (Datos.arboles[arbiri] == undefined) {
					// aquí divido el procesamiento según el caso
					if (caso === "ifn")	{
						if (Datos.arboles[arbiri] == undefined)
							Datos.arboles[arbiri] = {};
						let arbobj = Datos.arboles[arbiri];
						// guardo uri (sólo si no existía)
						// NOTA: para árboles del IFN uso clave "uri" en vez de "iri"
						// así los distingo fácilmente de los edutrees
						if (arbobj.uri == undefined)
							arbobj.uri = arbiri; 
						// guardo posición (sólo si no existía)
						if (arbobj.lat == undefined)
							arbobj.lat = Number(row.lat.value);
						if (arbobj.lng == undefined)
							arbobj.lng = Number(row.lng.value);
						// guardo cada medida (sólo si no existían)
						if (arbobj.dbh1mm == undefined)
							arbobj.dbh1mm = Number(row.dbh1mm.value);
						if (arbobj.dbh2mm == undefined)
							arbobj.dbh2mm = Number(row.dbh2mm.value);
						if (arbobj.heightM == undefined)
							arbobj.heightM = Number(row.heightM.value);				
						// guardo especie (sólo si no existía)
						if (arbobj.species == undefined && row.type != undefined) // type es un valor opcional
							arbobj.species = row.type.value;
					}
					else {
						Datos.arboles[arbiri] = {
							'iri': arbiri,
							'lat': Number(row.lat.value),
							'lng': Number(row.lng.value),
							'pending': true	// clave para recuperar los datos en la siguiente petición
						};
					}
				}
			}
		}
		// caso "edu", recupero árboles si es necesario
		if (caso === "edu" && mycell[caso].trees != undefined) {
			// obtengo los edutrees pendientes de recuperar
			let eiris = [];
			for (const eiri of mycell[caso].trees) {
				if (Datos.arboles[eiri].pending)
					eiris.push(eiri);
			}
			// pido descomponer en objetos para la llamada resources de CRAFTS	
			const objrs = descomponerCraftsResources('BasicEducaTree', eiris);
	
			// ya tengo los objetos a pedir, lanzo las peticiones en paralelo a CRAFTS
			let promesas = [];
			for (const objr of objrs) {
				// creo una promesa para cada petición
				promesas.push( new Promise(async function(resolve, reject) {
					try {
						// hago la llamada a CRAFTS	y espero resultados
						objcell.npc.push(1);
						let datos = await Crafts.getData(config.craftsConfig.resourcesTemplate, objr);
						// convierto en array si es necesario
						if (!Array.isArray(datos))
							datos = [ datos ];			
						// y actualizo educatree a educatree
						for (const eobj of datos) {
							// si está pendiente reemplazo y a volar
							if (Datos.arboles[eobj.iri].pending)
								Datos.arboles[eobj.iri] = eobj;
						}							
						// resuelvo la promesa
						resolve(true);
					} catch(err) {
						reject(err);
					}
				}));
			}
	
			try {
				// espero a que terminen todas las promesas
				await Promise.all(promesas);
			} catch(err) {
				console.error(err);
			}	
		}
	
		// si hay que colocar un cluster entonces obtengo la localización de un árbol aleatorio de 0 a config.treeThreshold
		if (!mycell[caso].mmil &&
				mycell[caso].ntrees > config.treeThreshold &&
				mycell[caso].locCluster == undefined ) {
			// número aleatorio entre 0 y mycell[caso].ntrees (en vez de config.treeThreshold)
			qobj.offset = Math.floor(Math.random() * mycell[caso].ntrees);
			qobj.limit = 1;	// sólo quiero un árbol
			// hago la llamada a CRAFTS	y espero resultados
			objcell.npc.push(1);
			const template = caso === "ifn"? config.craftsConfig.queryTreesinboxbasico : config.craftsConfig.queryEducatreesinbox;			
			const datos = await Crafts.getData(template, qobj);		
			// inicializo la localización
			mycell[caso].locCluster = null;
			// analizo primera fila, si la hay
			if (datos.results.bindings.length > 0) {
				mycell[caso].locCluster = {
					lat: Number(datos.results.bindings[0].lat.value),
					lng: Number(datos.results.bindings[0].lng.value)
				};		
			}	
		}
		
		// fue todo bien, resuelvo la promesa
		return Promise.resolve();		
	} catch(err) {
		// si hay algún error rechazo la promesa
		console.error(err);
		return Promise.reject(err);
	}
}

export { initClass, getPlantPartsPhotoInfo, getSpeciesInfo, obtenerEspeciesExpandidas,
	processTreesCell, getDatosEducatree, getDatosLoteEducatrees, getTreePages, 
	getUserData, nickExists, setNick, 
	createEducatree, deleteEducatree, setTreeNick, 
	annotateEducatree, deleteAnnotationEducatree, 
	getValidTaxons, extractWikidataTaxon, getExistingWikidataTaxons, createTaxonFromWikidata };

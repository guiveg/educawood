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

import _ from 'underscore';
import $ from "jquery";

import { Datos } from '../main.js';

// GENERACIÓN DEL ID
// nanoid: https://github.com/ai/nanoid/
// versión de https://cdn.jsdelivr.net/npm/nanoid/nanoid.js
let nanoid=(t=21)=>crypto.getRandomValues(new Uint8Array(t)).reduce(((t,e)=>t+=(e&=63)<36?e.toString(36):e<62?(e-26).toString(36).toUpperCase():e>62?"-":"_"),"");

function generateId(length) {
	let id = nanoid(length);
	// no permito que el id empiece por '-' (ver qnames https://en.wikipedia.org/wiki/QName)
	if (id.startsWith('-'))
		id = id.replace('-', '_');
	return id;
}


// PARSING LOCATIONS
function string2loc(cad) {
	const cachos = cad.split(",");
	if (cachos.length == 3) {
		const latpars = cachos[0];
		const lngpars = cachos[1];
		const zpars = cachos[2].split("z")[0];
		// compruebo que los valores estén bien antes de reajustar
		if ( !isNaN( Number(latpars) ) ) {
			if ( !isNaN( Number(lngpars) ) ) {
				if ( Number.isInteger( Number(zpars) ) ) {
					if ( Number(latpars) >= -90 &&  Number(latpars) <= 90 ) {
						// LOCALIZACIÓN CORRECTA
						let obj = {
							lat: Number(latpars),
							lng: Number(lngpars),
							z: Number(zpars)
						}
						return obj;					
					}				
				}
			}		
		}
	}
	// si no consigo hacer el parsing con éxito
	return null;
}
function loc2string(loc) {
	// aquí no hago comprobaciones del objeto loc
	return loc.lat.toFixed(6) + ',' + loc.lng.toFixed(6) + ',' + loc.z + 'z';
}


// LENGUAJE Y LITERALES
// obtengo lenguaje preferido
function getPreferredLang() {
	let lang = localStorage.getItem('lang');
	if (!lang) {
		// elijo automáticamente a partir del lenguaje del navegador
		const preflangs = window.navigator.languages || [window.navigator.language || window.navigator.userLanguage];
		for (let ltag of preflangs) {
			const langev = ltag.substring(0, 2);
			if (_.contains(config.langs, langev)) {
				lang = langev;
				break;
			}
		}
		if (!lang)
			lang = config.langs[0]; // inglés
	}
	return lang;
}

// la uso para comprobar si cadgrande incluye cadpeq utilizando cadenas normalizadas
function indexOfNormalized(cadgrande, cadpeq) {
	// normalizo cadenas según: https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
	// adicionalmente las pongo en minúsculas para comparar
	var cgnorm = cadgrande.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
	var cpnorm = cadpeq.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
	return cgnorm.indexOf(cpnorm);
}

function getLiteral(litobj, def) {
	// si no está definido el objeto, valor por defecto
	if (litobj == undefined)
		return def;
		
	// 5/3/21 si es un array, convierto a un objeto
	if (Array.isArray(litobj)) {
		let aux = {};
		for (let i=0; i<litobj.length; i++) {
			const el = litobj[i];
			if (typeof el === 'object') {
				// incluyo en aux los pares clave-valor
				const claves = Object.keys(el);
				for (let j=0; j<claves.length; j++) {
					const clave = claves[j];
					aux[clave] = el[clave];				
				}
			}
			else // si no es un objeto, meto directamente el valor con "nolang"
				aux[config.nolang] = el;
		}
		// cambio el objeto a analizar
		litobj = aux;
	} else if (typeof litobj !== 'object') { // y si es un literal lo convierto
		let aux = {}
		aux[config.nolang] = litobj;
		litobj = aux;
	}	
	
	// 2023-11 permito elegir el idioma
	let lang = getPreferredLang();	
	// devuelvo la cadena en el lenguaje elegido si existe
	if (litobj[lang])
		return litobj[lang];
	// en otro caso devuelvo la cadena sin etiqueta de idioma
	if (litobj[config.nolang]) 
		return litobj[config.nolang];
	// pruebo en latín...
	if (litobj['la']) 
		return litobj['la'];
	// cadena por defecto en otro caso...
	if (def)
		return def;	
	// pruebo con el resto de lenguas de la configuración
	for (let ltag of config.langs) {
		if (ltag !== lang && litobj[ltag])
			return litobj[ltag];
	}
	// nada que hacer...
	return undefined;
}

function getPosition(obj) {
	let cad = null;
	if (obj.latWGS84 && obj.lngWGS84) {
		cad = getLiteral(dict.latitude) + " " + obj.latWGS84.toFixed(6) + ", " 
			+ getLiteral(dict.longitude) + " " + obj.lngWGS84.toFixed(6);// + " (WGS 84)";
	}
	return cad;
}

function getCreatorLabel(obj, pref) {
	let cad = null;
	if (obj.creator) {		
		cad = pref + getCreator(obj, true);
		// fecha
		const fecha = getDate(obj);
		if (fecha)
			cad += getLiteral(dict.onDate) + fecha;
	}
	return cad;
}
function getCreator(obj, conhiperenlace) {
	const target = obj.creator? obj.creator : obj;
	if (target) {
		const criri = target.iri? getLiteral(target.iri) : getLiteral(target);
		const uid = criri.lastIndexOf("/") === -1? criri : criri.substring(criri.lastIndexOf("/") + 1);
		// cojo primero el nick en Datos.usuarios[uid] (por si actualizó su nick),
		// en segunda opción el nick del objeto y si no, el uid
		let cr = (Datos.usuarios[uid] && Datos.usuarios[uid].nick)? getLiteral(Datos.usuarios[uid].nick) : (target.nick? getLiteral(target.nick) : uid);
		if (cr.length > 15)
			cr = cr.substring(0, 12) + "…";
		if (conhiperenlace) 
			cr = '<a class="pagusuario" uid="'+uid+'" href="/user/'+uid+'">' + cr + '</a>';
		return cr;
	}
	return null;
}
function getCreatorObj(obj) {
	const target = obj.creator? obj.creator : obj;
	if (target) {
		const criri = target.iri? getLiteral(target.iri) : getLiteral(target);
		const uid = criri.lastIndexOf("/") === -1? criri : criri.substring(criri.lastIndexOf("/") + 1);
		const crobj = { id : uid};
		// si hay nick lo incluyo
		const nick = (Datos.usuarios[uid] && Datos.usuarios[uid].nick)? getLiteral(Datos.usuarios[uid].nick) : (target.nick? getLiteral(target.nick) : null);		
		if (nick)
			crobj.nick = nick;
		return crobj;
	}
	return null;
}
function getDate(obj) {
	const fecha = obj.created? obj.created : obj;
	if (fecha) {
		const dops = { year: 'numeric', month: 'long', day: 'numeric' };
		if (fecha != undefined && !isNaN(Date.parse(fecha)))
			return new Date(Date.parse(fecha)).toLocaleDateString(getLiteral(dict.local), dops);
	}
	return null;
}
function getNumericDate(obj) {
	const fecha = obj.created? obj.created : obj;
	if (fecha && !isNaN(Date.parse(fecha)))
		return new Date(Date.parse(fecha)).toLocaleDateString(getLiteral(dict.local));
	return null;
}



// extracción primer elemento válido siguiendo las claves en keys
// la dificultad está en que el objeto puede tener elementos que sean objetos o arrays
function extractFirstElement(obj, keys, decomposelastarray) {
	// cojo primer elemento
	const subobj = obj[ keys[0] ];
	if (keys.length == 1) {
		// hemos llegado al final (hoja)
		if (decomposelastarray && Array.isArray(subobj)) {
			// si el elemento final es un array y nos piden descomponerlo, nos quedamos con el primer elemento y a volar
			return subobj[0];
		}
		else		
			return subobj;
	}
	else { // toca recursión
		const newkeys = _.rest(keys);
		if (Array.isArray(subobj)) {
			// caso delicado, toca iterar por cada elemento del array a ver si hay suerte y alguno lo consigue
			for (let j=0; j<subobj.length; j++) {
				let res = extractFirstElement(subobj[j], newkeys);
				if (res != null)
					return res; // lo conseguimos			
			}
			// no hubo suerte...
			return null;
		}
		else if (typeof subobj === 'object') {
			// aplicamos recursión, sin más
			return extractFirstElement(subobj, newkeys);
		}
		else // es null o un literal...
			return null;
	}
}
// aquí no queremos uno, sino que cogemos todos (DEVUELVE SIEMPRE UN ARRAY)
function extractAllElements(obj, keys) {
	// cojo primer elemento
	const subobj = obj[ keys[0] ];
	if (keys.length == 1) {
		// hemos llegado al final (hoja)
		if (subobj == undefined)
			return [];
		else if (Array.isArray(subobj))
			return subobj;
		else		
			return [ subobj ];
	}
	else { // toca recursión
		const newkeys = _.rest(keys);
		if (Array.isArray(subobj)) {
			// caso delicado, toca iterar por cada elemento del array
			let subels = []; // aquí metemos los subelementos que nos van valiendo
			for (let j=0; j<subobj.length; j++) {
				let parcels = extractAllElements(subobj[j], newkeys);
				if (parcels.length > 0) // juntamos				
					subels = subels.concat(parcels);
			}
			return subels;
		}
		else if (typeof subobj === 'object') {
			// aplicamos recursión, sin más
			return extractAllElements(subobj, newkeys);
		}
		else // es null o un literal...
			return [];
	}
}


function uriToLiteral(uri) {
	// extraigo la última parte de la uri
	let lit = "";
	if (uri.split("#").length > 1)
		lit = uri.split("#")[uri.split("#").length -1];
	else {
		lit = uri.split("/")[uri.split("/").length -1];
		if (lit === "")
			lit = uri.split("/")[uri.split("/").length -2];
	}
	// sustituyo - y _ por espacio
	lit = lit.replace(/-/g, " "); 
	lit = lit.replace(/_/g, " ");
	return lit;
}

function firstUppercase(lit) {
	if (lit != undefined && lit.length > 0)
		return lit.charAt(0).toUpperCase() + lit.slice(1);
	else
		return lit;
}

function firstLowercase(lit) {
	if (lit != undefined && lit.length > 0)
		return lit.charAt(0).toLowerCase() + lit.slice(1);
	else
		return lit;
}


///////////////
// CONFIG MODAL
function configurarModal(opciones, titulo, body, footer) {
	// inicializo el header con el título 	
	let header = '<h1 id="mimodaltitle" class="modal-title fs-5">'+titulo+'</h1>';
	// si hay opciones...
	if (opciones) {
		// tamaño grande o no
		if (opciones.lg)
			$("#mimodalDialog").addClass("modal-lg");
		else
			$("#mimodalDialog").removeClass("modal-lg");
		// centrado vertical o no
		if (opciones.vertcent)
			$("#mimodalDialog").addClass("modal-dialog-centered");
		else		
			$("#mimodalDialog").removeClass("modal-dialog-centered");
		// combino static con la preparación del header
		if (opciones.static) {
			$("#mimodal").attr("data-bs-backdrop", "static");
			$("#mimodal").attr("data-bs-keyboard", false);
		}
		else {
			$("#mimodal").removeAttr("data-bs-backdrop");
			$("#mimodal").removeAttr("data-bs-keyboard");
			header += '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>';	
		}
		// no body?		
		if (opciones.nobody)
			$("#mimodalBody").addClass("d-none");
		else
			$("#mimodalBody").removeClass("d-none");
		// no footer?		
		if (opciones.nofooter)
			$("#mimodalFooter").addClass("d-none");
		else
			$("#mimodalFooter").removeClass("d-none");
		// spinner o no
		if (opciones.spinner) {
			let mibody = '<div class="col-1"> \
						<div class="spinner-border text-secondary" role="status"> \
							<span class="visually-hidden">Loading...</span> \
	  					</div> \
					</div>';
			if (opciones.spinnerMessage)
				mibody += '<div class="col ms-3">'+opciones.spinnerMessage+'</div>';
			// pongo el body
			$("#mimodalBody").html(mibody);
			// y activo bodyrow para alinear el spinner (aunque no esté en las opciones)
			opciones.bodyrow = true;
		}
		// row en el body o no
		if (opciones.bodyrow)
			$("#mimodalBody").addClass("row");
		else
			$("#mimodalBody").removeClass("row");
	}
	// si hay título, pongo el header que he preparado
	if (titulo)
		$("#mimodalHeader").html(header);
	// si hay body...
	if (body) {
		$("#mimodalBody").html(body);
		$("#mimodalBody").removeClass("d-none");
	}
	// si hay footer...
	if (footer) {
		$("#mimodalFooter").html(footer);
		$("#mimodalFooter").removeClass("d-none");
	}
}


export { string2loc, loc2string, getPreferredLang, indexOfNormalized, getLiteral, 
getPosition, getCreatorLabel, getCreator, getCreatorObj, getDate, getNumericDate,
extractFirstElement, extractAllElements,
uriToLiteral, firstUppercase, firstLowercase, generateId,
configurarModal };
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
import L from 'leaflet';
import _ from 'underscore';
import { Sesion, Datos } from '../main.js';
import { getMoreSpecificSpecies } from './taxons.js';

// ICONOS
let iconos = {};
function generaIconos() {
	// genero icono genérico de arbol
	iconos.arbol = {};
	iconos.arbol.edu = generaIconoArbol( config.treeicon );
	iconos.arbol.ifn = generaIconoArbol( config.treeicon + '_i' );
	for (const cind of config.coltxinds) {
		iconos.arbol[cind+'edu'] = generaIconoArbol( config.treeicon + cind );
		iconos.arbol[cind+'ifn'] = generaIconoArbol( config.treeicon + cind  + '_i');
	}
	// genero iconos por familia
	for (const furi in config.familyicons) {
		// inicializo objeto
		iconos[furi] = {};
		// iconos educatree e ifn
		iconos[furi].edu = generaIconoArbol( config.familyicons[furi] );
		iconos[furi].ifn = generaIconoArbol( config.familyicons[furi] + '_i' );
		// iconos de colores
		for (const cind of config.coltxinds) {
			iconos[furi][cind+'edu'] = generaIconoArbol( config.familyicons[furi] + cind );
			iconos[furi][cind+'ifn'] = generaIconoArbol( config.familyicons[furi] + cind  + '_i');
		}
	}
	// genero icono de lugar
	// a partir de https://github.com/pointhi/leaflet-color-markers
	iconos.lugar = new L.Icon({
		iconUrl: new URL('../images/marker-icon-2x-blue.png', import.meta.url),
		shadowUrl: new URL('../images/marker-shadow.png', import.meta.url),
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41]
	});
	// genero icono de diana
	// a partir de https://icons.getbootstrap.com/icons/bullseye/
	iconos.diana = new L.Icon({
		iconUrl: new URL('../images/diana.png', import.meta.url),
		iconSize: [40, 40],
		iconAnchor: [20, 20]
	});
	// inicializo iconos de especies
	iconos.especies = {};
}
function generaIconoArbol(nfich) {
	// tengo que generar de forma muy rara la URL de la imagen por culpa de Parcel: https://github.com/parcel-bundler/parcel/issues/3056
	let urlarb = new URL('../images/frondosa.png', import.meta.url); // url estática
	urlarb.pathname = nfich + '.png'; // y cambio aquí el pathname
	return L.icon({
		iconUrl: urlarb,
		iconSize:     [80, 80], // size of the icon
		iconAnchor:   [40, 76], // point of the icon which will correspond to marker's location
		tooltipAnchor:[15, -35], // point from which tooltips will "open", relative to the icon anchor
		popupAnchor: [1, -55]
	});	
}

function getIconoLugar() {
	return iconos.lugar;
}

function getIconoDiana() {
	return iconos.diana;
}

function getIconoArbol(arb, conColor) {
	// lo primero es ver qué tipo de icono toca
	let icono = iconos.arbol; // valor por defecto
	const spuri = getMoreSpecificSpecies(arb.species);
	if (spuri != undefined) {
		// si no está definido el icono de la especie, lo calculo
		if (iconos.especies[spuri] == undefined) {
			let icaux = iconos.arbol; // valor por defecto
			// analizamos las familias
			for (const furi in config.familyicons) {
				// compruebo si está incluido spuri en la lista de uris expandida de la familia
				if ( _.contains(Datos.especies[furi].expuris, spuri) )
					icaux = iconos[furi]; // ¡es de la familia!
			}
			// guardo para luego
			iconos.especies[spuri] = icaux;
		}
		// asigno el icono
		icono = iconos.especies[spuri];	
	}
	
	// preparo sufijo para elegir el icono
	let suf = arb.iri != undefined? 'edu' : 'ifn'; // educatree o ifn
	if (conColor || Sesion.estado.taxon != undefined) // ajusto color
		suf = Sesion.txcolor + suf;
		
	// y devuelvo el icono
	return icono[suf];
}

export { generaIconos, getIconoLugar, getIconoDiana, getIconoArbol };
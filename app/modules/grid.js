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
import { Datos } from '../main.js';

/////////////////
// CÁLCULO CELDAS
// obtengo el lado de cada celda (dependiente del zoom) a partir de la referencia:
// config.zDegreesStep4 es el número de grados para zoom 4
function getCellSide(zoom) {
	if (!Datos.cellSide[zoom]) {
		const potencia = Math.pow(2, zoom - 4);
		Datos.cellSide[zoom] = config.zDegreesStep4/potencia;
	}
	return Datos.cellSide[zoom];
}
// a partir de unos bounds genero la malla que lo envuelve para el zoom z
function getGrid(bounds, z) {
	// recupero zoom
	const zoom = z? z : Sesion.zoom;
	// recupero cellSide
	const cellSide = getCellSide(zoom);
	// preparo grid
	const grid = {
		'cellN': Math.floor( bounds.getNorth() / cellSide ),
		'cellS': Math.floor( bounds.getSouth() / cellSide ),
		'cellE': Math.floor( bounds.getEast() / cellSide ),
		'cellW': Math.floor( bounds.getWest() / cellSide )
	};
	// devuelvo grid
	return grid;
}
// los bounds de un grid
function getGridBounds(grid, z) {
	// recupero zoom
	const zoom = z? z : Sesion.zoom;
	// recupero cellSide
	const cellSide = getCellSide(zoom);
	// devuelvo objeto bounds en formato Leaflet
	return L.latLngBounds([
			[ grid.cellS * cellSide, // S
				grid.cellW * cellSide ], // W
			[ (grid.cellN + 1) * cellSide, // N
				(grid.cellE + 1) * cellSide ] // E			
		]);
}
// los bounds de una celda
function getCeldaBounds(cellX, cellY, z) {
	// recupero zoom
	const zoom = z? z : Sesion.zoom;
	// recupero cellSide
	const cellSide = getCellSide(zoom);
	// devuelvo objeto bounds en formato Leaflet
	return L.latLngBounds([
			[ cellY * cellSide, // S
				cellX * cellSide ], // W
			[ (cellY + 1) * cellSide, // N
				(cellX + 1) * cellSide ] // E			
		]);
}
// para una celda dada obtengo el grid para cada nivel de zoom
function getCeldaGridMatrix(cellX, cellY, z, zvalidos) {
	// primero recupero los bounds de la celda
	let bounds = getCeldaBounds(cellX, cellY, z);
	// para evitar el efecto borde, contraigo ligeramente los bounds (1 por diez mil)
	const red = (bounds.getEast() - bounds.getWest())/10000;
	bounds = L.latLngBounds([
			[ bounds.getSouth() + red, // S
				bounds.getWest() + red], // W
			[ bounds.getNorth() - red, // N
				bounds.getEast() - red ] // E
		]);
	// preparo un objeto con el grid para cada nivel de zoom
	let ocgm = {};
	for (let i=config.minZoom; i<=config.maxZoom; i++) {
		if (zvalidos == undefined || zvalidos[i]) // para todos o sólo para los contemplados
			ocgm[i] = getGrid(bounds, i);
	}
	return ocgm;
}


export { getGrid, getGridBounds, getCellSide, getCeldaBounds, getCeldaGridMatrix };
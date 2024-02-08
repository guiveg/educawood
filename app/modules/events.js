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
import { getAnalytics, logEvent } from "firebase/analytics";

import { Sesion } from '../main.js';
import { getFirebaseApp } from './users.js';
import { loc2string } from './util.js';

let analytics;
let eventData = undefined;

function initMapEvent() {
	eventData = {};
	// inicializo content_type, content_id, crafts_reqs, num_cells, cached_cells y taxon
	eventData.content_type = 'map';
	eventData.content_id = loc2string(Sesion.estado.loc);	
	if (Sesion.estado.taxon)
		eventData.taxon = Sesion.estado.taxon;
	eventData.crafts_reqs = 0;
	eventData.num_cells = 0;
	eventData.cached_cells = 0;
	// timestamp in milliseconds
	eventData.init = Date.now();
}

function initTimedEvent(initData) {
	eventData = {};
	// inicializo lo que me pase
	for (const key in initData)
		eventData[key] = initData[key];
	// inicializo crafts_reqs
	eventData.crafts_reqs = 0;
	// timestamp in milliseconds
	eventData.init = Date.now();
}

// común a cualquier evento para incrementar crafts_reqs o lo que haga falta
function addEventData(key, amount) {
	if (eventData != undefined) {
		if (eventData[key] != undefined)
			eventData[key] += amount;
	}
}

// común a eventos select_content de mapa y de contenidos medibles
function sendTimedEvent(eventName) {
	if (eventData != undefined) {
		// timestamp de fin en milisegundos
		eventData.end = Date.now(); // timestamp in milliseconds 		
		// calculo latencia y elimino init y end
		eventData.latency_ms = eventData.end - eventData.init;
		delete eventData.end;
		delete eventData.init;
		// envío el evento (por defecto evento 'select_content')
		const en = eventName? eventName : 'select_content';
		sendEvent(en, eventData);	
	}
}

// caso especial para timeout del mapa
function sendMapTimeoutEvent() {
	if (eventData != undefined) {
		// cambio el content_type
		eventData.content_type = 'map_timeout';	
		// pongo por latencia el timeout y elimino init y end
		eventData.latency_ms = Sesion.timeout;
		delete eventData.end;
		delete eventData.init;
		// envío el evento
		sendEvent('select_content', eventData);
	}
}

// mando evento
function sendEvent(eventName, edata) {
	//console.log("- Enviando a GA evento de tipo " + eventName + " - Datos evento:")
	//console.log(eventData);
	if (!analytics)
		analytics = getAnalytics(getFirebaseApp());	
	logEvent(analytics, eventName, edata);
}

export { initMapEvent, initTimedEvent, addEventData, sendTimedEvent, sendMapTimeoutEvent, sendEvent };

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
import dict from '../data/dictionary.json';

import Shepherd from 'shepherd.js';

import { Sesion, Solr } from '../main.js';
import { getLiteral } from './util.js';

function lanzarTour() {
	// marco como completado el tour para que no recargue todo el rato el tour
	localStorage.setItem('tourCompletado', true); // cuidado, que setItem sólo guarda strings

	// creo tour
	const tour = new Shepherd.Tour({
		useModalOverlay: true,
		defaultStepOptions: {
			cancelIcon: { enabled: true },
			//classes: 'class-1 class-2',
		    scrollTo: { behavior: 'smooth', block: 'center' }
		}
	});

	// creo los pasos del tour
	//'Welcome',
	tour.addStep({
		title: getLiteral(dict.tourTitle0),
		text: getLiteral(dict.tourText0),
		buttons: [
			{
				text: getLiteral(dict.tourExit),
				classes: 'shepherd-button-secondary',
				action() {
					return this.complete();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action: tour.next
			}
		]
	});
	// "The map",
	tour.addStep({
		title: getLiteral(dict.tourTitle1),
		text: getLiteral(dict.tourText1),
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action: tour.next
			}
		]
	});
	//'Zoom',
	if (!L.Browser.mobile) {
		tour.addStep({
			title: getLiteral(dict.tourTitle2),
			text: getLiteral(dict.tourText2),
			classes: 'mb-3',
			attachTo: {
				element: '.leaflet-control-zoom',
				on: 'top-start'
			},
			buttons: [
				{
					text: getLiteral(dict.tourBack),
					classes: 'shepherd-button-secondary',
					action() {
						return this.back();
					}
				}, 
				{
					text: getLiteral(dict.tourNext),
					action() {
						return this.next();
					}
				}
			]
		});
	}
	//'Mi localización',
	tour.addStep({
		title: getLiteral(dict.tourTitle3),
		text: getLiteral(dict.tourText3),
		classes: 'mb-3',
		attachTo: {
			element: '.leaflet-control-locate',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	// obtengo el elemento visible de clase usuario
	const usuarioElements = document.querySelectorAll('.usuario');
	// Iterate through the elements to find the visible one
	let visibleUsuarioElement = null;
	usuarioElements.forEach(element => {
		const style = getComputedStyle(element);
		if (style.display !== 'none' && style.visibility !== 'hidden') {
    		visibleUsuarioElement = element;
			return;
		}
	});	
	if (Sesion.usuario) {
		//'Your profile',
		tour.addStep({
			title: getLiteral(dict.tourTitle4),
			text: getLiteral(dict.tourText4),
			classes: 'mt-3',
			attachTo: {
				element: visibleUsuarioElement,
				on: 'bottom'
			},
			buttons: [
				{
					text: getLiteral(dict.tourBack),
					classes: 'shepherd-button-secondary',
					action() {
						return this.back();
					}
				}, 
				{
					text: getLiteral(dict.tourNext),
					action() {
						return this.next();
					}
				}
			]
		});
	}
	else {
		//'Sign in',
		tour.addStep({
			title: getLiteral(dict.tourTitle5),
			text: getLiteral(dict.tourText5),
			classes: 'mt-3',
			attachTo: {
				element: visibleUsuarioElement,
				on: 'bottom'
			},
			buttons: [
				{
					text: getLiteral(dict.tourBack),
					classes: 'shepherd-button-secondary',
					action() {
						return this.back();
					}
				}, 
				{
					text: getLiteral(dict.tourNext),
					action() {
						return this.next();
					}
				}
			]
		});	
	}
	//'Create tree',
	tour.addStep({
		title: getLiteral(dict.tourTitle6),
		text: getLiteral(dict.tourText6),
		classes: 'mb-3',
		attachTo: {
			element: '.createtree',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'View IFN trees',
	tour.addStep({
		title: getLiteral(dict.tourTitle7),
		text: getLiteral(dict.tourText7),
		classes: 'mb-3',
		attachTo: {
			element: '.verifn',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'Choose map layer',
	tour.addStep({
		title: getLiteral(dict.tourTitle7a),
		text: getLiteral(dict.tourText7a),
		classes: 'mb-3',
		attachTo: {
			element: '.esri',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'Refresh data',
	tour.addStep({
		title: getLiteral(dict.tourTitle8),
		text: getLiteral(dict.tourText8),
		classes: 'mb-3',
		attachTo: {
			element: '.refresh',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'Download data',
	tour.addStep({
		title: getLiteral(dict.tourTitle9),
		text: getLiteral(dict.tourText9),
		classes: 'mb-3',
		attachTo: {
			element: '.download',
		    on: 'top-start'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'Filter taxon',	
	tour.addStep({
		title: getLiteral(dict.tourTitle10),
		text: getLiteral(dict.tourText10),
		classes: 'mt-3',
		attachTo: {
			element: '#bot_taxones',
		    on: 'bottom'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'Scientific names',
	tour.addStep({
		title: getLiteral(dict.tourTitle11),
		text: getLiteral(dict.tourText11),
		classes: 'mt-3',
		attachTo: {
			element: '#bot_mapnomci',
		    on: 'bottom'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	if (Solr) {
		//'Search places',	
		tour.addStep({
			title: getLiteral(dict.tourTitle12),
			text: getLiteral(dict.tourText12),
			classes: 'mt-3',
			attachTo: {
				element: '#lugares_heading',
				on: 'bottom'
			},
			buttons: [
				{
					text: getLiteral(dict.tourBack),
					classes: 'shepherd-button-secondary',
					action() {
						return this.back();
					}
				}, 
				{
					text: getLiteral(dict.tourNext),
					action() {
						return this.next();
					}
				}
			]
		});
	}
	//'More options',
	tour.addStep({
		title: getLiteral(dict.tourTitle13),
		text: getLiteral(dict.tourText13),
		classes: 'mt-3',
		attachTo: {
			element: '#bot_inicio',
		    on: 'bottom'
		},
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourNext),
				action() {
					return this.next();
				}
			}
		]
	});
	//'The end',
	tour.addStep({
		title: getLiteral(dict.tourTitle14),
		text: getLiteral(dict.tourText14),
		buttons: [
			{
				text: getLiteral(dict.tourBack),
				classes: 'shepherd-button-secondary',
				action() {
					return this.back();
				}
			}, 
			{
				text: getLiteral(dict.tourDone),
				action() {
					return this.complete();
				}
			}
		]
	});	
	
	// lanzo...
	tour.start();
}

export { lanzarTour };
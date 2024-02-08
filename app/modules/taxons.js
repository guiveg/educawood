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
import { speciesModalTemplate, taxonesSubheadingTemplate, taxonesBlockTemplate, 
	sugeTaxonesTemplate, sugeTaxonesWDTemplate, annotators, footers } from '../data/htmlTemplates.js';

import $ from "jquery";
import _ from 'underscore';
import Mustache from 'mustache';
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";

import { Sesion, Datos, obtenerURL, cargarURL } from '../main.js';
import { initClass, getValidTaxons, obtenerEspeciesExpandidas, extractWikidataTaxon, 
	getExistingWikidataTaxons, createTaxonFromWikidata } from "./dataManager.js";
import { Minimapa as MinimapaCT } from "./createTree.js";
import { Minimapa, procesarAnotacion } from "./viewAnnotateTree.js";
import { tooltipArbol, ajustarCursorPopupArbol } from './trees.js';
import { renderEntradaLugares } from './places.js';
import { firstUppercase, getLiteral, uriToLiteral, indexOfNormalized, configurarModal,
	getPreferredLang } from './util.js';
import { initTimedEvent, sendTimedEvent, sendEvent } from './events.js';

function getMoreSpecificSpecies(types) {
	if (!types)
		return undefined;
	// inicializaciones
	let suri = undefined;
	let nexpuris = null;
	// convierto en array si hace falta
	let arsp = Array.isArray(types)? types : [ types ];
	// evalúo cada uno de los tipos disponibles
	for (let evtype of arsp) {
		if (Datos.especies[evtype] && Datos.especies[evtype].expuris) {
			// aquí tengo uno válido, miro si es mejor que lo que tenía
			if (nexpuris == null || Datos.especies[evtype].expuris.length < nexpuris) {
				suri = evtype;
				nexpuris = Datos.especies[evtype].expuris.length;
			}		
		}	
	};
	// devuelvo suri
	return suri;
} 

function handlerNombreCientifico() {
	// guardo valor (en memoria y en local storage para recordarlo entre sesiones)
	Sesion.nomci = this.checked;
	localStorage.setItem('nomci', Sesion.nomci); // guardará "true" o "false"
	
	// ajusto todos los switches de nombres científicos desactivando
	// los change listeners de manera temporal (gracias, chatGPT)
	$('.nomci').off('change').prop('checked',  Sesion.nomci).on('change', handlerNombreCientifico);
		
	// renderizado taxón (formularios)
	visualizarTaxonFormulario();
	
	// etiqueta filtro de taxón (panel del mapa)
	if (Sesion.estado.taxon) {
		// pongo etiqueta
		const label = Sesion.nomci? 
			'<i>'+firstUppercase(getLiteral(Datos.especies[Sesion.estado.taxon].scientificName))+'</i>'
			: firstUppercase(getLiteral(Datos.especies[Sesion.estado.taxon].vulgarName, uriToLiteral(Sesion.estado.taxon)));							
		const et = getLiteral(dict.filtering) +' <strong>' + label + '</strong>';
		$("#div_label_filtro_taxon").html(et);
	}
	
	
	// ¡hay que cambiar el valor de todo!
	// cambio las etiquetas de todas las especies en la lista
	$(".taxones_block").find("[spuri]").each(function() {
		// obtengo la especie
		const spuri= $(this).attr("spuri");
		// nombre vulgar y científico
		const nvul = Datos.especies[spuri]?
			firstUppercase(getLiteral(Datos.especies[spuri].vulgarName, uriToLiteral(spuri))) :
			firstUppercase(uriToLiteral(spuri));
		const ncie = Datos.especies[spuri]?
			'<i>' + firstUppercase(getLiteral(Datos.especies[spuri].scientificName, nvul)) + '</i>' :
			'<i>' + nvul + '</i>';
		// hago reemplazo en el markup del botón
		const oldmarkup = $(this).html();
		const newmarkup = Sesion.nomci? oldmarkup.replace(nvul, ncie) : oldmarkup.replace(ncie, nvul);
		$(this).html(newmarkup);	
	});
	
	// en teselas actualizo los popups
	//ajustarCursorPopupsTeselas(Object.keys(Sesion.tessPintadas));
	
	// en el mapa actualizo tooltips ifntrees y popups de edutrees (según el modo edición)
	for (const turi in Sesion.arbsPintados) {
		// ajuste popup según modo edición
		ajustarCursorPopupArbol(turi);
		// tooltip sólo para ifntrees
		if (Datos.arboles[turi].uri) {
			const tooltip = tooltipArbol(Datos.arboles[turi]);
			Sesion.arbsPintados[turi].bindTooltip(tooltip);		
		}
	}
	
	// si hay minimapa pongo tooltips a todos los árboles
	if (Minimapa && Minimapa.arbsPintados) {
		for (const turi in Minimapa.arbsPintados) {
			Minimapa.arbsPintados[turi].bindTooltip(tooltipArbol(Datos.arboles[turi]));
		}
	}
	if (MinimapaCT && MinimapaCT.arbsPintados) {
		for (const turi in MinimapaCT.arbsPintados) {
			MinimapaCT.arbsPintados[turi].bindTooltip(tooltipArbol(Datos.arboles[turi]));
		}
	}
}


////////////////////////////////
// VISUALIZACIÓN FILTRO TAXÓN (modo mapa)
// sólo se llama desde cargarURL
////////////////////////////////
function visualizarFiltroTaxon() {
	if (Sesion.estado.taxon == undefined) {
		// escondo el contenido
		$("#filtro_taxon").addClass("d-none");
	} else {
		// pongo etiqueta
		const label = Sesion.nomci? 
			'<i>'+firstUppercase(getLiteral(Datos.especies[Sesion.estado.taxon].scientificName))+'</i>'
			: firstUppercase(getLiteral(Datos.especies[Sesion.estado.taxon].vulgarName, uriToLiteral(Sesion.estado.taxon)));							
		const et = getLiteral(dict.filtering) +' <strong>' + label + '</strong>';
		$("#div_label_filtro_taxon").html(et);
		
		// si hay info de wikidata hago visible el botón de info
		if (Datos.especies[Sesion.estado.taxon].wikidata) {
			// incluyo uri de la especie
			$("#bot_info_filtro_taxon").attr("turi", Sesion.estado.taxon);
			// incluyo uri de DBpedia
			//$("#bot_info_filtro_taxon").attr("dbr", Datos.especies[Sesion.estado.taxon].dbpedia);
			// quito popover que hubiera
			//$("#bot_info_filtro_taxon").popover('dispose');	TODO: comprobar que esto no vale
			// botón de info visible
			$("#bot_info_filtro_taxon").removeClass("d-none");
		} 
		else // en otro caso no hay botón de info
			$("#bot_info_filtro_taxon").addClass("d-none");	
		
		// hago visible el filtro
		$("#filtro_taxon").removeClass("d-none");
	}
}


////////////////////////////////////
// VISUALIZACIÓN TAXÓN (formulario)
////////////////////////////////////
function visualizarTaxonFormulario() {
	// actualizo todas las entradas de clase taxón
	let $taxonInputs = $('input').filter('.taxon');
	$taxonInputs.each(function() {
		// cojo el botón de la dbpedia de este elemento (puede no existir)
		const $dbbut = $(this).siblings('.dbpedia');		
		// cojo el botón de delete de este elemento (puede no existir)
		const $delbut = $(this).siblings('.delete');		
		// obtengo uri del taxón	
		let turi = $(this).attr("iri");
		// preparo etiqueta
		const label = turi ? 
			( Datos.especies[turi] ? 
            	( Sesion.nomci ? 
					firstUppercase(getLiteral(Datos.especies[turi].scientificName)) :
					firstUppercase(getLiteral(Datos.especies[turi].vulgarName, uriToLiteral(turi)))
            	) : firstUppercase(uriToLiteral(turi))
			) :  "";			
		// ajusto itálica	
		if (Sesion.nomci)
			$(this).attr("style", "font-style:italic");
		else
			$(this).removeAttr("style");
		// pongo etiqueta
		$(this).val(label);		
		// muestro o escondo el botón de borrar
		if ($delbut) {
			if (turi)
				$("#deleteTreeTaxon").removeClass("d-none");
			else	
				$("#deleteTreeTaxon").addClass("d-none");
		}		
		// trato con el botón de info de taxón a dbpedia
		if ($dbbut) {
			$dbbut.off("click"); // desactivo handlers previos
			// muestro o escondo el botón 
			if (turi && Datos.especies[turi] && Datos.especies[turi].wikidata) {
				// incluyo uri de la especie
				$dbbut.attr("turi", turi);
				// quito popover que hubiera
				//$dbbut.popover('dispose');	TODO: comprobar que esto no vale
				// botón de info visible
				$dbbut.removeClass("d-none");		
				// handler del popover taxón con info de DBpedia
				$dbbut.click(handlerInfoTaxon);
			} 
			else // en otro caso no hay botón de info
				$dbbut.addClass("d-none");
		}
	});
}


//////////////////////////
// HANDLER setTreeTaxon (modo formulario)
// el handler está puesto directamente en el formulario creationEducatreeForm
function handlerSetTreeTaxonEd() {
	// obtengo nuevo estado del botón
	const activar = !$("#setTreeTaxonEd").hasClass("active");		
	// pongo el botón activo o no
	if (activar)
		$("#setTreeTaxonEd").addClass("active");
	else 
		$("#setTreeTaxonEd").removeClass("active");	
	// render de la selección de taxón
	renderSeleccionTaxon(activar, true);
}

//////////////////////////
// HANDLER deleteTreeTaxon (modo formulario)
function handlerDeleteTreeTaxonEd() {
	// borro iri y lanzo evento de "change" para poder hacer validación en las anotaciones
	$("#inputTreeTaxonEd").removeAttr("iri").trigger('change');
	// visualizo y a volar
	visualizarTaxonFormulario();
}


//////////////////////////
// HANDLER FILTRAR TAXÓN (modo mapa)
function handlerFiltrarTaxon() {
	// obtengo nuevo estado del botón
	const activar = !$("#bot_taxones").hasClass("active");
		
	// pongo el botón activo o no
	if (activar)
		$("#bot_taxones").addClass("active");
	else 
		$("#bot_taxones").removeClass("active");
	
	// render de la selección de taxón
	renderSeleccionTaxon(activar);
}

//////////////////////////
// RENDER SELECCIÓN TAXÓN
function renderSeleccionTaxon(activar, esformulario) {
	// RENDER ENTRADA LUGARES (para que no interfiera)
	if (!esformulario)
		renderEntradaLugares(!activar);
	
	// selecciono los divs apropiados según el modo
	const $divbus = esformulario? $("#taxones_subheading_newtree") : $("#taxones_subheading");
	const $divnav = esformulario? $("#taxones_block_newtree") : $("#taxones_block");

	// BÚSQUEDA CON ENTRADA DE TEXTO Y SUGERENCIAS DE TIPOS DE SITIOS
	if (activar) {
		// rendering del subheading
		const content = Mustache.render(taxonesSubheadingTemplate, {'activar': activar, 'esformulario': esformulario} );
		$divbus.html(content);
		$divbus.removeClass("d-none");
		// listener de handlerImportTaxon
		$("#importTaxonButton").click(handlerImportTaxon);
		// handler de buscar taxon...
		$(".in_taxon").on("keyup search", function(e) {
			//console.log("Caracter: " + e.which);
			// trato las teclas de arriba, abajo y enter			
			if (e.which == 13) { // tecla ENTER
				// actúo según el focus
				if (Sesion.txfocus == -1)	{ // ninguna sugerencia seleccionada
					// si hay al menos una sugerencia (y habilitada) voy a la primera
					if ($(".sugetaxones").children(":enabled").length > 0)
						$(".sugetaxones").children(":enabled").eq(0).click();
				}
				else // obtengo la sugerencia y vamos a ella
					$(".sugetaxones").children().eq(Sesion.txfocus).click();
			}
			else if (e.which == 40) { // tecla ABAJO
				// incremento focus
				Sesion.txfocus++;
				ajustarTaxonfocus();
			}
			else if (e.which == 38) { // tecla ARRIBA
				// decremento focus
				Sesion.txfocus--;
				ajustarTaxonfocus();
			}
			else { // caso normal
				const entrada = $(this).val();		
				// analizo la cadena de entrada
				if (entrada.length < 1) { // está vacía: muestro la taxonomía y elimino las sugerencias
					$divnav.removeClass("d-none");
					$(".sugetaxones").html("");
				}
				else {	// hay algo: muestro sugerencias y escondo la taxonomía
					$divnav.addClass("d-none");
					// obtengo sugerencias de tipos de sitios
					const suges = sugeTaxones(entrada);
					// renderizo las sugerencias
					renderSugeTaxones(entrada, suges);
				}
			}
		});
	} 
	else
		$divbus.addClass("d-none");	
	
	// NAVEGACIÓN ONTOLOGÍA DE TIPOS
	if (activar) { // mostrar el bloque de contenido de las especies
		$divnav.removeClass("d-none");
		// ¿caso inicial?
		if ($divnav.html() == "") {
			// preparo datos para mostrar
			let btaxainfo = [];
		
			// analizo los taxones top
			for (const spuri of config.especiesTop) {
				// obtengo información del objeto para formatear
				let spinfo = getInfoSpecies(spuri);
				// incluyo también el indice
				spinfo.indice = 0;
				spinfo.indentspace = '';
				// añado
				btaxainfo.push(spinfo);
			}
		
			// sort elements
			btaxainfo = _.sortBy(btaxainfo, 'label').reverse();
			//btaxainfo = _.sortBy(btaxainfo, function(el) { return (+el.nclasses*100 + +el.allindivs); });
			btaxainfo = _.sortBy(btaxainfo, "score");
			btaxainfo =	btaxainfo.reverse();
		
			// generate the mark-up
			const content = Mustache.render(taxonesBlockTemplate, btaxainfo);
			
			// pongo el contenido
			$divnav.html(content);			

			// HANDLERS
			// handler de seleccionar taxón
			$(".bot_sel_taxon").click(handlerSeleccionarTaxon);
			// handler de expandir taxón
			$(".bot_expandir_taxon").click(handlerExpandTaxon);
			// handler de showmore
			$(".showmore").click(handlerShowmore);
		}
		else // simplemente mostrar lo que tenía
			$divnav.removeClass("d-none");
	}
	else // esconder el bloque de contenido de los taxones
		$divnav.addClass("d-none");	
}



//////////////////////
// HANDLER SUGERENCIAS
//////////////////////
function sugeTaxones(entrada) {
	let sugerencias = [];
	// sólo actúo si la entrada no es una cadena vacía
	if (entrada.length > 0) {
		// obtengo las uris de las especies ordenadas alfabéticamente
		const espuris = Object.keys(Datos.especies).sort();
		// evalúo cada especie si vale
		for (let espuri of espuris) {
			// primero veo si descarto la especie: : sólo considero si tiene datos de wikidata y UN NOMBRE CIENTÍFICO DIFERENTE AL DEL PADRE
			let descarte = false;
			if (!Datos.especies[espuri].wikidata)
				descarte = true;
			else {
				for (let supiri of Datos.especies[espuri].superclasses) {
					if (getLiteral(Datos.especies[supiri].scientificName) === getLiteral(Datos.especies[espuri].scientificName))
						descarte = true;
				}
			}
			if (!descarte) { // aquí sí evalúo
				// obtengo etiqueta de la especie (por defecto nombre vulgar)
				let labesp = getLiteral(Datos.especies[espuri].vulgarName, uriToLiteral(espuri));
				// si hay nombre científico...		
				if (Sesion.nomci) {
					labesp = firstUppercase(getLiteral(Datos.especies[espuri].scientificName, labesp));
				}
				// si coincide, a las sugerencias
				if (indexOfNormalized(labesp, entrada) > -1)
					sugerencias.push(espuri);
			}
		}
	}
	return sugerencias;
}
function renderSugeTaxones(entrada, sugerencias) {
	// preparo sugerencias
	let sinfo = {};
	sinfo.sugerencias = [];
		
	// obtengo las sugerencias si la entrada no está vacía
	if (sugerencias.length == 0)
		sinfo.nosugerencias = true;
	else {
		for (let suge of sugerencias) {
			// obtengo información del objeto para formatear
			let spinfo = getInfoSpecies(suge);
			// índice en el que hubo match
			const ind = indexOfNormalized(spinfo.label, entrada);
			// formateo el nombre a mostrar con negritas
			spinfo.labelshown = "";
			if (ind > 0)
				spinfo.labelshown += spinfo.label.substr(0, ind);
			spinfo.labelshown += "<strong>" + spinfo.label.substr(ind, entrada.length) + "</strong>"
			spinfo.labelshown += spinfo.label.substr(ind + entrada.length);			
			/* siempre se añade
			// añado el objeto SÓLO SI TIENE INDIVIDUOS
			if (spinfo.allindivs > 0)
				sinfo.sugerencias.push(spinfo);*/
			sinfo.sugerencias.push(spinfo);
		};
	}
	
	// ordeno sugerencias por número de individuos y subclases
	//sinfo.sugerencias = _.sortBy(sinfo.sugerencias, function(el) { return (+el.nclasses*100 + +el.allindivs); });
	// ordeno por popularidad en Wikidata
	sinfo.sugerencias = _.sortBy(sinfo.sugerencias, "score");
	sinfo.sugerencias =	sinfo.sugerencias.reverse();
	
	// corto número de sugerencias
	sinfo.sugerencias = sinfo.sugerencias.slice(0, config.numsugs);
	
	// muestro sugerencias
	const cont = Mustache.render(sugeTaxonesTemplate, sinfo);
	$(".sugetaxones").html(cont);
			
	// handler de los botones de sugerencias
	$(".bot_suge_taxon").click(handlerSeleccionarTaxon);
	
	// inicializo focus
	Sesion.txfocus = -1;
}
function ajustarTaxonfocus(esWD) {
	const idel = esWD? "#sugetaxonesWD" : ".sugetaxones";
	// Sesion.txfocus = 0; => cajetín entrada
	// Sesion.txfocus = i; => num de sugerencia
	// obtengo número de sugerencias que no están deshabilitadas
	const ns = $(idel).children(":enabled").length;
	//if (ns == 1 && $("#sugetaxones").children().eq(0)  )// corrección por si no es una sugerencia real
	// reajusto índice del focus si hace falta
	if (ns == 0) Sesion.txfocus = -1;
	else if (Sesion.txfocus >= ns) Sesion.txfocus = 0;
	else if (Sesion.txfocus < 0) Sesion.txfocus = ns -1;
	// y ahora las cosas visuales
	$(idel).children().removeClass("active");
	if (Sesion.txfocus >= 0)
		$(idel).children().eq(Sesion.txfocus).addClass("active");
}


/////////////////////////////
// HANDLER NAVEGACIÓN TAXONES
/////////////////////////////
function handlerExpandTaxon() {
	// obtengo i para el icono
	let $i = $(this).find("i");
	let $div = $(this).closest(".taxon");
	
	if ($(this).hasClass("active")) { // colapsar
		// desactivo botón
		$(this).removeClass("active");
		// pongo otro icono
		$i.removeClass("bi-chevron-down");
		$i.addClass("bi-chevron-right");
		
		// itero para quitar los elementos de la lista
		const indice = +$div.attr("indice");
		do {
			var $nextdiv = $div.next();
			var fin = true;
			if (+$nextdiv.attr("indice") > indice) {
				$nextdiv.remove();
				fin = false;
			}				
		} while (!fin);
	}
	else { // expandir
		// activo botón
		$(this).addClass("active");
		// pongo otro icono
		$i.removeClass("bi-chevron-right");
		$i.addClass("bi-chevron-down");
		
		// get uri of the class and prepare indentspace
		const spuri = $div.find(".bot_sel_taxon").attr("spuri");
		const newindice = +$div.attr("indice") + 1;
		let indentspace = "";
		for (let ind = 0; ind < newindice; ind++) 
			indentspace += "&nbsp;&nbsp;&nbsp;&nbsp;";
		
		// generate aux object for the template
		let scobj = [];
		for (let subspuri of Datos.especies[spuri].subclasses) {
			// obtengo información del objeto para formatear
			let subspinfo = getInfoSpecies(subspuri);
			// incluyo también el indent
			subspinfo.indice = newindice;
			subspinfo.indentspace = indentspace;
			
			// sólo inserto si tiene datos de wikidata y UN NOMBRE CIENTÍFICO DIFERENTE AL DEL PADRE
			if (Datos.especies[subspuri].wikidata && getLiteral(Datos.especies[subspuri].scientificName) !== getLiteral(Datos.especies[spuri].scientificName))			
				scobj.push(subspinfo);
		};
		
		// sort elements
		scobj = _.sortBy(scobj, 'label').reverse();
		//scobj = _.sortBy(scobj, function(el) { return (+el.nclasses*100 + +el.allindivs); });
		scobj = _.sortBy(scobj, "score");
		scobj =	scobj.reverse();
		
		// show more button
		if (scobj.length > config.hidemax) {
			// include fake element for the button
			scobj.splice(config.hidebegin, 0, { "botonesconder" : true, "indice" : newindice, "indentspace" : indentspace+"&nbsp;&nbsp;&nbsp;&nbsp;" });
			for (let ind = config.hidebegin + 1; ind < scobj.length; ind++)
				scobj[ind].esconder = true;						
		}						

		// generate content and add	to the DOM
		const newcontent = Mustache.render(taxonesBlockTemplate, scobj);							
		$div.after(newcontent);
					
		// handler de seleccionar taxón
		$(".bot_sel_taxon").off('click');
		$(".bot_sel_taxon").click(handlerSeleccionarTaxon);
		
		// recreate handlers of the expand/collapse buttons
		$(".bot_expandir_taxon").off('click');
		$(".bot_expandir_taxon").click(handlerExpandTaxon);
		
		// recreate handlers of the showmore buttons
		$(".showmore").click(handlerShowmore);
	}
}
function handlerShowmore() {
	let $div = $(this).closest(".taxon");
	const indice = +$div.attr("indice");
	// show elements
	let $aux = $div;
	let fin;
	do {
		$aux = $aux.next();
		fin = true;
		if (+$aux.attr("indice") == indice && $aux.hasClass("d-none")) {
			$aux.removeClass("d-none");
			$aux.addClass("d-flex");			
			fin = false;
		}
	} while (!fin);	
	// remove show more button
	$div.remove();
}


// para formatear las especies
function getInfoSpecies(spuri) {
	// recupero especie
	const sp = Datos.especies[spuri];
	// el objeto a devolver
	let spinfo = {};
	// incluyo la uri
	spinfo.uri = spuri;
	// por defecto nombre vulgar
	spinfo.label = firstUppercase(getLiteral(sp.vulgarName, uriToLiteral(spuri)));
	// si hay nombre científico...		
	if (Sesion.nomci) {
		spinfo.nc = true;
		spinfo.label = firstUppercase(getLiteral(sp.scientificName,
			spinfo.label));
	}
	// info número de clases
	spinfo.nclasses = 0;
	for (let suburi of Datos.especies[spuri].subclasses) {
		// sólo inserto si tiene datos de wikidata y UN NOMBRE CIENTÍFICO DIFERENTE AL DEL PADRE
		if (Datos.especies[suburi] && Datos.especies[suburi].wikidata 
				&& getLiteral(Datos.especies[suburi].scientificName) !== getLiteral(Datos.especies[spuri].scientificName))			
			spinfo.nclasses++;	
	};
	if (spinfo.nclasses == 0)
		spinfo.nosubclasses = true;
	// calculo el score
	spinfo.score = 0;
	if (Datos.especies[spuri].wikidata && Datos.especies[spuri].wikidata.sitelinks)
		spinfo.score += 3*+Datos.especies[spuri].wikidata.sitelinks;
	if (Datos.especies[spuri].wikidata && Datos.especies[spuri].wikidata.statements)
		spinfo.score += +Datos.especies[spuri].wikidata.statements;
		
	// devuelvo el objeto
	return spinfo;
}



//////////////////////////
// HANDLER SELECCIÓN TAXÓN (común a mapa y formulario)
//////////////////////////
function handlerSeleccionarTaxon() {
	// obtengo uri del taxon
	const turi = $(this).attr("spuri");
	
	// vamos a la selección del taxón
	tratarSeleccionTaxon(turi);
	
	// click en botón de seleccionar taxón para cerrar el panel correspondiente
	let $bot = $("#bot_taxones");
	if (Sesion.estado.path === 'newtree' || Sesion.estado.path === 'tree')
		$bot = $("#setTreeTaxonEd");
	$bot.click();
}
function tratarSeleccionTaxon(turi) {	
	if (Sesion.estado.path === 'newtree' || Sesion.estado.path === 'tree') { // modo formulario
		// guardo IRI y lanzo evento de "change" para poder hacer validación en las anotaciones
		$("#inputTreeTaxonEd").attr("iri", turi).trigger('change');		
		// renderizado
		visualizarTaxonFormulario();
	} 
	else {	// modo mapa		
		// mando evento de filtro de taxón a GA		
		sendEvent( 'select_content', { content_type: 'taxon_filter', content_id: turi } );
		// pongo el taxón en la sesión y reajusto URL
		Sesion.estado.taxon = turi;
		history.replaceState(Sesion.estado, "", obtenerURL());
		// cargo la URL
		cargarURL();
	}
}


/////////////////////
// HANDLER INFO TAXÓN
/////////////////////
function handlerInfoTaxon() {
	// obtengo uri del taxón
	const turi = $(this).attr("turi");
	
	// 2023-11 ahora siempre tengo la info a mostrar del taxón, no hay que pedirla al vuelo
	
	// objeto taxón
	let taxon = Datos.especies[turi];
	// preparo objeto del modal
	let popobj = {};
	// imagen
	if (taxon.wikidata.image) {
		popobj.hayimagen = true;
		let imgsaux = Array.isArray(taxon.wikidata.image)? taxon.wikidata.image : [ taxon.wikidata.image ];
		popobj.image = [];
		let first = true;
		for (let img of imgsaux) {
			// ajusto tamaño para que tarde menos en recuperarla
			const imgsrc = (img.startsWith('http://commons.wikimedia.org/wiki/Special:FilePath') && img.indexOf('?') === -1 )?
				img + "?width=300" : img;
			popobj.image.push( { src: imgsrc, active: first})
			first = false;
		}
		if (popobj.image.length == 1)
			popobj.image = popobj.image[0].src;
		else
			popobj.multimages = true;
	}
	// resumen
	if (taxon.wikidata.comment)
		popobj.resumen = getLiteral(taxon.wikidata.comment);
	// nombre científico
	const label = firstUppercase(getLiteral(taxon.vulgarName, uriToLiteral(turi)));
	popobj.nomci = firstUppercase(getLiteral(taxon.scientificName, label));
	// gbifPage
	if (taxon.wikidata && taxon.wikidata.gbifPage)
		popobj.gbifPage = taxon.wikidata.gbifPage;
	// wikidataPage
	if (taxon.wikidata)
		popobj.wikidataPage = taxon.wikidata.iri;
	// wikipediaPage
	if (taxon.wikipediaPage)
		popobj.wikipediaPage = taxon.wikipediaPage;
	// wikispeciesPage
	if (taxon.wikispeciesPage)
		popobj.wikispeciesPage = taxon.wikispeciesPage;
	// indico tipo: especie, género, familia o clase
	if (taxon.nivel == 0)
		popobj.tipo = getLiteral(dict.species);
	else if (taxon.nivel == 1)
		popobj.tipo = getLiteral(dict.genus);
	else if (taxon.nivel == 2)
		popobj.tipo = getLiteral(dict.family);
	else if (taxon.nivel == 3)
		popobj.tipo = getLiteral(dict.class);

	// preparo contenido modal
	let tit = '<i>' + popobj.nomci + '</i>';				
	let htmlcontent = Mustache.render(speciesModalTemplate, popobj);
	configurarModal( { lg: true, nofooter: true }, 
		tit, htmlcontent, null);
	// muestro modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	// mando evento de info taxón a GA		
	sendEvent( 'select_content', { content_type: 'infoTaxon', content_id: turi } );
}


/////////////////////
// HANDLER IMPORT TAXÓN
/////////////////////
// 2023-11-1 NUEVO
function handlerImportTaxon() {
	// inicialización modal con su body y todo
	configurarModal( { static: true, vertcent: true }, 
		getLiteral(dict.importtaxon), annotators.importTaxon, footers.importarTaxon);
	// muestro el modal sólo en modo newtree
	if (Sesion.estado.path === "newtree") {
		const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
		mimodal.show();
	}
	// (en modo anotación ya lo tengo abierto y no hay que mostrarlo)
	
	// listener de importar
	$("#botimporttaxonwikidata").click(importTaxon);
						
	// detecto cambios en la entrada de importar taxón
	// "search" es para detectar si el usuario hizo click en la X del formulario (clear button)
	$("#in_importTaxon").on("keyup search", async function(e) {		
		// trato las teclas de arriba, abajo y enter			
		if (e.which == 13) { // tecla ENTER
			// sólo actúo si hay al menos una sugerencia (y habilitada)
			if ($("#sugetaxonesWD").children(":enabled").length > 0) {
				// si no había ninguna sugerencia seleccionada activo la primera
				if (Sesion.txfocus == -1) {
					Sesion.txfocus = 0;
					ajustarTaxonfocus(true);
				}
				// y ahora vamos al taxón seleccionado
				$("#sugetaxonesWD").children(":enabled").eq(Sesion.txfocus).click();
			}
		}
		else if (e.which == 40) { // tecla ABAJO			
			// incremento focus
			Sesion.txfocus++;
			ajustarTaxonfocus(true);
		}
		else if (e.which == 38) { // tecla ARRIBA
			// decremento focus
			Sesion.txfocus--;
			ajustarTaxonfocus(true);
		}
		else if (e.which != undefined) { // caso normal
			// actúo según la entrada
			const entrada = $(this).val();
			if (entrada.length == 0) {// no hay entrada
				$("#sugetaxonesWD").html("");
				$("#sugetaxonesWD").addClass("d-none");
				$("#statusImportTaxon").html(getLiteral(dict.typesomething));
			}
			else if (entrada.length < 3) {// entrada corta
				$("#sugetaxonesWD").html("");
				$("#sugetaxonesWD").addClass("d-none");
				$("#statusImportTaxon").html(getLiteral(dict.typesomethingmore));
			}
			else {// obtengo sugerencias y hago su render
				$("#sugetaxonesWD").removeClass("d-none");
				//const sugtaxones = await 
				obtenerSugerenciasTaxonesWD(entrada);
				// mando evento GA si la entrada > 2
				if (entrada.length > 2) {
					sendEvent('search', {
						search_term: entrada,
						content_type: "taxons"
					});
				}
			}
		}
		else  {
			// caso de la X del formulario... (quito las sugerencias)
			let entrada = $(this).val();
			if (entrada.length == 0) {// no hay entrada
				$("#sugetaxonesWD").html("");
				$("#sugetaxonesWD").addClass("d-none");
				$("#statusImportTaxon").html(getLiteral(dict.typesomething));
			}
		}
	}).focusin(function() {			
		// vuelve el focus, muestro las sugerencias si hay algo
		let entrada = $(this).val();
		if (entrada.length > 2)
			$("#sugetaxonesWD").removeClass("d-none");			
	}).focusout(function() {
		// si pierde el focus escondemos las sugerencias tras un delay
		// el delay es importante para que se pueda clickar un botón antes de eliminar las sugerencias
		setTimeout(function(){
			if (!$("#in_importTaxon").is(":focus")) // si vuelve el focus no escondo
				$("#sugetaxonesWD").addClass("d-none");
		}, 300);			
	});

	// handler del botón "clearImportTaxon"
	$("#clearImportTaxon").click(function() {	
		// reajusto tamaño del diálogo
		configurarModal( { static: true, vertcent: true } );
		// quito el taxón del textbox 
		$("#in_importTaxon").val("")
			.attr('wdiri', '')
			.prop('disabled', false);
		// habilito y escondo botón "clearImportTaxon"
		$("#clearImportTaxon").addClass("d-none");
		$("#statusImportTaxon").html(getLiteral(dict.typesomething));
		// escondo datos del taxón mostrado		
		$("#infoTaxonImportar").addClass("d-none");
	});
}
async function obtenerSugerenciasTaxonesWD(entrada) {
	// inicialización API de búsqueda de texto de Wikidata
	const otwd = {
		lang: getPreferredLang(),
		limit: config.limitWD,
		input: entrada
	};	
	const urlpet = Mustache.render(config.tempTextWD, otwd);
	
	// spinner y mensaje
	$("#spinnerImport").removeClass("d-none");
	$("#statusImportTaxon").html(getLiteral(dict.obtainingtaxons));
  	  	
	try {
		// pido sugerencias a la API de texto de Wikidata		
		if (!Datos.urlAPIWD[urlpet]) { // si no está cacheada...
			console.debug(urlpet);
			const response = await fetch(urlpet);
			Datos.urlAPIWD[urlpet] = await response.json();
		}
    	let datos = Datos.urlAPIWD[urlpet];
    
		// pido los taxones válidos al punto SPARQL de WD y consolido datos
		const taxons = await getValidTaxons(datos.search);
		
		// sólo sigo si coincide la entrada del cajetín de texto con entrada
		const entcaj = $("#in_importTaxon").val();
		if (entrada === entcaj) {		
			// preparo array de resultados con la respuesta
			let resultados = [];
			for (let tx of taxons) {
				let res = _.clone(Datos.taxonesWD[tx]);
				// le meto un score para el sorting
				res.score = 3*Datos.taxonesWD[tx].sitelinks + +Datos.taxonesWD[tx].statements;
				// extra de 300 si es una especie (la detecto porque el nombre tiene dos términos en vez de uno de género o familia)
				if (res.label.split(" ").length ==2)
					res.score += 300;
				// incluyo en los resultados
				resultados.push( res );
			}		
			// ordeno resultados y aplico límite
			resultados = _.sortBy(resultados, 'score').reverse();
			resultados = resultados.slice(0, config.numsugs);
			// compruebo heurístico de escribir más para desambiguar
			const heurTypeMore = entcaj.length < 5 && datos.search.length == config.limitWD;
			// visualizo			
			renderSugerenciasTaxonesWD(resultados, heurTypeMore);
		}
	} catch (error) {
    	console.error('Error fetching data: ', error);
	}  	
}
function renderSugerenciasTaxonesWD(resultados, heurTypeMore) {
	// quito spinner
	$("#spinnerImport").addClass("d-none");
	
	// objeto sugerencias
	let sinfo = {};
	sinfo.sugerencias = [];
		
	// formateo las sugerencias
	if (resultados.length == 0) {
		sinfo.nosugerencias = true;
		if (heurTypeMore)
			$("#statusImportTaxon").html(getLiteral(dict.typesomethingmore));
		else
			$("#statusImportTaxon").html(getLiteral(dict.tryanotherstring));
	}
	else {
		for (let res of resultados) {
			sinfo.sugerencias.push(
				{
					'title': res.label,
					'desc': res.description,
					'wdiri': res.iri
				}
			);
		}
		$("#statusImportTaxon").html(getLiteral(dict.selectataxon));
	}
	
	// muestro sugerencias
	let cont = Mustache.render(sugeTaxonesWDTemplate, sinfo);
	$("#sugetaxonesWD").html(cont);
		
	// handler de los botones de sugerencias de taxones
	$(".bot_suge_taxonWD").click(async function() {
		// extraigo el taxón
		const wdiri = $(this).attr("wdiri");
		
		// pongo el taxón en el textbox, incluyo wdiri, deshabilito, muestro botón "clearImportTaxon" y quito sugerencias
		$("#in_importTaxon").val(Datos.taxonesWD[wdiri].label)
			.attr('wdiri', wdiri)
			.prop('disabled', true);
		$("#clearImportTaxon").removeClass("d-none");		
		$("#sugetaxonesWD").html("");
		$("#sugetaxonesWD").addClass("d-none");
		
		// spinner y mensaje
		$("#spinnerImport").removeClass("d-none");
		$("#statusImportTaxon").html(getLiteral(dict.obtainingtaxondata));
	
		// consigo datos del taxón (si no está)
		try {
			await extractWikidataTaxon(wdiri);
		} catch(err) {
			console.error(err.message);
			// actualizo modal
			const be = "<code>" + err.message + "<br>" + JSON.stringify(err.error) + "</code>";		
			configurarModal( { static: true, vertcent: true }, 
				getLiteral(dict.taxonimportingerror), be, footers.anotacionError);		
			return; // terminamos
		}	
		
		// spinner y mensaje
		$("#spinnerImport").addClass("d-none");
		$("#statusImportTaxon").html(getLiteral(dict.readytoimport));
		
		// preparo info del taxón para visualizar
		const txWD = Datos.taxonesWD[wdiri];
		let popobj = {};
		// imagen
		if (txWD.image) {
			popobj.hayimagen = true;
			let imgsaux = Array.isArray(txWD.image)? txWD.image : [ txWD.image ];
			popobj.image = [];
			let first = true;
			for (let img of imgsaux) {
				const imgsrc = (img.startsWith('http://commons.wikimedia.org/wiki/Special:FilePath') && img.indexOf('?') === -1 )?
					img + "?width=300" : img;
				popobj.image.push( { src: imgsrc, active: first})
				first = false;
			}
			if (popobj.image.length == 1)
				popobj.image = popobj.image[0].src;
			else
				popobj.multimages = true;
		}
		// resumen
		if (txWD.comment)
			popobj.resumen = getLiteral(txWD.comment);
		// nombre científico
		const label = firstUppercase(getLiteral(txWD.vulgarName, uriToLiteral(wdiri)));
		popobj.nomci = firstUppercase(getLiteral(txWD.scientificName, label));
		// wikidataPage
		popobj.wikidataPage = wdiri;		
		// wikipediaPage
		if (txWD.gbifPage)
			popobj.gbifPage = txWD.gbifPage;
		// wikipediaPage
		if (txWD.wikipediaPage)
			popobj.wikipediaPage = txWD.wikipediaPage;
		// wikispeciesPage
		if (txWD.wikispeciesPage)
			popobj.wikispeciesPage = txWD.wikispeciesPage;
		// indico tipo: especie, género o familia
		if (txWD.isSpecies)
			popobj.tipo = getLiteral(dict.species);
		else if (txWD.family) // hay algo en familia (por lo que es un género al no ser especie)
			popobj.tipo = getLiteral(dict.genus);
		else// if (txWD.isFamily)
			popobj.tipo = getLiteral(dict.family);
		
		// renderizo
		let htmlcontent = Mustache.render(speciesModalTemplate, popobj);
		$("#infoTaxonImportar").html(htmlcontent);
		$("#infoTaxonImportar").removeClass("d-none");
		
		// reajusto tamaño del diálogo
		configurarModal( { static: true, vertcent: true, lg: true } );
		
		// compruebo si existe el taxón
		const txuris = Object.keys(Datos.especies);
		const txexiste = _.find(txuris, function(txuri) {
			return Datos.especies[txuri].wikidata && Datos.especies[txuri].wikidata.iri === wdiri;
		});
		// si existe, deshabilito el botón de importar, si existe lo habilito
		$("#botimporttaxonwikidata").prop('disabled', !(txexiste == undefined));
		// y si existe, cambio el mensaje adicionalmente
		if (txexiste)
			$("#statusImportTaxon").html(getLiteral(dict.taxonalreadyimported));		
	});
	
	// inicializo focus
	Sesion.txfocus = -1;
}

async function importTaxon() {	
	// ACTULIZACIÓN GUI
	// escondo el botón de quitar el taxón
	$("#clearImportTaxon").addClass("d-none"); //.prop('disabled', true);
	// escondo el contenido de info
	$("#infoTaxonImportar").addClass("d-none");
	// pongo spinner y mensaje
	$("#spinnerImport").removeClass("d-none");
	$("#statusImportTaxon").html(getLiteral(dict.importingthetaxon));
	// actualizo modal para quitar el footer y ajustar tamaño
	configurarModal( { static: true, vertcent: true, nofooter: true } );
	
	// recupero los datos del recurso de Wikidata a importar
	const wdiri = $("#in_importTaxon").attr('wdiri');
	const txWD = Datos.taxonesWD[wdiri];
	
	// cojo todos los taxones (para comprobar si hay que traer más cosas)	
	const txuris = Object.keys(Datos.especies);
	
	// preparo entradas para crear los objetos
	let entradas = [];
	// cada entrada consta de estos campos: iriWD, txWD, iri, iriPadre, pedir (varias desconocidas)
	// durante varios pasos completaremos estos datos desde arriba (familia) hasta abajo (especie)
	if (txWD.family)
		entradas.push( { iriWD: txWD.family } );
	if (txWD.genus)
		entradas.push( { iriWD: txWD.genus } );
	entradas.push( { iriWD: wdiri, txWD: txWD } );
	
	// extraigo los txWD de cada entrada
	// (pediré datos de WD que puede que no necesite, pero es un mal menor => máximo una petición para gen y otra para fam)
	for (let ent of entradas) {
		if (!ent.txWD && (!Datos.taxonesWD[ent.iriWD] || Datos.taxonesWD[ent.iriWD].pending))
			await extractWikidataTaxon(ent.iriWD);
		if (!ent.txWD)
			ent.txWD = Datos.taxonesWD[ent.iriWD];
	}
	
	// aquí ya tengo completo iriWD y txWD en todas, completo resto de campos
	for (let ent of entradas) {
		const iri = _.find(txuris, function(txuri) {
			return Datos.especies[txuri].wikidata && Datos.especies[txuri].wikidata.iri === ent.iriWD;
		});
		if (iri)
			ent.pedir = false;
		else {
			// hay que pedir, completo datos en campos restantes
			ent.pedir = true;
			ent.iri = config.edubase + "/taxon/" + getLiteral(ent.txWD.scientificName).replace(' ', '_');
			if (!ent.txWD.family)
				ent.iriPadre = ent.txWD.isConifer? config.especiesTop[0] : config.especiesTop[1];
			else {
				// necesitaré buscar entre las especies a partir de iriPadreWD
				const iriPadreWD = ent.txWD.genus? ent.txWD.genus : ent.txWD.family;
				ent.iriPadre =  _.find(txuris, function(txuri) {
					return Datos.especies[txuri].wikidata && Datos.especies[txuri].wikidata.iri === iriPadreWD;
				});
				if (!ent.iriPadre) {
					const scPadre = Datos.taxonesWD[iriPadreWD].scientificName;
					ent.iriPadre = config.edubase + "/taxon/" + getLiteral(scPadre).replace(' ', '_');
				}
			}
		}
	}	
		
	// en este punto compruebo que siguen sin existir los taxones a crear 
	// (para evitar que se creen dos veces, aunque esto no debería suponer un problema)
	const irisWDcomprobar = _.pluck(entradas, 'iriWD');
	const irisWDexisten = await getExistingWikidataTaxons(irisWDcomprobar);
			
	// genero array de objetos con los recursos a crear
	let objetosCrear = [];
	let irisWDCrear = [];
	for (let ent of entradas) {
		if ( ent.pedir && !_.contains(irisWDexisten, function(iri){ return ent.iriWD; }) )
			objetosCrear.push( prepareTaxonObjectWD(ent.iri, ent.iriWD, ent.iriPadre) );
	}
	
	// hago las llamadas para crear las especies
	try {
		for (let oc of objetosCrear) {
		    // inicializo evento de creación de taxón a GA
			initTimedEvent( { content_type: 'taxon', content_id: oc.iri,
				uid: Sesion.usuario.uid, crafts_reqs: 0 });			
			// aquí sólo se hace el PUT a CRAFTS, el ajuste de datos se realiza en esta misma función 		
			await createTaxonFromWikidata(oc);
			// envío datos creación de la especie a GA			
			sendTimedEvent("create_content");
			console.info("Taxón creado con IRI: " + oc.iri); // log
		}
	} catch(err) {
		console.error(err.message);
		// actualizo modal
		const be = "<code>" + err.message + "<br>" + JSON.stringify(err.error) + "</code>";		
		configurarModal( { static: true, vertcent: true }, 
			getLiteral(dict.taxonimportingerror), be, footers.anotacionError);		
		return; // terminamos
	}	
	
	// ya están creados, incluyo nuevos taxones en Datos.especies
	// (esto lo hago incluso si fueron creados por otro usuario en el interlapso)
	for (let ent of entradas) {
		if (ent.pedir) // inicializo
			initClass(Datos.especies, ent.iri);
	}
	for (let ent of entradas) {
		if (ent.pedir) {
			//console.log("iri: " + ent.iri + " - iriPadre: " + ent.iriPadre);
			// guardo subclase
			Datos.especies[ent.iriPadre].subclasses.push(ent.iri);
			// guardo superclase
			Datos.especies[ent.iri].superclasses.push(ent.iriPadre);
			// guardo resto de datos
			Datos.especies[ent.iri].scientificName = ent.txWD.scientificName;
			Datos.especies[ent.iri].vulgarName = ent.txWD.vulgarName;
			Datos.especies[ent.iri].wikipediaPage = ent.txWD.wikipediaPage;
			Datos.especies[ent.iri].wikispeciesPage = ent.txWD.wikispeciesPage;
			Datos.especies[ent.iri].wikidata = {
				iri: ent.iriWD,
				image: ent.txWD.image,
				gbifPage: ent.txWD.gbifPage,
				sitelinks: ent.txWD.sitelinks,
				statements: ent.txWD.statements,
				comment: ent.txWD.comment
			};
		}
	}
	// regenero las especies expandidas
	obtenerEspeciesExpandidas(true);
		
	// por último, vuelvo a la tarea anterior
	if (Sesion.estado.path === "newtree") {
		// informo en el diálogo
		$("#statusImportTaxon").html(getLiteral(dict.taxonimported));
		$("#spinnerImport").addClass("d-none");
		// actualizo modal para mostrar el footer
		configurarModal( { static: true, vertcent: true},
			null, null, footers.anotacionError);			
		// hago la selección del taxón (por fin)
		// ojo: uso la iri de la última entrada
		tratarSeleccionTaxon(entradas[entradas.length - 1].iri);	
		// click en botón de seleccionar taxón para cerrar el panel correspondiente
		$("#setTreeTaxonEd").click();
	}
	else {
		// estoy anotando un taxón, rehago el diálogo
		configurarModal( { static: true, vertcent: true, nobody: true}, 
			getLiteral(dict.newAnnotation), annotators.treeTaxon, footers.crearAnotacion);		
		// handler al botón de procesar anotación
		$("#botcreatemodalannotation").click(procesarAnotacion);
		// ajusto nomci 
		$("#anchecknomci").prop('checked', Sesion.nomci);
		$("#anchecknomci").change(handlerNombreCientifico);
		// detecto cambio en treeTaxon
		$("#inputTreeTaxonEd").change(function() { // he hecho un trigger de evento change en species.js para detectar esto
			const iri = config.edubase + "/tree/" + Sesion.estado.etid;
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
		// hago la selección del taxón (por fin)
		// ojo: uso la iri de la última entrada
		tratarSeleccionTaxon(entradas[entradas.length - 1].iri);	
	}
	
	// borro el contenido de la navegación de taxones
	$("#taxones_block_newtree").html("");
	$("#taxones_block").html("");
	$("#taxones_block").addClass("d-none");	
}
function prepareTaxonObjectWD(iri, iriWD, iriPadre) {
	// recupero info del taxón de Wikidata
	const txWD = Datos.taxonesWD[iriWD];
	if (!txWD)
		return undefined;
	// preparo objeto a devolver
	let txobj = {
		"iri": iri, //config.edubase + "/taxon/" + getLiteral(txWD.scientificName).replace(' ', '_'),
		"creator": config.edubase + "/user/" + Sesion.usuario.uid,		
		"created": new Date().toISOString(),
		"types": [
			"http://www.w3.org/2002/07/owl#Class",
			"http://www.w3.org/2000/01/rdf-schema#Class",
			txWD.isSpecies? "https://datos.iepnb.es/def/sector-publico/medio-ambiente/ifn/Species" :
				( txWD.family? "https://datos.iepnb.es/def/sector-publico/medio-ambiente/ifn/Genus" :
					"https://datos.iepnb.es/def/sector-publico/medio-ambiente/ifn/Family" )
		],
		"subclasses": [
			iriPadre,
			txWD.iri
		],
		"scientificName": getLiteral(txWD.scientificName)
	};
	// fusiono vulgarName y label en vulgarName
	//txobj.vulgarName = fuseItems(txWD.vulgarName, txWD.label);
	if (txWD.vulgarName)
		txobj.vulgarName = txWD.vulgarName;
	if (txWD.wikipediaPage)
		txobj.wikipediaPage = txWD.wikipediaPage;
	if (txWD.wikispeciesPage)
		txobj.wikispeciesPage = txWD.wikispeciesPage;
	// y devuelvo
	return txobj;
}

export { getMoreSpecificSpecies, handlerNombreCientifico, handlerInfoTaxon, handlerFiltrarTaxon, 
	visualizarFiltroTaxon, visualizarTaxonFormulario, tratarSeleccionTaxon, 
	handlerSetTreeTaxonEd, handlerDeleteTreeTaxonEd };

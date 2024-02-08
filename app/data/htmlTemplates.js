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
import { getLiteral } from '../modules/util.js';

/*********************
*** TEMPLATES FILE ***
**********************/
let cardTemplate, taxonesSubheadingTemplate, sugeTaxonesTemplate, taxonesBlockTemplate, sugeLugaresTemplate, 
	sugeTaxonesWDTemplate, speciesModalTemplate, popupEdutreeTemplate, spinnerTemplate, navbarTemplate, 
	createEducatreeForm, treeStatusTemplate, treePartsPhotoTemplate, userButtonTemplate, viewEducatreeForm, 
	annotators, footers, treeDeletionBody, downloadTemplateBody, downloadingTemplateBody, signinButtonTemplate, 
	changeNickTemplate, changeTreeNickTemplateBody, userPageTemplate, lasttreesTemplate, alertQuestionnaireTemplate;

let urlLogo = new URL('../images/logoEW.svg', import.meta.url);

function updateHTMLtemplates() {
	cardTemplate = 
'<div id="tarjeta" class="card-body mitarjeta p-1" > \
	<div class="d-flex flex-row"> \
		<div class="dropdown"> \
			<button id ="bot_inicio" class="btn btn-outline-secondary" type="button" \
				data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-list"></i> \
			</button> \
			<ul class="dropdown-menu"> \
				<li><a id="tarjeta-home" class="dropdown-item home" href="#">'+getLiteral(dict.home)+'</a></li> \
				<li><a id="tarjeta-lasttrees" class="dropdown-item lasttrees" href="#">'+getLiteral(dict.lastTrees)+'</a></li> \
			    <li><hr class="dropdown-divider"></li> \
			    <li><a class="dropdown-item lang" tag="en" href="#">🇬🇧 EN</a></li> \
				<li><a class="dropdown-item lang" tag="es" href="#">🇪🇸 ES</a></li> \
			</ul> \
		</div> \
		<div class="btn-group"> \
			<button id="bot_taxones" class="text-nowrap btn btn-outline-secondary ms-1" type="button" disabled> \
				'+getLiteral(dict.taxonfilter)+'</button> \
			<input id="mapchecknomci" type="checkbox" class="btn-check nomci" id="btn-check" autocomplete="off" {{#nomci}}checked{{/nomci}} > \
			<label id="bot_mapnomci" class="btn btn-outline-secondary" for="mapchecknomci"><i class="bi bi-mortarboard-fill"></i></label> \
		</div> \
		<div id="lugares_heading" class="flex-fill ms-1 me-1 me-sm-0 d-none"> \
			<input id="in_lugares" autocomplete="off" type="search" class="form-control " \
				placeholder="'+getLiteral(dict.searchplace)+'" aria-label="'+getLiteral(dict.searchplace)+'"> \
		</div> \
		<div class="ms-auto usuario d-block d-sm-none d-flex align-items-center"></div> \
	</div> \
	<div id="sugelugares" class="list-group mt-2 d-none"></div> \
	<div id="taxones_subheading"></div> \
	<div id="taxones_block" class="taxones_block list-group overflow-auto mt-1 pe-1 pe-sm-2 d-none" style="max-height:50vh;"></div> \
	<div id="filtro_taxon" class="d-none"> \
		<div class="d-flex align-items-center border mt-1"> \
			<div id="div_label_filtro_taxon" class="ms-2"></div> \
			<div class="ms-auto"> \
				<button id="bot_info_filtro_taxon" class="btn btn-sm" type="button" turi="" > \
					<i class="bi bi-info-circle-fill"></i> \
				</button> \
			</div> \
			<div class="me-2"> \
				<button id="bot_color_filtro" class="btn btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false"> \
					<i class="bi bi-droplet-fill"></i> \
				</button> \
				<ul class="dropdown-menu" aria-labelledby="dropdownMenu"> \
					<li><a class="dropdown-item dropdown_color_taxon" href="#" cind="5">Pink</a></li> \
					<li><a class="dropdown-item dropdown_color_taxon" href="#" cind="6">Purple</a></li> \
					<li><a class="dropdown-item dropdown_color_taxon" href="#" cind="7">Indigo</a></li> \
					<li><a class="dropdown-item dropdown_color_taxon" href="#" cind="8">Cyan</a></li> \
					<li><a class="dropdown-item dropdown_color_taxon" href="#" cind="9">Brown</a></li> \
				</ul> \
			</div> \
			<div id="bot_quitar_taxon" class="me-2 pb-1"> \
				<button type="button" class="btn-close" aria-label="Close"></button> \
			</div> \
		</div> \
	</div> \
	<div id="mibarradiv" class="progress mt-1 d-none" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"> \
		<div id="mibarra" class="progress-bar progress-bar-striped progress-bar-animated bg-secondary" style="width: 0%" >0%</div> \
		<div id="mibarra_loading" class="text-center text-dark" style="width: 100%">'+getLiteral(dict.spinnerLoading)+'</div> \
    </div> \
</div>';


	taxonesSubheadingTemplate =
	'{{#activar}} \
		{{#esformulario}}<div class="input-group my-1">{{/esformulario}} \
		<input autocomplete="off" type="search" class="in_taxon form-control{{^esformulario}} my-1{{/esformulario}}" \
				 placeholder="'+getLiteral(dict.searchtaxon)+'" aria-label="'+getLiteral(dict.searchtaxon)+'"> \
		{{#esformulario}}<button id="importTaxonButton" type="button" class="btn btn-outline-primary">'+getLiteral(dict.importtaxon)+'</button></div>{{/esformulario}} \
	{{/activar}} \
	<div class="sugetaxones list-group"></div>';
	

	sugeTaxonesTemplate = 
	'{{#sugerencias}} \
		<button class="list-group-item list-group-item-action bot_suge_taxon" type="button" spuri="{{uri}}"> \
			{{#nc}}<i>{{/nc}}{{{labelshown}}}{{#nc}}</i>{{/nc}}<span class="badge rounded-pill text-bg-secondary float-end me-0">{{nclasses}} S</span> \
			<span class="badge rounded-pill text-bg-secondary float-end me-1">{{nindivs}}</span> \
		</button> \
	{{/sugerencias}} \
	{{#nosugerencias}} \
		<button type="button" class="list-group-item list-group-item-action py-2 bot_suge_taxon" disabled>'+getLiteral(dict.notaxonfound)+'</button> \
	{{/nosugerencias}}';


	taxonesBlockTemplate = 
	'{{#.}} \
		<div class="{{^esconder}}d-flex {{/esconder}}bd-highlight border-bottom border-left border-right taxon {{#esconder}}d-none{{/esconder}}" indice="{{indice}}"> \
			{{#botonesconder}} \
				<div><span>{{{indentspace}}}</span><span><button type="button" class="btn btn-outline-secondary btn-sm showmore">'+getLiteral(dict.showmore)+'</button></span></div> \
			{{/botonesconder}} \
			{{^botonesconder}} \
				<div class="flex-grow-1"> \
					<button class="list-group-item list-group-item-action border-0 bot_sel_taxon" type="button" spuri="{{uri}}"> \
						{{{indentspace}}}{{#nc}}<i>{{/nc}}{{label}}{{#nc}}</i>{{/nc}} \
						<span class="badge rounded-pill text-bg-secondary float-end me-0">{{nclasses}} S</span> \
						<span class="badge rounded-pill text-bg-secondary float-end me-1">{{nindivs}}</span> \
					</button> \
				</div> \
				<div class="p-1"> \
					<button class="btn btn-outline-secondary btn-sm bot_expandir_taxon {{#nosubclasses}}invisible{{/nosubclasses}}" \
						type="button" data-placement="top"><i class="bi bi-chevron-right"></i> \
					</button> \
				</div> \
			{{/botonesconder}} \
		</div> \
	{{/.}}';


	sugeLugaresTemplate = 
	'{{#sugerencias}} \
		<button type="button" class="list-group-item list-group-item-action py-2 bot_suge_lugar" id="{{id}}">{{{name}}}</button> \
	{{/sugerencias}} \
	{{#nosugerencias}} \
		<button type="button" class="list-group-item list-group-item-action py-2" disabled>'+getLiteral(dict.noplacesfound)+'</button> \
	{{/nosugerencias}}';


	sugeTaxonesWDTemplate = 
	'{{#sugerencias}} \
		<button type="button" wdiri="{{{wdiri}}}" class="list-group-item list-group-item-action py-2 bot_suge_taxonWD"><i>{{{title}}}</i><br><small>{{{desc}}}</small></button> \
	{{/sugerencias}} \
	{{#nosugerencias}} \
		<button type="button" class="list-group-item list-group-item-action py-2" disabled>'+getLiteral(dict.notaxonsfound)+'</button> \
	{{/nosugerencias}}';
	

	speciesModalTemplate =
	'<div class="container-fluid"> \
		{{#hayimagen}} \
			<div class="row"> \
				<div class="col-sm-5"> \
		{{/hayimagen}} \
					<h5 class="text-muted">{{tipo}}</h5> \
		{{#hayimagen}} \
			{{^multimages}} \
					<img class="img-fluid mt-1 mb-2" src="{{{image}}}"> \
			{{/multimages}} \
			{{#multimages}} \
				<div id="carouselPopupTaxon" class="carousel slide" data-bs-ride="carousel"> \
					<div class="carousel-inner"> \
						{{#image}} \
							<div class="carousel-item {{#active}}active{{/active}}"> \
								<img src="{{{src}}}" > \
							</div> \
						{{/image}} \
					</div> \
					<button class="carousel-control-prev" type="button" data-bs-target="#carouselPopupTaxon" data-bs-slide="prev"> \
						<span class="carousel-control-prev-icon" aria-hidden="true"></span> \
						<span class="visually-hidden">Previous</span> \
					</button> \
					<button class="carousel-control-next" type="button" data-bs-target="#carouselPopupTaxon" data-bs-slide="next"> \
						<span class="carousel-control-next-icon" aria-hidden="true"></span> \
						<span class="visually-hidden">Next</span> \
					</button>   \
				</div> \
			{{/multimages}} \
				</div> \
				<div class="col-sm-7"> \
		{{/hayimagen}} \
					{{#resumen}} \
						<p>{{resumen}}</p> \
					{{/resumen}} \
					{{#gbifPage}} \
						<a href="{{{.}}}" target="_blank" \
							class="btn btn-secondary btn-sm">GBIF</a> \
					{{/gbifPage}} \
					{{#wikidataPage}} \
						<a href="{{{.}}}" target="_blank" \
							class="btn btn-secondary btn-sm">Wikidata</a> \
					{{/wikidataPage}} \
					{{#wikipediaPage}} \
						<a href="{{{.}}}" target="_blank" \
							class="btn btn-secondary btn-sm">Wikipedia</a> \
					{{/wikipediaPage}} \
					{{#wikispeciesPage}} \
						<a href="{{{.}}}" target="_blank" \
							class="btn btn-secondary btn-sm">WikiSpecies</a> \
					{{/wikispeciesPage}} \
		{{#hayimagen}} \
				</div> \
			</div> \
		{{/hayimagen}} \
	</div>';

	
	popupEdutreeTemplate =	
	'<div style="max-width: 180px;"> \
		{{#image}}<img class="card-img-top" src="{{{.}}}" width="180px">{{/image}} \
		{{#multimages}} \
			<div id="carouselPopupTree" class="carousel slide" data-bs-ride="carousel"> \
				<div class="carousel-inner"> \
					{{#images}} \
						<div class="carousel-item {{#active}}active{{/active}}"> \
							<img src="{{{srcimg}}}" width="180px" class="d-block w-100"> \
						</div> \
					{{/images}} \
				</div> \
				<button class="carousel-control-prev" type="button" data-bs-target="#carouselPopupTree" data-bs-slide="prev"> \
					<span class="carousel-control-prev-icon" aria-hidden="true"></span> \
					<span class="visually-hidden">Previous</span> \
				</button> \
				<button class="carousel-control-next" type="button" data-bs-target="#carouselPopupTree" data-bs-slide="next"> \
					<span class="carousel-control-next-icon" aria-hidden="true"></span> \
					<span class="visually-hidden">Next</span> \
				</button>   \
			</div> \
		{{/multimages}}	\
		{{#nick}}<h6>{{.}}</h6>{{/nick}} \
		{{#taxon}}<h6 class="card-subtitle text-muted">{{{.}}}</h6>{{/taxon}} \
		{{#desc}}<p class="my-1 my-sm-2 card-text">{{{.}}}</p>{{/desc}} \
		{{#creator}}<p class="my-1 my-sm-2 text-muted">{{{.}}}</p>{{/creator}} \
		<div style="display: flex; justify-content: center;"> \
			<button etid="{{{etid}}}" class="educatree btn btn-secondary" type="button">'+getLiteral(dict.moreinfo)+'</button> \
		</div> \
	</div>';

	
	spinnerTemplate =
	'<div class="d-flex flex-row bd-highlight m-5"> \
		<div class="p-3 bd-highlight"><div class="spinner-border" role="status" aria-hidden="true"></div></div> \
		<div class="ml-5 bd-highlight"><div><h3 id="titleSpinner">'+getLiteral(dict.spinnerLoading)+'</h3><p id="infoSpinner" class="font-weight-light">'+getLiteral(dict.spinnerInfo)+'</p></div></div> \
	</div>';


	navbarTemplate = 
	'<nav class="navbar navbar-expand-md" style="background-color: #DCEDC8;"> \
		<div class="container-fluid"> \
			<a class="navbar-brand d-none d-md-block" href="#"> \
				<img src="' + urlLogo + '" alt="EducaWood" height="40"> \
			</a> \
			<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation"> \
				<span class="navbar-toggler-icon"></span> \
			</button> \
			<div class="collapse navbar-collapse" id="navbarNav"> \
				<ul class="navbar-nav"> \
					<li class="nav-item"> \
						<a class="nav-link home" href="#">'+getLiteral(dict.home)+'</a> \
					</li> \
					<li class="nav-item"> \
						<a class="nav-link map" href="#">'+getLiteral(dict.map)+'</a> \
					</li> \
					<li class="nav-item"> \
						<a class="nav-link lasttrees {{#enPagLastrees}}active{{/enPagLastrees}}" {{#enPagLastrees}}aria-current="page"{{/enPagLastrees}} href="#">'+getLiteral(dict.lastTrees)+'</a> \
					</li> \
					<li class="nav-item dropdown"> \
						<a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">'
							+getLiteral(dict.flaglang)+'</a> \
						<ul class="dropdown-menu"> \
							<li><a class="dropdown-item lang" tag="en" href="#">🇬🇧 EN</a></li> \
							<li><a class="dropdown-item lang" tag="es" href="#">🇪🇸 ES</a></li> \
						</ul> \
					</li> \
				</ul> \
			</div> \
			<a class="navbar-brand d-block d-md-none" href="#"> \
				<img src="' + urlLogo + '" alt="EducaWood" height="28"> \
			</a> \
			{{^usuario}} \
			<button class="nav-item btn btn-light usersignin" type="button"><i class="bi bi-box-arrow-in-right"></i></button> \
			{{/usuario}} \
			{{#usuario}} \
			<div class="nav-item dropstart"> \
				<button class="btn p-0" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="border-color: transparent;"> \
					<img class="avatar avatar-32 avatar-sm-48 bg-light rounded-circle text-white {{^usuarioImg}}p-1 p-sm-2{{/usuarioImg}}" \
						src="{{#usuarioImg}}{{{.}}}{{/usuarioImg}}{{^usuarioImg}}https://raw.githubusercontent.com/twbs/icons/main/icons/person.svg{{/usuarioImg}}" \
						referrerpolicy="no-referrer"> \
				</button> \
				<ul class="dropdown-menu"> \
					<li><a href="#" class="dropdown-item userprofile">'+getLiteral(dict.viewProfile)+'</a></li> \
					<li><a href="#" class="dropdown-item usersignout">'+getLiteral(dict.signout)+'</a></li> \
				</ul> \
			</div> \
			{{/usuario}} \
		</div> \
	</nav>';


	createEducatreeForm = navbarTemplate +
	'<div class="container pb-4"> \
		<div class="container-fluid"> \
			<div class="row justify-content-lg-center mt-4 p-0"> \
				<div class="col-lg-8 p-0"> \
					<div class="card text-center p-0"> \
						<div class="card-header"> \
							<h5 class="col card-title">'+getLiteral(dict.newtree)+'</h5> \
						</div> \
						<div class="card-body p-0"> \
							<div id="mapaedutree" style="height: 300px;"> \
								<div id="overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"> \
									<div class="d-flex justify-content-center align-items-center overlay-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5);"> \
										<div class="spinner-border" role="status"> \
											<span class="visually-hidden">Loading...</span> \
										</div> \
									</div> \
								</div> \
							</div> \
							<div id="mapclue" class="form-text d-none">'+getLiteral(dict.mapclue)+'</div> \
						</div> \
					</div> \
				</div> \
			</div> \
			<div class="row justify-content-lg-center"> \
				<form id="createTreeForm" class="col-lg-8 py-4"> \
					<!-- POSITION --> \
					<div class="pb-4 row"> \
						<label for="inputPosition" class="col-md-3 col-form-label">'+getLiteral(dict.position)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputPosition" type="text" class="form-control" value="" disabled readonly> \
							</div> \
						</div> \
					</div> \
					<!-- NICK --> \
					<div class="pb-4 row"> \
						<label for="inputTreeNick" class="col-md-3 col-form-label">'+getLiteral(dict.treenick)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputTreeNick" type="text" class="form-control" value="" minlength="3" maxlength="30" placeholder="'+getLiteral(dict.newTreeNickTip)+'"> \
							</div> \
							<div id="statusNick" class="form-text">'+getLiteral(dict.noNick)+'</div> \
						</div> \
					</div> \
					<!-- TREE TAXON --> \
					<div class="pb-4 row"> \
						<label for="inputTreeTaxonEd" class="col-md-3 col-form-label">'+getLiteral(dict.treetaxon)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<button id="setTreeTaxonEd" class="btn btn-outline-secondary" type="button">'+getLiteral(dict.taxonfilter)+'</button> \
								<input id="inputTreeTaxonEd" type="text" class="form-control taxon" placeholder="" aria-describedby="handlerSetTreeTaxonEd" disabled readonly> \
								<button class="btn btn-outline-secondary d-none delete" type="button" id="deleteTreeTaxon"><i class="bi bi-x-lg"></i></button> \
								<button id="infoTaxonDbpedia" class="btn btn-outline-secondary d-none dbpedia" type="button" turi="" > \
									<i class="bi bi-info-circle-fill"></i> \
								</button> \
								<input id="crchecknomci" type="checkbox" class="btn-check nomci" id="btn-check" autocomplete="off"> \
								<label class="btn btn-outline-secondary" for="crchecknomci"><i class="bi bi-mortarboard-fill"></i></label> \
							</div> \
							<div id="taxones_subheading_newtree" class="d-none"></div> \
							<div id="taxones_block_newtree" class="taxones_block list-group overflow-auto mt-1 d-none pe-1 pe-sm-2" style="max-height:50vh;"></div> \
						</div> \
					</div> \
					<!-- TREE STATUS --> \
					<div class="pb-4 row"> \
						<label for="selectTreeStatus" class="col-md-3 col-form-label">'+getLiteral(dict.treeStatus)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<select id="selectTreeStatus" class="form-select" \
									aria-label="'+getLiteral(dict.treestatusselection)+'"></select> \
								<button class="btn btn-outline-secondary" type="button" id="botTreeStatusInfo"><i class="bi bi-info-circle-fill"></i></button> \
							</div> \
						</div> \
					</div> \
					<!-- TREE PHOTO --> \
					<div class="pb-4 row"> \
						<label for="treePhoto" class="col-md-3 col-form-label">'+getLiteral(dict.photo)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="treePhoto" class="form-control" type="file" accept="image/*" \
									{{#esMovil}}{{#camera}}capture="environment"{{/camera}}{{/esMovil}} > \
								<button class="btn btn-outline-secondary d-none" type="button" id="deleteTreePhoto"><i class="bi bi-x-lg"></i></button> \
								{{#esMovil}} \
									<input id="checkCamera" type="checkbox" class="btn-check camera" id="btn-check" autocomplete="off" {{#camera}}checked{{/camera}}> \
									<label class="btn btn-outline-secondary" for="checkCamera"><i class="bi bi-camera-fill"></i></label> \
								{{/esMovil}} \
							</div> \
							<select id="selectTreePartPhoto" class="d-none form-select mt-1" \
								aria-label="'+getLiteral(dict.partplanselection)+'"></select> \
							<input type="hidden" id="resizedTreePhoto"> \
							<div class="form-text"><span id="textTreePhoto">'+getLiteral(dict.nophoto)+'</span><img id="treeThumbnail" class="d-none ms-3 mt-1" src="" width="80px"></div> \
						</div> \
					</div> \
					<!-- TREE HEIGHT --> \
					<div class="pb-4 row"> \
						<label for="treeHeight" class="col-md-3 col-form-label">'+getLiteral(dict.heightm)+'</label> \
						<div class="col-md-9"> \
							<input type="number" class="form-control" id="treeHeight" step="any" min="0" max="150" placeholder="'+getLiteral(dict.enterheightm)+'"> \
						</div> \
					</div> \
					<!-- TREE DIAMETER --> \
					<div class="pb-4 row"> \
						<label id="labelTreeDiameter" for="treeDiameter" class="col-md-3 col-form-label">'+getLiteral(dict.diametermm)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="treeDiameter" type="number" class="form-control" step="1" min="0" max="20000" placeholder="'+getLiteral(dict.enterdiametermm)+'"> \
								<input id="checkPerimeter" type="checkbox" class="btn-check perimeter" id="btn-check" autocomplete="off"> \
								<label class="btn btn-outline-secondary" for="checkPerimeter"><i class="bi bi-circle"></i></label> \
							</div> \
						</div> \
		  			</div> \
					<!-- TREE OBSERVATION --> \
					<div class="pb-4 row"> \
						<label id="labelTreeObservation for="treeObservation" class="col-md-3 col-form-label">'+getLiteral(dict.treeobservation)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<textarea class="form-control" id="treeObservation" autocomplete="off" placeholder="'+getLiteral(dict.yourobservation)+'" minlength="5" maxlength="500"></textarea> \
							</div> \
						</div> \
		  			</div> \
					<div class="form-text pb-4">{{^usuario}}<strong>'+getLiteral(dict.signupToCreate)+'<strong>{{/usuario}}{{#usuario}}'+getLiteral(dict.formopt)+'{{/usuario}}</div> \
					<div class="d-flex"> \
						<button id="goBackButton" type="button" class="me-auto btn btn-secondary">'+getLiteral(dict.cancel)+'</button> \
						<button id="createTreeButton" type="submit" class="btn btn-primary" {{^usuario}}disabled{{/usuario}}>'+getLiteral(dict.createtree)+'</button> \
					</div> \
				</form> \
			</div> \
		</div> \
	</div>';


	treeStatusTemplate = 
	'<option value="" selected>'+getLiteral(dict.treestatusselection)+'</option> \
	{{#.}} \
		<option value="{{{iri}}}">{{{pref}}}{{label}}</option> \
	{{/.}}';


	treePartsPhotoTemplate = 
	'<option value="" selected>'+getLiteral(dict.partplanselection)+'</option> \
	{{#.}} \
		<option value="{{{uri}}}">{{label}}</option> \
	{{/.}}';


	userButtonTemplate = 
	'<div class="dropdown"> \
		<button class="btn p-0" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="border-color: transparent;"> \
			<img class="avatar avatar-32 avatar-sm-48 bg-light rounded-circle text-white {{^img}}p-1 p-sm-2{{/img}}" \
    			src="{{#img}}{{{.}}}{{/img}}{{^img}}https://raw.githubusercontent.com/twbs/icons/main/icons/person.svg{{/img}}" \
    			referrerpolicy="no-referrer"> \
		</button> \
		<ul class="dropdown-menu"> \
			<li><a href="#" class="dropdown-item userprofile">'+getLiteral(dict.viewProfile)+'</a></li> \
			<li><a href="#" class="dropdown-item usersignout">'+getLiteral(dict.signout)+'</a></li> \
		</ul> \
	</div>';


	viewEducatreeForm = navbarTemplate +
	'<div class="container pb-4"> \
		<div class="container-fluid"> \
			<div class="row justify-content-lg-center mt-4 p-0"> \
				<div class="col-lg-8 p-0"> \
					<div class="card text-center p-0"> \
						<div class="card-header"> \
							<h5 class="col card-title">{{{title}}}</h5> \
							{{#treeCreator}}<p class="col card-text">{{{.}}}</p>{{/treeCreator}} \
							{{#removable}}<button id="changeTreeNick" type="button" class="btn btn-primary mt-1">{{nickButtonLabel}}</button>{{/removable}} \
						</div> \
						<div class="card-body p-0"> \
							<div id="mapaedutree" style="height: 300px;"> \
								<div id="overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"> \
									<div class="d-flex justify-content-center align-items-center overlay-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5);"> \
										<div class="spinner-border" role="status"> \
											<span class="visually-hidden">Loading...</span> \
										</div> \
									</div> \
								</div> \
							</div> \
						</div> \
					</div> \
				</div> \
			</div> \
			<div class="row justify-content-lg-center"> \
				<div class="col-lg-8 py-4 px-0 px-sm-3"> \
					<!-- POSITION --> \
					<div class="row"> \
						<label for="inputPosition" class="col-md-3 col-form-label">'+getLiteral(dict.position)+'</label> \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputPosition" type="text" class="form-control" value="{{position.value}}" disabled readonly> \
							</div> \
						</div> \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary position create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#position.removable}}px-0{{/position.removable}}">{{{position.creator}}}</div> \
						{{#position.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="col-auto btn btn-outline-danger position delete" iri="{{{position.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/position.removable}} \
					</div> \
					{{#hasFormerPositions}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePositions" \
								aria-expanded="false" aria-controls="collapsePositions">'+getLiteral(dict.formerPositions)+'</button> \
						</div> \
					</div> \
					<div id="collapsePositions" class="collapse pt-1"> \
						{{#formerPositions}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<input id="inputPosition" type="text" class="form-control" value="{{value}}" disabled readonly> \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger position delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/formerPositions}} \
					</div> \
					{{/hasFormerPositions}} \
					<!-- TREE TAXON --> \
					{{#treeTaxon}} \
					<div class="row pt-4"> \
						<label for="viewTreeTaxon" class="col-md-3 col-form-label">'+getLiteral(dict.treetaxon)+'</label> \
						{{#treeTaxon.value}} \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="viewTreeTaxon" type="text" class="form-control taxon" iri="{{{treeTaxon.value}}}" disabled readonly> \
								{{#treeTaxon.wikidata}} \
								<button id="viewInfoTaxonDbpedia" class="btn btn-outline-secondary dbpedia" type="button" turi="{{{treeTaxon.value}}}" > \
									<i class="bi bi-info-circle-fill"></i> \
								</button> \
								{{/treeTaxon.wikidata}} \
								<input id="viewchecknomci" type="checkbox" class="btn-check nomci" id="btn-check" autocomplete="off"> \
								<label class="btn btn-outline-secondary" for="viewchecknomci"><i class="bi bi-mortarboard-fill"></i></label> \
							</div> \
						</div> \
						{{/treeTaxon.value}} \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary treeTaxon create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#treeTaxon.removable}}px-0{{/treeTaxon.removable}}">{{{treeTaxon.creator}}}</div> \
						{{#treeTaxon.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger treeTaxon delete" iri="{{{treeTaxon.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/treeTaxon.removable}} \
					</div> \
					{{#hasFormerTaxa}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTaxa" \
								aria-expanded="false" aria-controls="collapseTaxa">'+getLiteral(dict.formerTreeTaxons)+'</button> \
						</div> \
					</div> \
					<div id="collapseTaxa" class="collapse pt-1"> \
						{{#formerTaxa}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<input type="text" class="form-control taxon" iri="{{{value}}}" disabled readonly> \
									{{#wikidata}} \
									<button class="btn btn-outline-secondary dbpedia" type="button" turi="{{{value}}}" > \
										<i class="bi bi-info-circle-fill"></i> \
									</button> \
									{{/wikidata}} \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger treeTaxon delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/formerTaxa}} \
					</div> \
					{{/hasFormerTaxa}} \
					{{/treeTaxon}} \
					<!-- TREE STATUS --> \
					{{#treeStatus}} \
					<div class="row pt-4"> \
						<label for="inputTreeStatus" class="col-md-3 col-form-label">'+getLiteral(dict.treeStatus)+'</label> \
						{{#treeStatus.value}} \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputTreeStatus" type="text" class="form-control" value="{{treeStatus.value}}" disabled readonly> \
								<button id="botTreeStatusInfo" class="btn btn-outline-secondary" type="button"><i class="bi bi-info-circle-fill"></i></button> \
							</div> \
						</div> \
						{{/treeStatus.value}} \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary treeStatus create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#treeStatus.removable}}px-0{{/treeStatus.removable}}">{{{treeStatus.creator}}}</div> \
						{{#treeStatus.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger treeStatus delete" iri="{{{treeStatus.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/treeStatus.removable}} \
					</div> \
					{{#hasFormerStatus}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStatus" \
								aria-expanded="false" aria-controls="collapseStatus">'+getLiteral(dict.formerTreeStatus)+'</button> \
						</div> \
					</div> \
					<div id="collapseStatus" class="collapse pt-1"> \
						{{#formerStatus}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<input type="text" class="form-control" value="{{value}}" disabled readonly> \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger treeStatus delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/formerStatus}} \
					</div> \
					{{/hasFormerStatus}} \
					{{/treeStatus}} \
					<!-- PHOTOS --> \
					{{#photoLabel}} \
					<div class="row pt-4"> \
						<label class="col-md-3 col-form-label">{{photoLabel}}</label> \
					</div> \
					{{#hasPhotos}} \
					<div id="miCarrusel" class="row carousel slide"> \
						{{^onePhoto}} \
						<div class="carousel-indicators" style="margin-left: 0;"> \
							{{#photos}} \
							<button type="button" data-bs-target="#miCarrusel" data-bs-slide-to="{{index}}" {{#first}}class="active"{{/first}}></button> \
							{{/photos}} \
					  	</div> \
						{{/onePhoto}} \
						<div class="carousel-inner"> \
							{{#photos}} \
							<div class="carousel-item {{#first}}active{{/first}}"> \
								<img src="{{{src}}}" class="d-block w-100"> \
								{{#plantPart}} \
								<div class="carousel-caption d-block"> \
									<p>{{plantPart}}</p> \
								</div> \
								{{/plantPart}} \
							</div> \
							{{/photos}} \
						</div> \
						{{^onePhoto}} \
					 	<button class="carousel-control-prev" type="button" data-bs-target="#miCarrusel" data-bs-slide="prev"> \
							<span class="carousel-control-prev-icon" aria-hidden="true"></span> \
							<span class="visually-hidden">Previous</span> \
					  	</button> \
					  	<button class="carousel-control-next" type="button" data-bs-target="#miCarrusel" data-bs-slide="next"> \
							<span class="carousel-control-next-icon" aria-hidden="true"></span> \
							<span class="visually-hidden">Next</span> \
					  	</button> \
						{{/onePhoto}} \
					</div> \
					{{/hasPhotos}} \
					{{#photos}} \
					<div class="row pt-1 justify-content-between photoCreator {{^first}}d-none{{/first}}" index="{{index}}"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary photo create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
						{{#removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger photo delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/removable}} \
					</div> \
					{{/photos}} \
					{{^hasPhotos}} \
					{{#editable}} \
					<div class="row pt-1 justify-content-between"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary photo create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
					</div> \
					{{/editable}} \
					{{/hasPhotos}} \
					{{/photoLabel}} \
					<!-- HEIGHT --> \
					{{#height}} \
					<div class="row pt-4"> \
						<label for="inputHeight" class="col-md-3 col-form-label">'+getLiteral(dict.heightm)+'</label> \
						{{#height.value}} \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputHeight" type="text" class="form-control" value="{{height.value}}" disabled readonly> \
							</div> \
						</div> \
						{{/height.value}} \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary height create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#height.removable}}px-0{{/height.removable}}">{{{height.creator}}}</div> \
						{{#height.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger height delete" iri="{{{height.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/height.removable}} \
					</div> \
					{{#hasFormerHeight}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseHeight" \
								aria-expanded="false" aria-controls="collapseHeight">'+getLiteral(dict.formerHeights)+'</button> \
						</div> \
					</div> \
					<div id="collapseHeight" class="collapse pt-1"> \
						{{#formerHeights}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<input type="text" class="form-control" value="{{value}}" disabled readonly> \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger height delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/formerHeights}} \
					</div> \
					{{/hasFormerHeight}} \
					{{/height}} \
					<!-- DIAMETER --> \
					{{#diameter}} \
					<div class="row pt-4"> \
						<label for="inputDiameter" class="col-md-3 col-form-label">'+getLiteral(dict.diametermm)+'</label> \
						{{#diameter.value}} \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<input id="inputDiameter" type="text" class="form-control" value="{{diameter.value}}" disabled readonly> \
							</div> \
						</div> \
						{{/diameter.value}} \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary diameter create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#diameter.removable}}px-0{{/diameter.removable}}">{{{diameter.creator}}}</div> \
						{{#diameter.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger diameter delete" iri="{{{diameter.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/diameter.removable}} \
					</div> \
					{{#hasFormerDiameter}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDiameter" \
								aria-expanded="false" aria-controls="collapseDiameter">'+getLiteral(dict.formerDiameters)+'</button> \
						</div> \
					</div> \
					<div id="collapseDiameter" class="collapse pt-1"> \
						{{#formerDiameters}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<input type="text" class="form-control" value="{{value}}" disabled readonly> \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger diameter delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/formerDiameters}} \
					</div> \
					{{/hasFormerDiameter}} \
					{{/diameter}} \
					<!-- OBSERVACIONES --> \
					{{#observation}} \
					<div class="row pt-4"> \
						<label for="inputObservation" class="col-md-3 col-form-label">'+getLiteral(dict.observations)+'</label> \
						{{#observation.value}} \
						<div class="col-md-9"> \
							<div class="input-group"> \
								<textarea id="inputObservation" class="form-control" disabled readonly>{{{observation.value}}}</textarea> \
							</div> \
						</div> \
						{{/observation.value}} \
					</div> \
					<div class="row pt-1 justify-content-between"> \
						{{#editable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-primary observation create" type="button"><i class="bi bi-plus-lg"></i></button> \
						</div> \
						{{/editable}} \
						<div class="form-text col text-end {{#observation.removable}}px-0{{/observation.removable}}">{{{observation.creator}}}</div> \
						{{#observation.removable}} \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-danger observation delete" iri="{{{observation.iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
						</div> \
						{{/observation.removable}} \
					</div> \
					{{#hasMoreObservations}} \
					<div class="row pt-1 justify-content-end"> \
						<div class="btn-group col-auto" role="group"> \
							<button class="btn btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseObservation" \
								aria-expanded="false" aria-controls="collapseObservation">'+getLiteral(dict.moreobservations)+'</button> \
						</div> \
					</div> \
					<div id="collapseObservation" class="collapse pt-1"> \
						{{#moreObservations}} \
						<div class="row"> \
							<div class="col-md-3"></div> \
							<div class="col-md-9"> \
								<div class="input-group"> \
									<textarea class="form-control" disabled readonly>{{{value}}}</textarea> \
								</div> \
							</div> \
						</div> \
						<div class="row py-1 justify-content-between"> \
							<div class="form-text col text-end {{#removable}}px-0{{/removable}}">{{{creator}}}</div> \
							{{#removable}} \
							<div class="btn-group col-auto" role="group"> \
								<button class="col-auto btn btn-outline-danger observation delete" iri="{{{iri}}}" type="button"><i class="bi bi-x-lg"></i></button> \
							</div> \
							{{/removable}} \
						</div> \
						{{/moreObservations}} \
					</div> \
					{{/hasMoreObservations}} \
					{{/observation}} \
					<!-- BACK AND DELETE BUTTONS --> \
					<div class="d-flex pt-5"> \
						<button type="button" class="btn btn-secondary goBack">'+getLiteral(dict.back)+'</button> \
						{{#removable}} \
						<button id="deleteEducaTree" type="button" class="ms-auto btn btn-danger">'+getLiteral(dict.deleteTree)+'</button> \
						{{/removable}} \
					</div> \
				</div> \
			</div> \
		</div> \
	</div>';
	

	annotators = {
	position: '<div id="mapaAnn" style="height: 300px;"> \
			<div id="overlayAnn" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"> \
				<div class="d-flex justify-content-center align-items-center overlay-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5);"> \
					<div class="spinner-border" role="status"> \
						<span class="visually-hidden">Loading...</span> \
					</div> \
				</div> \
			</div> \
		</div> \
		<div id="mapclueAnn" class="form-text d-none">'+getLiteral(dict.mapclue)+'</div> \
		<label for="inputPositionAnn" class="col-form-label">'+getLiteral(dict.position)+'</label> \
		<input id="inputPositionAnn" type="text" class="form-control" value="" disabled readonly> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.sameAnnotation)+'</div>',
	treeTaxon: '<label for="inputTreeTaxonEd" class="col-form-label">'+getLiteral(dict.treetaxon)+'</label> \
		<div class="row"> \
			<div class="input-group"> \
				<button id="setTreeTaxonEd" class="btn btn-outline-secondary" type="button">'+getLiteral(dict.taxonfilter)+'</button> \
				<input id="inputTreeTaxonEd" type="text" class="form-control taxon" placeholder="" aria-describedby="handlerSetTreeTaxonEd" disabled readonly> \
				<button class="btn btn-outline-secondary d-none delete" type="button" id="deleteTreeTaxon"><i class="bi bi-x-lg"></i></button> \
				<input id="anchecknomci" type="checkbox" class="btn-check nomci" id="btn-check" autocomplete="off"> \
				<label class="btn btn-outline-secondary" for="anchecknomci"><i class="bi bi-mortarboard-fill"></i></label> \
			</div> \
			<div id="taxones_subheading_newtree" class="d-none"></div> \
			<div id="taxones_block_newtree" class="taxones_block list-group overflow-auto mt-1 d-none pe-1 pe-sm-2" style="max-height:50vh;"></div> \
		</div> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.noAnnotation)+'</div>',
	treeStatus: '<label for="selectTreeStatus" class="col-form-label">'+getLiteral(dict.treeStatus)+'</label> \
		<select id="selectTreeStatus" class="form-select" aria-label="'+getLiteral(dict.treestatusselection)+'"></select> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.noAnnotation)+'</div>',
	photo: '<label for="treePhoto" class="col-form-label">'+getLiteral(dict.photo)+'</label> \
		<div class="input-group"> \
			<input id="treePhoto" class="form-control" type="file" accept="image/*" \
				{{#esMovil}}{{#camera}}capture="environment"{{/camera}}{{/esMovil}} > \
			<button class="btn btn-outline-secondary d-none" type="button" id="deleteTreePhoto"><i class="bi bi-x-lg"></i></button> \
			{{#esMovil}} \
				<input id="checkCamera" type="checkbox" class="btn-check camera" id="btn-check" autocomplete="off" {{#camera}}checked{{/camera}}> \
				<label class="btn btn-outline-secondary" for="checkCamera"><i class="bi bi-camera-fill"></i></label> \
			{{/esMovil}} \
		</div> \
		<select id="selectTreePartPhoto" class="d-none form-select mt-1" \
				aria-label="'+getLiteral(dict.partplanselection)+'"></select> \
		<input type="hidden" id="resizedTreePhoto"> \
		<div class="form-text"><span id="textTreePhoto">'+getLiteral(dict.nophoto)+'</span><img id="treeThumbnail" class="d-none ms-3 mt-1" src="" width="80px"></div>',
	height: '<label for="treeHeight" class="col-form-label">'+getLiteral(dict.heightm)+'</label> \
		<input id="treeHeight" type="number" class="form-control" step="any" min="0" max="150" placeholder="'+getLiteral(dict.enterheightm)+'"> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.noAnnotation)+'</div>',
	diameter: '<label id="labelTreeDiameter" for="treeDiameter" class="col-form-label">'+getLiteral(dict.diametermm)+'</label> \
		<div class="input-group"> \
			<input id="treeDiameter" type="number" class="form-control" step="1" min="0" max="20000" placeholder="'+getLiteral(dict.enterdiametermm)+'"> \
			<input id="checkPerimeter" type="checkbox" class="btn-check perimeter" id="btn-check" autocomplete="off"> \
			<label class="btn btn-outline-secondary" for="checkPerimeter"><i class="bi bi-circle"></i></label> \
		</div> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.noAnnotation)+'</div>',
	observation: '<label for="observation" class="col-form-label">'+getLiteral(dict.treeobservation)+'</label> \
		<textarea class="form-control" id="observation" autocomplete="off" placeholder="'+getLiteral(dict.yourobservation)+'" minlength="5" maxlength="500"></textarea> \
		<div id="statusAnnotation" class="form-text pt-2">'+getLiteral(dict.noAnnotation)+'</div>',
	importTaxon: '<label for="importTaxon" class="col-form-label"></label> \
		<div class="row"> \
			<div class="input-group"> \
				<input id="in_importTaxon" autocomplete="off" type="search" class="form-control" \
					 placeholder="'+getLiteral(dict.searchtaxon)+'" aria-label="'+getLiteral(dict.searchtaxon)+'" wdiri="" > \
				<button id="clearImportTaxon" class="btn btn-outline-secondary d-none" type="button"><i class="bi bi-x-lg"></i></button> \
			</div> \
			<div id="sugetaxonesWD" class="list-group mt-2 mx-2 d-none"></div> \
		</div> \
		<div id="infoTaxonImportar" class="row d-none mt-2"></div> \
		<div class="d-flex align-items-center mt-2"> \
			<div id="spinnerImport" class="spinner-border me-2 d-none" role="status"></div> \
			<div id="statusImportTaxon" class="form-text">'+getLiteral(dict.typesomething)+'</div> \
		</div>'
};

	footers = {	
	creacionExito: '<button type="button" class="btn btn-secondary goBack" \
			data-bs-dismiss="modal">'+getLiteral(dict.back)+'</button> \
		<button type="button" class="btn btn-primary cargarURL" \
			data-bs-dismiss="modal">'+getLiteral(dict.viewtree)+'</button>',
	creacionError: '<button type="button" class="btn btn-secondary goBack" \
			data-bs-dismiss="modal">'+getLiteral(dict.back)+'</button>',
	confirmarBorradoArbol: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="procesarBorradoArbol" type="button" class="btn btn-danger">'+getLiteral(dict.delete)+'</button>',
	borradoArbolExito: '<button type="button" class="btn btn-secondary goBack" \
			data-bs-dismiss="modal">'+getLiteral(dict.back)+'</button>',
	borradoArbolError: '<button type="button" class="btn btn-secondary goBack" \
			data-bs-dismiss="modal">'+getLiteral(dict.back)+'</button> \
		<button type="button" class="btn btn-danger" \
			data-bs-dismiss="modal" aria-label="Close">'+getLiteral(dict.close)+'</button>',
	crearAnotacion: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="botcreatemodalannotation" type="button" class="btn btn-primary" \
			disabled>'+getLiteral(dict.createAnnotation)+'</button>',
	anotacionExito: '<button id="botAnotacionExito" type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal">'+getLiteral(dict.close)+'</button>',
	anotacionError: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal">'+getLiteral(dict.close)+'</button>',
	confirmarBorradoAnotacion: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="botonBorradoAnotacion" type="button" class="btn btn-danger">'+getLiteral(dict.delete)+'</button>',
	cambiarNick: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="botonCambioNick" type="button" class="btn btn-primary" disabled>'+getLiteral(dict.change)+'</button>',
	nickCambiado: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal">'+getLiteral(dict.close)+'</button>',
	treeNickCambiado: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal">'+getLiteral(dict.close)+'</button>',
	descargaDatos: '<button id="downloadClose" type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="downloadData" type="button" class="btn btn-primary" disabled>'+getLiteral(dict.download)+'</button>',
	importarTaxon: '<button type="button" class="btn btn-secondary" \
			data-bs-dismiss="modal" aria-label="Close" ">'+getLiteral(dict.cancel)+'</button> \
		<button id="botimporttaxonwikidata" type="button" class="btn btn-primary" \
			disabled>'+getLiteral(dict.importtaxon)+'</button>'
};

	downloadTemplateBody = 
	'<div> \
		<p>'+getLiteral(dict.downloadMessage)+'</p> \
		<span>'+getLiteral(dict.downloadChoices)+'</span> \
		<div class="form-check"> \
			<input class="form-check-input check-download trees" type="checkbox" value="" id="checkTrees"> \
			<label class="form-check-label" for="checkTrees">'+getLiteral(dict.checkTrees)+'</label> \
		</div> \
		<div class="form-check"> \
			<input class="form-check-input check-download annotations" type="checkbox" value="" id="checkAnnotations"> \
			<label class="form-check-label" for="checkAnnotations">'+getLiteral(dict.checkAnnotations)+'</label> \
		</div> \
		<div id="downloadClusterNote"><small><i>'+getLiteral(dict.downloadClusterNote)+'</i></small></div> \
		<div id="downloadNothing"><strong>'+getLiteral(dict.downloadNothing)+'</strong></div> \
		<br><div>'+getLiteral(dict.downloadFormatChoose)+'</div> \
		<input type="radio" class="btn-check downloadRadio" name="format" id="GeoJSON" autocomplete="off"> \
		<label class="btn btn-outline-primary" for="GeoJSON">GeoJSON</label> \
		<input type="radio" class="btn-check downloadRadio" name="format" id="CSV" autocomplete="off"> \
		<label class="btn btn-outline-primary" for="CSV">CSV</label> \
		<input type="radio" class="btn-check downloadRadio" name="format" id="KML" autocomplete="off"> \
		<label class="btn btn-outline-primary" for="KML">KML</label> \
		<div id="downloadNoFormat"><strong>'+getLiteral(dict.downloadNoFormat)+'</strong></div> \
	</div>';
		
	downloadingTemplateBody =
	'<div> \
		<div id="downloadingTrees" class="d-none"><i class="bi bi-arrow-right-circle"></i> \
			<span class="ms-1">'+ getLiteral(dict.downloadingTrees) +'</span> \
		</div> \
		<div id="treesDownloaded" class="d-none"><i class="bi bi-check-lg"></i> \
			<span class="ms-1">'+ getLiteral(dict.treesDownloaded) +'</span> \
		</div> \
		<div id="noTreesDownloaded" class="d-none"><i class="bi bi-info-circle"></i> \
			<span class="ms-1">'+ getLiteral(dict.noTreesDownloaded) +'</span> \
		</div> \
		<div id="downloadingAnnotations" class="d-none"><i class="bi bi-arrow-right-circle"></i> \
			<span class="ms-1">'+ getLiteral(dict.downloadingAnnotations) +'</span> \
		</div> \
		<div id="annotationsDownloaded" class="d-none"><i class="bi bi-check-lg"></i> \
			<span class="ms-1">'+ getLiteral(dict.annotationsDownloaded) +'</span> \
		</div> \
		<div id="noAnnotationsDownloaded" class="d-none"><i class="bi bi-info-circle"></i> \
			<span class="ms-1">'+ getLiteral(dict.noAnnotationsDownloaded) +'</span> \
		</div> \
		<div id="mibarradescarga_div" class="progress my-1" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"> \
			<div id="mibarradescarga" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%" >0%</div> \
		</div> \
		<div id="imgDownload" class="d-none mt-1"><img src="./downloadData.png" class="d-block w-100"></div> \
	</div>';
	
	
	treeDeletionBody = 
	'<img id="imgTreeDeletion" src="./treeDeletion.png" class="d-block w-100">';
	

	signinButtonTemplate = 
	'<button class="btn btn-outline-secondary d-block d-sm-none usersignin" type="button"><i class="bi bi-box-arrow-in-right"></i></button> \
	<button class="btn btn-light d-none d-sm-block usersignin" type="button"><i class="bi bi-box-arrow-in-right"></i></button>';

	
	changeNickTemplate = 
	'<input id="newNick" type="text" class="form-control" minlength="3" maxlength="20" placeholder="'+getLiteral(dict.newNickTip)+'"> \
	<div id="statusNick" class="form-text pt-2">'+getLiteral(dict.noNick)+'</div> \
	<img id="imgNewNick" src="./newNick.png" class="d-none d-block w-100">';


	changeTreeNickTemplateBody = 
	'<input id="newTreeNick" type="text" class="form-control" minlength="3" maxlength="30" \
			placeholder="'+getLiteral(dict.newTreeNickTip)+'"> \
	<div id="statusNick" class="form-text pt-2">'+getLiteral(dict.noNick)+'</div> \
	<img id="imgNewTreeNick" src="./newNick.png" class="d-none d-block w-100">';
	
	
	userPageTemplate = navbarTemplate +
	'<div class="container pb-4"> \
		<div class="row"> \
			<div class="col-md-6 mt-4 mx-auto"> \
				<!-- TARJETA USUARIO --> \
				<div class="card text-center"> \
					<div class="card-header d-flex justify-content-center"> \
						<img class="card-img-top avatar avatar-128 bg-light rounded-circle text-white {{^img}}p-1 p-sm-2{{/img}}" \
							src="{{#img}}{{{.}}}{{/img}}{{^img}}https://raw.githubusercontent.com/twbs/icons/main/icons/person.svg{{/img}}" \
							referrerpolicy="no-referrer"> \
					</div> \
					<div class="card-body"> \
						<h5 class="card-title">{{{name}}}</h5> \
						{{#activeLabel}}<p class="card-text">{{.}}</p>{{/activeLabel}} \
						{{#master}}<p class="card-text">'+getLiteral(dict.isMaster)+'</p>{{/master}} \
						{{#cannotAnnotate}}<p class="card-text">'+getLiteral(dict.cannotAnnotate)+'</p>{{/cannotAnnotate}} \
						{{#edutreesLabel}}<p class="card-text">{{.}}</p>{{/edutreesLabel}} \
						{{#annotationsLabel}}<p class="card-text">{{.}}</p>{{/annotationsLabel}} \
						{{#nickButtonLabel}}<button id="changeNick" type="button" class="btn btn-primary mt-1">{{.}}</button>{{/nickButtonLabel}} \
					</div> \
				</div> \
				<!-- BOTÓN ATRÁS DISPS GRANDES --> \
				<div class="d-none d-md-block col my-4 mx-auto"> \
					<div class="d-flex ms-0"> \
						<button type="button" class="ms-0 btn btn-secondary goback">'+getLiteral(dict.back)+'</button> \
					</div> \
				</div> \
			</div> \
			<!-- ACORDEÓN --> \
			<div class="col-md-6 my-4 mx-auto"> \
				<div class="accordion" id="accordionTrees"> \
					<div class="accordion-item"> \
						<h2 class="accordion-header"> \
							<button class="accordion-button {{#showann}}collapsed{{/showann}}" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCreated" \
								aria-expanded="{{^showann}}true{{/showann}}{{#showann}}false{{/showann}}" aria-controls="collapseCreated">'+getLiteral(dict.lastCreatedTrees)+'</button> \
						</h2> \
						<div id="collapseCreated" class="accordion-collapse collapse {{^showann}}show{{/showann}}" data-bs-parent="#accordionTrees"> \
							<div class="accordion-body {{#hayUltedutrees}}pt-0{{/hayUltedutrees}} {{^hayUltedutrees}}pb-0{{/hayUltedutrees}}"> \
								{{^hayUltedutrees}}<p>'+getLiteral(dict.noCreatedTrees)+'</p>{{/hayUltedutrees}} \
								{{#hayUltedutrees}} \
								<div class="d-flex align-items-center justify-content-between my-2"> \
									<h6 class="text-muted mt-2">'+getLiteral(dict.page)+' #{{pagUltedutrees}}</h6> \
									<span class="btn-group" role="group"> \
										<button class="btn btn-outline-secondary pagina prev created" type="button" {{^hayUltedutreesPrev}}disabled{{/hayUltedutreesPrev}}><i class="bi bi-chevron-left"></i></button> \
										<button class="btn btn-outline-secondary pagina sig created" type="button" {{^hayUltedutreesSig}}disabled{{/hayUltedutreesSig}}><i class="bi bi-chevron-right"></i></button> \
									</span> \
								</div> \
								<ul class="list-group"> \
									{{#ultedutrees}} \
									<li class="list-group-item">{{{.}}}</li> \
									{{/ultedutrees}} \
								</ul> \
								{{/hayUltedutrees}} \
							</div> \
						</div> \
					</div> \
					<div class="accordion-item"> \
						<h2 class="accordion-header"> \
							<button class="accordion-button {{^showann}}collapsed{{/showann}}" type="button" data-bs-toggle="collapse" \
								data-bs-target="#collapseAnnotated" aria-expanded="{{^showann}}false{{/showann}}{{#showann}}true{{/showann}}" aria-controls="collapseAnnotated"> \
								'+getLiteral(dict.lastAnnotations)+'</button> \
						</h2> \
						<div id="collapseAnnotated" class="accordion-collapse collapse {{#showann}}show{{/showann}}" data-bs-parent="#accordionTrees"> \
							<div class="accordion-body {{#hayUltanns}}pt-0{{/hayUltanns}} {{^hayUltanns}}pb-0{{/hayUltanns}}"> \
								{{^hayUltanns}}<p>'+getLiteral(dict.noAnnotations)+'</p>{{/hayUltanns}} \
								{{#hayUltanns}} \
								<div class="d-flex align-items-center justify-content-between my-2"> \
									<h6 class="text-muted mt-2">'+getLiteral(dict.page)+' #{{pagUltanns}}</h6> \
									<span class="btn-group" role="group"> \
										<button class="btn btn-outline-secondary pagina prev annotated" type="button" {{^hayUltannsPrev}}disabled{{/hayUltannsPrev}}><i class="bi bi-chevron-left"></i></button> \
										<button class="btn btn-outline-secondary pagina sig annotated" type="button" {{^hayUltannsSig}}disabled{{/hayUltannsSig}}><i class="bi bi-chevron-right"></i></button> \
									</span> \
								</div> \
								<ul class="list-group"> \
									{{#ultanns}} \
									<li class="list-group-item">{{{.}}}</li> \
									{{/ultanns}} \
								</ul> \
								{{/hayUltanns}} \
							</div> \
						</div> \
					</div> \
				</div>	 \
			</div> \
		</div> \
		<!-- BACK BUTTON (SMALL) --> \
		<div class="d-block d-md-none row"> \
			<div class="col mb-4 mx-auto"> \
				<div class="d-flex ms-0"> \
					<button type="button" class="ms-0 btn btn-secondary goback">'+getLiteral(dict.back)+'</button> \
				</div> \
			</div> \
		</div> \
	</div>';
	
	
	lasttreesTemplate = navbarTemplate +
	'<div class="container pb-4"> \
		<!-- ACORDEÓN --> \
		<div class="col-md-8 my-4 mx-auto"> \
			<div class="accordion" id="accordionTrees"> \
				<div class="accordion-item"> \
					<h2 class="accordion-header"> \
						<button class="accordion-button {{#showann}}collapsed{{/showann}}" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCreated" \
							aria-expanded="{{^showann}}true{{/showann}}{{#showann}}false{{/showann}}" aria-controls="collapseCreated">'+getLiteral(dict.lastCreatedTrees)+'</button> \
					</h2> \
					<div id="collapseCreated" class="accordion-collapse collapse {{^showann}}show{{/showann}}" data-bs-parent="#accordionTrees"> \
						<div class="accordion-body {{#hayUltedutrees}}pt-0 px-2 px-md-4{{/hayUltedutrees}} pb-0"> \
							{{^hayUltedutrees}}<p>'+getLiteral(dict.noCreatedTrees)+'</p>{{/hayUltedutrees}} \
							{{#hayUltedutrees}} \
							<div class="d-flex align-items-center justify-content-between my-2"> \
								<h6 class="text-muted mt-2">'+getLiteral(dict.page)+' #{{pagUltedutrees}}</h6> \
								<span class="btn-group" role="group"> \
									<button class="btn btn-outline-secondary pagina prev created" type="button" {{^hayUltedutreesPrev}}disabled{{/hayUltedutreesPrev}}><i class="bi bi-chevron-left"></i></button> \
									<button class="btn btn-outline-secondary pagina sig created" type="button" {{^hayUltedutreesSig}}disabled{{/hayUltedutreesSig}}><i class="bi bi-chevron-right"></i></button> \
								</span> \
							</div> \
							<div> \
								<table class="table table-striped"> \
									<thead> \
										<tr> \
											<th scope="col">'+getLiteral(dict.tree)+'</th> \
											<th scope="col">'+getLiteral(dict.created)+'</th> \
											<th scope="col">'+getLiteral(dict.creator)+'</th> \
										</tr> \
									</thead> \
									<tbody class="table-group-divider"> \
										{{#ultedutrees}} \
										<tr> \
											<td><a href="{{{treeHref}}}" etid="{{{etid}}}" class="educatree">{{treeLabel}}</a></td> \
											<td>{{created}}</td> \
											<td><a href="{{{userHref}}}" uid="{{{uid}}}" class="pagusuario">{{userLabel}}</a> \</td> \
										</tr> \
										{{/ultedutrees}} \
									</tbody> \
								</table> \
							</div> \
							{{/hayUltedutrees}} \
						</div> \
					</div> \
				</div> \
				<div class="accordion-item"> \
					<h2 class="accordion-header"> \
						<button class="accordion-button {{^showann}}collapsed{{/showann}}" type="button" data-bs-toggle="collapse" \
							data-bs-target="#collapseAnnotated" aria-expanded="{{^showann}}false{{/showann}}{{#showann}}true{{/showann}}" aria-controls="collapseAnnotated"> \
							'+getLiteral(dict.lastAnnotations)+'</button> \
					</h2> \
					<div id="collapseAnnotated" class="accordion-collapse collapse {{#showann}}show{{/showann}}" data-bs-parent="#accordionTrees"> \
						<div class="accordion-body {{#hayUltanns}}pt-0 px-2 px-md-4{{/hayUltanns}} pb-0"> \
							{{^hayUltanns}}<p>'+getLiteral(dict.noAnnotations)+'</p>{{/hayUltanns}} \
							{{#hayUltanns}} \
							<div class="d-flex align-items-center justify-content-between my-2"> \
								<h6 class="text-muted mt-2">'+getLiteral(dict.page)+' #{{pagUltanns}}</h6> \
								<span class="btn-group" role="group"> \
									<button class="btn btn-outline-secondary pagina prev annotated" type="button" {{^hayUltannsPrev}}disabled{{/hayUltannsPrev}}><i class="bi bi-chevron-left"></i></button> \
									<button class="btn btn-outline-secondary pagina sig annotated" type="button" {{^hayUltannsSig}}disabled{{/hayUltannsSig}}><i class="bi bi-chevron-right"></i></button> \
								</span> \
							</div> \
							<div> \
								<table class="table table-striped"> \
									<thead> \
										<tr> \
											<th scope="col">'+getLiteral(dict.tree)+'</th> \
											<th scope="col">'+getLiteral(dict.annotationType)+'</th> \
											<th scope="col">'+getLiteral(dict.annotator)+'</th> \
										</tr> \
									</thead> \
									<tbody class="table-group-divider"> \
										{{#ultanns}} \
										<tr> \
											<td><a href="{{{treeHref}}}" etid="{{{etid}}}" class="educatree">{{treeLabel}}</a></td> \
											<td>{{annotationType}}</td> \
											<td><a href="{{{userHref}}}" uid="{{{uid}}}" class="pagusuario">{{userLabel}}</a>'+getLiteral(dict.onDate)+'{{annotated}}</td> \
										</tr> \
										{{/ultanns}} \
									</tbody> \
								</table> \
							</div> \
							{{/hayUltanns}} \
						</div> \
					</div> \
				</div> \
			</div>	 \
		</div> \
		<!-- BACK BUTTON --> \
		<div class="col-sm-8 my-4 mx-auto"> \
			<div class="d-flex ms-0"> \
				<button id="goBackButton" type="button" class="ms-0 btn btn-secondary">'+getLiteral(dict.back)+'</button> \
			</div> \
		</div> \
	</div>';


	alertQuestionnaireTemplate = 
	'<div id="questalert" class="alert alert-light ms-2 ms-md-2 mb-4 p-2 alert-dismissible fade show" role="alert"> \
		<p class="mb-1">'+getLiteral(dict.questtext)+'</p> \
		<button id="questbotyes" type="button" questurl="'+getLiteral(dict.questurl)+'" class="btn btn-outline-secondary btn-sm">'+getLiteral(dict.yes)+'</button>\
		<button id="questbotno" type="button" class="btn btn-outline-secondary btn-sm">'+getLiteral(dict.no)+'</button>\
		<button id="questbotlater" type="button" class="btn btn-outline-secondary btn-sm">'+getLiteral(dict.later)+'</button>\
	</div>';
}

export { cardTemplate, taxonesSubheadingTemplate, sugeTaxonesTemplate, taxonesBlockTemplate, sugeLugaresTemplate, 
sugeTaxonesWDTemplate, speciesModalTemplate, popupEdutreeTemplate, spinnerTemplate, navbarTemplate, 
createEducatreeForm, treeStatusTemplate, treePartsPhotoTemplate, userButtonTemplate, viewEducatreeForm, 
annotators, footers, treeDeletionBody, downloadTemplateBody, downloadingTemplateBody, signinButtonTemplate, changeNickTemplate, 
changeTreeNickTemplateBody, userPageTemplate, lasttreesTemplate, alertQuestionnaireTemplate, updateHTMLtemplates };
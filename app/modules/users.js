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
import { signinButtonTemplate, spinnerTemplate, userPageTemplate, userButtonTemplate, 
	changeNickTemplate, footers } from '../data/htmlTemplates.js';

import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithRedirect, onAuthStateChanged, signOut } from "firebase/auth";
import $ from "jquery";
import Mustache from 'mustache';
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";

import { Sesion, Datos, cargarURL, obtenerURL, goBack } from '../main.js';
import { getUserData, getTreePages, nickExists, setNick } from './dataManager.js';
import { renderLasttrees } from './trees.js';
import { renderEducatree } from './viewAnnotateTree';
import { renderAjustesCreacionArbolMapa, renderFormularioCreacionArbol } from './createTree.js';
import { initTimedEvent, sendEvent, sendTimedEvent } from './events.js';
import { getLiteral, getDate, getCreator, configurarModal } from './util.js';

/////////////////////////
// INICIALIZACIÓN FIREBASE
/////////////////////////
let app;
let provider;
function getFirebaseApp() {
	// TODO: config.firebaseConfig.authDomain: "localhost", // cambiar en producción a "educawood.gsic.uva.es",
	if (!app)
		app = initializeApp(config.firebaseConfig);
	return app;
}
	
	
/////////////////////////
// AUTENTICACIÓN FIREBASE
/////////////////////////
function inicializarAutenticacion() {
	// inicialización
	provider = new GoogleAuthProvider();
	const auth = getAuth();
	auth.useDeviceLanguage();
	// handler para detectar si hay usuario
	onAuthStateChanged(auth, async (user) => {
		if (user) {
			// User is signed in, see docs for a list of available properties
			// https://firebase.google.com/docs/reference/js/firebase.User
			//var uid = user.uid;
			// ...
			console.info("Usuario conectado: " + user.uid);		
			// guardo el usuario en la sesión
			Sesion.usuario = user;
			// envío datos signin a GA
			sendEvent("login", { method: "Google", uid: Sesion.usuario.uid } );
			// muestro avatar con dropdown de signout (MAPA)
			const htmluser = Mustache.render(userButtonTemplate, { "img": Sesion.usuario.photoURL });	
			$(".usuario").html(htmluser);
			// pido a CRAFTS los datos del usuario si no lo tengo
			await getUserData(Sesion.usuario.uid);			
		} else {
			//console.warn("EL USUARIO SE SALIÓ..."); // 
			console.info("El usuario se salió...");
			// envío datos signout a GA
			sendEvent("sign_out");
			// borro usuario de la sesión
			delete Sesion.usuario;			
			// muestro botón de signin (MAPA)
			$(".usuario").html(signinButtonTemplate);
		}
		// pongo listeners a clickViewprofile, clickSignin y clickSignout
		$(".userprofile").click(clickViewprofile);
		$(".usersignin").click(clickSignin);
		$(".usersignout").click(clickSignout);
		
		// ajustes del mapa botón de creación
		renderAjustesCreacionArbolMapa();
		
		// AJUSTES SEGÚN LA PANTALLA
		switch(Sesion.estado.path) {
			case "user":
				// regenero página usuario
				renderUsuario();			
				break;
			case "lasttrees":
				// regenero página lasttrees
				renderLasttrees();
				break;
			case "tree":
				// regenero página árbol
				renderEducatree();
				break;
			case "newtree":
				// regenero formulario creación árbol
				renderFormularioCreacionArbol();
				break;
		} // fin del switch		
	});
}
function clickSignin(e) {
	e.preventDefault(); // Prevent the default behavior of the hyperlink
	const auth = getAuth();
	signInWithRedirect(auth, provider);
}
function clickSignout(e) {
	e.preventDefault(); // Prevent the default behavior of the hyperlink
	const auth = getAuth();
	signOut(auth);
}
function clickViewprofile() {
	// voy a la página del usuario							
	Sesion.estado.path = "user";
	Sesion.estado.etid = Sesion.usuario.uid;	
	// reajusto url y creo nueva página en la historia
	history.pushState(Sesion.estado, "", obtenerURL());
	Sesion.npags++; // una página más
	// cargoURL => me llevará a verUsuario
	cargarURL();
}


////////////////////
// PÁGINA DE USUARIO
////////////////////
async function verUsuario(noborrarcache) {	
	// pongo spinner con mensaje de cargando	
	$("#miarbol").html(spinnerTemplate);
	window.scrollTo(0, 0);	
	
	// inicializo el evento para enviar a GA
	initTimedEvent( { content_type: 'user', content_id: config.edubase + "/user/" + Sesion.estado.etid,
		crafts_reqs: 0 } );

	// quito el cacheo si se trata del usuario de la sesión (porque puede haber producido datos nuevos)
	if (!noborrarcache && Sesion.usuario && Sesion.usuario.uid === Sesion.estado.etid) {
		delete Datos.usuarios[Sesion.estado.etid];
		delete Datos.ultEducatrees[Sesion.estado.etid];
		delete Datos.ultAnotaciones[Sesion.estado.etid];
	}
	
	// pido datos a CRAFTS del usuario
	await getUserData(Sesion.estado.etid);
	
	// pido datos a CRAFTS de las páginas de educatrees del usuario
	const pe = Sesion.estado.pe? Sesion.estado.pe : 0;	// por defecto la 0
	const pae = Sesion.estado.pae? Sesion.estado.pae : 0;	// por defecto la 0
	await getTreePages(pe, pae, Sesion.estado.etid);
	
	// si están mal ajustadas las páginas (por no tener resultados y no ser 0), reajusto la URL
	let actualizar = false;
	if (pe > 0 && Datos.ultEducatrees[Sesion.estado.etid][pe].length == 0) {
		delete Sesion.estado.pe;
		actualizar = true;
	}
	if (pae > 0 && Datos.ultAnotaciones[Sesion.estado.etid][pae].length == 0) {
		delete Sesion.estado.pae;
		actualizar = true;
	}
	if (actualizar) {
		//console.log("URL nueva: "+obtenerURL());
		// actualizo URL
		history.replaceState(Sesion.estado, "", obtenerURL());
		// y cargo la URL para que obtenga los datos de nuevo
		//cargarURL();
		verUsuario(true);
		return;
	}
	
	// caso normal: hago el render
	renderUsuario();
}

async function renderUsuario() {
	// detecto llamada espúrea por la autenticación
	if (!Datos.usuarios[Sesion.estado.etid] || !Datos.ultEducatrees[Sesion.estado.etid] || !Datos.ultAnotaciones[Sesion.estado.etid]) 
		return;

	// obtengo info básica del usuario
	const iri = config.edubase + "/user/" + Sesion.estado.etid;
	const udata = Datos.usuarios[Sesion.estado.etid];
	const uname = getCreator(udata);
	const usesion = Sesion.usuario && Sesion.usuario.uid === Sesion.estado.etid;
	const ufecha = getDate(udata);
	const pe = Sesion.estado.pe? Sesion.estado.pe : 0;	// por defecto la 0
	const pae = Sesion.estado.pae? Sesion.estado.pae : 0;	// por defecto la 0
	// resto el número de árboles del de anotaciones (incluidas en las consultas)
	const numanots = udata.numberOfAnnotations? (udata.numberOfEducatrees? udata.numberOfAnnotations - udata.numberOfEducatrees: udata.numberOfAnnotations) : null;
	
	// si hay nick reajusto título de la página
	if (udata.nick)
		document.title = getLiteral(udata.nick)+' - EducaWood';
				
	// si no tiene ninguna anotación y no es el usuario de la sesión, asumo que no existe
	if (!udata.numberOfAnnotations && !udata.numberOfEducatrees && !usesion) {		
		usuarioNoExiste();
		return;
	}
	
	// preparo objeto plantilla
	const objut = {
		uid: Sesion.estado.etid,
		usuario: Sesion.usuario != undefined, // para mostrar botón de signin o avatar
		usuarioImg: Sesion.usuario? Sesion.usuario.photoURL : null, // foto para el avatar
		name: uname, //udata.nick? udata.nick : Sesion.estado.etid,
		nickButtonLabel: usesion? (udata.nick? getLiteral(dict.changeNick) : getLiteral(dict.newNick)) : null,
		img: usesion? Sesion.usuario.photoURL : null,
		activeLabel: udata.created? getLiteral(dict.userActive) + ufecha : null,
		master: udata.isMasterAnnotator,
		cannotAnnotate: udata.cannotAnnotate,
		edutreesLabel: udata.numberOfEducatrees? 
			(udata.numberOfEducatrees==1? getLiteral(dict.oneTreeCreated) : 
				getLiteral(dict.multipleTreesCreated).replace('%d', udata.numberOfEducatrees)) : null,
		annotationsLabel: numanots? 
			(numanots==1? getLiteral(dict.oneAnnotation) : 
				getLiteral(dict.multipleAnnotations).replace('%d', numanots)) : null,
		showann: Sesion.estado.showann
	}
	// ultEducatrees
	const uet = Datos.ultEducatrees[Sesion.estado.etid][pe];
	objut.hayUltedutrees = uet.length > 0;
	objut.hayUltedutreesPrev = pe > 0;
	objut.hayUltedutreesSig = uet.length > config.pageus;
	objut.pagUltedutrees = pe + 1;
	objut.ultedutrees = [];
	for (let i=0; i<uet.length && i < config.pageus; i++) { // no muestro el config.pageus + 1
		const uetel = uet[i];
		const etid = uetel.iri.split("/")[uetel.iri.split("/").length -1];
		// cojo primero el nick en Datos.educatrees[iri] (por si actualizó su nick),
		// en segunda opción el nick del objeto y si no, el etid
		const etl = (Datos.educatrees[uetel.iri] && Datos.educatrees[uetel.iri].nick)? getLiteral(Datos.educatrees[uetel.iri].nick) :
			(uetel.nick? getLiteral(uetel.nick) : getLiteral(dict.tree) + " " + etid);
		const htmledutree = '<a href="/tree/' + etid + '" etid="' + etid + '" class="educatree">' + 
			etl +'</a><div class="text-muted">' + getLiteral(dict.createdOn) + getDate(uetel)+'</div>';
		objut.ultedutrees.push(htmledutree);
	}
	// ultAnotaciones
	const uaet = Datos.ultAnotaciones[Sesion.estado.etid][pae];
	objut.hayUltanns = uaet.length > 0;
	objut.hayUltannsPrev = pae > 0;
	objut.hayUltannsSig = uaet.length > config.pageus;
	objut.pagUltanns = pae + 1;	
	objut.ultanns = [];
	for (let i=0; i<uaet.length && i < config.pageus; i++) { // no muestro el config.pageus + 1
		const uaetel = uaet[i];
		const etid = uaetel.iri.split("/")[uaetel.iri.split("/").length -1];		
		// cojo primero el nick en Datos.educatrees[iri] (por si actualizó su nick),
		// en segunda opción el nick del objeto y si no, el etid
		const etl = (Datos.educatrees[uaetel.iri] && Datos.educatrees[uaetel.iri].nick)? getLiteral(Datos.educatrees[uaetel.iri].nick) :
			(uaetel.nick? getLiteral(uaetel.nick) : getLiteral(dict.tree) + " " + etid);
		// preparo htmlann con cuidado
		//const label = getLiteral(config.annotationTypeLabels.[uaetel.type], getLiteral(config.annotationTypeLabels.pordefecto))
		const atl = config.annotationTypeLabels[ uaetel.type ];
		const htmlann = getLiteral(atl, getLiteral(config.annotationTypeLabels.pordefecto)) + getLiteral(dict.ofTree) +
			' <a href="/tree/' + etid + '" etid="' + etid + '" class="educatree">'+ etl +'</a><div class="text-muted">' +
			getLiteral(dict.annotatedOn) + getDate(uaetel)+'</div>';			
		objut.ultanns.push(htmlann);	
	}	
	
	// renderizo
	const htmlcontent = Mustache.render(userPageTemplate, objut);
	$("#miarbol").html(htmlcontent);
	
	// envío GA evento ver página usuario
	sendTimedEvent();
	console.info("Página usuario cargada: " + iri);
	
	// pongo listener de botones de volver
	$(".goback").on("click", goBack);
	
	// pongo listeners a clickViewprofile, clickSignin y clickSignout
	$(".userprofile").click(clickViewprofile);
	$(".usersignin").click(clickSignin);
	$(".usersignout").click(clickSignout);
	
	// listener a changeNick
	$("#changeNick").click(changeNick);
	
	// handlers de páginas
	$(".pagina").click(function() {
		// detecto target de la página
		let target = $(this).hasClass("created")? "pe" : "pae";
		Sesion.estado.showann = $(this).hasClass("annotated");
		// detecto si retrocedo o avanzo
		if ( $(this).hasClass("prev") ) {
			Sesion.estado[target]--;
			if (Sesion.estado[target] == 0)
				delete Sesion.estado[target];
		}
		else { // avanzo, cuidado si no existiera
			if (!Sesion.estado[target])
				Sesion.estado[target] = 1;
			else
				Sesion.estado[target]++;		
		}
		// actualizo URL
		history.replaceState(Sesion.estado, "", obtenerURL());
		// y cargo la URL para que obtenga los datos de nuevo
		verUsuario(true);
	});
}

function changeNick() {
	// preparo contenido modal
	let tit = getLiteral(dict.newNick);
	configurarModal( { vertcent: true, static: true},
		tit, changeNickTemplate, footers.cambiarNick);
	// muestro modal
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));	
	mimodal.show();
	// listener de cambio de nick
	$("#newNick").change(function() {
		const newnick = $('#newNick').val();
		// preinicializo
		$("#statusNick").removeClass("d-none")
		$("#botonCambioNick").prop("disabled", true);
		if (!newnick) {
			//console.log("No hay nada");
			$("#statusNick").text(getLiteral(dict.noNick));
		}
		else if (newnick.length < 3 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickTooshort));
		}
		else if (newnick.length > 20 ) {
			//console.log("Fuera de rango");
			$("#statusNick").text(getLiteral(dict.nickToolong));
		}	
		else {
			//console.log("Todo OK");
			$("#statusNick").addClass("d-none")
			$("#botonCambioNick").prop("disabled", false);
		}
	});
	// listener del botón de cambio de nick
	$("#botonCambioNick").click(async function() {
		// desabilito la entrada, cambio el tip y quito el footer
		$("#newNick").prop("disabled", true);
		$("#statusNick").removeClass("d-none")
		$("#statusNick").text(getLiteral(dict.checkingNick));		
		configurarModal( { vertcent: true, static: true, nofooter: true},
			null, null, null);
		// recupero el nick y compruebo si existe
		const newnick = $('#newNick').val();
		const existe = await nickExists(newnick);
		if (existe) {
			// no puede hacerse el cambio
			configurarModal( { vertcent: true, static: true, nofooter: false},
				null, null, null);
			$("#newNick").prop("disabled", false);
			$("#statusNick").text(getLiteral(dict.nickTaken));			
			$("#botonCambioNick").prop("disabled", true);
		}
		else {
			// inicializo evento nuevo nick a GA
			initTimedEvent( { value: newnick, crafts_reqs: 0 });
			// vamos con el cambio
			try {
				// preparo patch con el cambio de nick
				const patch = [];
				const oper = Datos.usuarios[Sesion.estado.etid].nick? "replace" : "add";
				patch.push(	{ op: oper, path: "/nick", value: newnick }	);
				//console.log(patch);
				await setNick(Sesion.estado.etid, patch);
				// envío evento nuevo nick a GA
				sendTimedEvent('new_nick');
				console.info("Nick del usuario cambiado: " + newnick);
			} catch(err) {
				console.error(err.message);
				// actualizo modal
				const be = "<code>" + err.message + "\n" + JSON.stringify(err.error) + "</code>";		
				configurarModal( { static: true, vertcent: true, }, 
					getLiteral(dict.changeNickFailure), be, footers.anotacionError);
				return; // terminamos
			}
			// modal de éxito
			// escondo campos y muestro imagen
			$("#newNick").addClass("d-none");
			$("#statusNick").addClass("d-none");
			$("#imgNewNick").attr("src", new URL('../images/newNick.png', import.meta.url));
			$("#imgNewNick").removeClass("d-none");
			//const htmlbody = '<img src="/app/images/newNick.png" class="d-block w-100">';
			configurarModal( { vertcent: true, static: true},
				getLiteral(dict.changeNickSuccess), null, footers.nickCambiado);
			// listener cierre modal
			document.getElementById('mimodal').addEventListener('hidden.bs.modal', event => {
				renderUsuario();
			}, { once: true });
		}	
	});
}


function usuarioNoExiste() {
	// pongo página en blanco
	$("#miarbol").html("");	
	// pongo un modal
	const body = getLiteral(dict.errorUserText) + ' "' + Sesion.estado.etid + '".';
	configurarModal( { vertcent: true, nofooter: true},
		getLiteral(dict.errorUserTitle), body, null);
	const mimodal = new bootstrap.Modal(document.getElementById('mimodal'));
	mimodal.show();
	// handler al esconderse
	document.getElementById('mimodal').addEventListener('hidden.bs.modal', event => {
		// voy para atrás
		goBack();
	}, { 'once': true });
}

export { getFirebaseApp, inicializarAutenticacion, verUsuario, 
	clickViewprofile, clickSignin, clickSignout };
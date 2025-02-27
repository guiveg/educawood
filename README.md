# EducaWood: Your social application for forestry education

EducaWood is a social web application for forestry education. the exploration of world-wide Cultural Heritage. It uses Linked Open Data from the [Spanish National Forestry Inventory](https://www.miteco.gob.es/es/biodiversidad/servicios/banco-datos-naturaleza/informacion-disponible/ifn3.html), [Wikidata](https://www.wikidata.org) and [DBpedia](https://www.dbpedia.org/). 

These are some of the features of EducaWood:

* Interactive map for visualizing world-wide trees

* Social creation of trees

* Different types of tree annotations (location, tree status, taxon, height, diameter, image, and observation)
  
* Multi-author tree annotations and deletions

* The application can run in any device with a modern browser

* Effective hiding of RDF/OWL/SPARQL

* Powered by [CRAFTS (Configurable REST APIs For Triple Stores)](https://crafts.gsic.uva.es/)

* Available in English and Spanish


Usage
==========
EducaWood is a web application developed in Javascript. You can easily deploy it in your web server, 
but you need to set up your own [CRAFTS API](https://crafts.gsic.uva.es/) to access data sources.

Alternatively, you can just try a live version of EducaWood on [https://educawood.gsic.uva.es/](https://educawood.gsic.uva.es/)


Dataset
==========
EducaWood tree annotations are published in a triplestore with endpoint URL [https://semanticforest.gsic.uva.es/sparql](https://semanticforest.gsic.uva.es/sparql) and graph IRI [http://educawood.gsic.uva.es](http://educawood.gsic.uva.es).


Pilot study
==========
We have run a pilot of EducaWood at the Yutera campus of Universidad de Valladolid in a "Reforestation, Nurseries, and Gardening" course in the third year of the Forestry and Environmental Engineering degree. Students have collaboratively created a tree inventory with EducaWood, it can be accessed [https://educawood.gsic.uva.es/map?loc=41.986754,-4.516886,18z&esri=true](here). Students were asked to fill the standardized System Usability Score (SUS). The SUS scores can be accessed [https://github.com/guiveg/educawood/blob/main/SUS_educawood.csv](here).


Help us to improve
==========
EducaWood is available under an Apache 2.0 license. Please send us an email to [guiveg@tel.uva.es](mailto:guiveg@tel.uva.es) 
if you use or plan to use EducaWood. Drop us also a message if you have comments or suggestions for improvement.

**If you have already employed EducaWood you can help ups to improve by filling [this questionnaire](https://docs.google.com/forms/d/e/1FAIpQLSdj2YL-1yZFMFBi0dWHDnlOKp5oWg_58DkM7fAWykSgmONKZw/viewform?usp=sf_link) 
(also available [in Spanish](https://docs.google.com/forms/d/e/1FAIpQLSdjLezgl169v5nCY2Y1bLskDimEy_rbDwO4GhMdQ2YdKijmPg/viewform?usp=sf_link)).**


Screenshots
==========
Some screenshots of EducaWood (somewhat old, the user interface is cooler now):

![screenshot 1](https://educawood.gsic.uva.es/app/images/educawood0.png)

![screenshot 2](https://educawood.gsic.uva.es/educawood1.62645cfd.png)

![screenshot 3](https://educawood.gsic.uva.es/educawood2.a5e3babb.png)

![screenshot 4](https://educawood.gsic.uva.es/educawood3.7d5bbcaa.png)

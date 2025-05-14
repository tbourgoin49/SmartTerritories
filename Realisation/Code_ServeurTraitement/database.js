
//Ce fichier comprendra les classes de base de données ainsi que le schéma/modèle mongoose.
//
//Cela correspondra donc à notre classe entité représentant la base de données.

const mongoose = require("mongoose");

//La classe CDatabase regroupera la connexion à la base de donnée MongoDB choisie pour le retour des données ainsi que le retour des erreurs
class CDatabase {
//  On récupère le nom de la base ainsi que son IP et le port concernés pour s'y connecter
    constructor(dbName, host = "localhost", port = "27017") {
	this.dbName = dbName;
	this.host = host;
	this.port = port;

	this.uri = `mongodb://${this.host}:${this.port}/${this.dbName}`;
        this._connect();
    }

//  On effectue la connexion à la base et si une erreur est retrouvée on la retourne
//  Ecrit avec un "_" pour éviter de confondre avec le mongoose.connect
    _connect() {
	try {
            mongoose.connect(this.uri);
	    console.log(`Connecté à MongoDB réussie, nom de BDD: ${this.dbName}`);
        } catch(err) {
//	    Possibilité de retourner plusieurs erreurs & améliorer le switch
	    switch (err.name) {
/*
		case 'MongoNetworkError':
		    console.error("Erreur de connexion réseau à MongoDB: ", err.message);
		    break;
*/
		case 'MongoParseError':
		    console.error("URI de connexion MongoDB invalide: ", err.message);
		    break;
		default:
		    console.error("Erreur non repertoriée détectée: ", err.message);
		    break;
	    }
	    throw err;
	}
    }
}


module.exports = { CDatabase };

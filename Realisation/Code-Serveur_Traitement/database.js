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
    async _connect() {
        try {
            await mongoose.connect(this.uri);

            const admin = mongoose.connection.db.admin();
            const dbs = await admin.listDatabases();
            const existe = dbs.databases.some(db => db.name === this.dbName);

            if (!existe) {
            	const err = new Error(`La base '${this.dbName}' n'existe pas sur le serveur.`);
            	err.name = "DatabaseNotFoundError";
            	throw err;
            }

            console.log(`Connexion réussie à MongoDB, base : ${this.dbName}`);

        } catch (err) {
            switch (err.name) {
    		case 'MongooseServerSelectionError':
        	    console.error("Impossible de se connecter : MongoDB est éteint ou inaccessible.");
        	    break;

    		case 'MongoNetworkError': // Peut aussi apparaître selon la version de Mongoose
        	    console.error("Problème réseau lors de la tentative de connexion à MongoDB.");
        	    break;

    		case 'ValidationError':
    		//  Inutile si la méthode de CAnalyse est correcte
    	    	    console.error("Données invalides : non conformes au schéma.");
        	    break;

    		default:
// 		    Vérifie si MongoDB est éteint ou inaccessible
        	    if (err.message.includes('Unable to parse')) {
            		console.error("Erreur URI MongoDB invalide.");
        	    } else {
            		console.error("Erreur lors de la connexion :", err.message);
        	    }
        	    break;
            }
//	Retour direct en fin de programme si l'erreur n'a rien retourné (MongoDB eteint)
	process.exit(1);
        }
    }


};




//La classe CModel créera un modèle de la base donnée dans la classe CDatabase, avec un modèle type pris en compte par défaut et un autre qui peut être donné par l'utilisateur
class CModel {
    constructor(modelName = 'dbModel', collectionName = 'Test_Database', schemaCustom = null) {
        const schemaDefault = new mongoose.Schema({
            Capteur: String,           // Nom du capteur (lieu)
            TypeDeDonnee: String,      // Type de mesure (ex : Température)
            Date: String,              // Date sous forme de string
	    Valeur: Number
	}, {
  	    versionKey: false
	});

//	Si aucun modèle est donné alors on utilise le défault, sinon on utilise le custom.
	this.model = mongoose.model(modelName, schemaDefault || schemaCustom, collectionName);
    }

    getModel() {
	return this.model;
    }

//On renvoie les données des routes présentes dans la classe CRequetes
    async getAllMesures() {
	return await this.model.find();
    }

    async getMesuresFiltre(filtre, limite) {
	//console.log("Filtre utilisé :", filtre);
	return await this.model.find(filtre).limit(limite);
    }

//On ajoute une nouvelle données dans la base, à l'aide de notre modèle créé au préalable et de la méthode "save" de mongoose
    async insertMesure(data) {
    	try {
            const nouvelleMesure = new this.model(data);
            await nouvelleMesure.save();
            return { success: true, message: "Mesure enregistrée avec succès." };
    	} catch (error) {
            return { success: false, message: "Erreur lors de l'enregistrement.", error };
    	}
    }
}

module.exports = { CDatabase, CModel };

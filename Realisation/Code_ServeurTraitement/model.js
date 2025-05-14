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

module.exports = { CModel };

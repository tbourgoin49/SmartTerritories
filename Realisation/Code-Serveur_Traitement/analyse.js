//Cette classe servira de controle, elle analysera les données venant d'un paquet MQTT : elle vérifiera l'intégralité des données (champs) et leur forme.


const axios = require('axios');
const logger = require('./Logger/loggerMqtt');

class CAnalyse {

    constructor(apiUrl, cheminEnvoi) {
        this.apiUrl = apiUrl;
        this.cheminEnvoi = cheminEnvoi;
    }

    // Vérifie si les données sont valides
    verif_dataMQTT(dataMQTT) {
        const champsObligatoires = ["Capteur", "TypeDeDonnee", "Date", "Valeur"];

        for (const champ of champsObligatoires) {
            if (!(champ in dataMQTT)) {
                logger.warn(`Champ manquant dans le paquet MQTT : ${champ}`);
                return false;
            }
        }

        const regexDate = new RegExp("^\\d{4}-\\d{2}-\\d{2} ((0\\d)|(1\\d)|(2[0-3]))$");
        if (!regexDate.test(dataMQTT.Date)) {
            logger.warn("Format de date invalide reçu dans le paquet MQTT. Format attendu : 'AAAA-MM-JJ HH'");
            return false;
        }

        if (isNaN(parseFloat(dataMQTT.Valeur))) {
            logger.warn("Champ 'Valeur' non numérique dans le paquet MQTT.");
            return false;
        }

        logger.info("Paquet MQTT validé avec succès.");
        return true;
    }

    // Traite et envoie les données à l'API si elles sont valides
    async envoiMQTT(dataMQTT) {
        if (this.verif_dataMQTT(dataMQTT)) {
            try {
                const res = await axios.post(`${this.apiUrl}${this.cheminEnvoi}`, dataMQTT);
                logger.info(`Donnée MQTT envoyée à l’API avec succès : ${JSON.stringify(res.data)}`);
            } catch (error) {
                logger.warn(`Erreur lors de l’envoi du paquet MQTT à l’API : ${error.message}`);
            }
        } else {
            logger.warn("Paquet MQTT rejeté après validation.\n");
        }
    }
}

module.exports = { CAnalyse };

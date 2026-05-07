/**
 * @file info.js
 * @author Screeps Developer
 * @version 1.0.1
 * @description Centralized Data Hub για την ανταλλαγή πληροφοριών μεταξύ modules.
 * Υλοποιεί έναν Ephemeral Cache μηχανισμό που καθαρίζεται αυτόματα σε κάθε tick.
 */

const REPAIR_TOWER = "repairTower";

class Info {
    /**
     * Αρχικοποίηση του συστήματος Info.
     */
    constructor() {
        /** @type {Object} Αποθήκευση δεδομένων ανά δωμάτιο */
        this.cache = {};
        /** @type {number} Το τρέχον tick για αυτόματο καθαρισμό */
        this.currentTick = 0;
    }

    /**
     * Ανάκτηση δεδομένου από το cache.
     * @param {string} roomName Το όνομα του δωματίου.
     * @param {string} id Το αναγνωριστικό της πληροφορίας (π.χ. REPAIR_TOWER).
     * @returns {any|null}
     */
    get(roomName, id) {
        this._autoRefresh();

        if (!this.cache[roomName]) return null;
        return this.cache[roomName][id] || null;
    }

    /**
     * Καταχώρηση δεδομένου στο cache.
     * @param {string} roomName Το όνομα του δωματίου.
     * @param {string} id Το αναγνωριστικό της πληροφορίας.
     * @param {any} value Η τιμή προς αποθήκευση.
     */
    set(roomName, id, value) {
        this._autoRefresh();

        if (!this.cache[roomName]) {
            this.cache[roomName] = {};
        }
        this.cache[roomName][id] = value;
    }

    /**
     * Ελέγχει αν έχει αλλάξει το tick και καθαρίζει το cache αν χρειάζεται.
     * @private
     */
    _autoRefresh() {
        if (this.currentTick !== Game.time) {
            this.cache = {};
            this.currentTick = Game.time;
        }
    }
}

// Singleton instance για κοινή χρήση σε όλα τα modules
const info = new Info();

module.exports = { info, REPAIR_TOWER };
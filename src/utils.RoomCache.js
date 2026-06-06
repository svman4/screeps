/**
 * @file RoomCache.js
 * @author Gerakianakis Manos
 * @version 1.2.1
 * @description Ενοποιημένος Διαχειριστής Μνήμης και Cache (Unified Singleton) για το Screeps.
 * * Αρχιτεκτονική Σχεδίασης:
 * 1. Persistent Cache (Memory): Αποθήκευση στατικών/ημι-στατικών δεδομένων (IDs, συντεταγμένες) που 
 * δεν αλλάζουν συχνά, μειώνοντας δραματικά τη χρήση της find() και διατηρώντας δεδομένα ακόμη και χωρίς Vision.
 * 2. Volatile Cache (_tickCache): Αποθήκευση δυναμικών δεδομένων (creeps, structures, dropped energy) 
 * με διάρκεια ζωής ενός Tick (Global Reset / CPU optimization).
 * * @optimization Μειώνει το CPU overhead εκμεταλλευόμενο το Object.groupBy και αποφεύγοντας 
 * επαναλαμβανόμενες κλήσεις FIND_STRUCTURES στο ίδιο tick.
 */

var debugConsole = require("utils.debugConsole");
const { ROOM_TYPE } = require("expansion.constants");

/** @type {Object} Σταθερές ρυθμίσεις για thresholds αξιολόγησης οικονομίας του δωματίου */
const CONFIG = {
    ROADS_THRESHOLD: 30,
    LINKS_THRESHOLD: 2,
};

class RoomCache {
    constructor() {
        /**
         * Τοπική αποθήκη (RAM) για τα instances των επιμέρους δωματίων.
         * @type {Object<string, RoomCacheInstance>}
         * @private
         */
        this._rooms = {};
        
        /**
         * Instance για την καθολική cache του κόσμου (αυτοκρατορίας).
         * @type {WorldCacheInstance|null}
         * @private
         */
        this._world = null;
    }

    /**
     * Επιστρέφει (ή δημιουργεί) το cache instance για ένα συγκεκριμένο δωμάτιο.
     * @example RoomCache.in('E12S28').sources
     * @param {string} roomName Το όνομα του δωματίου (π.χ. W1N1)
     * @returns {RoomCacheInstance}
     */
    in(roomName) {
        if (!this._rooms[roomName]) {
            this._rooms[roomName] = new RoomCacheInstance(roomName);
        }
        return this._rooms[roomName];
    }

    /**
     * Επιστρέφει το global instance για τον έλεγχο της αυτοκρατορίας (World/Global level).
     * @returns {WorldCacheInstance}
     */
    World() {
        if (!this._world) {
            this._world = new WorldCacheInstance();
        }
        return this._world;
    }

    /**
     * Καθαρίζει τα tick caches (RAM) για όλα τα εγγεγραμμένα δωμάτια.
     * Σημαντικό: Πρέπει να καλείται στην ΑΡΧΗ κάθε tick στο main loop (πριν τρέξουν τα Creeps).
     */
    clearTickCaches() {
        for (const roomName in this._rooms) {
            this._rooms[roomName].clearTickCache();
        }
    }

    /**
     * Κεντρική μέθοδος εκτέλεσης της cache ανά tick.
     * Αναλαμβάνει τον καθαρισμό της tick-μνήμης και τον περιοδικό συγχρονισμό (Garbage Collection / Force Refresh).
     */
    run() {
        this.clearTickCaches();
        
        // Κάθε 500 ticks γίνεται πλήρης ανανέωση για την αποφυγή "ορφανών" IDs (π.χ. κατεστραμμένα links/containers)
        if (Game.time % 500 === 0) {
            this.forceRefreshAll();
        }
    }

    /**
     * Εξαναγκάζει την πλήρη ανανέωση της persistent cache για όλα τα δωμάτια.
     */
    forceRefreshAll() {
        for (const roomName in this._rooms) {
            this._rooms[roomName].forceRefresh();
        }
    }

    /**
     * Εξαναγκάζει την ανανέωση των στατικών δεδομένων για ένα συγκεκριμένο ή για όλα τα δωμάτια.
     * @param {string} [roomName] - Αν παραλειφθεί, καθαρίζει όλα τα δωμάτια.
     */
    forceRefresh(roomName) {
        if (roomName) {
            if (this._rooms[roomName]) this._rooms[roomName].forceRefresh();
        } else {
            this.forceRefreshAll();
        }
    }

    // =========================================================================
    // ΒΟΗΘΗΤΙΚΕΣ DIRECT ΜΕΘΟΔΟΙ (Shortcuts για γρήγορη πρόσβαση χωρίς το .in())
    // =========================================================================
    getSources(roomName) { return this.in(roomName).sources; }
    getLinks(roomName) { return this.in(roomName).links; }
    getContainers(roomName) { return this.in(roomName).containers; }
    getHostileCreeps(roomName) { return this.in(roomName).hostileCreeps; }
}

/**
 * Διαχειριστής της Global στρατηγικής μνήμης της αυτοκρατορίας.
 * Χρησιμοποιείται για multi-room operations, remote mining, και αμυντικά sectors.
 */
class WorldCacheInstance {
    constructor() {
        if (!Memory.world) {
            Memory.world = {};
        }
    }

    /** @returns {Object} Πρόσβαση στο global Memory object του κόσμου μας */
    get World() {
        return Memory.world;
    }

    /**
     * Επιστρέφει τα ονόματα των δωματίων (Cities) που μας ανήκουν (έχουν Controller και είναι My).
     * @returns {string[]} Πίνακας με ονόματα δωματίων
     */
    get cities() {
        if (!this.World.cities) {
            // Φιλτράρισμα των ενεργών δωματίων στα οποία έχουμε vision αυτή τη στιγμή
            const cities = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
            const citiesName = cities.map(city => city.name);
            
            if (cities && cities.length > 0) {
                this.World.cities = citiesName;
            } else {
                return [];
            }
        }
        return this.World.cities || [];
    }

    /**
     * Επιστρέφει τα ονόματα όλων των Remote Mining δωματίων (Shires) της αυτοκρατορίας.
     * @returns {string[]} Πίνακας με ονόματα remote δωματίων
     */
    get shires() {
        if (!this.World.Shires) {
            const rooms = Memory.rooms || {}; // Διόρθωση: Ήταν [] ενώ το Memory.rooms είναι Object
            const roomsName = Object.keys(rooms);
            const remoteMiningNames = roomsName.filter(name => rooms[name].type === ROOM_TYPE.REMOTE_MINING);
            
            if (remoteMiningNames && remoteMiningNames.length > 0) {
                this.World.Shires = remoteMiningNames;
            }			
        }
        return this.World.Shires || [];
    }

    /**
     * Επιστρέφει τα remote mining δωμάτια (Shires) που είναι ανατεθειμένα σε μια συγκεκριμένη πόλη.
     * @param {string} cityName Το όνομα της μητρόπολης (π.χ. 'W1N1')
     * @returns {string[]} Πίνακας με τα ονόματα των Shires
     */
    getShiresOfCity(cityName) { 
        if (!cityName) return [];
        
        const shiresName = this.shires;
        if (!shiresName || shiresName.length === 0) return [];
        
        // Φιλτράρισμα βάσει του cross-reference attribute 'city' στη μνήμη του δωματίου
        return _.filter(shiresName, shireName => Memory.rooms[shireName].city === cityName);
    }

    /**
     * Καθαρίζει τη global δομή της αυτοκρατορίας.
     */
    flush() {
        Memory.world = {};
    }
}

/**
 * Εσωτερική κλάση που αντιπροσωπεύει την απομονωμένη cache ενός συγκεκριμένου δωματίου.
 * Η πρόσβαση γίνεται πάντα ελεγχόμενα μέσω της RoomCache.in(roomName).
 */
class RoomCacheInstance {
    /**
     * @param {string} roomName 
     */
    constructor(roomName) {
        this.roomName = roomName;

        // Ασφαλής αρχικοποίηση δομών Memory αν το Bot μπαίνει σε νέο δωμάτιο
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }
        if (!Memory.rooms[roomName].cache) {
            Memory.rooms[roomName].cache = {
                sourceIds: null,
                controllerLinkId: null,
                storageLinkId: null,
                sourceLinkIds: {}, // Mapping { sourceId: linkId }
                recoveryContainerId: null,
                controllerContainerId: null,
                lastUpdated: 0
            };
        }

        this.cache = Memory.rooms[roomName].cache;
        this._tickCache = {}; // Volatile RAM cache (καθαρίζει σε κάθε tick)
    }

    /**
     * Επιστρέφει το native Game Object του Room αν υπάρχει Vision.
     * @returns {Room|null} Σημείωση: Επιστρέφει null αν δεν έχουμε creeps/structures στο δωμάτιο.
     */
    get room() {
        return Game.rooms[this.roomName] || null;
    }

    /**
     * Μηδενισμός της volatile cache. Καλείται στην αρχή του tick.
     */
    clearTickCache() {
        this._tickCache = {};
    }

    /**
     * Πλήρης εκκαθάριση της persistent μνήμης (Memory).
     * Χρήσιμο όταν αλλάζει το layout του δωματίου ή καταστρέφονται κτίρια.
     */
    forceRefresh() {
        this.cache.sourceIds = null;
        this.cache.controllerLinkId = null;
        this.cache.storageLinkId = null;
        this.cache.sourceLinkIds = {};
        this.cache.recoveryContainerId = null;
        this.cache.controllerContainerId = null;
        this.cache.controllerDistance = null;
        this.cache.center = null;
        this.cache.lastUpdated = Game.time;
        this.cache.sourceDistanceIds = {};
        this.cache.containers = null;
        this.cache.links = null;
        this.cache.patrolPoints = null; // Αλλαγή σε null για σ
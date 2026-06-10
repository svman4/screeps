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
        return this._rooms[roomName] || null;
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
        this.World().flush();
		
    }

    /**
     * Εξαναγκάζει την ανανέωση των στατικών δεδομένων για ένα συγκεκριμένο ή για όλα τα δωμάτια.
     * @param {string} [roomName] - Αν παραλειφθεί, καθαρίζει όλα τα δωμάτια.
     */
    forceRefresh(roomName) {
        if (roomName) {
            if (this._rooms[roomName]) this._rooms[roomName].forceRefresh();
        } else {
            for (const name in this._rooms) {
                this._rooms[name].forceRefresh();
            }
        }
    }

    // =========================================================================
    // ΒΟΗΘΗΤΙΚΕΣ DIRECT ΜΕΘΟΔΟΙ (Για απευθείας κλήση με roomName)
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
        this.cache.center = null;
        this.cache.containers = null;
        this.cache.links = null;
        this.cache.patrolPoints = [];
        this._tickCache = {};
    }


    // =========================================================================
    // ΠΡΟΣΒΑΣΗ ΣΕ ΣΤΑΤΙΚΑ ΔΕΔΟΜΕΝΑ (Persistent Cache)
    // =========================================================================
    
    get center() {
    if (this.cache.center === undefined || this.cache.center === null) {
        if (!this.room) return null;
        
        // Προσοχή: Χρησιμοποιούμε || επειδή η this.spawns μπορεί να είναι άδειος πίνακας []
        const target = this.room.storage || (this.spawns.length > 0 ? this.spawns[0] : null) || new RoomPosition(25, 25, this.roomName);
        if (!target) return null;
        
        // Αποθηκεύουμε μόνο απλό object στη μνήμη, όχι ολόκληρο το RoomPosition class
        this.cache.center = { x: target.pos.x, y: target.pos.y, roomName: this.roomName };
    }
    return new RoomPosition(this.cache.center.x, this.cache.center.y, this.cache.center.roomName);

        

    }
    get sourceIds() {
        if (!this.cache.sourceIds || this.cache.sourceIds.length === 0) {
            if (!this.room) return [];
            const sources = this.room.find(FIND_SOURCES);
            this.cache.sourceIds = sources.map(s => s.id);
        }
        return this.cache.sourceIds || [];
    }

    get sources() {
        return this.sourceIds.map(id => Game.getObjectById(id)).filter(Boolean);
    }
    get controllerDistance() {
        if (this.cache.controllerDistance === undefined || this.cache.controllerDistance === null) {
            if (!this.room || !this.room.controller) return Infinity;
            const center = this.center || null; // Μπορείς να ορίσεις το κέντρο του δωματίου στη cache αν θέλεις, π.χ. κοντά στον controller ή στο storage
            if (!center) return Infinity;
            
            const distanceCenterToControllerContainer=this.controllerContainerDistance;
            if(distanceCenterToControllerContainer!=0) {
                this.cache.controllerDistance = distanceCenterToControllerContainer;
            } else {
                this.cache.controllerDistance = this.room.controller.pos.getRangeTo(center);
            }
        }
        
        return this.cache.controllerDistance || 0;
    }
    get controllerContainerDistance() {
        const controllerContainer=this.controllerContainer;
        const center = this.center || null; // Μπορείς να ορίσεις το κέντρο του δωματίου στη cache αν θέλεις, π.χ. κοντά στον controller ή στο storage
        if (controllerContainer && center){
            return controllerContainer.pos.getRangeTo(center);
            
        }
        return 0;
    }
    get controllerLink() {
        if (this.cache.controllerLinkId === undefined || this.cache.controllerLinkId === null) {
            if (!this.room || !this.room.controller) return null;

            const links = this.room.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.controllerLinkId = links.length > 0 ? links[0].id : null;
        }
        return Game.getObjectById(this.cache.controllerLinkId) || null;
    }

    get storageLink() {
        if (this.cache.storageLinkId === undefined || this.cache.storageLinkId === null) {
            if (!this.room || !this.room.storage) return null;

            const links = this.room.storage.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.storageLinkId = links.length > 0 ? links[0].id : null;
        }
        return Game.getObjectById(this.cache.storageLinkId) || null;
    }
    getSourceDistance(sourceId) {
        if (!this.cache.sourceDistanceIds) this.cache.sourceDistanceIds = {};
        if (this.cache.sourceDistanceIds[sourceId] === undefined) {
            const source = Game.getObjectById(sourceId);
            if (!source) return Infinity;
            const center = this.center || Infinity; // Μπορείς να ορίσεις το κέντρο του δωματίου στη cache αν θέλεις, π.χ. κοντά στον controller ή στο storage
            if (!center) return Infinity;

            this.cache.sourceDistanceIds[sourceId] = source.pos.getRangeTo(center);
        }
        return this.cache.sourceDistanceIds[sourceId] || Infinity;


    }
	getSourceContainer(sourceId) {
    // 1. Σιγουρευόμαστε ότι η δομή στη μνήμη είναι σωστά αρχικοποιημένη
    if (!this.cache.sourceContainerIds) {
        this.cache.sourceContainerIds = {};
    }
    
    // 2. Αν έχουμε ήδη αποθηκευμένο ID, προσπαθούμε να επιστρέψουμε το αντικείμενο απευθείας
    if (this.cache.sourceContainerIds[sourceId]) {
        const cachedObj = Game.getObjectById(this.cache.sourceContainerIds[sourceId]);
        if (cachedObj) return cachedObj;
        
        // Αν το ID υπάρχει αλλά το Game.getObjectById επέστρεψε null ΕΝΩ έχουμε vision, 
        // σημαίνει ότι το container καταστράφηκε, οπότε καθαρίζουμε το ID για να ξαναψάξει.
        if (this.room) {
            this.cache.sourceContainerIds[sourceId] = null;
        }
    }
    
    // 3. Αν δεν υπάρχει αποθηκευμένο ID (ή μηδενίστηκε παραπάνω) και ΕΧΟΥΜΕ vision στο δωμάτιο
    if (this.room && (!this.cache.sourceContainerIds[sourceId])) {
        const source = Game.getObjectById(sourceId);
        if (source) {
            // Σιγουρευόμαστε ότι υπάρχουν containers διαθέσιμα στην tick cache
            const allContainers = this.containers || [];
            const container = allContainers.find(c => c.pos.isNearTo(source));
            
            if (container) {
                this.cache.sourceContainerIds[sourceId] = container.id;
                return container;
            }
        }
    }
    
    return null;
}
    getSourceLink(sourceId) {
        if (!this.cache.sourceLinkIds) this.cache.sourceLinkIds = {};

        if (this.cache.sourceLinkIds[sourceId] === undefined || this.cache.sourceLinkIds[sourceId] === null) {
            const source = Game.getObjectById(sourceId);
            if (!source) return null;

            const links = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.sourceLinkIds[sourceId] = links.length > 0 ? links[0].id : null;

        }
        return Game.getObjectById(this.cache.sourceLinkIds[sourceId]) || null;
    }
    get sourceContainers() {
        const sourceIDs = this.sourceIds;

        // Χρησιμοποιούμε .map() για να επιστρέψουμε έναν πίνακα με τα αντικείμενα
        const containers = sourceIDs.map(sourceID => {
            return this.getSourceContainer(sourceID);
        }).filter(Boolean); // Φιλτράρει τυχόν null αν κάποια πηγή δεν έχει ακόμα container

        return containers || [];
    }

    get recoveryContainer() {
        if (!this.cache.recoveryContainerId) {
            if (!this.room) return null;
            const spawns = this.room.find(FIND_MY_SPAWNS);
            if (spawns.length === 0) return null;

            const containers = spawns[0].pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            this.cache.recoveryContainerId = containers.length > 0 ? containers[0].id : null;
        }
        return Game.getObjectById(this.cache.recoveryContainerId) || null;
    }

    get controllerContainer() {
        if (!this.cache.controllerContainerId) {
            if (!this.room || !this.room.controller) return null;

            const containers = this.room.controller.pos.findInRange(FIND_STRUCTURES, 4, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            this.cache.controllerContainerId = containers.length > 0 ? containers[0].id : null;
        }
        return Game.getObjectById(this.cache.controllerContainerId) || null;
    }
    get patrolPoints() {
        if (!this.cache.patrolPoints) {
            if (!this.room) return [];
            let points = [];
            if (this.room.controller) {
                points.push(this.room.controller.pos);
            }
            if (this.room.storage) {
                points.push(this.room.storage.pos);
            }
            this.cache.patrolPoints = points;

            //spawn
            const spawns = this.groupedStructures[STRUCTURE_SPAWN] || [];
            spawns.forEach(spawn => {
                if (spawn.pos) this.cache.patrolPoints.push(spawn.pos);
            });
        }
        return this.cache.patrolPoints || [];

    }

    // =========================================================================
    // ΠΡΟΣΒΑΣΗ ΣΕ ΔΥΝΑΜΙΚΑ ΔΕΔΟΜΕΝΑ (Volatile Tick Cache)
    // =========================================================================

    get myStructures() {
        if (!this._tickCache.myStructures) {
            if (!this.room) return [];
            this._tickCache.myStructures = this.room.find(FIND_MY_STRUCTURES);
        }
        return this._tickCache.myStructures || [];
    }

    get groupedStructures() {
        if (!this._tickCache.groupedStructures) {
            this._tickCache.groupedStructures = _.groupBy(this.structures, 'structureType');
        }
        return this._tickCache.groupedStructures || [];
    }
	get spawns() {
		return this.groupedStructures[STRUCTURE_SPAWN] || [];
	}
    get containers() {
        return this.groupedStructures[STRUCTURE_CONTAINER] || [];
    }
    get hasContainers() {
        const sourceLength=this.sources.length;
        const containersCount=this.containers.length||0;
        
         if(this.controllerContainer && this.controllerContainer!=null) {
            // console.log("controoler container found");
             return true;
         }
        // console.log("controller container not found");
        // Το πρώτο container που χτίζεται είναι αυτό του controller.
        const answer = containersCount >= (1);
        //console.log("source is "+sourceLength+" containers is "+containersCount+"   "+answer);
        
        return answer;
    }
    get hasRoads() {

        const answer = this.roads.length > CONFIG.ROADS_THRESHOLD;
        return answer;
    }
    get roads() {

        return this.groupedStructures[STRUCTURE_ROAD] || [];
    }
    get structures() {
        if (!this._tickCache.structures) {
            if (!this.room) return [];
            this._tickCache.structures = this.room.find(FIND_STRUCTURES);
        }
        return this._tickCache.structures || [];
    }
    get hasLinks() {
        const linkNumber = this.links.length;
        if (linkNumber >= CONFIG.LINKS_THRESHOLD) {
            return true;
        }
        return false;
    }
    get links() {

        return this.groupedStructures[STRUCTURE_LINK] || [];


    }
    get myCreeps() {
        if (!this._tickCache.myCreeps) {
            if (!this.room) return [];
            this._tickCache.myCreeps = this.room.find(FIND_MY_CREEPS);
        }
        return this._tickCache.myCreeps || [];
    }
    get hostileCreeps() {
        if (!this._tickCache.hostileCreeps) {
            if (!this.room) return [];
            this._tickCache.hostileCreeps = this.room.find(FIND_HOSTILE_CREEPS);
        }
        return this._tickCache.hostileCreeps || [];
    }

    get constructionSites() {
        if (!this._tickCache.constructionSites) {
            if (!this.room) return [];
            this._tickCache.constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        }
        return this._tickCache.constructionSites || [];
    }

    get damagedStructures() {
        if (!this._tickCache.damagedStructures) {
            this._tickCache.damagedStructures = this.structures.filter(s => {
                return s.hits < s.hitsMax &&
                    s.structureType !== STRUCTURE_WALL &&
                    s.structureType !== STRUCTURE_RAMPART;
            });
        }
        return this._tickCache.damagedStructures || [];
    }
    get ruins() {
        if (!this._tickCache.ruins) {
            if (!this.room) return [];
            this._tickCache.ruins = this.room.find(FIND_RUINS);
        }
        return this._tickCache.ruins || [];
    }
    get droppedEnergy() {
        if (!this._tickCache.droppedEnergy) {
            if (!this.room) return [];
            this._tickCache.droppedEnergy = this.room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY
            });
        }
        return this._tickCache.droppedEnergy || [];
    }
}

// Εξαγωγή ενός μοναδικού (Singleton) instance της κλάσης RoomCache
module.exports = new RoomCache();

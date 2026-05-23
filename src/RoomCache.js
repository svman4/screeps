/**
 * @file RoomCache.js
 * @version 1.2.0
 * @description Ενοποιημένος Διαχειριστής Μνήμης και Cache για όλα τα δωμάτια στο Screeps (Unified Singleton).
 * Διαχειρίζεται εσωτερικά πολλαπλά δωμάτια χωρίς να χρειάζεται ξεχωριστό Registry, μειώνοντας το CPU overhead.
 */

class RoomCache {
    constructor() {
        /**
         * Αποθήκη για τα instances των επιμέρους δωματίων.
         * @type {Object<string, RoomCacheInstance>}
         * @private
         */
        this._rooms = {};
    }

    /**
     * Επιστρέφει το cache instance για ένα συγκεκριμένο δωμάτιο.
     * Χρήση: RoomCache.in('E12S28').sources
     * @param {string} roomName 
     * @returns {RoomCacheInstance}
     */
    in(roomName) {
        if (!this._rooms[roomName]) {
            this._rooms[roomName] = new RoomCacheInstance(roomName);
        }
        return this._rooms[roomName];
    }

    /**
     * Καθαρίζει τις tick caches για όλα τα εγγεγραμμένα δωμάτια.
     * Πρέπει να καλείται στην αρχή κάθε tick στο main loop.
     */
    clearTickCaches() {
        for (const roomName in this._rooms) {
            this._rooms[roomName].clearTickCache();
        }
    }

    /**
     * Εξαναγκάζει την ανανέωση των στατικών δεδομένων για ένα ή όλα τα δωμάτια.
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
 * Εσωτερική κλάση που αντιπροσωπεύει την cache ενός συγκεκριμένου δωματίου.
 * Δεν εξάγεται απευθείας, αλλά η πρόσβαση γίνεται μέσω της RoomCache.in(roomName).
 */
class RoomCacheInstance {
    /**
     * @param {string} roomName 
     */
    constructor(roomName) {
        this.roomName = roomName;
        
        // Αρχικοποίηση δομών Memory αν δεν υπάρχουν
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
        this._tickCache = {};
    }

    /**
     * Επιστρέφει το ενεργό αντικείμενο του Room
     * @returns {Room|null}
     */
    get room() {
        return Game.rooms[this.roomName] || null;
    }

    clearTickCache() {
        this._tickCache = {};
    }

    forceRefresh() {
        this.cache.sourceIds = null;
        this.cache.controllerLinkId = null;
        this.cache.storageLinkId = null;
        this.cache.sourceLinkIds = {};
        this.cache.recoveryContainerId = null;
        this.cache.controllerContainerId = null;
        this.cache.lastUpdated = Game.time;
        this._tickCache = {};
    }

    // =========================================================================
    // ΠΡΟΣΒΑΣΗ ΣΕ ΣΤΑΤΙΚΑ ΔΕΔΟΜΕΝΑ (Persistent Cache)
    // =========================================================================

    get sourceIds() {
        if (!this.cache.sourceIds || this.cache.sourceIds.length === 0) {
            if (!this.room) return [];
            const sources = this.room.find(FIND_SOURCES);
            this.cache.sourceIds = sources.map(s => s.id);
        }
        return this.cache.sourceIds;
    }

    get sources() {
        return this.sourceIds.map(id => Game.getObjectById(id)).filter(Boolean);
    }

    get controllerLink() {
        if (this.cache.controllerLinkId === undefined || this.cache.controllerLinkId === null) {
            if (!this.room || !this.room.controller) return null;
            
            const links = this.room.controller.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.controllerLinkId = links.length > 0 ? links[0].id : null;
        }
        return Game.getObjectById(this.cache.controllerLinkId);
    }

    get storageLink() {
        if (this.cache.storageLinkId === undefined || this.cache.storageLinkId === null) {
            if (!this.room || !this.room.storage) return null;
            
            const links = this.room.storage.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.storageLinkId = links.length > 0 ? links[0].id : null;
        }
        return Game.getObjectById(this.cache.storageLinkId);
    }

    getSourceLink(sourceId) {
        if (!this.cache.sourceLinkIds) this.cache.sourceLinkIds = {};
        
        if (this.cache.sourceLinkIds[sourceId] === undefined) {
            const source = Game.getObjectById(sourceId);
            if (!source) return null;
            
            const links = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_LINK }
            });
            this.cache.sourceLinkIds[sourceId] = links.length > 0 ? links[0].id : null;
        }
        return Game.getObjectById(this.cache.sourceLinkIds[sourceId]);
    }

    get recoveryContainer() {
        if (!this.cache.recoveryContainerId) {
            if (!this.room) return null;
            const spawns = this.room.find(FIND_MY_SPAWNS);
            if (spawns.length === 0) return null;
            
            const containers = spawns[0].pos.findInRange(FIND_STRUCTURES, 4, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            this.cache.recoveryContainerId = containers.length > 0 ? containers[0].id : null;
        }
        return Game.getObjectById(this.cache.recoveryContainerId);
    }

    get controllerContainer() {
        if (!this.cache.controllerContainerId) {
            if (!this.room || !this.room.controller) return null;
            
            const containers = this.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            this.cache.controllerContainerId = containers.length > 0 ? containers[0].id : null;
        }
        return Game.getObjectById(this.cache.controllerContainerId);
    }

    // =========================================================================
    // ΠΡΟΣΒΑΣΗ ΣΕ ΔΥΝΑΜΙΚΑ ΔΕΔΟΜΕΝΑ (Volatile Tick Cache)
    // =========================================================================

    get myStructures() {
        if (!this._tickCache.myStructures) {
            if (!this.room) return [];
            this._tickCache.myStructures = this.room.find(FIND_MY_STRUCTURES);
        }
        return this._tickCache.myStructures;
    }

    get structures() {
        if (!this._tickCache.structures) {
            if (!this.room) return [];
            this._tickCache.structures = this.room.find(FIND_STRUCTURES);
        }
        return this._tickCache.structures;
    }

    get containers() {
        if (!this._tickCache.containers) {
            this._tickCache.containers = this.structures.filter(s => s.structureType === STRUCTURE_CONTAINER);
        }
        return this._tickCache.containers;
    }

    get links() {
        if (!this._tickCache.links) {
            this._tickCache.links = this.myStructures.filter(s => s.structureType === STRUCTURE_LINK);
        }
        return this._tickCache.links;
    }

    get hostileCreeps() {
        if (!this._tickCache.hostileCreeps) {
            if (!this.room) return [];
            this._tickCache.hostileCreeps = this.room.find(FIND_HOSTILE_CREEPS);
        }
        return this._tickCache.hostileCreeps;
    }

    get constructionSites() {
        if (!this._tickCache.constructionSites) {
            if (!this.room) return [];
            this._tickCache.constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        }
        return this._tickCache.constructionSites;
    }

    get damagedStructures() {
        if (!this._tickCache.damagedStructures) {
            this._tickCache.damagedStructures = this.structures.filter(s => {
                return s.hits < s.hitsMax && 
                       s.structureType !== STRUCTURE_WALL && 
                       s.structureType !== STRUCTURE_RAMPART;
            });
        }
        return this._tickCache.damagedStructures;
    }

    get droppedEnergy() {
        if (!this._tickCache.droppedEnergy) {
            if (!this.room) return [];
            this._tickCache.droppedEnergy = this.room.find(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY
            });
        }
        return this._tickCache.droppedEnergy;
    }
}

// Εξαγωγή ενός μοναδικού (Singleton) instance της κλάσης RoomCache
module.exports = new RoomCache();
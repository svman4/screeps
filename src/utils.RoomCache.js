/**
 * @file RoomCache.js
 * @version 1.2.0
 * @description Ενοποιημένος Διαχειριστής Μνήμης και Cache για όλα τα δωμάτια στο Screeps (Unified Singleton).
 * Διαχειρίζεται εσωτερικά πολλαπλά δωμάτια χωρίς να χρειάζεται ξεχωριστό Registry, μειώνοντας το CPU overhead.
 */
var debugConsole = require("utils.debugConsole");
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
        Memory.rooms[this.roomName].cache = this.cache;
    }
    run() {
        this.clearTickCache(); // Καθαρισμός tick cache στην αρχή του run για να διασφαλίσουμε φρέσκα δεδομένα
        if (Game.time % 500) {
            this.rorceRefresh();
        }
    }
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
        this.cache.center = {};
        this.cache.containers = null;
        this.cache.links = null;
        this._tickCache = {};
    }


    // =========================================================================
    // ΠΡΟΣΒΑΣΗ ΣΕ ΣΤΑΤΙΚΑ ΔΕΔΟΜΕΝΑ (Persistent Cache)
    // =========================================================================
    get center() {
        if (this.cache.center === undefined || this.cache.center === null) {
            if (!this.room) {
                return null;
            }
            const target = this.room.storage;// || (context.spawns && context.spawns.length > 0 ? context.spawns[0] : null);
            this.cache.center = target.pos;
        }
        return this.cache.center;
    }
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
    get controllerDistance() {
        if (this.cache.controllerDistance === undefined || this.cache.controllerDistance === null) {
            if (!this.room || !this.room.controller) return Infinity;
            const center = this.cache.center || null; // Μπορείς να ορίσεις το κέντρο του δωματίου στη cache αν θέλεις, π.χ. κοντά στον controller ή στο storage
            if (!center) return null;

            this.cache.controllerDistance = this.room.controller.pos.getRangeTo(center);
        }
        return this.cache.controllerDistance || 0;
    }
    get controllerLink() {
        if (this.cache.controllerLinkId === undefined || this.cache.controllerLinkId === null) {
            if (!this.room || !this.room.controller) return null;

            const links = this.room.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, {
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
    getSourceDistance(sourceId) {
        if (!this.cache.sourceDistanceIds) this.cache.sourceDistanceIds = {};
        if (this.cache.sourceDistanceIds[sourceId] === undefined) {
            const source = Game.getObjectById(sourceId);
            if (!source) return null;
            const center = this.cache.center || null; // Μπορείς να ορίσεις το κέντρο του δωματίου στη cache αν θέλεις, π.χ. κοντά στον controller ή στο storage
            if (!center) return null;

            this.cache.sourceDistanceIds[sourceId] = source.pos.getRangeTo(center);
        }
        return this.cache.sourceDistanceIds[sourceId];


    }
    getSourceContainer(sourceId) {
        if (!this.cache.sourceContainerIds)
            this.cache.sourceContainerIds = {};
        if (this.cache.sourceContainerIds[sourceId] === undefined || this.cache.sourceContainerIds[sourceId] === null) {
            const source = Game.getObjectById(sourceId);
            const container = this.containers.filter(c => c.pos.isNearTo(source))[0];
            this.cache.sourceContainerIds[sourceId] = container ? container.id : null;
        }
        return Game.getObjectById(this.cache.sourceContainerIds[sourceId]);
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
        return Game.getObjectById(this.cache.sourceLinkIds[sourceId]);
    }
    get sourceContainers() {
        const sourceIDs = this.sourceIds;

        // Χρησιμοποιούμε .map() για να επιστρέψουμε έναν πίνακα με τα αντικείμενα
        const containers = sourceIDs.map(sourceID => {
            return this.getSourceContainer(sourceID); // Διορθώθηκε το 'this.cache.' σε 'this.'
        }).filter(Boolean); // Φιλτράρει τυχόν null αν κάποια πηγή δεν έχει ακόμα container

        return containers;
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
        if (!this.cache.containers) {
            this.cache.containers = this.structures.filter(s => s.structureType === STRUCTURE_CONTAINER);
        }
        return this.cache.containers;
    }

    get links() {
        if (!this.cache.links) {
            this.cache.links = this.myStructures.filter(s => s.structureType === STRUCTURE_LINK).map(s => s.id);
        }
        return this.cache.links;
    }
    get myCreeps() {
        if (!this._tickCache.myCreeps) {
            if (!this.room) return [];
            this._tickCache.myCreeps = this.room.find(FIND_MY_CREEPS);
        }
        return this._tickCache.myCreeps;
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
/*

Οδηγός Χρήσης του RoomCache για το Δωμάτιο "W7N7"Αυτός ο οδηγός παρουσιάζει πώς να καλέσεις κάθε διαθέσιμη ιδιότητα (getter) και συνάρτηση της κλάσης RoomCache για το δωμάτιο "W7N7".1. Εισαγωγή και Αρχικοποίηση (Setup)Πριν από οποιαδήποτε χρήση, πρέπει να κάνεις require το module στο αρχείο σου:const RoomCache = require('RoomCache');
2. Διαχείριση του Tick Cache (Στο Main Loop)Για να λειτουργεί σωστά η cache και να αδειάζει τα δεδομένα του προηγούμενου tick, πρέπει να καλείς την clearTickCaches στην αρχή του loop σου:// src/main.js
module.exports.loop = function () {
    // Καθαρισμός των tick caches για ΟΛΑ τα δωμάτια
    RoomCache.clearTickCaches();

    // ... ο υπόλοιπος κώδικάς σου ...
};
3. Παραδείγματα Κλήσης Συνάρτησεων για το "W7N7"Υπάρχουν δύο τρόποι να αλληλεπιδράσεις με την cache:Μέσω του Room Context (Προτεινόμενος - Fluent API): Χρησιμοποιώντας το RoomCache.in('W7N7').Μέσω Direct βοηθητικών συναρτήσεων: Απευθείας από το RoomCache.Α. Μέσω του Room Context (RoomCache.in('W7N7'))Αποθηκεύουμε το instance του δωματίου σε μια μεταβλητή για πιο καθαρό κώδικα:const cache = RoomCache.in('W7N7');
Τώρα μπορούμε να καλέσουμε όλες τις μεθόδους πάνω στο cache:1. Βασικές Ιδιότητες Δωματίου// Λήψη του κανονικού Game.rooms['W7N7'] αν έχουμε visibility
const roomObject = cache.room; 
if (roomObject) {
    console.log(`Έχουμε visibility στο δωμάτιο W7N7 με RCL: ${roomObject.controller.level}`);
}
2. Στατικά Δεδομένα (Persistent Cache - Αποθηκευμένα στη Memory)Αυτά τα δεδομένα διαβάζονται από τη Memory.rooms['W7N7'].cache εξοικονομώντας CPU.// α) IDs των πηγών (Επιστρέφει array από strings)
const sourceIds = cache.sourceIds; 
// Παράδειγμα: ["5bbcac3c9099fc012e6359f1", "5bbcac3c9099fc012e6359f2"]

// β) Game Objects των πηγών (Επιστρέφει array από Source objects)
const sources = cache.sources; 
sources.forEach(source => {
    console.log(`Πηγή ID: ${source.id} έχει ${source.energy} ενέργεια.`);
});

// γ) Controller Link (Επιστρέφει StructureLink ή null)
const cLink = cache.controllerLink;
if (cLink) {
    console.log(`Το Link του Controller έχει ${cLink.store[RESOURCE_ENERGY]} ενέργεια.`);
}

// δ) Storage Link (Επιστρέφει StructureLink ή null)
const sLink = cache.storageLink;
if (sLink) {
    console.log(`Το Link του Storage έχει ελεύθερο χώρο: ${sLink.store.getFreeCapacity(RESOURCE_ENERGY)}`);
}

// ε) Link συγκεκριμένης πηγής (Δέχεται ένα source ID και επιστρέφει StructureLink ή null)
if (sourceIds.length > 0) {
    const firstSourceId = sourceIds[0];
    const sourceLink = cache.getSourceLink(firstSourceId);
    if (sourceLink) {
        console.log(`Βρέθηκε Link δίπλα στην πηγή ${firstSourceId}!`);
    }
}

// στ) Recovery Container - Κοντά στο Spawn (Επιστρέφει StructureContainer ή null)
const recContainer = cache.recoveryContainer;
if (recContainer) {
    console.log(`Το Recovery Container έχει ID: ${recContainer.id}`);
}

// ζ) Controller Container - Δίπλα στον Controller (Επιστρέφει StructureContainer ή null)
const ctrlContainer = cache.controllerContainer;
if (ctrlContainer) {
    console.log(`Το Container του Controller είναι γεμάτο κατά: ${ctrlContainer.store.getUsedCapacity()}`);
}
3. Δυναμικά Δεδομένα (Volatile Cache - Υπολογίζονται ΜΙΑ φορά ανά Tick)Αν καλέσεις αυτές τις ιδιότητες πολλές φορές στο ίδιο tick, το find() θα εκτελεστεί μόνο την πρώτη φορά.// α) Δικά μας Structures (Επιστρέφει Structure[])
const myStructs = cache.myStructures;

// β) Όλα τα Structures στο δωμάτιο (Επιστρέφει Structure[])
const allStructs = cache.structures;

// γ) Όλα τα Containers (Επιστρέφει StructureContainer[])
const containers = cache.containers;

// δ) Όλα τα Links (Επιστρέφει StructureLink[])
const links = cache.links;

// ε) Εχθρικά Creeps (Επιστρέφει Creep[])
const hostiles = cache.hostileCreeps;
if (hostiles.length > 0) {
    console.log(`⚠️ ΠΡΟΣΟΧΗ! Βρέθηκαν ${hostiles.length} εχθροί στο W7N7!`);
}

// στ) Construction Sites του δωματίου (Επιστρέφει ConstructionSite[])
const sites = cache.constructionSites;

// ζ) Structures που θέλουν repair - εκτός walls/ramparts (Επιστρέφει Structure[])
const repairTargets = cache.damagedStructures;

// η) Πεσμένη ενέργεια στο πάτωμα (Επιστρέφει Resource[])
const energyPiles = cache.droppedEnergy;
Β. Μέσω των Direct Συναρτήσεων (Direct Helpers)Αν δεν θέλεις να κρατάς instance, μπορείς να ζητήσεις απευθείας δεδομένα για το "W7N7" περνώντας το όνομα του δωματίου ως παράμετρο:// 1. Λήψη πηγών απευθείας
const sourcesDirect = RoomCache.getSources('W7N7');

// 2. Λήψη όλων των links απευθείας
const linksDirect = RoomCache.getLinks('W7N7');

// 3. Λήψη όλων των containers απευθείας
const containersDirect = RoomCache.getContainers('W7N7');

// 4. Έλεγχος για εχθρούς απευθείας
const hostilesDirect = RoomCache.getHostileCreeps('W7N7');
4. Χειροκίνητος Καθαρισμός Στατικών Δεδομένων (Force Refresh)Αν χτίσεις ένα νέο Link ή Container, η Memory δεν θα το πάρει χαμπάρι αμέσως επειδή διαβάζει τα αποθηκευμένα IDs. Πρέπει να πεις στο RoomCache να ξαναψάξει.Μπορείς να το κάνεις με δύο τρόπους:// 1. Καθαρισμός των στατικών δεδομένων ΜΟΝΟ για το δωμάτιο "W7N7"
RoomCache.forceRefresh('W7N7');

// 2. Καθαρισμός των στατικών δεδομένων για ΟΛΑ τα δωμάτια
RoomCache.forceRefresh();
Tip: Καλό είναι να καλείς το RoomCache.forceRefresh('W7N7') μέσα στον ConstructionManager σου, αμέσως μόλις ολοκληρωθεί το χτίσιμο (finish building) ενός Container ή Link!

*/
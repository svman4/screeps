/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * VERSION 2.6.1: Διόρθωση λογικής ελέγχου για τα links στην _calculateCarryQuota ώστε να καλύπτει σωστά την περίπτωση με ακριβώς τα απαιτούμενα links.
 * *VERSION 2.6.1
 * bugfix: Διόρθωση λογικής ελέγχου για τα links στην _calculateCarryQuota ώστε να καλύπτει σωστά την περίπτωση με ακριβώς τα απαιτούμενα links.    
 * * VERSION 2.6.0
 * - Refactoring: Διαχωρισμός των limits σε 'creeps' (αριθμός creeps) και 'parts' (άθροισμα body parts).
 * - Οι Harvesters πλέον υπολογίζονται βάσει επιθυμητού αριθμού creeps ανά πηγή.
 * * VERSION 2.5.0
 * - Feature: Υλοποίηση της checkIfRoomHaveRoads για δυναμικό έλεγχο υποδομών.
 * - Refactoring: Προσθήκη HAVE_ROAD_KEY στο GLOBAL_CONFIG.
 * * VERSION 2.4.0
 * - Refactoring: Διαχωρισμός ρυθμίσεων σε GLOBAL_CONFIG και MODULE_CONFIG για καλύτερη διαλειτουργικότητα.
 * * VERSION 2.3.0
 * - Refactoring: Μεταφορά του ονόματος κλειδιού Memory (populationLimits) στο CONFIG.
 * * VERSION 2.2.0
 * - Refactoring: Μεταφορά των σταθερών (constants) εκτός κλάσης για μελλοντική εξαγωγή σε config module.
 * - Καθαρισμός του constructor για καλύτερη τήρηση των αρχών προγραμματισμού.
 *  * VERSION 2.1.0
 * - Βελτίωση Recovery Mode: Προσθήκη ελάχιστου Upgrader για αποφυγή downgrade.
 * - Δυναμικός υπολογισμός εισοδήματος πηγών (Source Income) βάσει RCL (1500 vs 3000 energy).
 * - Ενσωμάτωση "Padding" στα Quotas για να καλύπτονται οι απώλειες κατά τη μεταφορά.
 * VERSION 2.0.0
 * - Μετάβαση από "Πλήθος Creeps" σε "Quotas Body Parts" (Work/Carry Quotas).
 * - Δυναμικός υπολογισμός Net Income και κατανομή WORK parts σε Builders/Upgraders.
 * - Υπολογισμός Carry Quota βάσει πραγματικών αποστάσεων (Pathfinding) από το Anchor (Storage ή Spawn).
 * - Εισαγωγή Economic Balancing Constants για αποφυγή magic numbers.
 * * VERSION 1.5.0
 * - Δημιουργία Link.
 * VERSION 1.4.0
 * - Refactored σε εξειδικευμένες μεθόδους για ευαναγνωσία.
 * - Ενσωμάτωση Builder-as-Upgrader στρατηγικής.
 * VERSION 1.2.0 Προσθήκη λειτουργία containers. 
 * - Αν υπάρχει έστω και ένα container τότε αλλάζει η διαχείριση του πληθυσμού.
 * VERSION 1.1.0 Ακύρωση λειτουργίας storageContainer
 */
const { ROLES, POPULATION_MODULE_CONFIG, POPULATION_GLOBAL_CONFIG } = require('./spawn.constants');
const debugConsole = require("utils.debugConsole");

var roomCache = require('utils.RoomCache');
class PopulationManager {
    constructor() {
        // Ο constructor παραμένει καθαρός από σταθερές παραμέτρους
    }

    /**
     * Κεντρική μέθοδος υπολογισμού ορίων.
     * @param {Room} room - Το αντικείμενο του δωματίου.
     * @returns {Object} Τα όρια πληθυσμού χωρισμένα σε creeps και parts.
     */
    calculateLimits(room) {
        const context = this._createContext(room);

        // Αν το δωμάτιο είναι σε κατάσταση έκτακτης ανάγκης
        if (context.isRecovery) {
            return this._getRecoveryLimits(context);
        }
        // Αν έχουμε Storage (Mid-Late Game)
        if (context.storage) {
            return this._getStorageLimits(context);
        }
        //console.log(context.hasContainers);
        // Αν έχουμε Containers (Early-Mid Game)
        if (context.hasContainers) {
            return this._getContainerLimits(context);
        }

        // Αρχή του παιχνιδιού (No infra)
        
        return this._getEarlyGameLimits(context);
    }

    /**
     * Υπολογίζει τα διαθέσιμα WORK parts βάσει πραγματικού εισοδήματος.
     */
    _calculateAvailableWorkParts(context) {
        const INCOME_PER_SOURCE = (context.room.controller) ? 10 : 5;

        const totalIncome = context.sources.length * INCOME_PER_SOURCE;
        let availableWork = totalIncome - POPULATION_MODULE_CONFIG.MAINTENANCE_BUFFER;

        if (context.storage) {
            const energy = context.storage.store[RESOURCE_ENERGY];
            const storageCapacity = context.storage.store.getCapacity();
            const fillPercent = energy / storageCapacity;

            if (fillPercent > POPULATION_MODULE_CONFIG.SURPLUS_THRESHOLD) {
                const surplusBonus = Math.floor((fillPercent - POPULATION_MODULE_CONFIG.SURPLUS_THRESHOLD) * POPULATION_MODULE_CONFIG.SURPLUS_SCALER);
                availableWork += surplusBonus;
            }
        }

        return Math.max(availableWork, 1);
    }
    /**
     * Κατανομή των διαθέσιμων WORK parts σε Builders και Upgraders (Μπαίνουν στη λίστα 'parts').
     */
    _distributeWorkQuotas(context, limits) {
        let availableWork = this._calculateAvailableWorkParts(context);

        let builderWork = 0;
        let upgraderWork = 0;

        if (context.hasConstruction) {
            builderWork = Math.min(availableWork * POPULATION_MODULE_CONFIG.BUILDER_INCOME_SHARE, POPULATION_MODULE_CONFIG.MAX_BUILDER_WORK_BASELINE);
            availableWork -= builderWork;
        }

        upgraderWork = availableWork;

        if (context.level === 8) {
            upgraderWork = Math.min(upgraderWork, POPULATION_MODULE_CONFIG.MAX_UPGRADER_WORK_RCL8);
        }

        // Τα όρια πλέον αποθηκεύονται στο nested object 'parts'
        limits.parts[ROLES.UPGRADER] = Math.max(Math.floor(upgraderWork), 1);
        limits.parts[ROLES.BUILDER] = Math.floor(builderWork);
    }

    /**
     * Υπολογισμός CARRY parts για Haulers βασισμένος σε Round-trip Distance.
     */
    _calculateCarryQuota(context) {
        var cache = roomCache.in(context.room.name);
        const target = cache.center;
        if (!target) return 10;

        const FALLBACK_DISTANCE = 25;
        const ENERGY_INCOME_TICK = 10;

        let totalCarryRequired = 0;
        /**
         * Τα carry που χρειάζονται από τις πηγές μέχρι το target(storage)
         */


        //debugConsole.debugObject("PopulationManager", "sources is ", cache.sources);
        for (const source of cache.sources) {
            const sourceLink = cache.getSourceLink(source.id);

            if (sourceLink)
                continue; // αν η πηγή έχει link δε χρειάζεται να υπολογίσουμε carry για αυτή την πηγή



            const range = cache.getSourceDistance(source.id);
//			debugConsole.debugText("PopulationManager","Source "+source.id+" distance is "+range);
            const distance = (range !== Infinity) ? range : FALLBACK_DISTANCE;

            totalCarryRequired += (ENERGY_INCOME_TICK * distance * 2) / CARRY_CAPACITY;

        }

        // ΥΠολογίζει τα carry Που χρειάζονται από το target στο controller
        if (!cache.controllerLink) {
            const controllerRange = cache.controllerDistance;
            const controllerDistance = (controllerRange !== Infinity) ? controllerRange : FALLBACK_DISTANCE;
            const upgradeRate = Math.min(this._calculateAvailableWorkParts(context), 15);
            totalCarryRequired += (upgradeRate * controllerDistance * 2) / CARRY_CAPACITY;
        }
        // ---------
        totalCarryRequired = (totalCarryRequired + POPULATION_MODULE_CONFIG.EXTENSION_CARRY_BONUS) * POPULATION_MODULE_CONFIG.DISTANCE_PADDING;

        return Math.ceil(totalCarryRequired);
    }

    /**
     * Δημιουργία Context για το δωμάτιο (Caching δεδομένων για τον υπολογισμό).
     */
    _createContext(room) {
        const cache = roomCache.in(room.name);
        const controller = room.controller;
        const creeps = cache.myCreeps;

        // Early exit or safety check if controller is missing
        const level = controller ? controller.level : 0;
        // Use filtering logic to derive states
        const hasWork = creeps.some(c => c.getActiveBodyparts(WORK) > 0);
        const hasCarry = creeps.some(c =>
            c.getActiveBodyparts(CARRY) > 0 &&
            (c.memory.role === ROLES.HAULER || c.memory.role === ROLES.SIMPLE_HARVESTER)
        );

        const answer = {
            room: room,
            level: room.controller ? room.controller.level : 0,
            sources: cache.sources,
            spawns: room.find(FIND_MY_SPAWNS),
            storage: room.storage,
            hasContainers: cache.hasContainers,

            hasConstruction: cache.constructionSites.length > 0,
            isRecovery: (!hasWork ||
                (!hasCarry && room.energyAvailable < 400)) &&
                room.controller &&
                room.controller.level > 1
        };

        return answer;
    }

    _getStorageLimits(context) {

        let limits = {
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]: {
                [ROLES.SIMPLE_HARVESTER]: 0,
                [ROLES.STATIC_HARVESTER]: context.sources.length * POPULATION_MODULE_CONFIG.STATIC_HARVESTERS_PER_SOURCE
            },
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]: {
                [ROLES.HAULER]: this._calculateCarryQuota(context)
            },
            isRecovery: false
        };
        this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getContainerLimits(context) {
        let limits = {
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]: {
                [ROLES.SIMPLE_HARVESTER]: Math.ceil(context.sources.length * POPULATION_MODULE_CONFIG.SIMPLE_HARVESTERS_PER_SOURCE/2),
                [ROLES.STATIC_HARVESTER]: context.sources.length * POPULATION_MODULE_CONFIG.STATIC_HARVESTERS_PER_SOURCE
            },
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]: {
                [ROLES.HAULER]: Math.ceil(this._calculateCarryQuota(context)/2),
                [ROLES.UPGRADER]: 2,
                [ROLES.BUILDER]: 2
            },
            isRecovery: false
        };
        this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getEarlyGameLimits(context) {
        let limits = {
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]: {
                [ROLES.SIMPLE_HARVESTER]: context.sources.length * POPULATION_MODULE_CONFIG.SIMPLE_HARVESTERS_PER_SOURCE,
                [ROLES.STATIC_HARVESTER]: 0//context.sources.length * POPULATION_MODULE_CONFIG.STATIC_HARVESTERS_PER_SOURCE
            },
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]: {
                [ROLES.HAULER]: 0,
                [ROLES.UPGRADER]: 2,
                [ROLES.BUILDER]: 0
                // this._calculateCarryQuota(context)
            },
            isRecovery: false
        };
        //this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getRecoveryLimits(context) {
        return {
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]: {
                [ROLES.SIMPLE_HARVESTER]: 4,
                [ROLES.STATIC_HARVESTER]: 0
            },
            [POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]: {
                [ROLES.HAULER]: 5,
                [ROLES.UPGRADER]: 1,
                [ROLES.BUILDER]: 0
            },
            isRecovery: true
        };
    } // end of _getRecoveryLimits

    /**
     * Ενημερώνει τα Memory limits του δωματίου.
     * Καλείται από το SpawnManager.
     */
    updateRoomLimits(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const limits = this.calculateLimits(room);
        Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY] = limits;

        Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.HAVE_ROAD_KEY] = roomCache.in(roomName).hasRoads;
        Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.HAVE_LINK_KEY] = roomCache.in(roomName).hasLinks;
        Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.ROOM_LEVEL_KEY] = room.controller.level;
    } // end of updateRoomLimits

    
} // end of class PopulationManager

module.exports = PopulationManager;
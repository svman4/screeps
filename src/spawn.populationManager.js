/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
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
 * VERSION 2.1.0
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
 * VERSION 1.1.0 Ακύρωση λειτουργίας storageContainer. 
 */
import { ROLES } from './spawn.constants';

// --- GLOBAL CONFIGURATION ---
// Ρυθμίσεις που χρησιμοποιούνται και από άλλα modules (π.χ. Spawn Manager)
const GLOBAL_CONFIG = {
    MEMORY_KEY: 'populationLimits',
    RECOVERY_KEY: 'isRecovery',
    HAVE_ROAD_KEY: 'hasRoads'
};

// --- MODULE SPECIFIC CONFIGURATION ---
// Ρυθμίσεις που αφορούν αποκλειστικά τη λογική του Population Manager
const MODULE_CONFIG = {
    // Efficiency values
    WORK_EFFICIENCY: 2,          // 1 WORK part = 2 energy per tick harvest
    UPGRADE_EFFICIENCY: 1,       // 1 WORK part = 1 energy per tick upgrade
    
    // Economic Balancing
    MAINTENANCE_BUFFER: 2,       // Ενέργεια που κρατάμε για Towers/Spawning
    BUILDER_INCOME_SHARE: 0.5,   // Ποσοστό του εισοδήματος που πάει σε χτίσιμο
    MAX_BUILDER_WORK_BASELINE: 10, // Μέγιστο WORK για builders από το τρέχον εισόδημα
    SURPLUS_THRESHOLD: 0.5,      // Πάνω από ποιο ποσοστό Storage θεωρούμε ότι έχουμε πλεόνασμα
    SURPLUS_SCALER: 50,          // Πόσο επιθετικά αυξάνουμε τα parts στο πλεόνασμα
    MAX_UPGRADER_WORK_RCL8: 15,  // Το όριο του controller στο RCL 8 (15 energy/tick cap)
    
    // Logistics
    EXTENSION_CARRY_BONUS: 10,   // Σταθερό quota για τον ανεφοδιασμό extensions
    DISTANCE_PADDING: 1.1,       // 10% έξτρα carry για κάλυψη απωλειών/κίνησης
    ROAD_THRESHOLD: 10           // Ελάχιστος αριθμός δρόμων για να θεωρηθεί το δωμάτιο "στρωμένο"
};

class PopulationManager {
    constructor() {
        // Ο constructor παραμένει καθαρός από σταθερές παραμέτρους
    }

    /**
     * Κεντρική μέθοδος υπολογισμού ορίων.
     * @param {Room} room - Το αντικείμενο του δωματίου.
     * @returns {Object} Τα όρια πληθυσμού (Quotas).
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
        const INCOME_PER_SOURCE = (context.room.controller && context.room.controller.level >= 1) ? 10 : 5;
        
        const totalIncome = context.sources.length * INCOME_PER_SOURCE;
        let availableWork = totalIncome - MODULE_CONFIG.MAINTENANCE_BUFFER;

        if (context.storage) {
            const energy = context.storage.store[RESOURCE_ENERGY];
            const storageCapacity = context.storage.store.getCapacity();
            const fillPercent = energy / storageCapacity;

            if (fillPercent > MODULE_CONFIG.SURPLUS_THRESHOLD) {
                const surplusBonus = Math.floor((fillPercent - MODULE_CONFIG.SURPLUS_THRESHOLD) * MODULE_CONFIG.SURPLUS_SCALER);
                availableWork += surplusBonus;
            }
        }

        return Math.max(availableWork, 1);
    }

    /**
     * Κατανομή των διαθέσιμων WORK parts σε Builders και Upgraders.
     */
    _distributeWorkQuotas(context, limits) {
        let availableWork = this._calculateAvailableWorkParts(context);
        
        let builderWork = 0;
        let upgraderWork = 0;

        if (context.hasConstruction) {
            builderWork = Math.min(availableWork * MODULE_CONFIG.BUILDER_INCOME_SHARE, MODULE_CONFIG.MAX_BUILDER_WORK_BASELINE); 
            availableWork -= builderWork;
        }

        upgraderWork = availableWork;

        if (context.level === 8) {
            upgraderWork = Math.min(upgraderWork, MODULE_CONFIG.MAX_UPGRADER_WORK_RCL8);
        }

        limits[ROLES.UPGRADER] = Math.max(Math.floor(upgraderWork), 1);
        limits[ROLES.BUILDER] = Math.floor(builderWork);
    }

    /**
     * Υπολογισμός CARRY parts για Haulers βασισμένος σε Round-trip Distance.
     */
    _calculateCarryQuota(context) {
        const target = context.storage || (context.spawns && context.spawns.length > 0 ? context.spawns[0] : null);
        if (!target) return 10;

        const FALLBACK_DISTANCE = 25;
        const ENERGY_INCOME_TICK = 10;
        
        let totalCarryRequired = 0;

        context.sources.forEach(source => {
            const range = target.pos.getRangeTo(source);
            const distance = (range !== Infinity) ? range : FALLBACK_DISTANCE; 
            totalCarryRequired += (ENERGY_INCOME_TICK * distance * 2) / CARRY_CAPACITY;
        });

        const controllerRange = target.pos.getRangeTo(context.room.controller);
        const controllerDistance = (controllerRange !== Infinity) ? controllerRange : FALLBACK_DISTANCE;
        const upgradeRate = Math.min(this._calculateAvailableWorkParts(context), 15); 
        totalCarryRequired += (upgradeRate * controllerDistance * 2) / CARRY_CAPACITY;

        totalCarryRequired = (totalCarryRequired + MODULE_CONFIG.EXTENSION_CARRY_BONUS) * MODULE_CONFIG.DISTANCE_PADDING;
        
        return Math.ceil(totalCarryRequired);
    }

    /**
     * Δημιουργία Context για το δωμάτιο (Caching δεδομένων για τον υπολογισμό).
     */
    _createContext(room) {
        const sources = room.find(FIND_SOURCES);
        const spawns = room.find(FIND_MY_SPAWNS);
        const storage = room.storage;
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        const construction = room.find(FIND_CONSTRUCTION_SITES);

        const creeps = room.find(FIND_MY_CREEPS);
        const hasWork = creeps.some(c => c.getActiveBodyparts(WORK) > 0);
        const hasCarry = creeps.some(c => c.getActiveBodyparts(CARRY) > 0);

        return {
            room: room,
            level: room.controller ? room.controller.level : 0,
            sources: sources,
            spawns: spawns,
            storage: storage,
            hasContainers: containers.length > 0,
            hasConstruction: construction.length > 0,
            isRecovery: (!hasWork || !hasCarry) && room.controller && room.controller.level > 1
        };
    }

    _getStorageLimits(context) {
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources.length * 5, 
            [ROLES.HAULER]: this._calculateCarryQuota(context),
            isRecovery: false
        };
        this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getContainerLimits(context) {
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources.length * 5,
            [ROLES.HAULER]: this._calculateCarryQuota(context),
            isRecovery: false
        };
        this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getEarlyGameLimits(context) {
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: context.sources.length * 10,
            [ROLES.STATIC_HARVESTER]: 0,
            [ROLES.HAULER]: this._calculateQuota(context),
            isRecovery: false
        };
        this._distributeWorkQuotas(context, limits);
        return limits;
    }

    _getRecoveryLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: 4, 
            [ROLES.STATIC_HARVESTER]: 0,
            [ROLES.HAULER]: 0,
            [ROLES.UPGRADER]: 1, 
            [ROLES.BUILDER]: 0,
            isRecovery: true
        };
    }

    /**
     * Ενημερώνει τα Memory limits του δωματίου.
     * Καλείται από το SpawnManager.
     */
    updateRoomLimits(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;
        
        const limits = this.calculateLimits(room);
        Memory.rooms[roomName][GLOBAL_CONFIG.MEMORY_KEY] = limits;
        Memory.rooms[roomName][GLOBAL_CONFIG.RECOVERY_KEY] = limits.isRecovery;
        Memory.rooms[roomName][GLOBAL_CONFIG.HAVE_ROAD_KEY] = this.checkIfRoomHaveRoads(room);
    }

    /**
     * Ελέγχει αν υπάρχουν επαρκείς δρόμοι στο δωμάτιο.
     * @param {Room} room 
     * @returns {boolean}
     */
    checkIfRoomHaveRoads(room) {
        const roads = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_ROAD
        });
        return roads.length >= MODULE_CONFIG.ROAD_THRESHOLD;
    }
}

export const populationManager = new PopulationManager();
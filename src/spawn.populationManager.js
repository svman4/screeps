/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * * VERSION 2.0.0
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

class PopulationManager {
    constructor() {
        // Efficiency constants
        this.WORK_EFFICIENCY = 2; // 1 WORK part = 2 energy per tick harvest
        this.UPGRADE_EFFICIENCY = 1; // 1 WORK part = 1 energy per tick upgrade
        
        // Economic Balancing Constants
        this.MAINTENANCE_BUFFER = 2; // Ενέργεια που κρατάμε για Towers/Spawning
        this.BUILDER_INCOME_SHARE = 0.5; // Ποσοστό του εισοδήματος που πάει σε χτίσιμο
        this.MAX_BUILDER_WORK_BASELINE = 10; // Μέγιστο WORK για builders από το τρέχον εισόδημα
        this.SURPLUS_THRESHOLD = 0.5; // Πάνω από ποιο ποσοστό Storage θεωρούμε ότι έχουμε πλεόνασμα
        this.SURPLUS_SCALER = 50; // Πόσο επιθετικά αυξάνουμε τα parts στο πλεόνασμα
        this.MAX_UPGRADER_WORK_RCL8 = 15; // Το όριο του controller στο RCL 8
        
        // Logistics Constants
        this.EXTENSION_CARRY_BONUS = 10; // Σταθερό quota για τον ανεφοδιασμό extensions
    }

    /**
     * Κεντρική μέθοδος υπολογισμού ορίων.
     */
    calculateLimits(room) {
        const context = this._createContext(room);
        
        if (context.isRecovery) {
            return this._getRecoveryLimits(context);
        }

        if (context.storage) {
            return this._getStorageLimits(context);
        }

        if (context.hasContainers) {
            return this._getContainerLimits(context);
        }

        return this._getEarlyGameLimits(context);
    }

    /**
     * Υπολογίζει τα διαθέσιμα WORK parts βάσει εισοδήματος και αποθεμάτων.
     */
    _calculateAvailableWorkParts(context) {
        const SOURCE_INCOME_PER_TICK = 10;
        
        // 1. Income: Πόσο energy παράγουμε ανά tick
        const totalIncome = context.sources.length * SOURCE_INCOME_PER_TICK;
        
        // 2. Net Available: Income μείον τα λειτουργικά έξοδα
        let availableWork = totalIncome - this.MAINTENANCE_BUFFER;

        // 3. Surplus Logic: Αν το storage ξεχειλίζει, προσθέτουμε "extra" work parts (Burn Strategy)
        if (context.storage) {
            const energy = context.storage.store[RESOURCE_ENERGY];
            const storageCapacity = context.storage.store.getCapacity();
            const fillPercent = energy / storageCapacity;

            if (fillPercent > this.SURPLUS_THRESHOLD) {
                const surplusBonus = Math.floor((fillPercent - this.SURPLUS_THRESHOLD) * this.SURPLUS_SCALER);
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

        // 1. Builder Allocation
        if (context.hasConstruction) {
            // Δίνουμε ένα baseline στον builder από το διαθέσιμο εισόδημα
            builderWork = Math.min(availableWork * this.BUILDER_INCOME_SHARE, this.MAX_BUILDER_WORK_BASELINE); 
            availableWork -= builderWork;
        }

        // 2. Upgrader Allocation
        // Ο upgrader παίρνει ό,τι περίσσεψε από το income + bonus πλεονάσματος
        upgraderWork = availableWork;

        // 3. RCL 8 Cap (Hard limit για τον controller)
        if (context.level === 8) {
            upgraderWork = Math.min(upgraderWork, this.MAX_UPGRADER_WORK_RCL8);
        }

        limits[ROLES.UPGRADER] = Math.max(Math.floor(upgraderWork), 1);
        limits[ROLES.BUILDER] = Math.floor(builderWork);
    }

    _getStorageLimits(context) {
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources.length * 5, // 5 WORK parts ανά source
            [ROLES.HAULER]: this._calculateCarryQuota(context),
            isRecovery: false
        };

        this._distributeWorkQuotas(context, limits);

        return limits;
    }

    /**
     * Υπολογισμός CARRY parts για Haulers.
     */
    _calculateCarryQuota(context) {
        const target = context.storage || (context.spawns && context.spawns.length > 0 ? context.spawns[0] : null);
        if (!target) return 10;

        const FALLBACK_DISTANCE = 20;
        const SOURCE_INCOME_PER_TICK = 10;
        
        let totalCarryRequired = 0;

        context.sources.forEach(source => {
            const path = target.pos.findPathTo(source, { ignoreCreeps: true });
            const distance = path.length || FALLBACK_DISTANCE; 
            totalCarryRequired += (SOURCE_INCOME_PER_TICK * distance * 2) / CARRY_CAPACITY;
        });

        const controllerPath = target.pos.findPathTo(context.room.controller, { ignoreCreeps: true });
        const controllerDistance = controllerPath.length || FALLBACK_DISTANCE;
        const upgradeRate = 10; 
        totalCarryRequired += (upgradeRate * controllerDistance * 2) / CARRY_CAPACITY;

        totalCarryRequired += this.EXTENSION_CARRY_BONUS;
        
        return Math.ceil(totalCarryRequired);
    }

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
            level: room.controller.level,
            sources: sources,
            spawns: spawns,
            storage: storage,
            hasContainers: containers.length > 0,
            hasConstruction: construction.length > 0,
            isRecovery: (!hasWork || !hasCarry) && room.controller.level > 1
        };
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
            [ROLES.HAULER]: this._calculateCarryQuota(context),
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
}

// Export a single instance for ease of use (Singleton)
export const populationManager = new PopulationManager();
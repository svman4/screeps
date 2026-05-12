/**
 * Σταθερές και ρυθμίσεις για το σύστημα παραγωγής Creeps.
 * Version 1.1
 */



export const ROLES = {
    STATIC_HARVESTER: 'staticHarvester',
    SIMPLE_HARVESTER: 'simpleHarvester',
    HAULER: 'hauler',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    LD_HARVESTER: 'LDHarvester',
    LD_HAULER: 'LDHauler',
    CLAIMER: 'claimer',
    SCOUT: 'scout',
    SUPPORTER: 'supporter',
    MINER: 'miner',
    DEFAULT: 'default'
};

export const BODY_ENERGY_LIMITS = {
    [ROLES.STATIC_HARVESTER]: 800,
    [ROLES.HAULER]: 2000,
    [ROLES.UPGRADER]: 1000,
    [ROLES.BUILDER]: 1000,
    [ROLES.SIMPLE_HARVESTER]: 800,
    [ROLES.DEFAULT]: 800
};

export const PRIORITY = {
    [ROLES.SIMPLE_HARVESTER]: 10,
    [ROLES.STATIC_HARVESTER]: 15,
    [ROLES.HAULER]: 30,
    [ROLES.MINER]: 25,
    [ROLES.LD_HARVESTER]: 35,
    [ROLES.LD_HAULER]: 40,
    [ROLES.CLAIMER]: 45,
    [ROLES.UPGRADER]: 60,
    [ROLES.BUILDER]: 70,
    [ROLES.SUPPORTER]: 80,
    [ROLES.SCOUT]: 100
};
export const NEED_REPLACEMENT_FLAG = "needReplacementFlag";

// --- GLOBAL CONFIGURATION ---

export const POPULATION_GLOBAL_CONFIG = {
    MEMORY_KEY: 'populationLimits',
    RECOVERY_KEY: 'isRecovery',
    HAVE_ROAD_KEY: 'hasRoads',
    MEMORY_KEY_CREEP: "creeps",
    MEMORY_KEY_PARTS: "parts"

};

// --- MODULE SPECIFIC CONFIGURATION ---
// Ρυθμίσεις που αφορούν αποκλειστικά τη λογική του Population Manager
export const POPULATION_MODULE_CONFIG = {
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
    STATIC_HARVESTERS_PER_SOURCE: 1, //
    SIMPLE_HARVESTERS_PER_SOURCE: 2, //
    // Logistics
    EXTENSION_CARRY_BONUS: 10,   // Σταθερό quota για τον ανεφοδιασμό extensions
    DISTANCE_PADDING: 1.1,       // 10% έξτρα carry για κάλυψη απωλειών/κίνησης
    ROAD_THRESHOLD: 10           // Ελάχιστος αριθμός δρόμων για να θεωρηθεί το δωμάτιο "στρωμένο"
};

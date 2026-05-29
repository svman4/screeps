/**
 * Σταθερές και ρυθμίσεις για το σύστημα παραγωγής Creeps.
 
 * Version 1.2.0: Προσθήκη νέων ρόλων και αναδιάρθρωση των ρυθμίσεων.
 * Version 1.1.0: Προσθήκη μεθόδου flush() για εκκαθάριση της ουράς.
 * Version 1.0.2: Προσθήκη stale request handling (timeout για παλιά αιτήματα).
 * Version 1.0.1: Βελτίωση του ελέγχου διπλοτύπων με βάση το sourceId και targetRoom.
 * Version 1.0.0: Αρχική υλοποίηση βασισμένη σε Singleton Pattern.
 */



const ROLES = {
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

const BODY_ENERGY_LIMITS = {
    [ROLES.STATIC_HARVESTER]: 800,
    [ROLES.HAULER]: 2000,
    [ROLES.UPGRADER]: 1000,
    [ROLES.BUILDER]: 1000,
    [ROLES.SIMPLE_HARVESTER]: 800,
    [ROLES.DEFAULT]: 800
};

const PRIORITY = {
    [ROLES.SIMPLE_HARVESTER]: 10,
    [ROLES.STATIC_HARVESTER]: 15,
    [ROLES.HAULER]: 20,
    [ROLES.MINER]: 35,
    [ROLES.LD_HARVESTER]: 35,
    [ROLES.LD_HAULER]: 40,
    [ROLES.CLAIMER]: 45,
    [ROLES.UPGRADER]: 60,
    [ROLES.BUILDER]: 70,
    [ROLES.SUPPORTER]: 80,
    [ROLES.SCOUT]: 100
};
const NEED_REPLACEMENT_FLAG = "needReplacementFlag";

// --- GLOBAL CONFIGURATION ---

const POPULATION_GLOBAL_CONFIG = {
    MEMORY_KEY: 'populationLimits',
    RECOVERY_KEY: 'isRecovery',
    HAVE_ROAD_KEY: 'hasRoads',
    HAVE_LINK_KEY: 'hasLinks',
    MEMORY_KEY_CREEP: "creeps",
    MEMORY_KEY_PARTS: "parts",
    ROOM_LEVEL_KEY: "level"

};
const SPAWN_MANAGER_CONFIG = {
    POPULATION_LIMIT_REFRESH_RATE: 50, //κάθε 50 TT
    CREEP_PARTS_THRESHOLD: 0.3 // Αν η διαφορά στα parts είναι μικρότερη από 30%, περιμένουμε να πεθάνουν τα παλιά creeps για να κάνουμε πιο αποδοτική αντικατάσταση.
}
// --- MODULE SPECIFIC CONFIGURATION ---
// Ρυθμίσεις που αφορούν αποκλειστικά τη λογική του Population Manager
const POPULATION_MODULE_CONFIG = {

    // Efficiency values
    WORK_EFFICIENCY: 2,          // 1 WORK part = 2 energy per tick harvest
    UPGRADE_EFFICIENCY: 1,       // 1 WORK part = 1 energy per tick upgrade

    // Economic Balancing
    MAINTENANCE_BUFFER: 5,       // Ενέργεια που κρατάμε για Towers/Spawning
    BUILDER_INCOME_SHARE: 0.5,   // Ποσοστό του εισοδήματος που πάει σε χτίσιμο
    MAX_BUILDER_WORK_BASELINE: 13, // Μέγιστο WORK για builders από το τρέχον εισόδημα
    SURPLUS_THRESHOLD: 0.5,      // Πάνω από ποιο ποσοστό Storage θεωρούμε ότι έχουμε πλεόνασμα
    SURPLUS_SCALER: 50,          // Πόσο επιθετικά αυξάνουμε τα parts στο πλεόνασμα
    MAX_UPGRADER_WORK_RCL8: 15,  // Το όριο του controller στο RCL 8 (15 energy/tick cap)
    STATIC_HARVESTERS_PER_SOURCE: 1,
    SIMPLE_HARVESTERS_PER_SOURCE: 4,
    // Logistics
    EXTENSION_CARRY_BONUS: 9,   // Σταθερό quota για τον ανεφοδιασμό extensions
    DISTANCE_PADDING: 1.1,       // 10% έξτρα carry για κάλυψη απωλειών/κίνησης
    ROAD_THRESHOLD: 30,           // Ελάχιστος αριθμός δρόμων για να θεωρηθεί το δωμάτιο "στρωμένο"
    LINK_THRESHOLD: 2           // Ελάχιστος αριθμός link για να θεωρηθεί το δωμάτιο "εξοπλισμένο με links"
};
module.exports = {
    NEED_REPLACEMENT_FLAG,
    ROLES,
    BODY_ENERGY_LIMITS,
    PRIORITY,
    POPULATION_GLOBAL_CONFIG,
    POPULATION_MODULE_CONFIG,
    SPAWN_MANAGER_CONFIG
};
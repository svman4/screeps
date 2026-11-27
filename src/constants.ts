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
   DEFAULT: 'default',
   TO_BE_RECYCLED: 'to_be_recycled',
};
export const DEFENCE = {
   /** Προσαύξηση ορίου hits τοίχων/ramparts ανά επίπεδο RCL */
   WALL_STEP_HITS: 1000,
   /** Μεγαλύτερη προσαύξηση hits τοίχων/ramparts σε RCL 8 όταν υπάρχει περίσσευμα ενέργειας */
   RCL8_RICH_WALL_STEP_HITS: 10000,
   /** Ελάχιστη ενέργεια στο room/storage σε RCL 8 για ενεργοποίηση του αυξημένου βήματος τοίχων */
   RCL8_RICH_ENERGY_THRESHOLD: 900000,
   /** Ανώτατο όριο hits για τοίχους και ramparts */
   MAX_WALL_LIMIT_HITS: 100000000,
   /** Προεπιλεγμένο όριο hits τοίχων όταν δεν υπάρχει controller ή δεν εφαρμόζεται άλλος κανόνας */
   DEFAULT_WALL_LIMIT_HITS: 1000,
   /** Ελάχιστο ποσοστό energy (70%) για επισκευή όσο υπάρχουν εχθροί */
   HOSTILE_REPAIR_ENERGY_RATIO: 0.7,
   /**
  * Κατώτατο όριο ποσοστού hits (0.0 - 1.0) κάτω από το οποίο επισκευάζονται
  * οι υπόλοιπες μη κρίσιμες δομές (όπως roads και containers).
  */
   OTHER_REPAIR_HITS_RATIO: 0.8,
   /** Κρίσιμες δομές που έχουν προτεραιότητα επισκευής ανεξαρτήτως ποσοστού hits */
   CRITICAL_STRUCTURE_TYPES: [
      STRUCTURE_SPAWN,
      STRUCTURE_EXTENSION,
      STRUCTURE_TOWER,
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL
   ] as StructureConstant[]
}; // end of DEFENCE_CONSTANTS
/** Ρυθμίσεις αυτοματοποιημένου εμπορίου, αγοραπωλησιών και διαχείρισης πόρων Market */
export const MARKET_CONSTANTS = {
   /** Χρονικά διαστήματα εκτέλεσης εργασιών Market */
   INTERVALS: {
      /**
       * Κάθε πόσα ticks θα εκτελείται
       */
      RUN: 100
   },
   STORE_LIMITS: {
      /**
       * Όριο πώλησης ενέργειας (Storage)
       */
      STORAGE: 0.9,
      /**
       * Όριο πώλησης ενέργειας (Terminal)
       */
      TERMINAL: 0.5
   },
   MARKET_CONFIG: {
      /**
       * Ελάχιστη ποσότητα για να κάνουμε deal (αποφεύγει το bug της 1 μονάδας)
       */
      MIN_DEAL_AMOUNT: 40,
      /** Μέγιστο Ratio Κόστους Μεταφοράς (Energy / Amount). 
      * 0.6 σημαίνει: Για να στείλω 1000 items, δέχομαι να πληρώσω μέχρι 600 Energy.
      * Αν το κόστος είναι μεγαλύτερο, ο αγοραστής θεωρείται πολύ μακριά.
      */
      MAX_ENERGY_RATIO: 0.6,
   },

   POWER_CONFIG: {
      /**
       * Στόχος: 3000 Power στο Terminal
       */
      TARGET_AMOUNT: 3000,
      /**
       * Μέγιστη τιμή ανά Power
       */
      MAX_PRICE: 25.0,
      /**
       *  Αγορά ανά 500
       */
      BATCH_SIZE: 500
   },

   NUKER_CONFIG: {
      /**
       * Στόχος: 5000 Ghodium
       */
      TARGET_AMOUNT: 5000,
      /**
       * Μέγιστη τιμή ανά Ghodium
       */
      MAX_PRICE: 1.5,
      /**
       * Αγορά ανά 1000
       */
      BATCH_SIZE: 1000
   },

   /** Κοινό όριο ασφαλείας χρημάτων
    * 
   */
   GLOBAL_MIN_CREDITS: 50000


}; // end of MARKET_CONSTANTS
/** Ρυθμίσεις επέκτασης, αναγνώρισης rooms (intel) και κατηγοριοποίησης περιοχών */
export const EXPANSION = {
   /** Όνομα χρήστη (ιδιοκτήτη) για αναγνώριση δικών μας rooms/δομών */
   USERNAME: "Svman4",
   /** Μέγιστη απόσταση σε rooms που καλύπτει ο Observer */
   OBSERVER_RANGE: 10,
   /** Μέγιστο βάθος αναζήτησης/επέκτασης από τα κεντρικά rooms */
   MAX_REACH_DEPTH: 2,
   /** Μέγιστος χρόνος σε ticks πριν θεωρηθούν παρωχημένα τα δεδομένα intel ενός room */
   INTEL_STALE_TIME: 5000,
   /** Κάθε πόσα ticks ανανεώνεται το γράφημα/δίκτυο intel */
   REFRESH_INTEL_GRAPH_INTERVAL: 1000,
   /** Κάθε πόσα ticks ανατίθενται εργασίες οπτικής επιτήρησης (vision) */
   DELEGATE_VISION_TASKS_INTERVAL: 30,
   /** Ελάχιστο επίπεδο CPU bucket κάτω από το οποίο περιορίζονται βαριές εργασίες επέκτασης */
   CPU_BUCKET_SAFETY_THRESHOLD: 5000,
   /** Αναγνωριστικά κατηγοριών/ρόλων για τα rooms */
   ROOM_TYPE: {
      /** Κεντρικό ή ανεπτυγμένο room βάσης */
      CITY: "city",
      /** Room απομακρυσμένης εξόρυξης (remote mining) */
      REMOTE_MINING: "remote_mining",
      /** Εχθρικό room */
      ENEMY: "enemy",
      /** Κενό / μη διεκδικούμενο room */
      EMPTY: "empty",
      /** Μεγάλο ή αναβαθμισμένο κεντρικό room υψηλού επιπέδου */
      METROPOLIS: "Metropolis"
   }, // END OF ROOM_TYPE
} // end of EXPANSION
export const MOVEMENT_CONSTANTS = {
   MATRIX_TTL: 50,
   STUCK_THRESHOLD: 2,
} // end of MOVEMENT_CONSTANTS
export const CONSTRUCTION_CONSTANT = {

   MAX_CONSTRUCTION_SITE: 1,
   STORAGE_LIMIT_FOR_INDUSTRIAL_ERA: 600000,
   CONTROLLER_LEVEL_FOR_INDUSTRIAL_ERA: 6,
   // Προτεραιότητες κατασκευής (Υψηλότερο = Πιο σημαντικό)
   PRIORITIES: {
      SPAWN: 130,
      TOWER: 120,
      EXTENSION: 110,
      STORAGE: 100,
      CONTAINER: 110,
      TERMINAL: 80,
      LINK: 70,
      LAB: 60,
      FACTORY: 50,
      POWER_SPAWN: 40,
      NUKER: 30,
      OBSERVER: 20,
      ROAD: 10,
      RAMPART: 1,
      CONSTRUCTEDWALL: 3
   },
   SCAN_INTERVALS: {
      UPDATE_BUILT_CACHE: 10,
      CHECK_CONSTRUCTION_SITES: 5
   },
} // end of CONSTRUCTION_CONSTANT;
export const ROOM_CACHE_CONSTANTS = {
   ROADS_THRESHOLD: 30,
   LINKS_THRESHOLD: 2,
} // end of ROOM_CAcHE_CONSTANTS
export const SPAWN_CONSTANTS = {
   BODY_ENERGY_LIMITS: {
      [ROLES.STATIC_HARVESTER]: 800,
      [ROLES.HAULER]: 2000,
      [ROLES.UPGRADER]: 1000,
      [ROLES.BUILDER]: 1000,
      [ROLES.SIMPLE_HARVESTER]: 800,
      [ROLES.DEFAULT]: 800
   },

   PRIORITY: {
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
   },
   NEED_REPLACEMENT_FLAG: "needReplacementFlag",
   LEAD_TIME_KEY: "leadTime",


   SPAWN_MANAGER_CONFIG: {
      POPULATION_LIMIT_REFRESH_RATE: 100, //κάθε 100 Tick
      EMA_SMOOTHING_PERIODS: 13, // Πόσους κύκλους πίσω θέλουμε να "θυμάται" το EMA 
      //CREEP_PARTS_THRESHOLD: 0.3 // Αν η διαφορά στα parts είναι μικρότερη από 30%, περιμένουμε να πεθάνουν τα παλιά creeps για να κάνουμε πιο αποδοτική αντικατάσταση.
      DEFAULT_RETIREMENT_THRESHOLD: 30
   },

} // end of SPAWN_CONSTANTS
// --- MODULE SPECIFIC CONFIGURATION ---
// Ρυθμίσεις που αφορούν αποκλειστικά τη λογική του Population Manager
export const POPULATION_MODULE_CONFIG = {

   // Efficiency values
   BUILDING_EFFICIENCY: 5,      // 1 WORK PART = 5 energy per tick
   WORK_EFFICIENCY: 2,          // 1 WORK part = 2 energy per tick harvest
   UPGRADE_EFFICIENCY: 1,       // 1 WORK part = 1 energy per tick upgrade

   // Economic Balancing
   MAINTENANCE_BUFFER: 3,       // Ενέργεια που κρατάμε για Towers/Spawning
   BUILDER_INCOME_SHARE: 0.5,   // Ποσοστό του εισοδήματος που πάει σε χτίσιμο
   MAX_BUILDER_WORK_BASELINE: 13, // Μέγιστο WORK για builders από το τρέχον εισόδημα
   SURPLUS_THRESHOLD: 0.5,      // Πάνω από ποιο ποσοστό Storage θεωρούμε ότι έχουμε πλεόνασμα
   SURPLUS_SCALER: 50,          // Πόσο επιθετικά αυξάνουμε τα parts στο πλεόνασμα
   MAX_UPGRADER_WORK_RCL8: 15,  // Το όριο του controller στο RCL 8 (15 energy/tick cap)
   STATIC_HARVESTERS_PER_SOURCE: 1,
   SIMPLE_HARVESTERS_PER_SOURCE: 2,
   // Logistics
   EXTENSION_CARRY_BONUS: 7,   // Σταθερό quota για τον ανεφοδιασμό extensions
   DISTANCE_PADDING: 1.1,       // 10% έξτρα carry για κάλυψη απωλειών/κίνησης
   ROAD_THRESHOLD: 30,           // Ελάχιστος αριθμός δρόμων για να θεωρηθεί το δωμάτιο "στρωμένο"
   LINK_THRESHOLD: 2           // Ελάχιστος αριθμός link για να θεωρηθεί το δωμάτιο "εξοπλισμένο με links"
}
// --- GLOBAL CONFIGURATION ---=
export const POPULATION_GLOBAL_CONFIG = {
   MEMORY_KEY: 'populationLimits',
   RECOVERY_KEY: 'isRecovery',
   HAVE_ROAD_KEY: 'hasRoads',
   HAVE_LINK_KEY: 'hasLinks',
   MEMORY_KEY_CREEP: "creeps",
   MEMORY_KEY_PARTS: "parts",
   ROOM_LEVEL_KEY: "level"

}

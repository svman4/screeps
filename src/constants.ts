
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
export const ROOM_CACHE_CONSTANTS = {
   ROADS_THRESHOLD: 30,
   LINKS_THRESHOLD: 2,
};
} // end of ROOM_CAcHE_CONSTANTS
export default {
   DEFENCE,
   MARKET_CONSTANTS,
   EXPANSION,
   MOVEMENT_CONSTANTS,
   ROOM_CACHE_CONSTANTS
};
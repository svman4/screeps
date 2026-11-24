export default {
   DEFENCE_CONSTANTS: {
      WALL_STEP_HITS: 1000,
      RCL8_RICH_WALL_STEP_HITS: 10000,
      RCL8_RICH_ENERGY_THRESHOLD: 900000,
      MAX_WALL_LIMIT_HITS: 100000000,
      DEFAULT_WALL_LIMIT_HITS: 1000,
      /** Ελάχιστο ποσοστό energy (70%) για επισκευή όσο υπάρχουν εχθροί */
      HOSTILE_REPAIR_ENERGY_RATIO: 0.7,
   }, // end of DEFENCE_CONSTANTS
   MARKET_CONSTANTS: {
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


   }, // end of MARKET_CONSTANTS
} // end of export
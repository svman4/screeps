/**
 * Supporter Role: Ένας ευέλικτος ρόλος υποστήριξης που διαχειρίζεται ενέργεια, 
 * χτίζει δομές και προστατεύει τον Controller από υποβάθμιση (downgrade).
 */
const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class Supporter extends BaseRole {
    /**
     * Η κύρια λογική που εκτελείται σε κάθε tick.
     */
    run() {
        // --- 1. ΔΙΑΧΕΙΡΙΣΗ ΚΑΤΑΣΤΑΣΗΣ (STATE MANAGEMENT) ---
        
        // Αν το creep δούλευε (working: true) αλλά άδειασε η αποθήκη του, σταμάτα να δουλεύεις.
        if (this.creep.memory.working && this.creep.store[RESOURCE_ENERGY] === 0) {
            this.creep.memory.working = false;
        }
        
        // Αν το creep μάζευε ενέργεια και γέμισε η αποθήκη του, ξεκίνα να δουλεύεις.
        if (!this.creep.memory.working && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.working = true;
        }

        // --- 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΩΝ (WORKING STATE) ---
        if (this.creep.memory.working) {
            
            // Πρώτη προτεραιότητα: Μετακίνηση στο δωμάτιο-στόχο αν βρίσκεται αλλού.
            // Η χρήση του 'return' σταματά την εκτέλεση για αυτό το tick αν το creep ταξιδεύει.
            if (this.travelToTargetRoom()) return;

            const controller = this.creep.room.controller;

            /**
             * ΚΡΙΣΙΜΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Emergency Upgrade
             * Αν ο Controller κινδυνεύει να πέσει επίπεδο (downgrade < 1000 ticks),
             * το Supporter αγνοεί τα πάντα για να τον "σώσει".
             */
            if (controller && controller.my && controller.ticksToDowngrade < 1000) {
                if (this.upgradeController()) return;
            }

            // ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Τροφοδοσία Spawn και Extensions.
            // Απαραίτητο για να συνεχιστεί η παραγωγή νέων creeps.
            if (this.fillSpawnExtension()) return;

            // ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Κατασκευή κτιρίων (Construction Sites).
            if (this.buildStructures()) return;

            // ΤΕΤΑΡΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Αν δεν υπάρχει τίποτα άλλο, κάνε Upgrade.
            // Αυτό βοηθάει στην αύξηση του RCL (Room Controller Level).
            this.upgradeController();

        } 
        // --- 3. ΑΝΑΠΛΗΡΩΣΗ ΠΟΡΩΝ (COLLECTING STATE) ---
        else {
            // Αν το creep πρέπει να μαζέψει ενέργεια, επέστρεψε στο "Home Room".
            if (this.travelToHomeRoom()) return;

            // Εκτέλεση της μεθόδου συλλογής ενέργειας (π.χ. από Containers ή Sources).
            this.getEnergy();
        }
    }
}

module.exports = Supporter;
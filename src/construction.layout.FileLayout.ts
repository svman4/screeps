/**
 * @module construction.layout.FileLayout
 * @description Υλοποίηση της BaseLayout που αναλαμβάνει αποκλειστικά τη δυναμική 
 * φόρτωση (Dynamic IO) στατικών αρχείων blueprint ανά δωμάτιο.
 * 
 * CHANGELOG:
 * version 1.3.0
 * - Πλήρης ανασχεδιασμός (Refactor): Η κλάση πλέον κληρονομεί από την BaseLayout.
 * - Μεταφορά της λογικής scoring και preprocessing στην κλάση Scorer.
 * - Περιορισμός ευθύνης αποκλειστικά στη δυναμική φόρτωση αρχείων (Dynamic IO).
 * 
 * version 1.2.1
 * - Προσθήκη αναλυτικού μηνύματος λάθους (console.error) κατά τη δυναμική φόρτωση blueprint.
 * 
 * version 1.2.0
 * - Υλοποίηση Dynamic Loading (Lazy Load) των blueprint αρχείων.
 * - Κατάργηση εξάρτησης από το global.roomBlueprints.
 * - Προσθήκη error handling για δωμάτια χωρίς αρχείο blueprint.
 */

import BaseLayout = require("./construction.layout.BaseLayout");

/**
 * Υποκλάση της {@link BaseLayout} για τη διαχείριση προκαθορισμένων (static) blueprints 
 * που βρίσκονται αποθηκευμένα ως ξεχωριστά modules/αρχεία στο project.
 * 
 * @class FileLayout
 * @extends {BaseLayout}
 */
class FileLayout extends BaseLayout {

    /**
     * Δημιουργεί ένα νέο instance της FileLayout και εκκινεί αυτόματα 
     * τη διαδικασία αρχικοποίησης ({@link BaseLayout.init}).
     * 
     * @param {string} roomName - Το όνομα του δωματίου (π.χ. "W1N1") για το οποίο θα φορτωθεί το αρχείο.
     */
    constructor(roomName: string) {
        super(roomName);
        this.init(); // Εκκίνηση της ροής (loading -> scoring -> caching) από την BaseLayout
    }

    /**
     * Υλοποίηση της αφηρημένης μεθόδου της {@link BaseLayout} ειδικά για δυναμική 
     * φόρτωση αρχείων blueprint μέσω `require()`.
     * 
     * Διαχειρίζεται με ασφάλεια τόσο την απουσία αρχείου όσο και τυχόν συντακτικά λάθη 
     * μέσα στο ίδιο το αρχείο blueprint.
     * 
     * @protected
     * @override
     * @returns {any | null} Τα ακατέργαστα δεδομένα του blueprint ή `null` αν αποτύχει η φόρτωση.
     */
    protected loadRawData(): any | null {
        try {
            // Δυναμική εισαγωγή του module με βάση το όνομα του δωματίου
            return require(`blueprints.${this.roomName}`);
        } catch (e: unknown) {
            const error = e as Error;

            // Αν το σφάλμα είναι ότι δεν βρέθηκε το αρχείο (MODULE_NOT_FOUND)
            if (error.message && error.message.includes("Cannot find module")) {
                console.log(`[FileLayout] Blueprint file not found for room: ${this.roomName}`);
            } else {
                // Αν το αρχείο υπάρχει αλλά έχει Syntax Error ή άλλο πρόβλημα
                console.log(`[FileLayout] Error loading blueprint "${this.roomName}": ${error.message}`);
                if (error.stack) {
                    console.log(error.stack); // Εκτυπώνει ακριβώς πού είναι το λάθος
                }
            }
            return null;
        }
    } // end of loadRawData
} // end of class

export = FileLayout;
/*
    CHANGELOG:
    version 1.3.0
    - Πλήρης ανασχεδιασμός (Refactor): Η κλάση πλέον κληρονομεί από την BaseLayout.
    - Μεταφορά της λογικής scoring και preprocessing στην κλάση Scorer.
    - Περιορισμός ευθύνης αποκλειστικά στη δυναμική φόρτωση αρχείων (Dynamic IO).

    version 1.2.1
    - Προσθήκη αναλυτικού μηνύματος λάθους (console.error) κατά τη δυναμική φόρτωση blueprint.
    
    version 1.2.0
    - Υλοποίηση Dynamic Loading (Lazy Load) των blueprint αρχείων.
    - Κατάργηση εξάρτησης από το global.roomBlueprints.
    - Προσθήκη error handling για δωμάτια χωρίς αρχείο blueprint.
*/

const BaseLayout = require('construction.layout.BaseLayout');

class FileLayout extends BaseLayout {
    constructor(roomName) {
        super(roomName);
        this.init(); // Εκκίνηση της ροής από την BaseLayout
    }

    /**
     * Υλοποίηση της φόρτωσης ειδικά για αρχεία blueprint.
     */
    loadRawData() {
        try {
            return require(`blueprints.${this.roomName}`);
        } catch (e) {
            // Αν το σφάλμα είναι ότι δεν βρέθηκε το αρχείο (MODULE_NOT_FOUND)
            if (e.message && e.message.includes('Cannot find module')) {
                console.log(`[FileLayout] Blueprint file not found for room: ${this.roomName}`);
            } else {
                // Αν το αρχείο υπάρχει αλλά έχει Syntax Error ή άλλο πρόβλημα
                console.log(`[FileLayout] Error loading blueprint "${this.roomName}": ${e.message}`);
                console.log(e.stack); // Εκτυπώνει ακριβώς που είναι το λάθος
            }
            return null;
        }
    } // end of loadRawData
} // end of class

module.exports = FileLayout;
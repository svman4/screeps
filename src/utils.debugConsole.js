
/**
 * @file debugConsole.js
 * @version 1.0.0
 * @date 2026-05-18
 * @description Κλάση για τη διαχείριση μηνυμάτων αποσφαλμάτωσης (debugging) στην κονσόλα.
 * Επιτρέπει την κεντρική ενεργοποίηση/απενεργοποίηση των logs μέσω της σταθεράς DEBUG_STATE.
 */

// Γενικός διακόπτης για την ενεργοποίηση (true) ή απενεργοποίηση (false) των debug logs.
const DEBUG_STATE = true;

/**
 * @class debugConsole
 * @description Παρέχει βοηθητικές μεθόδους για την εκτύπωση μηνυμάτων και αντικειμένων
 * στην κονσόλα με οργανωμένο τρόπο, περιλαμβάνοντας το όνομα του manager/module.
 */
class debugConsole {

	/**
	 * Εκτυπώνει ένα απλό μήνυμα κειμένου στην κονσόλα.
	 * 
	 * @param {string} manager - Το όνομα του module, της κλάσης ή του context που καλεί το log.
	 * @param {string} message - Το μήνυμα αποσφαλμάτωσης προς εκτύπωση.
	 * @returns {void}
	 */
	debugText(manager, message) {
		if (!DEBUG_STATE) return; // Έξοδος αν το debugging είναι απενεργοποιημένο
		console.log(`[${manager}] ${message}`);
	}

	/**
	 * Εκτυπώνει ένα μήνυμα συνοδευόμενο από ένα αντικείμενο, μορφοποιημένο σε ευανάγνωστο JSON.
	 * 
	 * @param {string} manager - Το όνομα του module, της κλάσης ή του context που καλεί το log.
	 * @param {string} message - Το μήνυμα αποσφαλμάτωσης προς εκτύπωση.
	 * @param {Object} obj     - Το αντικείμενο ή η μεταβλητή προς επιθεώρηση.
	 * @returns {void}
	 */
	debugObject(manager, message, obj) {
		if (!DEBUG_STATE) return; // Έξοδος αν το debugging είναι απενεργοποιημένο

		// Χρήση JSON.stringify με indent 2 κενών για πιο ευανάγνωστη μορφή (pretty-print)
		console.log(`[${manager}] ${message}` + "\n" + JSON.stringify(obj, null, 2));
	}
}

// Εξαγωγή ενός singleton instance της κλάσης για να διατηρείται το ίδιο context σε όλη την εφαρμογή
module.exports = new debugConsole();
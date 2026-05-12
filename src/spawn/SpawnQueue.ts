/**
 * MODULE: Spawn Queue Manager
 * VERSION: 1.1.0
 * TYPE: Persistence Layer Class
 * * ΠΕΡΙΓΡΑΦΗ:
 * Διαχειρίζεται την ουρά παραγωγής των creeps στη Memory. 
 * Εξασφαλίζει ότι δεν υπάρχουν διπλότυπα αιτήματα και διατηρεί τη σειρά προτεραιότητας.
 * * CHANGE LOG:
 * 1.1.0: Προσθήκη μεθόδου flush() για εκκαθάριση της ουράς.
 * 1.0.2: Προσθήκη stale request handling (timeout για παλιά αιτήματα).
 * 1.0.1: Βελτίωση του ελέγχου διπλοτύπων με βάση το sourceId και targetRoom.
 * 1.0.0: Αρχική υλοποίηση βασισμένη σε Singleton Pattern.
 */

import _ from "lodash";

class SpawnQueue {
    data: any;
    private _needsSort: boolean;
    constructor() {
        // Αρχικοποίηση στη Memory αν δεν υπάρχει
        /** @type {Array} */
        this.data = [];

        /** @private */
        this._needsSort = true;

        // Καθαρισμός αν η ουρά μείνει "κολλημένη" για πάνω από 500 ticks
        this._cleanStaleRequests();
    }

    /**
     * Προσθέτει ένα νέο αίτημα παραγωγής στην ουρά.
     * @param {Object} request - Το αντικείμενο του αιτήματος.
     * @param {string} request.role - Ο ρόλος του creep (βλ. ROLES).
     * @param {number} request.priority - Προτεραιότητα (μικρότερο νούμερο = υψηλότερη προτεραιότητα).
     * @param {string} request.homeRoom - Το δωμάτιο που "ανήκει" το creep.
     * @param {string} [request.targetRoom] - Το δωμάτιο προορισμού (αν διαφέρει).
     * @param {Object} [request.memory] - Επιπλέον δεδομένα μνήμης (π.χ. sourceId).
     * @returns {boolean} True αν προστέθηκε επιτυχώς, False αν υπήρχε ήδη.
     */
    add(request) {
        // Έλεγχος για αποφυγή spamming ίδιων αιτημάτων
        const isAlreadyInQueue = this.data.some(r =>
            r.role === request.role &&
            r.targetRoom === (request.targetRoom || request.homeRoom) &&
            (!request.memory || r.memory.sourceId === request.memory.sourceId)
        );

        if (!isAlreadyInQueue) {
            this.data.push({
                role: request.role,
                priority: request.priority,
                homeRoom: request.homeRoom,
                targetRoom: request.targetRoom || request.homeRoom,
                memory: request.memory || {},
                addedAt: Game.time // Χρήσιμο για τον εντοπισμό stale requests
            });

            this._needsSort = true;
            return true;
        }
        return false;
    }

    /**
     * Ταξινομεί την ουρά βάσει προτεραιότητας.
     * Χρησιμοποιεί το flag _needsSort για αποφυγή περιττών calculations στο ίδιο tick.
     */
    sort() {
        if (this._needsSort) {
            // Priority first, then Age (τα παλαιότερα αιτήματα προηγούνται σε ίδια προτεραιότητα)
            this.data.sort((a: { priority: number; addedAt: number; }, b: { priority: number; addedAt: number; }) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.addedAt - b.addedAt;
            });
            this._needsSort = false;
        }
    }

    /**
     * Αφαιρεί ένα αίτημα από την ουρά (συνήθως μετά από επιτυχημένο spawn).
     * @param {number} index 
     */
    removeAt(index) {
        this.data.splice(index, 1);
    }

    /**
     * Επιστρέφει το τρέχον μέγεθος της ουράς.
     * @returns {number}
     */
    get length() {
        return this.data.length;
    }

    /**
     * Λήψη αιτήματος βάσει θέσης.
     * @param {number} index 
     * @returns {Object}
     */
    getAt(index) {
        return this.data[index];
    }

    /**
     * Καθαρίζει ολόκληρη την ουρά (χρήσιμο σε καταστάσεις Recovery).
     */
    flush() {

        this.data = [];
    }

    /**
     * Εσωτερική μέθοδος για την αφαίρεση αιτημάτων που έχουν μείνει στην ουρά πάνω από 500 ticks.
     * Προλαμβάνει το "μπούκωμα" της παραγωγής από αιτήματα που δεν μπορούν να ικανοποιηθούν.
     * @private
     */
    _cleanStaleRequests() {
        if (Game.time % 100 === 0) {
            const TIMEOUT = 500;
            const initialLength = this.data.length;

            _.remove(this.data, r => (Game.time - r.addedAt) > TIMEOUT);

            if (this.data.length < initialLength) {
                console.log(`[SpawnQueue] Cleaned ${initialLength - this.data.length} stale requests.`);
            }
        }
    }
} // end of class
// Look for the interface/type in SpawnQueue.ts and update it:
export interface SpawnRequest {
    role: string;
    priority: number;
    homeRoom: string;     // Add this if missing
    targetRoom?: string;
    energyBudget?: number; // <--- Add this line!
    memory?: any;
    addedAt?: number;      // Add this if missing
}

export default SpawnQueue;
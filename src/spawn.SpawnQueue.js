/**
 * MODULE: Spawn Queue Manager
 * VERSION: 1.2.0
 * TYPE: Persistence Layer Class
 * * ΠΕΡΙΓΡΑΦΗ:
 * Διαχειρίζεται την ουρά παραγωγής των creeps στη Memory. 
 * Εξασφαλίζει ότι δεν υπάρχουν διπλότυπα αιτήματα και διατηρεί τη σειρά προτεραιότητας.
 * * CHANGE LOG:
 * 1.2.0: Προσθήκη flushOnRoom() για εκκαθάριση αιτημάτων που σχετίζονται με συγκεκριμένο δωμάτιο (home ή target).
 * 1.1.0: Προσθήκη μεθόδου flush() για εκκαθάριση της ουράς.
 * 1.0.2: Προσθήκη stale request handling (timeout για παλιά αιτήματα).
 * 1.0.1: Βελτίωση του ελέγχου διπλοτύπων με βάση το sourceId και targetRoom.
 * 1.0.0: Αρχική υλοποίηση βασισμένη σε Singleton Pattern.
 */
const debugConsole = require("utils.debugConsole");
class SpawnQueue {
    constructor() {
        // Αρχικοποίηση στη Memory αν δεν υπάρχει
        if (!Memory.spawnQueue) {
            Memory.spawnQueue = [];
        }

        /** @type {Array} */
        this.data = Memory.spawnQueue;

        /** @private */
        this._needsSort = true;

        // Καθαρισμός αν η ουρά μείνει "κολλημένη" για πάνω από 500 ticks
        this.cleanStaleRequests();
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
                body: request.body,
                budget: request.budget,
                memory: request.memory || {},
                addedAt: Game.time // Χρήσιμο για τον εντοπισμό stale requests
            });
            Memory.spawnQueue = this.data; // Ενημέρωση στη Memory μετά την ταξινόμηση
            this._needsSort = true;
            return true;
        }
        return false;
    }
    /**
     * 
     * @param {string} roomName 
     */
     flushOnRoom(roomName) {
        
        _.remove(this.data, r => r.homeRoom === roomName || r.targetRoom === roomName);
        Memory.spawnQueue = this.data; // Ενημέρωση στη Memory μετά την ταξινόμηση

    }

    /**
     * Ταξινομεί την ουρά βάσει προτεραιότητας.
     * Χρησιμοποιεί το flag _needsSort για αποφυγή περιττών calculations στο ίδιο tick.
     */
    sort() {
        if (this._needsSort) {
            // Priority first, then Age (τα παλαιότερα αιτήματα προηγούνται σε ίδια προτεραιότητα)
            this.data.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.addedAt - b.addedAt;
            });
            this._needsSort = false;
        }
        Memory.spawnQueue = this.data; // Ενημέρωση στη Memory μετά την ταξινόμηση
    }

    /**
     * Αφαιρεί ένα αίτημα από την ουρά (συνήθως μετά από επιτυχημένο spawn).
     * @param {number} index 
     */
    removeAt(index) {
        this.data.splice(index, 1);
        Memory.spawnQueue = this.data; // Ενημέρωση στη Memory μετά την ταξινόμηση
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
        Memory.spawnQueue = [];
        this.data = Memory.spawnQueue;
    }

    /**
     * Εσωτερική μέθοδος για την αφαίρεση αιτημάτων που έχουν μείνει στην ουρά πάνω από 500 ticks.
     * Προλαμβάνει το "μπούκωμα" της παραγωγής από αιτήματα που δεν μπορούν να ικανοποιηθούν.
     * 
     */
    cleanStaleRequests() {
        
            const TIMEOUT = 500;
            const initialLength = this.data.length;

            _.remove(this.data, r => (Game.time - r.addedAt) > TIMEOUT);

            if (this.data.length < initialLength) {
                console.log(`[SpawnQueue] Cleaned ${initialLength - this.data.length} stale requests.`);
            }
     
        Memory.spawnQueue = this.data; // Ενημέρωση στη Memory μετά την ταξινόμηση
    }
} // end of class

module.exports = SpawnQueue;
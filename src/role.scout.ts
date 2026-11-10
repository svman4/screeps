/**
 * @module role.scout
 * @description Περιέχει τη λογική συμπεριφοράς για τα creeps με ρόλο Scout, 
 * τα οποία είναι υπεύθυνα για την αναγνώριση δωματίων και τη συλλογή πληροφοριών (Intel).
 */

import expansionManager = require("./manager.expansion");

/**
 * Κλάση που υλοποιεί τον ρόλο του Scout στο Screeps.
 * Κληρονομεί βασικές λειτουργίες κίνησης και διαχείρισης από την {@link BaseRole}.
 * 
 * @class Scout
 * @extends {BaseRole}
 */
export class Scout extends BaseRole {

    /**
     * Κύρια μέθοδος εκτέλεσης του ρόλου ανά tick.
     * 
     * Διαδικασία εκτέλεσης:
     * 1. Μετακινεί το creep προς το δωμάτιο-στόχο (`targetRoom`).
     * 2. Όταν φτάσει, ενημερώνει τα δεδομένα κατασκοπείας (Intel) μέσω του {@link expansionManager}.
     * 3. Τερματίζει τη ζωή του creep (`suicide`) για εξοικονόμηση CPU, εφόσον ολοκληρώθηκε η αποστολή.
     * 
     * @public
     * @override
     * @returns {void}
     */
    public run(): void {
        // Εάν το creep δεν έχει φτάσει ακόμα στο targetRoom, συνεχίζει τη μετακίνηση
        if (this.travelToTargetRoom()) {
            return;
        }

        /** @type {string | undefined} Το όνομα του δωματίου-στόχου από τη μνήμη του creep */
        const targetRoom: string | undefined = this.creep.memory.targetRoom;

        // Καταγραφή των πληροφοριών του τρέχοντος δωματίου στη μνήμη του ExpansionManager
        expansionManager.updateRoomIntelWithRoomName(
            this.creep.room.name,
            expansionManager.canIExpand()
        );

        // getInfoForNeighborRoom(targetRoom);

        // Εξοικονόμηση CPU: Το creep αυτοκαταστρέφεται μόλις συλλέξει τα δεδομένα
        this.creep.suicide();
    } // end of run
} // end of Scout
/**
 * MANAGER: Link Network
 * VERSION: 1.1.0
 * DESCRIPTION: Διαχειρίζεται την αυτόματη μεταφορά ενέργειας μεταξύ των Links.
 * Λειτουργεί με σύστημα προτεραιοτήτων (Controller > Storage) για τη βελτιστοποίηση 
 * του Upgrading και της αποθήκευσης πλεονάσματος.
 * * CHANGELOG:
 * 1.1.0: Διόρθωση bug στο instantiation (Room object αντί για string).
 * 1.0.0: Αρχική υλοποίηση βασικής κατηγοριοποίησης και μεταφοράς.
 */

class LinkManager {
    /**
     * @param {Room} room - Το αντικείμενο του δωματίου που διαχειρίζεται ο manager.
     */
    constructor(room) {
        this.room = room;
        this.links = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_LINK }
        });
        
        // Ταξινόμηση των links βάσει ρόλου για το τρέχον tick
        this.categories = this.categorizeLinks();
    }

    /**
     * Κύρια λογική εκτέλεσης: Ελέγχει τους Senders και μοιράζει ενέργεια στους Receivers.
     */
    run() {
        // Απαιτούνται τουλάχιστον 2 links για να υπάρξει ροή ενέργειας
        if (this.links.length < 2) return; 

        const { senders, storageLink, controllerLink } = this.categories;

        for (const sender of senders) {
            // Έλεγχος αν ο Sender είναι έτοιμος (Cooldown & ελάχιστο απόθεμα 400 energy)
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) < 400 || sender.cooldown > 0) {
                continue;
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1: Τροφοδοσία του Controller (Upgrading)
            if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                sender.transferEnergy(controllerLink);
                // Ένα transfer ανά sender ανά tick (λόγω cooldown και API limit)
                continue; 
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2: Αποθήκευση στο Storage (Surplus Management)
            if (storageLink && storageLink.id !== sender.id && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 100) {
                sender.transferEnergy(storageLink);
                continue;
            }
        }
    }

    /**
     * Αυτόματη απόδοση ρόλων στα Links βάσει της εγγύτητάς τους σε κρίσιμα structures.
     * @returns {Object} Επιστρέφει κατηγοριοποιημένα αντικείμενα Link.
     */
    categorizeLinks() {
        const senders = [];
        const receivers = [];
        let storageLink = null;
        let controllerLink = null;

        const controller = this.room.controller;
        const storage = this.room.storage;

        for (const link of this.links) {
            let isSpecial = false;

            // Έλεγχος Link κοντά στον Controller (εμβέλεια 4)
            if (controller && link.pos.inRangeTo(controller, 4)) {
                controllerLink = link;
                receivers.push(link);
                isSpecial = true;
            } 
            // Έλεγχος Link κοντά στο Storage (εμβέλεια 2)
            else if (storage && link.pos.inRangeTo(storage, 2)) {
                storageLink = link;
                isSpecial = true;
            }

            // Αν δεν εξυπηρετεί Controller ή Storage, θεωρείται Link συλλογής (Source Link)
            if (!isSpecial) {
                senders.push(link);
            }
        }

        return { senders, receivers, storageLink, controllerLink };
    }
}

module.exports = {
    /**
     * Εξωτερική κλήση του manager.
     * @param {string} roomName - Το όνομα του δωματίου (π.χ. "E1S1").
     */
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return; // Προστασία σε περίπτωση που δεν έχουμε ορατότητα στο δωμάτιο

        const manager = new LinkManager(room);
        manager.run();
    }
};
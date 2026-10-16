/**
 * MANAGER: Link Network
 * VERSION: 1.3.0
 * DESCRIPTION: Διαχειρίζεται την αυτόματη μεταφορά ενέργειας μεταξύ των Links.
 * * CHANGES 1.3.0:
 * - Προσθήκη εγγραφής του Storage Link ID στο Room Memory (storageLinkId).
 * - Δυνατότητα αναγνώρισης του Link από το Logistics Manager για αυτόματη εκκένωση/τροφοδοσία.
 */

const LIMIT_FOR_START_TRANSFER = 400;
const STORAGE_LINK_ID = "storageLinkId";

class LinkManager {
    /**
     * @param {Room} room - Το αντικείμενο του δωματίου που διαχειρίζεται ο manager.
     */
    constructor(room) {
        this.room = room;
        this.links = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_LINK }
        });
        this.categories = this.categorizeLinks();
    }

    /**
     * Εκτυπώνει την κατάσταση του δικτύου Link για debugging.
     */
    debugCategories() {
        const { senders, storageLink, controllerLink } = this.categories;
        console.log(`--- Link Report [${this.room.name}] ---`);
        console.log(`Senders: ${senders.length}`);
        console.log(`Storage Link: ${storageLink ? 'OK' : 'MISSING'}`);
        console.log(`Controller Link: ${controllerLink ? 'OK' : 'MISSING'}`);
    }

    /**
     * Κύρια λογική εκτέλεσης.
     */
    run() {
        if (this.links.length < 2) return; 

        const { senders, storageLink, controllerLink } = this.categories;

        for (const sender of senders) {
            // Έλεγχος αν ο Sender έχει ενέργεια και δεν είναι σε cooldown
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) < LIMIT_FOR_START_TRANSFER || sender.cooldown > 0) {
                continue;
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1: Controller (Upgrading)
            if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= LIMIT_FOR_START_TRANSFER) {
                sender.transferEnergy(controllerLink);
                continue; 
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2: Storage
            if (storageLink && storageLink.id !== sender.id && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= LIMIT_FOR_START_TRANSFER) {
                sender.transferEnergy(storageLink);
                continue;
            }
        }
    }

    /**
     * Κατηγοριοποιεί τα links βάσει θέσης και ενημερώνει τη μνήμη.
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

            // Link κοντά στον Controller (Receiver)
            if (controller && link.pos.inRangeTo(controller, 4)) {
                controllerLink = link;
                receivers.push(link);
                isSpecial = true;
            } 
            // Link κοντά στο Storage (Hub)
            else if (storage && link.pos.inRangeTo(storage, 2)) {
                storageLink = link;
                isSpecial = true;
                // Ενημέρωση Memory για χρήση από άλλους managers (π.χ. Logistics)
                this.room.memory[STORAGE_LINK_ID] = storageLink.id;
            }

            // Αν δεν είναι ειδικό Link, θεωρείται Sender (από Sources)
            if (!isSpecial) {
                senders.push(link);
            }
        }

        return { senders, receivers, storageLink, controllerLink };
    }
}

module.exports = {STORAGE_LINK_ID,
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const manager = new LinkManager(room);
        manager.run();
    }
};
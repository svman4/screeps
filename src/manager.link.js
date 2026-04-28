/**
 * MANAGER: Link Network
 * VERSION: 1.2.0
 * DESCRIPTION: Διαχειρίζεται την αυτόματη μεταφορά ενέργειας μεταξύ των Links.
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
       // console.log("Link number "+this.links.length);
        this.categories = this.categorizeLinks();
        
        // TODO: Εκτύπωση categories στη κονσόλα (Ολοκληρώθηκε)
       //  this.debugCategories(); 
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
            // Έλεγχος αν ο Sender έχει ενέργεια (τουλάχιστον 200 για να αξίζει το transfer fee)
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) < 200 || sender.cooldown > 0) {
                continue;
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1: Controller (Upgrading)
            if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                sender.transferEnergy(controllerLink);
                continue; 
            }

            // ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2: Storage
            if (storageLink && storageLink.id !== sender.id && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) {
                sender.transferEnergy(storageLink);
                continue;
            }
        }
    }

    /**
     * Κατηγοριοποιεί τα links βάσει θέσης.
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

            if (controller && link.pos.inRangeTo(controller, 4)) {
                controllerLink = link;
                receivers.push(link);
                isSpecial = true;
            } 
            else if (storage && link.pos.inRangeTo(storage, 2)) {
                storageLink = link;
                isSpecial = true;
            }

            if (!isSpecial) {
                senders.push(link);
            }
        }

        return { senders, receivers, storageLink, controllerLink };
    }
}

module.exports = {
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const manager = new LinkManager(room);
        manager.run();
    }
};
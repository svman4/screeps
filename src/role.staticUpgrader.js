var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // --- 1. ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ ΡΟΛΟΥ (UPGRADE / WITHDRAW) ---
        
        // Όταν τελειώσει η ενέργεια, επιστρέφει σε Withdraw mode
        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            // creep.say('🔄 withdraw');
	    }
        // Όταν γεμίσει ενέργεια, επιστρέφει σε Upgrade mode
	    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
	        creep.memory.upgrading = true;
	        // creep.say('⚡ upgrade');
	    }

        // ----------------------------------
        // 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΑΣ (UPGRADE)
        // ----------------------------------
	    if(creep.memory.upgrading) {
            // Ο Upgrader πηγαίνει πάντα στον Controller
	        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                // Χρησιμοποιούμε reusePath: 5 για βελτιστοποίηση της κίνησης
	            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}, reusePath: 5}); 
	        }
            // Δεν υπάρχει επιστροφή (return) εδώ, γιατί θέλουμε το creep να συνεχίσει να δουλεύει στο ίδιο tick 
            // αν είναι ήδη σε range ή μόλις έφτασε.
	    }
        
        // ----------------------------------
        // 3. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (WITHDRAW / PULL)
        // ----------------------------------
	    else {
            // 3.1. Βρίσκουμε την κοντινότερη πηγή ενέργειας (Container, Storage, Terminal, Link)
            const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Ελέγχουμε δομές που έχουν αποθηκευμένη ενέργεια
                    return (structure.structureType == STRUCTURE_CONTAINER || 
                            structure.structureType == STRUCTURE_STORAGE ||
                            structure.structureType == STRUCTURE_TERMINAL) && 
                           structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            // // 3.2. Επίσης, ελέγχουμε για πεταμένη ενέργεια στο έδαφος (Dropped Energy)
            // const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            //     filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
            // });
            
            //let target = null;
            
            // Προτεραιότητα: Πάντα η πεταμένη ενέργεια (Dropped Energy)
            //  if (droppedEnergy) {
            //      target = droppedEnergy;
            //  } else if (energySource) {
            //      target = energySource;
            //  }
            target=energySource;
            if(target) {
                // Αν ο στόχος είναι δομή (Container, Storage)
                if (target.structureType) { 
                    if(creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 5}); // Πορτοκαλί διαδρομή
                    }
                } 
                // Αν ο στόχος είναι Dropped Resource
                else { 
                    if(creep.pickup(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}, reusePath: 5}); // Πορτοκαλί διαδρομή
                    }
                }
            } else {
                // Εναλλακτικά: Αν δεν βρεθεί ενέργεια, ας περιμένει δίπλα στον Controller
                // για να μην ξοδεύει ενέργεια σε άσκοπες μετακινήσεις.
                // Αυτό είναι σημαντικό γιατί ο Upgrader δεν έχει άλλη δουλειά να κάνει (όπως ο Builder)
                // Επειδή είναι αδρανής, τον μετακινούμε πάνω στον Controller.
                if(creep.pos.getRangeTo(creep.room.controller) > 3) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}, reusePath: 5});
                }
            }
        }
	}
};

module.exports = roleUpgrader;

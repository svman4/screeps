/**
 * role.hauler.js
 * Ο ρόλος του Hauler (Μεταφορέας) είναι να μεταφέρει ενέργεια από τις πηγές (Containers, Storage) 
 * προς τους καταναλωτές (Spawn, Extension, Tower, Controller).
 */
var roleHauler = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // ----------------------------------
        // 1. ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ ΡΟΛΟΥ (TRANSFER / WITHDRAW)
        // ----------------------------------
        // Όταν αδειάσει, επιστρέφει σε Withdraw mode
        if(creep.memory.transferring && creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.transferring = false;
             //creep.say('🔄 pull');
	    }
        // Όταν γεμίσει ενέργεια, επιστρέφει σε Transfer mode
	    if(!creep.memory.transferring && creep.store.getFreeCapacity() == 0) {
	        creep.memory.transferring = true;
	         //creep.say('🚚 push');
	    }

        // ----------------------------------
        // 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΑΣ (TRANSFER - Μεταφορά/Γέμισμα)
        // ----------------------------------
	    if(creep.memory.transferring) {
            
            const extensions = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Προτεραιότητα: Extension, Spawn, Tower (για άμυνα)
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ) && 
                           structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if(extensions.length > 0) {
                // Βρίσκουμε τον πιο κοντινό στόχο για να μεταφέρουμε ενέργεια
                const target = creep.pos.findClosestByPath(extensions);
                
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#0000ff'}}); // Μπλε διαδρομή για τροφοδοσία
                }
                return;
            }
            
            
            // Βρίσκουμε στόχους που χρειάζονται ενέργεια (Extensions, Spawns, Towers)
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Προτεραιότητα: Extension, Spawn, Tower (για άμυνα)
                    return (structure.structureType == STRUCTURE_TOWER) && 
                           structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0.90;
                }
            });
            
            if(targets.length > 0) {
                // Βρίσκουμε τον πιο κοντινό στόχο για να μεταφέρουμε ενέργεια
                const target = creep.pos.findClosestByPath(targets);
                
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#0000ff'}}); // Μπλε διαδρομή για τροφοδοσία
                }
                return;
            } 
            // Αν όλα είναι γεμάτα, αποθηκεύουμε στο Storage ή τροφοδοτούμε τον Controller (όπως ο Builder)
            const storage = creep.room.storage;
        
            if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if(creep.transfer(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {visualizePathStyle: {stroke: '#ff00ff'}}); // Φούξια διαδρομή για Storage
                }
                return; // Τελειώνουμε το tick, είτε μεταφέρουμε είτε κινούμαστε
            } 
            
            
            // Προτεραιότητα 2 (Fallback): Upgrade Controller (αν το Storage είναι γεμάτο ή δεν υπάρχει)
            else {
                
                if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}}); // Μωβ διαδρομή για Upgrade
                } else {
                    return; // Τελειώνουμε το tick, είτε κάνουμε upgrade είτε κινούμαστε
                }
            }
            
	    }
        
        // ----------------------------------
        // 3. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (WITHDRAW - Τράβηγμα/Γέμισμα)
        // ----------------------------------
	    else {
            // 3.1. Προτεραιότητα: Dropped Energy (ενέργεια στο έδαφος)
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 100
            });

             if (droppedEnergy) {
                 if(creep.pickup(droppedEnergy) == ERR_NOT_IN_RANGE) {
                     creep.moveTo(droppedEnergy, {visualizePathStyle: {stroke: '#00ff00'}}); // Πράσινη διαδρομή
                 }
                 return; // Τελειώνουμε το tick, ο hauler κινείται προς την πεταμένη ενέργεια
             }

            // 3.2. Δευτερεύουσα Προτεραιότητα: Containers, Storage, Terminal
            const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Ψάχνουμε δομές που έχουν αποθηκευμένη ενέργεια
                    return (structure.structureType == STRUCTURE_CONTAINER || 
                            structure.structureType == STRUCTURE_STORAGE ||
                            structure.structureType == STRUCTURE_TERMINAL) && 
                           structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if(energySource) {
                if(creep.withdraw(energySource, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}}); // Πορτοκαλί διαδρομή
                }
            } else {
                // Αν δεν υπάρχει ενέργεια στα containers, περιμένουμε κοντά στο Spawn για εξοικονόμηση ενέργειας.
                 const currentSpawn = creep.room.find(FIND_MY_SPAWNS)[0];
                 if (currentSpawn && creep.pos.getRangeTo(currentSpawn) > 3) {
                     creep.moveTo(currentSpawn, {visualizePathStyle: {stroke: '#aaaaaa'}});
                 }
            }
        }
	}
};

module.exports = roleHauler;

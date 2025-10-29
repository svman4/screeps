var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // --- 1. ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ ΡΟΛΟΥ (BUILD / WITHDRAW) ---
        
        // Όταν τελειώσει η ενέργεια, επιστρέφει σε Withdraw mode
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            // creep.say('🔄 withdraw');
        }
        // Όταν γεμίσει ενέργεια, επιστρέφει σε Build/Repair mode
        if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
            // creep.say('🚧 work');
        }
        
        // ----------------------------------
        // 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΩΝ (BUILD / REPAIR / UPGRADE)
        // ----------------------------------
        if(creep.memory.building) {
            
            // 2.1. Βρίσκουμε κατεστραμμένες δομές για ΕΠΙΣΚΕΥΗ (Repair Priority)
            const targetsToRepair = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Μόνο δομές που χτυπήθηκαν:
                    if (structure.hits === structure.hitsMax) return false;
                    
                    // Προτεραιότητα: Όλα εκτός από τείχη/ramparts
                    if (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) {
                        return structure.hits < structure.hitsMax * 0.9; // Επισκευή αν πέσει κάτω από 90%
                    }
                    
                    // Τείχη (WALL) και Ramparts: επισκευή μόνο αν έχουν πολύ χαμηλή ζωή
                    if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
                        // Χαμηλό όριο για να μην επισκευάζουν συνέχεια τα τεράστια Walls
                        return structure.hits < 50000; 
                    }
                    
                    return false;
                }
            });
            
            // Αν βρεθεί στόχος για επισκευή, δίνουμε προτεραιότητα σε αυτόν
            if (targetsToRepair.length > 0) {
                // Βρίσκουμε τον πιο κοντινό στόχο επισκευής
                const target = creep.pos.findClosestByPath(targetsToRepair);
                if (creep.repair(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}, reusePath: 5}); // Πράσινη διαδρομή
                    return; 
                }
            }


            // 2.2. Αν δεν υπάρχουν δομές για επισκευή, προχωράμε σε ΚΑΤΑΣΚΕΥΗ (Build Priority)
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if(targets.length) {
                // Βρίσκουμε το κοντινότερο εργοτάξιο
                const closestSite = creep.pos.findClosestByPath(targets);
                if(creep.build(closestSite) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestSite, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 5}); // Λευκή διαδρομή
                }
                return; 
            }
            
            // 2.3. Αν δεν υπάρχει τίποτα για επισκευή ή κατασκευή, αναβαθμίζουμε τον Controller
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}, reusePath: 5}); // Μωβ διαδρομή
            }

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

            // 3.2. Επίσης, ελέγχουμε για πεταμένη ενέργεια στο έδαφος (Dropped Energy)
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
            });
            
            let target = null;
            
            // Προτεραιότητα: Πάντα η πεταμένη ενέργεια (Dropped Energy), καθώς χάνεται
            if (droppedEnergy) {
                target = droppedEnergy;
            } else if (energySource) {
                target = energySource;
            }
            
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
                // Εναλλακτικά: Αν δεν βρεθεί ενέργεια για τράβηγμα, ας κάνει Upgrade Controller 
                // για να μην μένει αδρανής (ενώ περιμένει τους Static Harvesters να γεμίσουν το Container)
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}, reusePath: 5});
                }
            }
        }
    }
};

module.exports = roleBuilder;

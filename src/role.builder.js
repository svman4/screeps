var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // ----------------------------------
        // ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ ΡΟΛΟΥ (BUILD / HARVEST)
        // ----------------------------------
        // Όταν τελειώσει η ενέργεια, επιστρέφει σε Harvest mode
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            //creep.say('🔄 harvest');
        }
        // Όταν γεμίσει ενέργεια, επιστρέφει σε Build/Repair mode
        if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
            //creep.say('🚧 work');
        }
        
        // ----------------------------------
        // ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΩΝ (BUILD / REPAIR)
        // ----------------------------------
        if(creep.memory.building) {
            
            // 1. Βρίσκουμε κατεστραμμένες δομές για ΕΠΙΣΚΕΥΗ (Repair Priority)
            // Ψάχνουμε για δρόμους, τείχη (WALL) ή άλλα αντικείμενα που έχουν πέσει κάτω από ένα όριο
            const targetsToRepair = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Ελέγχουμε αν η δομή έχει χτυπηθεί κάτω από ένα ποσοστό (π.χ. 10% για τείχη/δρόμους)
                    // ή αν δεν είναι τείχος/rampart και θέλουμε να είναι πάντα full (π.χ. Container, Spawn)
                    
                    // Δρόμοι και Containers: επισκευή αν πέσουν κάτω από το 50%
                    if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) {
                        return structure.hits < structure.hitsMax * 0.5;
                    }
                    // Τείχη (WALL) και Ramparts: επισκευή μόνο αν έχουν πολύ χαμηλή ζωή (π.χ. < 50.000)
                    if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
                        // Αντικαταστήστε το 50000 με ένα επίπεδο επισκευής που επιθυμείτε
                        return structure.hits < 50000; 
                    }
                    // Όλες οι άλλες δομές (Spawn, Extension, κλπ.): επισκευή αν είναι κατεστραμμένες
                    return structure.hits < structure.hitsMax;
                }
            });
            
            // Αν βρεθεί στόχος για επισκευή, δίνουμε προτεραιότητα σε αυτόν
            if (targetsToRepair.length > 0) {
                // Βρίσκουμε τον πιο κοντινό στόχο επισκευής
                const target = creep.pos.findClosestByPath(targetsToRepair);
                if (creep.repair(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}}); // Πράσινη διαδρομή για επισκευή
                    return; // Ο creep κινείται/επισκευάζει, τελειώνει το tick
                }
            }


            // 2. Αν δεν υπάρχουν δομές για επισκευή, προχωράμε σε ΚΑΤΑΣΚΕΥΗ (Build Priority)
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if(targets.length) {
                if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}}); // Λευκή διαδρομή για κατασκευή
                }
                return; // Ο creep κινείται/χτίζει, τελειώνει το tick
            }
            
            // 3. Αν δεν υπάρχει τίποτα για επισκευή ή κατασκευή, αναβαθμίζουμε τον Controller
            // Αυτό είναι σημαντικό ώστε ο Builder να μην κάθεται αδρανής
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#cc66cc'}}); // Μωβ διαδρομή για upgrade
            }

        }
        
        // ----------------------------------
        // ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (HARVEST)
        // ----------------------------------
        else {
            // Αυτή η ενότητα παραμένει για την απλή συλλογή ενέργειας από την πηγή 0
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}}); // Πορτοκαλί διαδρομή για συλλογή
            }
        }
    }
};

module.exports = roleBuilder;
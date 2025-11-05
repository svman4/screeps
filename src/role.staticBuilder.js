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
		if( creep.memory.building) {

			if(this.buildingNewStructures(creep)){return;};
			if (this.repairStructures(creep)) {return;}

			// 2C. FALLBACK: UPGRADE CONTROLLER
			// Αν δεν υπάρχει ούτε Build ούτε Repair, ο Builder βοηθάει στην αναβάθμιση.
            if (this.upgradeController(creep,creep.room.controller)) {return;}			
			
			return; // Τελείωσε η εργασία (είτε Build, είτε Repair, είτε Upgrade)
		}

		// ----------------------------------
		// 3. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (WITHDRAW / PULL)
		// ----------------------------------
		else {
			// 3.1. Αναζήτηση Dropped Energy (Υψηλή Προτεραιότητα)
			const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
				filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 50
			});

			// 3.2. Αναζήτηση Αποθηκευμένης Ενέργειας (Δομές)
			const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
				filter: (structure) => {
					// Ελέγχουμε δομές που έχουν αποθηκευμένη ενέργεια > 50
					return (structure.structureType == STRUCTURE_CONTAINER ||
							structure.structureType == STRUCTURE_STORAGE ||
							structure.structureType == STRUCTURE_TERMINAL) &&
						structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
				}
			});

			let target = null;

			// Προτεραιότητα: Dropped Energy > Stored Energy
			if (droppedEnergy) {
				target = droppedEnergy;
			} else if (energySource) {
				target = energySource;
			}

			if(target) {
				// Αν ο στόχος είναι δομή (Container, Storage)
				if (target.structureType) {
					if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
						creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 }); // Πορτοκαλί
					}
				}
				// Αν ο στόχος είναι Dropped Resource (χρησιμοποιούμε pickup)
				else {
					if (creep.pickup(target) == ERR_NOT_IN_RANGE) {
						creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 }); // Πορτοκαλί
					}
				}
			} else {
				// Αν δεν βρεθεί ενέργεια, ας περιμένει δίπλα στον Controller ή στο Spawn (δεν είναι λάθος, αλλά βελτίωση)
				// Ο κώδικας σου δεν είχε fallback κίνησης εδώ.
			}
		}
	}, // end of run

	buildingNewStructures:function(creep) {
		var targets = creep.room.find(FIND_CONSTRUCTION_SITES);

		if(targets && targets.length) {
			const closestSite = creep.pos.findClosestByPath(targets);
			if(!closestSite) {
				return false;
			}
			// Αν είμαστε εκτός εμβέλειας 3, μετακινούμαστε
			if (creep.build(closestSite) == ERR_NOT_IN_RANGE) {
				creep.moveTo(closestSite, {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 5}); // Λευκή διαδρομή
			}
			return true;
		}
		return false;
	} // end of buildingNewStructures
	,
	upgradeController:function(creep,controller) { 
	    if(!controller) { 
	        return false;
	    }
	    creep.say("Upgrade");
	    if (creep.pos.inRangeTo(controller,3)) {
	        creep.upgradeController();
	    } else { 
	        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#cc66cc' }, reusePath: 5 });
	        
	    }
	   return true;     
	} // end of upgradeController()
    ,
	repairStructures:function(creep) {
		const targetsToRepair = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				// Μόνο δομές που χτυπήθηκαν
				if (structure.hits === structure.hitsMax) return false;

				// Προτεραιότητα: Όλα εκτός από τείχη/ramparts
				if (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) {
					return structure.hits < structure.hitsMax * 0.9; // Επισκευή αν πέσει κάτω από 90%
				}

				// Τείχη (WALL) και Ramparts: επισκευή μόνο αν έχουν πολύ χαμηλή ζωή (μικρό όριο)
				if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
					// Ένα πιο λογικό όριο για να μην ασχολείται ο Builder, εκτός αν κινδυνεύει
					return structure.hits < 5000;
				}

				return false;
			}
		});

		// Αν βρεθεί στόχος για επισκευή
		if (targetsToRepair.length > 0) {
			const target = creep.pos.findClosestByPath(targetsToRepair);
			// Αν είμαστε εκτός εμβέλειας 3, μετακινούμαστε
			if (creep.repair(target) == ERR_NOT_IN_RANGE) {
				creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}, reusePath: 5}); // Πράσινη διαδρομή
			}
			return true;
		}
		return false;
	} // end of repairStructures

};

module.exports = roleBuilder;
/**
 * role.hauler.js
 * Ο ρόλος του Hauler (Μεταφορέας) είναι να μεταφέρει ενέργεια από τις πηγές (Containers, Storage) 
 * προς τους καταναλωτές (Spawn, Extension, Tower, Controller).
 */
var roleHauler = {

	/** * @param {Creep} creep Το αντικείμενο Creep που εκτελεί αυτόν τον ρόλο. 
	 **/
	run: function(creep) {


		// ----------------------------------
		// 1. ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ ΡΟΛΟΥ (TRANSFER / WITHDRAW)
		// ----------------------------------
		// Όταν αδειάσει τελείως, αλλάζει σε Withdraw mode (συλλογή ενέργειας)
		if (creep.memory.transferring && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
			creep.memory.transferring = false;
			//creep.say('🔄 pull'); // Αλλαγή σε λειτουργία συλλογής
		}
		// Όταν γεμίσει ενέργεια (δεν έχει καθόλου ελεύθερο χώρο), αλλάζει σε Transfer mode (διανομή ενέργειας)
		if (!creep.memory.transferring && creep.store.getFreeCapacity() === 0) {
			creep.memory.transferring = true;
			//creep.say('🚚 push'); // Αλλαγή σε λειτουργία διανομής
		}
        
        
        
        
        
		// ----------------------------------
		// 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΑΣ (TRANSFER - Μεταφορά/Γέμισμα)
		// ----------------------------------
		if (creep.memory.transferring) {
			
			// Οι προτεραιότητες δίνονται με τη σειρά που καλούνται:
			
			// 2.1. Προτεραιότητα 1: Γέμισμα Towers (Άμυνα)
			if (this.fillTowers(creep) === true) { return; }
			
			// 2.2. Προτεραιότητα 2: Γέμισμα Spawns/Extensions (Αναπαραγωγή Creeps)
			if (this.fillExtensionSpawn(creep) === true) { return; }
			
			// 2.3. Προτεραιότητα 3: Γέμισμα Storage (Αποθήκευση πλεονάζουσας ενέργειας)
			if (this.fillStorage(creep) === true) { return; }

			// 2.4. Προτεραιότητα 4: Κατασκευή Construction Sites (Αν υπάρχει πλεονάζουσα ενέργεια)
     		//	if (this.fixConstructionSites(creep) === true) { return; }
	        	
			// 2.5. Προτεραιότητα 5: Upgrade του Room Controller (Αύξηση RCL)
			if (this.upgradeRoomController(creep,creep.memory.homeRoom) === true) { return; }
		}

		// ----------------------------------
		// 3. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (WITHDRAW - Τράβηγμα/Γέμισμα)
		// ----------------------------------
		else {

			// 3.2. Προτεραιότητα 2: Link κοντά στον Controller (Ενέργεια για Upgrader)

			if(creep.room.memory.controllerLink) { 
                
                if (this.harvestFromLink(creep,creep.room.memory.controllerLink) ===true) { return; }
			}
			
			    
			// 3.1. Προτεραιότητα 1: Dropped Energy (ενέργεια στο έδαφος)
			let source = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
				filter: (resource) => resource.resourceType === RESOURCE_ENERGY &&
					resource.amount > 100 // Συλλέγουμε μόνο αν είναι αρκετή ποσότητα
			});
			
			if (source) {
				creep.say("🎁 Dropped");
				if (creep.pickup(source) == ERR_NOT_IN_RANGE) {
					creep.moveTo(source, {
						visualizePathStyle: { stroke: '#00ff00' }, // Πράσινη διαδρομή
						reusePath: 10
					}); 
				}
				return; // Τελειώνουμε το tick, ο hauler κινείται προς την πεταμένη ενέργεια
			}

			// 3.3. Προτεραιότητα 3: Containers, Storage, Terminal (Γενικές Πηγές)
			// Ψάχνουμε για την πιο κοντινή δομή με αποθηκευμένη ενέργεια (Containers, Storage, Terminal)
			source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
				filter: (structure) => {
					// Ελέγχουμε αν είναι Container Ή Storage Ή Terminal
					return (structure.structureType === STRUCTURE_CONTAINER ||
						
						structure.structureType === STRUCTURE_TERMINAL) &&
						// Και αν έχει αρκετή ενέργεια για να αξίζει τον κόπο
						structure.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
				}
			});

			if (source) {
				//creep.say("Pull");
				if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
					creep.moveTo(source, {
						visualizePathStyle: { stroke: '#ffaa00' }, // Πορτοκαλί διαδρομή
						reusePath: 10
					}); 
			    }
			    return;
			}
			
			
			
			
			{
				// 3.4. Τελευταία Προτεραιότητα: Idle (Αναμονή)
				// Αν δεν υπάρχει ενέργεια στα containers/storage, περιμένουμε κοντά στο Spawn για εξοικονόμηση ενέργειας.
				const currentSpawn = creep.room.find(FIND_MY_SPAWNS)[0];
				if (currentSpawn && creep.pos.getRangeTo(currentSpawn) > 3) {
					creep.say("🅿️ Idle");
					creep.moveTo(currentSpawn, {
						visualizePathStyle: { stroke: '#aaaaaa' }, // Γκρι διαδρομή για αναμονή
						reusePath: 10
					});
				}
			}
		}
	} // end of run
	,
	harvestFromLink:function(creep,link) { 
	   	/** @type {StructureLink} */
	   	const controllerLink = Game.getObjectById(link);
    	// Ελέγχουμε αν το Link υπάρχει και αν έχει τουλάχιστον 200 ενέργεια για να αξίζει το withdraw
	   	if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 200) { 
	       	creep.say("Link"); 
		    if (creep.withdraw(controllerLink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
	    	    // Κινούμαστε προς το Link
    	    	creep.moveTo(controllerLink, {
	   		    	visualizePathStyle: { stroke: '#ffaa00' }, // Πορτοκαλί διαδρομή
    				reusePath: 10
			    });
			} else if (creep.withdraw(controllerLink, RESOURCE_ENERGY) === OK) {
                // Επιτυχές withdraw (μπορεί να γίνει και την ίδια στιγμή που φτάνει αν είναι in range)
                // Δε χρειάζεται return εδώ, συνεχίζει
            }
			return true; // Τελειώνουμε το tick, είτε τραβάμε είτε κινούμαστε προς το link
		}
		return false;
    }, // end of harvestFromLink
	/**
	 * Αναλαμβάνει την κατασκευή Construction Sites.
	 * @param {Creep} creep
	 * @returns {boolean} true αν βρέθηκε στόχος, false αν όχι.
	 */
	fixConstructionSites: function(creep) {
		// Εύρεση όλων των Construction Sites στο δωμάτιο
		const targets = creep.room.find(FIND_CONSTRUCTION_SITES);

		if (targets.length) {
			creep.say("🛠️ Build");
		if( creep.pos.inRangeTo(targets[0],4) ) {
		    creep.build(targets[0]);
		} else {
		    creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } }); // Λευκή διαδρομή για κατασκευή
		}
		return true;
		}
		return false;
	} // end of fixConstructionSites()
	,
	/**
	 * Αναλαμβάνει το Upgrade του Room Controller.
	 * @param {Creep} creep
	 * @returns {boolean} true, καθώς πάντα προσπαθούμε να κάνουμε upgrade αν φτάσουμε εδώ.
	 */
	upgradeRoomController: function(creep) {
		//creep.say("⏫ Upgr");
		// Αν είναι εντός εμβέλειας (range 3), κάνει upgrade
		const controller=Game.rooms[creep.memory.homeRoom].controller;
		if (controller) { 
		    
		    if (creep.pos.inRangeTo(controller, 3)) {
			    creep.upgradeController(controller);
		    } else {
    			// Αν δεν είναι εντός εμβέλειας, κινείται προς τον Controller
	    		creep.moveTo(controller, { visualizePathStyle: { stroke: '#cc66cc' } }); // Μωβ διαδρομή για Upgrade
	    		
		    }
		    return true;
		}
		return false; // Τελειώνουμε το tick, είτε κάνουμε upgrade είτε κινούμαστε

	} // end of upgradeRoomController()
	,
	/**
	 * Γεμίζει το Storage με την πλεονάζουσα ενέργεια.
	 * @param {Creep} creep
	 * @returns {boolean} true αν βρήκε Storage και το γεμίζει, false αν όχι.
	 */
	fillStorage: function(creep) {
		const storage = creep.room.storage;

		// Ελέγχουμε αν υπάρχει Storage και αν έχει ελεύθερο χώρο
		if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
		//	creep.say("📦 Storage");
			
			if (creep.pos.inRangeTo(storage, 1)) {
				creep.transfer(storage, RESOURCE_ENERGY);
			} else {
				creep.moveTo(storage, {
					visualizePathStyle: { stroke: '#ff00ff' } // Φούξια διαδρομή για Storage
				}); 
			}

			return true; // Τελειώνουμε το tick, είτε μεταφέρουμε είτε κινούμαστε
		}
		return false;

	} // end of fillStorage
	,
	/**
	 * Γεμίζει Extensions και Spawns (κρίσιμες δομές αναπαραγωγής).
	 * @param {Creep} creep
	 * @returns {boolean} true αν βρήκε στόχο, false αν όχι.
	 */
	fillExtensionSpawn: function(creep) {
		const targets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				// Ψάχνουμε για Extensions Ή Spawns με ελεύθερο χώρο
				return (structure.structureType === STRUCTURE_EXTENSION ||
					structure.structureType === STRUCTURE_SPAWN) &&
					structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
			}
		});

		if (targets && targets.length > 0) {
		//	creep.say("💧 Refuel");
			// Βρίσκουμε τον πιο κοντινό στόχο για να μεταφέρουμε ενέργεια
			const target = creep.pos.findClosestByPath(targets);
			if (target) {
				if (creep.pos.inRangeTo(target, 1)) {
					creep.transfer(target, RESOURCE_ENERGY);
				} else {
					creep.moveTo(target, {
						visualizePathStyle: { stroke: '#0000ff' }, // Μπλε διαδρομή για τροφοδοσία
						reusePath: 50
					}); 
				}
				return true;
			}
		}
		return false;
	} // end of fillExtensionSpawn
	,
	/**
	 * Γεμίζει τους Towers (Προτεραιότητα #1 για άμυνα).
	 * @param {Creep} creep
	 * @returns {boolean} true αν βρήκε πύργο, false αν όχι.
	 */
	fillTowers: function(creep) {
		let targets = [];
		targets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				// Ψάχνουμε για Towers που τους λείπει ενέργεια
				return (structure.structureType === STRUCTURE_TOWER) &&
					structure.store.getFreeCapacity(RESOURCE_ENERGY) > 100; // Αν έχει χώρο για τουλάχιστον 100
			}
		});

		if (targets && targets.length > 0) {
		//	creep.say("🛡️ Tower");
			// Βρίσκουμε τον πιο κοντινό στόχο για να μεταφέρουμε ενέργεια
			const target = creep.pos.findClosestByPath(targets);
			if (target) {
				if (creep.pos.inRangeTo(target, 1)) {
					creep.transfer(target, RESOURCE_ENERGY);
				} else {
					creep.moveTo(target, {
						visualizePathStyle: { stroke: '#ff0000' }, // Κόκκινη διαδρομή για Tower
						reusePath: 50
					}); 
				}
			}
			return true;
		}
		return false;
	} // end of fillTowers()
}; //end of roleHauler

module.exports = roleHauler;

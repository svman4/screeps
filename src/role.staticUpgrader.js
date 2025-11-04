var roleUpgrader = {

	/** @param {Creep} creep **/
	run: function(creep) {

		// --- 0. ΒΟΗΘΗΤΙΚΕΣ ΑΝΑΖΗΤΗΣΕΙΣ (Controller Link & Storage) ---
		// Αναζητούμε το Link κοντά στον Controller (εντός εμβέλειας 6 tiles) και το Storage.
		// NOTE: Ένας Upgrader που δουλεύει με Link συνήθως είναι στα 3 tiles από τον Controller
		// και ταυτόχρονα στα 1 tile από το Link.
		var controllerLink = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 6, {
			filter: (s) => s.structureType == STRUCTURE_LINK
		})[0];

		const storage = creep.room.storage;
		
		// 0.1. Βοηθητική μεταβλητή για την εξαίρεση
		// Πρόκειται για έναν Upgrader που είναι επιφορτισμένος να "αδειάζει" το link
		// για να μεταφερθεί ενέργεια στο Storage, όταν αυτό είναι άδειο (για λόγους bootstrapping ή έκτακτης ανάγκης).
		// Αν δεν χρησιμοποιείται αυτή η λογική, μπορείτε να αφαιρέσετε τα is_draining_link.
		if (creep.memory.is_draining_link === undefined) {
			creep.memory.is_draining_link = false;
		}

		// ----------------------------------
		// 1. ΛΟΓΙΚΗ ΑΛΛΑΓΗΣ MODE (Upgrade <-> Withdraw)
		// ----------------------------------

		// A. Λογική αλλαγής mode για την ΤΥΠΙΚΗ ΡΟΗ (Upgrade <-> Withdraw)
		// Ισχύει μόνο όταν ΔΕΝ εκτελείται η εξαίρεση.
		if (!creep.memory.is_draining_link) {
			// Όταν τελειώσει η ενέργεια, επιστρέφει σε Withdraw mode
			if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
				creep.memory.upgrading = false;
			}
			// Όταν γεμίσει ενέργεια, επιστρέφει σε Upgrade mode
			if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
				creep.memory.upgrading = true;
			}
		} 
		// B. Λογική αλλαγής mode για την ΕΞΑΙΡΕΣΗ (Link -> Storage)
		else { 
			// Τερματίζουμε την εξαίρεση: Αν το Link είναι άδειο Ή αν το Storage γέμισε
			if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) == 0 ||
				storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
				creep.memory.is_draining_link = false;
				// Επειδή τερματίσαμε την εξαίρεση, γυρνάμε σε Upgrade mode για να δουλέψει την ενέργεια που έχει πάνω του.
				creep.memory.upgrading = true; 
			}
		}

		// ----------------------------------
		// 2. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΑΣ (SPECIAL DRAIN, UPGRADE, ή WITHDRAW)
		// ----------------------------------

		// 2A. ΕΚΤΕΛΕΣΗ ΕΞΑΙΡΕΣΗΣ (Link -> Storage) - ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ
		
		// Πότε ξεκινάει η εξαίρεση; Αν υπάρχει Link & Storage, το Link είναι γεμάτο (ή σχεδόν)
		// και το Storage είναι άδειο (ή σχεδόν), και ο Upgrader είναι γεμάτος
		if (controllerLink && storage && !creep.memory.is_draining_link &&
			controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() * 0.9 &&
			storage.store.getUsedCapacity(RESOURCE_ENERGY) < 1000) {
			
			creep.memory.is_draining_link = true;
			creep.memory.upgrading = true; // Ξεκινάει με transfer
		}

		if (creep.memory.is_draining_link) {
			// Λογική: γεμίζουμε -> μεταφέρουμε στο storage -> αδειάζουμε -> γεμίζουμε
			
			// 1. Άδειασμα (Transfer)
			if (creep.memory.upgrading) {
				if (creep.transfer(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
					creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 5 });
				}
				// Αν αδειάσει, επιστρέφουμε σε "Withdraw mode" για να ξαναγεμίσει
				if (creep.store[RESOURCE_ENERGY] == 0) {
					creep.memory.upgrading = false;
				}
			} 
			// 2. Γέμισμα (Withdraw)
			else {
				if (creep.withdraw(controllerLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
					creep.moveTo(controllerLink, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 });
				}
				// Αν γεμίσει, επιστρέφουμε σε "Transfer mode" για να αδειάσει στο Storage
				if (creep.store.getFreeCapacity() == 0) {
					creep.memory.upgrading = true;
				}
			}
			return; // ΤΕΛΟΣ ΕΚΤΕΛΕΣΗΣ: Η εξαίρεση έχει την υψηλότερη προτεραιότητα
		}
		
		// 2B. ΕΚΤΕΛΕΣΗ ΕΡΓΑΣΙΑΣ (UPGRADE) - Τυπική Ροή
		if (creep.memory.upgrading) {
			// Ο Upgrader πηγαίνει πάντα στον Controller
			const room=Game.rooms[creep.memory.homeRoom];
			if(!room) {
			    creep.say("no room found");
			    
			    return;
			}
			const controller=room.controller;
			if(creep.pos.inRangeTo(controller,3) ) {
			    creep.upgradeController(room.controller) 
			} else {
			    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#cc66cc' }, reusePath: 50 });
			}
		}

		// 2C. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (WITHDRAW / PULL) - Τυπική Ροή
		else { // !creep.memory.upgrading
			let target = null;
			
			// **ΠΡΟΤΕΡΑΙΟΤΗΤΑ 1: Controller Link** (το βέλτιστο για Upgrader)
			// Εφόσον υπάρχει το link και έχει ενέργεια
			if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
				target = controllerLink;
			}
			
			// **ΠΡΟΤΕΡΑΙΟΤΗΤΑ 2: Κοντινότερη Πηγή** (Container, Storage, Terminal, Link)
			if (!target) {
				const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
					filter: (structure) => {
						// Ελέγχουμε δομές που έχουν αποθηκευμένη ενέργεια > 100
						return (structure.structureType == STRUCTURE_CONTAINER ||
							structure.structureType == STRUCTURE_STORAGE ||
							structure.structureType == STRUCTURE_TERMINAL ||
							structure.structureType == STRUCTURE_LINK) &&
							structure.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
					}
				});
				target = energySource;
			}

			if (target) {
				// Εκτελούμε Withdraw
				if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
					creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 }); // Πορτοκαλί διαδρομή
				}
			} else {
				// Εναλλακτικά: Αν δεν βρεθεί ενέργεια, ας περιμένει δίπλα στον Controller
				if (creep.pos.getRangeTo(creep.room.controller) > 3) {
					creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#cc66cc' }, reusePath: 5 });
				}
			}
		}
	} // end of run
};

module.exports = roleUpgrader;
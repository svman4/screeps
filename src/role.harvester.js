/**
 * role.staticHarvester.js
 * * Ο ρόλος του Static Harvester είναι να κάθεται μόνιμα σε ένα τετράγωνο (πάνω από Container)
 * και να συλλέγει συνεχώς ενέργεια από την Source, μεταφέροντάς την αμέσως στο Container.
 * Αναλαμβάνει επίσης την αυτό-επιδιόρθωση του Container.
 *
 * ΣΗΜΕΙΩΣΗ: Όλες οι άλλες ενέργειες (Transfer σε Extensions, Build, Upgrade)
 * ανατίθενται στον ρόλο "Hauler" ή "Builder".
 */
var staticHarvester = {

	/** @param {Creep} creep **/
	run: function(creep, roomLevel=1) {
		// --- 1. ΑΝΑΖΗΤΗΣΗ ΣΤΟΧΩΝ (Cache Targets) ---
		if (roomLevel < 2) {
			this.runSimpleHarvester(creep);
			return;
		}
		// Ο Static Harvester πρέπει να ξέρει ποια Source και ποιο Container εξυπηρετεί.
		// Εδώ υποθέτουμε ότι η Source ID είναι αποθηκευμένη στη μνήμη.
		// Αν δεν υπάρχει, βρίσκουμε την κοντινότερη ως προεπιλογή.

		if (!creep.memory.sourceId) {
			const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
			if (closestSource) {
				creep.memory.sourceId = closestSource.id;
			} else {
				return; // Δεν βρέθηκε Source
			}
		}

		const source = Game.getObjectById(creep.memory.sourceId);

		// --- 2. ΤΟΠΟΘΕΤΗΣΗ (Initial Move) ---

		// Αν ο Creep δεν βρίσκεται σε απόσταση harvest, κινείται προς τη Source.
		if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
			creep.moveTo(source, {
				visualizePathStyle: { stroke: '#ffaa00' }, // Πορτοκαλί διαδρομή
				// reusePath: 50
			});
			// Σημαντικό: Μόλις φτάσει, δεν πρέπει να ξανα-τρέξει αυτό το μπλοκ.
			return;
		}

		// Ο Creep είναι πλέον στη θέση εξόρυξης. Εκτελείται η κύρια λογική.

		// --- 3. ΚΥΡΙΑ ΔΡΑΣΗ: HARVEST ---
		// Κάνει harvest. Αυτή η εντολή πρέπει να εκτελείται συνεχώς.
		creep.harvest(source);

		// --- 4. ΔΕΥΤΕΡΕΥΟΥΣΑ ΔΡΑΣΗ: REPAIR (Αυτο-Συντήρηση του Container) ---

		// Βρίσκει το Container/Link στο τετράγωνο του Harvester (ή δίπλα).
		const structureToMaintain = creep.pos.findInRange(FIND_STRUCTURES, 1, {
			filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK) &&
				s.hits < s.hitsMax * 0.8 // Επιδιορθώνουμε όταν φτάσει το 80%
		})[0];

		// Αν βρεθεί κτίριο για επιδιόρθωση και ο Creep έχει ενέργεια για Repair
		if (structureToMaintain && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			creep.repair(structureToMaintain);
			// Σημείωση: Ο repair cost είναι 1 ενέργεια ανά 100 hits.
		}

		// --- 5. ΤΡΙΤΕΥΟΥΣΑ ΔΡΑΣΗ: TRANSFER (Μεταφορά Ενέργειας) ---

		// Βρίσκουμε το Container ή Link για μεταφορά.
		// Τοποθετούμε το Container στην μνήμη για καλύτερη απόδοση.
		if (!creep.memory.containerId) {
			const nearbyContainer = creep.pos.findInRange(FIND_STRUCTURES, 1, {
				filter: (s) => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK
			})[0];
			if (nearbyContainer) {
				creep.memory.containerId = nearbyContainer.id;
			}
		}

		const targetContainer = Game.getObjectById(creep.memory.containerId);

		// Αν ο Creep έχει ενέργεια (από το harvest) και υπάρχει Container
		// Μεταφέρει την ενέργεια στο Container/Link.
		if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && targetContainer) {
			// Αν ο Harvester κάθεται ακριβώς πάνω στο Container, η ενέργεια μεταφέρεται
			// αυτόματα αν το store του creep είναι γεμάτο. Ωστόσο, το transfer() είναι πιο clean.
			creep.transfer(targetContainer, RESOURCE_ENERGY);
		} else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			// Αν δεν βρέθηκε Container (πρέπει να χτιστεί) απλώς πετάμε την ενέργεια.
			// Η ενέργεια θα πέσει στο τετράγωνο και θα συλλεχθεί από το Container μόλις χτιστεί
			// ή από Haulers.
			creep.drop(RESOURCE_ENERGY);
		}

		// ΤΕΛΟΣ: Η λογική επιστρέφει και ξαναρχίζει το Harvest στον επόμενο tick.
	} // end of run
	,
	runSimpleHarvester: function(creep) {


		// --- ΕΝΑΛΛΑΓΗ ΚΑΤΑΣΤΑΣΗΣ (State Switching) ---
		// Σημείωση: Χρησιμοποιούμε 'working' αντί για 'harvesting' για μεγαλύτερη σαφήνεια.
		// 'noWorking' = true όταν μεταφέρει/χτίζει/κάνει upgrade (ξοδεύει ενέργεια).
		// 'n Working' = false όταν συλλέγει (γεμίζει).
		if (!creep.memory.hasOwnProperty('working')) {
			creep.memory.working = false;
		}

		// Αν ήταν σε λειτουργία 'εργασίας' και άδειασε, πρέπει να επιστρέψει στη συλλογή.
		if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
			creep.memory.working = false; // Ξεκινάει η συλλογή
			//  creep.say('⛏️ harvest');
		}
		// Αν ήταν σε λειτουργία 'συλλογής' και γέμισε, αρχίζει την εργασία.
		if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
			creep.memory.working = true; // Ξεκινάει η μεταφορά/εργασία
			//   creep.say('🚚 transfer');
		}

		// ----------------------------------
		// 1. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (HARVEST)
		// ----------------------------------
		if (creep.memory.working === false) {
			// Βρίσκει ΟΛΕΣ τις πηγές ενέργειας στο δωμάτιο.
			var sources = creep.room.find(FIND_SOURCES);

			// Επιλέγουμε την πρώτη Source ως σταθερή
			const source = sources[0];

			if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
				// Κίνηση προς την πηγή
				creep.moveTo(source, {
					//    visualizePathStyle: {stroke: '#ffaa00'}, // Πορτοκαλί διαδρομή
					//   reusePath: 50 // Αποθήκευση διαδρομής
				});
			}
			return;
		}

		// ----------------------------------
		// 2. ΜΕΤΑΦΟΡΑ ΕΝΕΡΓΕΙΑΣ (TRANSFER)
		// ----------------------------------

		// 2.1. ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Spawns, Extensions)
		// Εξασφαλίζει ότι το σύστημα παραγωγής Creeps λειτουργεί.
		var highPriorityTargets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				return (structure.structureType == STRUCTURE_EXTENSION ||
					structure.structureType == STRUCTURE_SPAWN) &&
					structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
			}
		});

		if (highPriorityTargets.length > 0) {
			const closestTarget = creep.pos.findClosestByPath(highPriorityTargets);
			if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
				creep.moveTo(closestTarget, {
					//    visualizePathStyle: {stroke: '#ffffff'}, 
					reusePath: 10
				});
			}
			return;
		}

		// 2.2. ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Towers, Links)
		// Τροφοδοσία Towers για άμυνα (με ελάχιστο όριο)
		var mediumPriorityTargets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				// Τροφοδοτούμε Towers μέχρι το 80% (αφήνουμε τα τελευταία 20% για τους Towers να το κάνουν)
				const isTower = structure.structureType == STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) < structure.store.getCapacity(RESOURCE_ENERGY) * 0.8;
				// Τροφοδοτούμε Links αν δεν είναι ο Harvester Link (π.χ. Storage Link ή Upgrader Link)
				// Εδώ επιλέγουμε μόνο Towers για απλότητα
				return isTower;
			}
		});

		if (mediumPriorityTargets.length > 0) {
			const closestTarget = creep.pos.findClosestByPath(mediumPriorityTargets);
			if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
				creep.moveTo(closestTarget, {
					//  visualizePathStyle: {stroke: '#ffff00'}, // Κίτρινη διαδρομή
					reusePath: 10
				});
			}
			return;
		}

		// 2.3. ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Storage, Terminal)
		// Αποθήκευση της περίσσειας ενέργειας
		var lowPriorityTargets = creep.room.find(FIND_STRUCTURES, {
			filter: (structure) => {
				return (structure.structureType == STRUCTURE_STORAGE ||
					structure.structureType == STRUCTURE_TERMINAL) &&
					structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
			}
		});

		if (lowPriorityTargets.length > 0) {
			const closestTarget = creep.pos.findClosestByPath(lowPriorityTargets);
			if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
				creep.moveTo(closestTarget, {
					// visualizePathStyle: {stroke: '#00ff00'}, // Πράσινη διαδρομή
					reusePath: 10
				});
			}
			return;
		}

		// ----------------------------------
		// 3. ΕΦΕΔΡΙΚΗ ΛΕΙΤΟΥΡΓΙΑ: BUILD (ΧΤΙΣΙΜΟ)
		// ----------------------------------
		// Αν όλα τα βασικά κτίρια είναι γεμάτα, χτίζουμε Construction Sites.
		const constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
		if (constructionSites.length > 0) {
			const closestSite = creep.pos.findClosestByPath(constructionSites);

			if (creep.build(closestSite) == ERR_NOT_IN_RANGE) {
				creep.moveTo(closestSite, {
					visualizePathStyle: { stroke: '#00ffff' }, // Κυανή διαδρομή για Build
					reusePath: 10
				});
			}
			return;
		}

		// ----------------------------------
		// 4. ΤΕΛΕΥΤΑΙΑ ΕΦΕΔΡΕΙΑ: UPGRADE
		// ----------------------------------
		// Αν δεν υπάρχει τίποτα για χτίσιμο, αναβαθμίζουμε.
		if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
			creep.moveTo(creep.room.controller, {
				visualizePathStyle: { stroke: '#cc66cc' },
				reusePath: 10
			});
		}
	} // end of runSimpleHarvester
};

module.exports = staticHarvester;

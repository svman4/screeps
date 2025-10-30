/*
 * respawController.js - Ελέγχει την ανάγκη και εκτελεί την αναπαραγωγή creeps.
 *
 
 */
// Ορίζουμε τους μέγιστους αριθμούς για τους βοηθητικούς ρόλους
const UPGRADER_MAX = 0; // Μέγιστος αριθμός Upgraders (που τραβούν ενέργεια)
const BUILDER_MAX = 0;  // Μέγιστος αριθμός Builders (που τραβούν ενέργεια)
const HAULER_MAX = 0;
const HARVESTER_MAX = 4;
// Ορίζουμε τον ρόλο του Harvester ως STATIC_HARVESTER
const STATIC_HARVESTER_ROLE = 'harvester';
const STATIC_UPGRADER_ROLE = 'staticUpgrader';
const STATIC_BUILDER_ROLE = "staticBuilder";
const STATIC_HAULER_ROLE = "staticHauler";

const respawController = {

	run: function(roomName) {
		// 1. Καθαρισμός Μνήμης από νεκρά creeps
		for (let name in Memory.creeps) {
			if (!Game.creeps[name]) {
				// Ελέγχουμε αν υπήρχε sourceId για να το απελευθερώσουμε
				if (Memory.creeps[name].role === STATIC_HARVESTER_ROLE && Memory.creeps[name].sourceId) {
					console.log(`🔌 Απελευθερώθηκε Source ID: ${Memory.creeps[name].sourceId}`);
				}
				delete Memory.creeps[name];
				console.log('🚮 Διαγράφηκε μνήμη για νεκρό creep:', name);
			}
		}

		// --- Λογική Spawning ---

		// 3. Ορίζουμε το Spawn που θα χρησιμοποιήσουμε
		const room = Game.rooms[roomName];
		if (!room) {
			console.log(roomName + " no found");
			return;
		}
		const currentSpawn = (room.find(FIND_MY_SPAWNS))[0];

		if (!currentSpawn) {
			console.log("SPawn no found on room " + roomName);
			return;
		}

		if (currentSpawn.spawning) {
			// Εμφάνιση του creep που παράγεται για οπτική επιβεβαίωση
			const spawningCreep = Game.creeps[currentSpawn.spawning.name];
			if (spawningCreep) {
				currentSpawn.room.visual.text(
					'🛠️' + spawningCreep.memory.role,
					currentSpawn.pos.x + 1,
					currentSpawn.pos.y,
					{ align: 'left', opacity: 0.8 }
				);
			}
			return;
		}

		const roomLevel = Memory.rooms[roomName].constructionLevel;
		const freeEnergy = room.energyAvailable;
		if (!roomLevel || !freeEnergy) {
			console.log("error on roomLevel or freeEnergy");
			return;
		}


		// 2. Βρίσκουμε όλα τα creeps ανά ρόλο
		const creeps = room.find(FIND_MY_CREEPS);
		const harvesters = _.filter(creeps, (creep) => creep.memory.role === STATIC_HARVESTER_ROLE);
		const upgraders = _.filter(creeps, (creep) => creep.memory.role === STATIC_UPGRADER_ROLE);
		const builders = _.filter(creeps, (creep) => creep.memory.role === STATIC_BUILDER_ROLE);
		const haulers = _.filter(creeps, (creep) => creep.memory.role === STATIC_HAULER_ROLE);

		let result = [];
		var harvesterMax = HARVESTER_MAX;
		if (roomLevel > 2) {
			const sources = room.find(FIND_SOURCES);
			harvesterMax = sources.length;
		}
		
		// --- 4. ΕΛΕΓΧΟΣ ΑΝΑΓΚΗΣ ΔΗΜΙΟΥΡΓΙΑΣ (Με σειρά προτεραιότητας) ---

		// 4.1. Static Harvesters (ΥΨΗΛΟΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
		// Ορίζουμε το μέγιστο των Static Harvesters ίσο με τον αριθμό των Sources.

		if (harvesters.length < harvesterMax) {
			if (roomLevel < 2) {
				result = this.createNewHarvester(currentSpawn, roomLevel, freeEnergy, null);
			} else {
				// Βρίσκουμε ποιες Sources είναι ήδη δεσμευμένες
				const assignedSourceIds = harvesters.map(creep => creep.memory.sourceId).filter(id => id);
				const sources = room.find(FIND_SOURCES);
				// Βρίσκουμε μια ελεύθερη Source
				const freeSource = sources.find(source => !assignedSourceIds.includes(source.id));

				if (freeSource) {
					result = this.createNewHarvester(currentSpawn, roomLevel, freeEnergy, freeSource.id);
				} else if (harvesters.length === 0) {
					// Αν δεν υπάρχει κανένας Harvester, φτιάχνουμε τον 1ο με την κοντινότερη Source
					const closestSource = currentSpawn.pos.findClosestByPath(FIND_SOURCES);
					if (closestSource) {
						result = this.createNewHarvester(currentSpawn, roomLevel, freeEnergy, closestSource.id);
					}
				}
			}
		}
		else if (haulers.length < HAULER_MAX) {
			result = createNewHaulers(currentSpawn);


		}
		// 4.2. Upgraders (ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
		// Σημείωση: Δεν ελέγχουμε αν υπάρχει ενέργεια. Αυτό το κάνει το role.upgrader.js.
		else if (upgraders.length < UPGRADER_MAX) {
			result = createNewUpgrader(currentSpawn);
		}

		// 4.3. Builders (ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ - Μόνο αν υπάρχει Construction Site)
		else if (builders.length < BUILDER_MAX) {
			const constructionSites = currentSpawn.room.find(FIND_CONSTRUCTION_SITES);
			// Ελέγχουμε αν υπάρχει κάτι για χτίσιμο ΠΡΙΝ φτιάξουμε builder
			if (constructionSites.length > 0) {
				result = createNewBuilder(currentSpawn);
			}
		}

		// --- 5. ΑΠΟΤΕΛΕΣΜΑ ΔΗΜΙΟΥΡΓΙΑΣ ---
		if (result.length > 0 && result[0] === OK) {
			const newCreep = Game.creeps[result[1]];
			if (newCreep) {
				console.log(`🛠️ Ξεκίνησε η δημιουργία νέου creep (${result[1]}). Ρόλος: ${newCreep.memory.role}`);
			}
		} else if (result.length > 0 && result[0] === ERR_NOT_ENOUGH_ENERGY) {
			// console.log('Δεν υπάρχει αρκετή ενέργεια για να φτιαχτεί το creep.');
		}
	} // end of run
	,
	createNewHarvester: function(currentSpawn, roomLevel, freeEnergy, sourceId = null) {


		// Δημιουργία μοναδικού ονόματος με χρήση του Game.time
		const newName = 'Harv' + Game.time;
		
		let bodyParts;
		const bodyType = STATIC_HARVESTER_ROLE;
		if (roomLevel < 2) {
			bodyParts = [WORK, CARRY, MOVE]; // 200 Energy (Starter)
			const creepMemory = { memory: { role: bodyType, sourceId } };

					// Καλούμε τη μέθοδο spawnCreep()
					let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
			return result;
		}

		// Ο Static Harvester χρειάζεται MAX WORK και ΕΝΑ CARRY + MOVE
		if (freeEnergy >= 600) {
			bodyParts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 600 Energy (5 WORK, 1 CARRY, 1 MOVE)
		} else if (freeEnergy >= 500) {
			bodyParts = [WORK, WORK, WORK, WORK, CARRY, MOVE]; // 500 Energy (4 WORK, 1 CARRY, 1 MOVE)
		} else if (enerfreeEnergygyCapacity >= 300) {
			bodyParts = [WORK, WORK, CARRY, MOVE]; // 300 Energy (2 WORK, 1 CARRY, 1 MOVE)
		}

		// Ορισμός της μνήμης (memory) με τον ρόλο ΚΑΙ το sourceId!
		const creepMemory = { memory: { role: bodyType, sourceId: sourceId } };

		// Καλούμε τη μέθοδο spawnCreep()
		let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
		return result;
	} // end fof createNewHarvester



};

// ===========================================
// ΛΟΓΙΚΗ ΔΗΜΙΟΥΡΓΙΑΣ CREP (Helper Functions)
// ===========================================
createNewHaulers = function(currentSpawn) {
	const energyCapacity = currentSpawn.room.energyCapacityAvailable;
	let bodyParts;
	const bodyType = STATIC_HAULER_ROLE;

	// Ο Hauler χρειάζεται MAX CARRY/MOVE και καθόλου WORK
	if (energyCapacity > 800) {
		// 800 Energy: 8 CARRY, 8 MOVE (Χρησιμοποιήθηκε 1:1, όχι 1:2)
		bodyParts = [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
			MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
	} else if (energyCapacity >= 500) {
		// 500 Energy: 5 CARRY, 5 MOVE
		bodyParts = [WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
	} else if (energyCapacity >= 300) {
		// 300 Energy: 3 CARRY, 3 MOVE
		bodyParts = [WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
	} else {
		// 200 Energy (Starter): 2 CARRY, 2 MOVE
		bodyParts = [CARRY, CARRY, MOVE, MOVE];
	}
	const newName = bodyType + Game.time;
	const creepMemory = { memory: { role: bodyType } };

	let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
	return result;
};

createNewBuilder = function(currentSpawn) {
	const energyCapacity = currentSpawn.room.energyCapacityAvailable;
	let bodyParts;
	const bodyType = STATIC_BUILDER_ROLE;

	// Εστίαση σε balanced body για Builder/Mobile Worker (WORK, CARRY, MOVE)
	if (energyCapacity > 800) {
		bodyParts = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]; // 800 Energy (4W, 4C, 4M)
	} else if (energyCapacity >= 550) {
		bodyParts = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; // 550 Energy (3W, 2C, 3M)
	} else if (energyCapacity >= 300) {
		bodyParts = [WORK, CARRY, CARRY, MOVE, MOVE]; // 300 Energy (1W, 2C, 2M)
	} else {
		bodyParts = [WORK, CARRY, MOVE]; // 200 Energy (Starter)
	}

	const newName = bodyType + Game.time;
	const creepMemory = { memory: { role: bodyType } };

	let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
	return result;
};

// Τροποποιημένη συνάρτηση για Static Harvester


createNewUpgrader = function(currentSpawn) {
	const energyCapacity = currentSpawn.room.energyCapacityAvailable;
	let bodyParts;
	const bodyType = 'staticUpgrader';

	// Ο Upgrader χρειάζεται πολλά WORK parts και CARRY/MOVE για να τραβάει ενέργεια
	// Work parts: 100, Carry: 50, Move: 50
	if (energyCapacity >= 1000) {
		bodyParts = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 1000 Energy (9W, 1C, 1M)
	} else if (energyCapacity >= 600) {
		bodyParts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 600 Energy (5 WORK, 1 CARRY, 1 MOVE)
	} else if (energyCapacity >= 400) {
		bodyParts = [WORK, WORK, WORK, CARRY, MOVE]; // 400 Energy (3 WORK, 1 CARRY, 1 MOVE)
	} else {
		bodyParts = [WORK, CARRY, MOVE]; // 200 Energy (Starter)
	}

	const newName = bodyType + Game.time;
	const creepMemory = { memory: { role: bodyType } };

	let result = [currentSpawn.spawnCreep(bodyParts, newName, creepMemory), newName];
	return result;
};
showPopuationInfo = function() {
	console.log("Hauler is " + haulers.length + "/" + HAULER_MAX);
}

module.exports = respawController;

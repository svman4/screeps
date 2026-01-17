/*
 * manager.spawn.js
 */

const ROLES = {
    STATIC_HARVESTER: 'staticHarvester',
    SIMPLE_HARVESTER: 'simpleHarvester',
    HAULER: 'hauler',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    LD_HARVESTER: 'LDHarvester',
    LD_HAULER: 'LDHauler',
    CLAIMER: 'claimer',
    SCOUT: 'scout',
    SUPPORTER: 'supporter',
    MINER: "miner"
};

const SUPPORTER_LIMIT_PER_ROOM = 2;
const REMOTE_SPAWNING_STORE_LIMIT=600000
const respawController = {
    
    run: function(roomName) {
        // ΒΗΜΑ 1: ΕΞΟΙΚΟΝΟΜΗΣΗ CPU
        if (Game.time % 5 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;
        
        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory || !roomMemory.populationLimits || Game.time%3000===0) {
            initPopulation(roomName);
        }
        
        // ΒΗΜΑ 2: ΚΑΘΑΡΙΣΜΟΣ ΜΝΗΜΗΣ
        this.cleanupDeadCreeps(roomName);
        
        // ΒΗΜΑ 3: ΕΠΙΒΛΕΨΗ SPAWNS
        const allSpawns = room.find(FIND_MY_SPAWNS);
        allSpawns.forEach(s => {
            if (s.spawning) this.showSpawningInfo(s);
        });
        
        const spawn = this.findAvailableSpawn(roomName);
        if (!spawn) return;

        const populationMax = Memory.rooms[roomName].populationLimits;
        const population = this.analyzePopulation(roomName);
        
        // ΒΗΜΑ 4: ΛΗΨΗ ΑΠΟΦΑΣΗΣ
        this.decideAndSpawnCreep(spawn, roomName, population, populationMax);
    },

    /**
     * Κύρια λογική προτεραιοτήτων
     */
    decideAndSpawnCreep: function(spawn, roomName, population, populationLimit) {
        const room = spawn.room;
        const rcl = room.controller ? room.controller.level : 1;
        
        // 1. ΑΠΟΛΥΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: ΕΠΙΒΙΩΣΗ (Local Economy)
        if (this.needSimpleHarvester(room, population, populationLimit)) {
            return this.createSimpleHarvester(spawn, roomName);
        }
        
        if (this.needStaticHarvester(room, population, populationLimit)) {
            return this.createStaticHarvester(spawn, roomName);
        }
        
        if (this.needHauler(room, population, populationLimit)) {
            return this.createHauler(spawn, roomName, rcl, 900);
        }

        // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: ΕΞΩΤΕΡΙΚΕΣ ΑΠΟΣΤΟΛΕΣ (Remote Ops)
        // Περιλαμβάνει Capital Support, Claimers, Scouts, Remote Mining
        if (this.handleRemoteSpawning(spawn, roomName, population, populationLimit)) {
            return;
        }

        // 3. ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: ΑΝΑΠΤΥΞΗ (Local Growth)
        if (this.needUpgrader(population, populationLimit)) {
            return this.createUpgrader(spawn, roomName, rcl,1200);
        }
        
        if (this.needBuilder(room, population, populationLimit)) {
            return this.createBuilder(spawn, roomName, rcl,1200);
        }
        if (this.lookForMiner(spawn,room,rcl)===true) return;
        
    },
    lookForMiner: function(spawn, room, rcl) { 
        // Το όριο ποσότητας πάνω από το οποίο σταματάμε την εξόρυξη
        const MINERAL_MARKET_LIMIT = 2000;
        
        // Εύρεση όλων των κοιτασμάτων (minerals) στο δωμάτιο
        const minerals = room.find(FIND_MINERALS);
        
        // Αν δεν υπάρχουν mineral στο δωμάτιο, σταμάτα τη διαδικασία
        if (!minerals.length) { 
            return false;
        }
    
        // Φιλτράρισμα των υπαρχόντων creeps για να βρούμε όσα είναι ήδη Miners σε αυτό το δωμάτιο
        const existedMiners = _.filter(Game.creeps, c => 
            c.memory.role === ROLES.MINER && c.memory.homeRoom === room.name
        );
    
        for (let mineral of minerals) {
            // 1. Έλεγχος για Extractor: Το mineral δεν μπορεί να εξορυχθεί χωρίς την ειδική κατασκευή
            const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => 
                s.structureType === STRUCTURE_EXTRACTOR
            );
            
            // Αν δεν υπάρχει Extractor, προχώρα στο επόμενο mineral
            if (!extractor) { 
                continue;
            }
            
            // 2. Έλεγχος Ανάθεσης: Αν υπάρχει ήδη creep που έχει αναλάβει αυτό το συγκεκριμένο mineral (mineralId)
            const isAssigned = existedMiners.some(c => c.memory.mineralId === mineral.id);
            if (isAssigned) {
                continue;
            }
            
            // 3. Έλεγχος Αποθέματος: Αν το κοίτασμα είναι άδειο (mineralAmount === 0), πήγαινε στο επόμενο
            if (mineral.mineralAmount === 0) {
                continue;
            }
            
            // 4. Έλεγχος Αποθήκης (Terminal): Αν έχουμε ήδη αρκετό από αυτό το υλικό στην αποθήκη μας
            // Χρησιμοποιούμε το mineral.mineralType για να δούμε το συγκεκριμένο είδος (π.χ. Η, Ο, U)
            const totalInMarket = room.terminal ? room.terminal.store[mineral.mineralType] || 0 : 0;
            if (totalInMarket >= MINERAL_MARKET_LIMIT) {
                continue;
            }
            
            // 5. Προετοιμασία Σώματος και Μνήμης για το νέο Creep
            // Το σώμα περιλαμβάνει WORK για εξόρυξη, CARRY για μεταφορά και MOVE για κίνηση
            let body = [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
            const creepName = `miner_${room.name}_${Game.time}`;
            
            const creepMemory = { 
                memory: { 
                    role: ROLES.MINER, 
                    mineralId: mineral.id, // Ανάθεση του ID του mineral στο creep
                    homeRoom: room.name,
                    working: false 
                } 
            };
    
            // Προσπάθεια δημιουργίας του creep. Αν πετύχει (=== OK), η συνάρτηση επιστρέφει true
            return spawn.spawnCreep(body, creepName, creepMemory) === OK;
        }
        
        // Αν φτάσουμε εδώ, σημαίνει ότι δεν χρειαζόταν ή δεν μπορούσε να δημιουργηθεί miner
        return false;
    },
/**
     * Διαχείριση αποστολών εκτός δωματίου
     */
    handleRemoteSpawning: function(spawn, roomName, population, populationLimit) {
        const room = spawn.room;
        
        // --- Fix για το neighborRooms error ---
        let neighborRooms = room.memory.neighbors;
        
        // Αν είναι undefined/null, το κάνουμε κενό array
        if (!neighborRooms) {
            neighborRooms = [];
        } 
        // Αν ΔΕΝ είναι πίνακας (άρα είναι Object), παίρνουμε τα κλειδιά (ονόματα δωματίων)
        else if (!Array.isArray(neighborRooms)) {
            neighborRooms = Object.keys(neighborRooms);
        }
        
        
        // --- A. CAPITAL SUPPORT ---
        const capitalName = Memory.capital;
        if (capitalName && capitalName !== roomName && room.storage && room.storage.store[RESOURCE_ENERGY] > REMOTE_SPAWNING_STORE_LIMIT) {
            
            // Αν η πρωτεύουσα είναι γειτονική.
            if (this.isRoomAdjacent(roomName, capitalName)) {
                const capitalRoom = Game.rooms[capitalName];
                // Αν το capital είναι χαμηλό RCL ή έχει κτίρια
                const needsSupport = !capitalRoom || (capitalRoom.controller && capitalRoom.controller.level < 8) || capitalRoom.find(FIND_CONSTRUCTION_SITES).length > 0;
                const activeSupporters = _.filter(Game.creeps, c => 
                    c.memory.role === ROLES.SUPPORTER && 
                    c.memory.homeRoom === roomName && 
                    c.memory.targetRoom === capitalName
                );
                if (needsSupport && activeSupporters.length < SUPPORTER_LIMIT_PER_ROOM) {
                    console.log(`🏛️ ${roomName}: Sending Capital Support to ${capitalName}`);
                    return this.createSupporter(spawn, roomName, capitalName, 2500);
                }
            }
        }
		
		if (this.helpNearingRoom(spawn,room)===true) {
			return true;
		}
        // --- B. SCOUTS ---
        const scoutTarget = _.findKey(Memory.rooms, (r) => r.scoutNeeded === true);
        if (scoutTarget && this.isSpawningAllowed(roomName, scoutTarget)) {
            const existingScout = _.find(Game.creeps, c => c.memory.role === ROLES.SCOUT && c.memory.targetRoom === scoutTarget);
            if (!existingScout) return this.createScout(spawn, roomName, scoutTarget);
        }

        // --- C. CLAIMERS ---
        const claimTarget = _.findKey(Memory.rooms, (r) => r.type === 'claim_target');
        if (claimTarget && this.isSpawningAllowed(roomName, claimTarget)) {
            const existingClaimer = _.find(Game.creeps, c => c.memory.role === ROLES.CLAIMER && c.memory.targetRoom === claimTarget);
            if (!existingClaimer) return this.createClaimer(spawn, roomName, claimTarget, 5000);
        }

        
            
        return false;
    },
	helpNearingRoom:function(spawn,room) { 
		let neighborRooms = room.memory.neighbors;
        
        // Αν είναι undefined/null, το κάνουμε κενό array
        if (!neighborRooms) {
            neighborRooms = [];
        } 
        // Αν ΔΕΝ είναι πίνακας (άρα είναι Object), παίρνουμε τα κλειδιά (ονόματα δωματίων)
        else if (!Array.isArray(neighborRooms)) {
            neighborRooms = Object.keys(neighborRooms);
        }
		if (neighborRooms.length===0)  {
			return false;
		}
		// --- D. INITIAL SETUP (Για νέα δωμάτια - Γείτονες) ---
        for (const targetNeighbor of neighborRooms) {
            const neighborMemory = Memory.rooms[targetNeighbor];
            
            // Ελέγχουμε αν ο γείτονας έχει τύπο 'initial_setup'
            if (neighborMemory && neighborMemory.type === 'initial_setup') {
                
                // Αν το δωμάτιο έχει αναπτυχθεί (RCL 4+), αφαιρούμε το flag και πάμε στον επόμενο
                const setupRoom = Game.rooms[targetNeighbor];
                if (setupRoom && setupRoom.controller && setupRoom.controller.level > 4) {
                    delete Memory.rooms[targetNeighbor].type;
                    continue; 
                }

                // Έλεγχος πληθυσμού για το συγκεκριμένο γείτονα
                const setupCreeps = _.filter(Game.creeps, c => c.memory.homeRoom===room.name && c.memory.targetRoom === targetNeighbor);
                
                // Αν λείπουν supporters
                if (setupCreeps.filter(c => c.memory.role === ROLES.SUPPORTER).length < SUPPORTER_LIMIT_PER_ROOM) {
                    return this.createSupporter(spawn, room.name, targetNeighbor);
                }

                
            }
            if (neighborMemory && neighborMemory.type === 'remote_mining') {
                const miningRoomName = targetNeighbor; 
                if (miningRoomName && this.isSpawningAllowed(room.name, miningRoomName)) {
                    const remoteHarvesters = _.filter(Game.creeps, 
					c => c.memory.role === ROLES.LD_HARVESTER && c.memory.targetRoom === miningRoomName).length;
                    if (remoteHarvesters < 1) {
                        return this.createLDHarvester(spawn, room.name, miningRoomName);
                    }
                }    
            }
        } // για όλους τους γείτονες.
        if (room && room.controller.level===8 &&  room.storage.store[RESOURCE_ENERGY] > REMOTE_SPAWNING_STORE_LIMIT ) {
			return this.supportNeighbors(spawn, room.name);
        }
	},
    supportNeighbors: function(spawn, roomName) { 
		const room = spawn.room;
		
		// Εξαγωγή λίστας γειτονικών δωματίων
		let neighborRooms = room.memory.neighbors;
		
		// Αν δεν υπάρχουν γείτονες, επιστροφή
		if (!neighborRooms || neighborRooms.length === 0) {
			return false;
		}
		
		// Αν το neighborRooms είναι Object, μετατροπή σε πίνακα
		if (!Array.isArray(neighborRooms)) {
			neighborRooms = Object.keys(neighborRooms);
		}
		
		// Διάσχιση όλων των γειτονικών δωματίων
		for (const targetNeighbor of neighborRooms) {
			// Παράβλεψη του τρέχοντος δωματίου
			if (targetNeighbor === roomName) continue;
			
			// Αναζήτηση γειτονικού δωματίου στο Game
			const neighborRoom = Game.rooms[targetNeighbor];
			if (!neighborRoom) continue; // Αν το δωμάτιο δεν είναι ορατό, συνέχιση
			
			// Έλεγχος εάν το γειτονικό δωμάτιο ανήκει στον παίκτη
			if (!neighborRoom.controller || !neighborRoom.controller.my) continue;
			if (neighborRoom.controller.level===8) continue;
			// Εύρεση υφιστάμενων supporters για αυτό το δωμάτιο
			const existingSupporters = _.filter(Game.creeps, c => 
				c.memory.role === ROLES.SUPPORTER && 
				c.memory.homeRoom === roomName && 
				c.memory.targetRoom === targetNeighbor
			);
			
			// Αν δεν έχουν φτάσει το όριο
			if (existingSupporters.length < SUPPORTER_LIMIT_PER_ROOM) {
				console.log(`🔄 ${roomName}: Στέλνει υποστηρικτή στο γειτονικό δωμάτιο ${targetNeighbor}`);
				return this.createSupporter(spawn, roomName, targetNeighbor, 2500)===OK;
			}
		}
		
		return false;
	},
    // --- HELPER FUNCTIONS ---

    cleanupDeadCreeps: function(roomName) {
        for (let creepName in Memory.creeps) {
            if (!Game.creeps[creepName]) {
                delete Memory.creeps[creepName];
            }
        }
    },
    
    findAvailableSpawn: function(roomName) {
        const room = Game.rooms[roomName];
        const spawns = room.find(FIND_MY_SPAWNS);
        return _.find(spawns, s => !s.spawning) || null;
    },
    
    showSpawningInfo: function(spawn) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        if (spawningCreep) {
            spawn.room.visual.text(`🛠️ ${spawningCreep.memory.role}`, spawn.pos.x + 1, spawn.pos.y, { align: 'left', opacity: 0.8 });
        }
    },
    
    analyzePopulation: function(roomName) {
        const allCreeps = _.filter(Game.creeps, (creep) => creep.memory.homeRoom === roomName || creep.memory.targetRoom === roomName);
        const population = {};
        for (let key in ROLES) {
            population[ROLES[key]] = allCreeps.filter(c => c.memory.role === ROLES[key]).length;
        }
        return population;
    },

    isRoomAdjacent: function(fromRoom, toRoom) {
        if (fromRoom === toRoom) return true;
        const exits = Game.map.describeExits(fromRoom);
        return _.some(exits, exit => exit === toRoom);
    },

    isSpawningAllowed: function(spawnRoom, targetRoom) {
        return spawnRoom === targetRoom || this.isRoomAdjacent(spawnRoom, targetRoom);
    },

    // --- CHECKS ---

    needStaticHarvester: function(room, population, populationMax) {
        return population[ROLES.STATIC_HARVESTER] < populationMax.STATIC_HARVESTER;
    },
    
    needSimpleHarvester: function(room, population, populationMax) {
        const current = population[ROLES.SIMPLE_HARVESTER];
        if (current >= populationMax.SIMPLE_HARVESTER) return false;
        const noEnergyEco = population[ROLES.STATIC_HARVESTER] === 0 || population[ROLES.HAULER] === 0;
        return noEnergyEco && current < 1;
    },
    
    needHauler: function(room, population, populationMax) {
        return population[ROLES.HAULER] < populationMax.HAULER;
    },
    
    needUpgrader: function(population, populationMax) {
        return population[ROLES.UPGRADER] < populationMax.UPGRADER;
    },
    
    needBuilder: function(room, population, populationMax) {
        
        return population[ROLES.BUILDER] < populationMax.BUILDER;
    },

    // --- SPAWN CREATION ---

    createStaticHarvester: function(spawn, roomName) {
        const sources = spawn.room.find(FIND_SOURCES);
        const existing = _.filter(Game.creeps, c => c.memory.role === ROLES.STATIC_HARVESTER && c.memory.homeRoom === roomName);
        const assigned = existing.map(c => c.memory.sourceId);
        const freeSource = sources.find(s => !assigned.includes(s.id));
        if (!freeSource) return false;

        const energy = spawn.room.energyCapacityAvailable;
        let body = [WORK, WORK, CARRY, MOVE];
        if (energy >= 600) body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE];
        
        return spawn.spawnCreep(body, `Static_${Game.time}`, { memory: { role: ROLES.STATIC_HARVESTER, sourceId: freeSource.id, homeRoom: roomName } }) === OK;
    },

    createSimpleHarvester: function(spawn, roomName) {
        return spawn.spawnCreep([WORK, CARRY, MOVE], `Simple_${Game.time}`, { memory: { role: ROLES.SIMPLE_HARVESTER, homeRoom: roomName } }) === OK;
    },

    createHauler: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 100) {
            body.push(CARRY, MOVE);
            energy -= 100;
        }
        body.sort();
        return spawn.spawnCreep(body, `Hauler_${Game.time}`, { memory: { role: ROLES.HAULER, homeRoom: roomName } }) === OK;
    },

    createUpgrader: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) {
            body.push(WORK, CARRY, MOVE, MOVE);
            energy -= 250;
        }
        body.sort();
        return spawn.spawnCreep(body, `Upgrader_${Game.time}`, { memory: { role: ROLES.UPGRADER, homeRoom: roomName } }) === OK;
    },

    createBuilder: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) {
            body.push(WORK, CARRY, MOVE, MOVE);
            energy -= 250;
        }
        body.sort();
        return spawn.spawnCreep(body, `Builder_${Game.time}`, { memory: { role: ROLES.BUILDER, homeRoom: roomName } }) === OK;
    },

    createSupporter: function(spawn, homeRoom, targetRoom, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) {
            body.push(WORK, CARRY, MOVE);
            energy -= 200;
        }
        body.sort();
        const creepName = `Supporter_${homeRoom}_${targetRoom}_${Game.time}`;
        return spawn.spawnCreep(body, creepName, { memory: { role: ROLES.SUPPORTER, homeRoom: homeRoom, targetRoom: targetRoom } }) === OK;
    },

    createScout: function(spawn, homeRoom, targetRoom) {
        return spawn.spawnCreep([MOVE], `Scout_${homeRoom}_${targetRoom}_${Game.time}`, { memory: { role: ROLES.SCOUT, homeRoom: homeRoom, targetRoom: targetRoom } }) === OK;
    },

    createClaimer: function(spawn, homeRoom, targetRoom, maxPreferredEnergy = 2000) {
        let energy = spawn.room.energyCapacityAvailable;
        energy = Math.min(energy, maxPreferredEnergy);
        let body = [];
        let currentCost = 0;
        const CORE_BODY = [MOVE, CLAIM];
        const CORE_COST = 650;
        while (currentCost + CORE_COST < energy) {
            body = body.concat(CORE_BODY);
            currentCost += CORE_COST;
        }
        while (currentCost + 250 <= energy) {
            body.push(MOVE, MOVE, WORK, CARRY);
            currentCost += 250;
        }
        while (currentCost + 100 <= energy) {
            body.push(MOVE, CARRY);
            currentCost += 100;
        }
        body.sort();
        return spawn.spawnCreep(body, `Claimer_${homeRoom}_${targetRoom}_${Game.time}`, { memory: { role: ROLES.CLAIMER, homeRoom: homeRoom, targetRoom: targetRoom } }) === OK;
    },

    createLDHarvester: function(spawn, roomName, setupRoomName, maxPreferredEnergy = 1500) {
        let energy = spawn.room.energyCapacityAvailable;
        energy = Math.min(energy, maxPreferredEnergy);
        const CORE_BODY = [WORK, CARRY, MOVE, MOVE]; // 250
        const CORE_COST = 250;
        
        let body = [];
        let currentCost = 0;
        
        while (currentCost + CORE_COST <= energy) {
            body = body.concat(CORE_BODY);
            currentCost += CORE_COST;
        }
        while (currentCost + 100 <= energy) {
            body.push(CARRY, MOVE);
            currentCost += 100;
        }
        body.sort();
        const creepName = `LDHarvester_${roomName}_${setupRoomName}_${Game.time}`;
        const sourceId = Memory.rooms[setupRoomName].sources[0];
        return spawn.spawnCreep(body, creepName, { 
            memory: { role: ROLES.LD_HARVESTER, homeRoom: roomName, targetRoom: setupRoomName, source: sourceId, working: false } 
        }) === OK;  
    }
};

function initPopulation(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return;
    const sourceCount = room.find(FIND_SOURCES).length;
    room.memory.populationLimits.SIMPLE_HARVESTER=1;
    
    room.memory.populationLimits.STATIC_HARVESTER= sourceCount;
    room.memory.populationLimits.HAULER= 1+2*sourceCount/3 ;
    if (room.controller.level===8 ) {
        room.memory.populationLimits.UPGRADER= 0;
        room.memory.populationLimits.BUILDER= 1;
    } else {
        room.memory.populationLimits.UPGRADER= 1;
        if(room.storage && room.storage.store[RESOURCE_ENERGY] > 500000) {
            room.memory.populationLimits.BUILDER= sourceCount+2;
        } else {
            room.memory.populationLimits.BUILDER= sourceCount;
        }
    }
    room.memory.populationLimits.lastRcl=room.controller.level;
    
    
    // room.memory.populationLimits.LD_HARVESTER= 0;
    // room.memory.populationLimits.CLAIMER= 0;
    // room.memory.populationLimits.SCOUT= 0;
    // room.memory.populationLimits.SUPPORTER= 0;
    
    
    
    // room.memory.populationLimits = {
    //     SIMPLE_HARVESTER: 1,
    //     STATIC_HARVESTER: sourceCount,
    //     HAULER: sourceCount ,
    //     UPGRADER: sourceCount,
    //     BUILDER: 1,
    //     LD_HARVESTER: 0,
    //     CLAIMER: 0,
    //     SCOUT: 0,
    //     SUPPORTER: 0
    // };
}

module.exports = respawController;
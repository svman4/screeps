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

const SUPPORTER_LIMIT_PER_ROOM = 1;
const REMOTE_SPAWNING_STORE_LIMIT = 600000;
const MAX_SCOUT_DISTANCE = 5; // Μέγιστη απόσταση για αποστολή Scout

const respawController = {

    run: function(roomName) {
        // ΒΗΜΑ 1: ΕΞΟΙΚΟΝΟΜΗΣΗ CPU
        if (Game.time % 5 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory || !roomMemory.populationLimits || Game.time % 3000 === 0) {
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
        // Η handleRemoteSpawning επιστρέφει true μόνο αν όντως ξεκινήσει spawn
        if (this.handleRemoteSpawning(spawn, roomName, population, populationLimit)) {
            return;
        }

        // 3. ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: ΑΝΑΠΤΥΞΗ (Local Growth)
        if (this.needUpgrader(population, populationLimit)) {
            return this.createUpgrader(spawn, roomName, rcl, 1200);
        }

        if (this.needBuilder(room, population, populationLimit)) {
            return this.createBuilder(spawn, roomName, rcl, 1200);
        }

        if (this.lookForMiner(spawn, room, rcl) === true) return;
    },

    lookForMiner: function(spawn, room, rcl) {
        const MINERAL_MARKET_LIMIT = 2000;
        const minerals = room.find(FIND_MINERALS);
        if (!minerals.length) return false;

        const existedMiners = _.filter(Game.creeps, c =>
            c.memory.role === ROLES.MINER && c.memory.homeRoom === room.name
        );

        for (let mineral of minerals) {
            const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s =>
                s.structureType === STRUCTURE_EXTRACTOR
            );
            if (!extractor) continue;

            const isAssigned = existedMiners.some(c => c.memory.mineralId === mineral.id);
            if (isAssigned) continue;

            if (mineral.mineralAmount === 0) continue;

            const totalInMarket = room.terminal ? room.terminal.store[mineral.mineralType] || 0 : 0;
            if (totalInMarket >= MINERAL_MARKET_LIMIT) continue;

            let body = [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
            const creepName = `miner_${room.name}_${Game.time}`;
            const creepMemory = {
                memory: {
                    role: ROLES.MINER,
                    mineralId: mineral.id,
                    homeRoom: room.name,
                    working: false
                }
            };
            return spawn.spawnCreep(body, creepName, creepMemory) === OK;
        }
        return false;
    },

    /**
     * Διαχείριση αποστολών εκτός δωματίου
     */
    handleRemoteSpawning: function(spawn, roomName, population, populationLimit) {
        const room = spawn.room;

        // --- A. CAPITAL SUPPORT ---
        const capitalName = Memory.capital;
        if (capitalName && capitalName !== roomName && room.storage && room.storage.store[RESOURCE_ENERGY] > REMOTE_SPAWNING_STORE_LIMIT) {
            if (this.isRoomWithinRange(roomName, capitalName, 1)) {
                const capitalRoom = Game.rooms[capitalName];
                const needsSupport = !capitalRoom || (capitalRoom.controller && capitalRoom.controller.level < 8) || capitalRoom.find(FIND_CONSTRUCTION_SITES).length > 0;
                const activeSupporters = _.filter(Game.creeps, c =>
                    c.memory.role === ROLES.SUPPORTER &&
                    c.memory.homeRoom === roomName &&
                    c.memory.targetRoom === capitalName
                );
                if (needsSupport && activeSupporters.length < SUPPORTER_LIMIT_PER_ROOM) {
                    console.log(`🏛️ ${roomName}: Sending Capital Support to ${capitalName}`);
                    return this.createSupporter(spawn, roomName, capitalName, 2500) === OK;
                }
            }
        }

        // Βοήθεια σε γειτονικά δωμάτια (Initial Setup / Remote Mining)
        if (this.helpNearingRoom(spawn, room) === true) {
            return true;
        }

        // --- B. SCOUTS (Διευρυμένη αναζήτηση) ---
        // Ψάχνουμε σε όλη τη μνήμη για δωμάτια που χρειάζονται Scout
        const scoutTarget = _.findKey(Memory.rooms, (r) => r.scoutNeeded === true);
        if (scoutTarget) {
            // Έλεγχος αν το δωμάτιο είναι εντός εμβέλειας MAX_SCOUT_DISTANCE
            if (this.isRoomWithinRange(roomName, scoutTarget, MAX_SCOUT_DISTANCE)) {
                const existingScout = _.find(Game.creeps, c => c.memory.role === ROLES.SCOUT && c.memory.targetRoom === scoutTarget);
                if (!existingScout) {
                    console.log(`🔭 ${roomName}: Spawning Scout for ${scoutTarget} (Distance: ${Game.map.getRoomLinearDistance(roomName, scoutTarget)})`);
                    return this.createScout(spawn, roomName, scoutTarget) === OK;
                }
            }
        }

        // --- C. CLAIMERS (Παραμένει γειτονικό ή σύμφωνα με τη λογική σας) ---
        const claimTarget = _.findKey(Memory.rooms, (r) => r.type === 'claim_target');
        if (claimTarget && this.isRoomWithinRange(roomName, claimTarget, 2)) { // Αυξήσαμε λίγο την εμβέλεια για claimers
            const existingClaimer = _.find(Game.creeps, c => c.memory.role === ROLES.CLAIMER && c.memory.targetRoom === claimTarget);
            if (!existingClaimer) {
                console.log(`🚩 ${roomName}: Spawning Claimer for ${claimTarget}`);
                return this.createClaimer(spawn, roomName, claimTarget, 5000) === OK;
            }
        }

        return false;
    },

    helpNearingRoom: function(spawn, room) {
        let neighborRooms = room.memory.neighbors;
        if (!neighborRooms) neighborRooms = [];
        else if (!Array.isArray(neighborRooms)) neighborRooms = Object.keys(neighborRooms);

        if (neighborRooms.length === 0) return false;

        // --- D. INITIAL SETUP / REMOTE MINING ---
        for (const targetNeighbor of neighborRooms) {
            const neighborMemory = Memory.rooms[targetNeighbor];

            if (neighborMemory && neighborMemory.type === 'initial_setup') {
                const setupRoom = Game.rooms[targetNeighbor];
                if (setupRoom && setupRoom.controller && setupRoom.controller.level > 4) {
                    delete Memory.rooms[targetNeighbor].type;
                    continue;
                }

                const setupCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name && c.memory.targetRoom === targetNeighbor);
                if (setupCreeps.filter(c => c.memory.role === ROLES.SUPPORTER).length < SUPPORTER_LIMIT_PER_ROOM) {
                    return this.createSupporter(spawn, room.name, targetNeighbor) === OK;
                }
            }

            if (neighborMemory && neighborMemory.type === 'remote_mining') {
                const miningRoomName = targetNeighbor;
                if (miningRoomName && this.isRoomWithinRange(room.name, miningRoomName, 1)) {
                    const remoteHarvesters = _.filter(Game.creeps,
                        c => c.memory.role === ROLES.LD_HARVESTER && c.memory.targetRoom === miningRoomName).length;
                    if (remoteHarvesters < 1) {
                        return this.createLDHarvester(spawn, room.name, miningRoomName) === OK;
                    }
                }
            }
        }

        if (room && room.controller.level === 8 && room.storage && room.storage.store[RESOURCE_ENERGY] > REMOTE_SPAWNING_STORE_LIMIT) {
            return this.supportNeighbors(spawn, room.name);
        }
        return false;
    },

    supportNeighbors: function(spawn, roomName) {
        const room = spawn.room;
        let neighborRooms = room.memory.neighbors;
        if (!neighborRooms || neighborRooms.length === 0) return false;
        if (!Array.isArray(neighborRooms)) neighborRooms = Object.keys(neighborRooms);

        for (const targetNeighbor of neighborRooms) {
            if (targetNeighbor === roomName) continue;
            const neighborRoom = Game.rooms[targetNeighbor];
            if (!neighborRoom) continue;
            if (!neighborRoom.controller || !neighborRoom.controller.my) continue;
            if (neighborRoom.controller.level === 8) continue;

            const existingSupporters = _.filter(Game.creeps, c =>
                c.memory.role === ROLES.SUPPORTER &&
                c.memory.homeRoom === roomName &&
                c.memory.targetRoom === targetNeighbor
            );

            if (existingSupporters.length < SUPPORTER_LIMIT_PER_ROOM) {
                return this.createSupporter(spawn, roomName, targetNeighbor, 2500) === OK;
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

    /**
     * Ελέγχει αν ένα δωμάτιο είναι εντός συγκεκριμένης γραμμικής απόστασης
     */
    isRoomWithinRange: function(fromRoom, toRoom, maxDist) {
        if (fromRoom === toRoom) return true;
        const dist = Game.map.getRoomLinearDistance(fromRoom, toRoom);
        return dist <= maxDist;
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
        const CORE_BODY = [WORK, CARRY, MOVE, MOVE];
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
        const sourceId = Memory.rooms[setupRoomName] && Memory.rooms[setupRoomName].sources ? Memory.rooms[setupRoomName].sources[0] : null;
        return spawn.spawnCreep(body, creepName, {
            memory: { role: ROLES.LD_HARVESTER, homeRoom: roomName, targetRoom: setupRoomName, source: sourceId, working: false }
        }) === OK;
    }
};

function initPopulation(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return;
    const sourceCount = room.find(FIND_SOURCES).length;
    if (!room.memory.populationLimits) room.memory.populationLimits = {};
    
    room.memory.populationLimits.SIMPLE_HARVESTER = 1;
    room.memory.populationLimits.STATIC_HARVESTER = sourceCount;
    room.memory.populationLimits.HAULER = 1 + 2 * sourceCount / 3;
    if (room.controller.level === 8) {
        room.memory.populationLimits.UPGRADER = 0;
        room.memory.populationLimits.BUILDER = 1;
    } else {
        room.memory.populationLimits.UPGRADER = 1;
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 500000) {
            room.memory.populationLimits.BUILDER = sourceCount + 2;
        } else {
            room.memory.populationLimits.BUILDER = sourceCount;
        }
    }
    room.memory.populationLimits.lastRcl = room.controller.level;
}

module.exports = respawController;
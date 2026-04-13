const expansionManager = require('manager.expansion');

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
const MAX_SCOUT_DISTANCE = 5;

const respawController = {

    run: function(roomName) {
        if (Game.time % 5 !== 0) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory || !roomMemory.populationLimits || Game.time % 3000 === 0) {
            initPopulation(roomName);
        }

        this.cleanupDeadCreeps(roomName);

        const allSpawns = room.find(FIND_MY_SPAWNS);
        allSpawns.forEach(s => {
            if (s.spawning) this.showSpawningInfo(s);
        });

        const spawn = this.findAvailableSpawn(roomName);
        if (!spawn) return;

        const populationMax = Memory.rooms[roomName].populationLimits;
        const population = this.analyzePopulation(roomName);

        this.decideAndSpawnCreep(spawn, roomName, population, populationMax);
    },

    decideAndSpawnCreep: function(spawn, roomName, population, populationLimit) {
        const room = spawn.room;
        const rcl = room.controller ? room.controller.level : 1;

        // 1. ΑΠΟΛΥΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: LOCAL ECONOMY
        if (this.needSimpleHarvester(room, population, populationLimit)) {
            return this.createSimpleHarvester(spawn, roomName);
        }

        if (this.needStaticHarvester(room, population, populationLimit)) {
            return this.createStaticHarvester(spawn, roomName);
        }

        if (this.needHauler(room, population, populationLimit)) {
            return this.createHauler(spawn, roomName, rcl, 900);
        }

        // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: REMOTE OPS (Scouts, Claimers, κτλ)
        if (this.handleRemoteSpawning(spawn, roomName, population, populationLimit)) {
            return;
        }

        // 3. ΤΡΙΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: LOCAL GROWTH
        if (this.needUpgrader(population, populationLimit)) {
            return this.createUpgrader(spawn, roomName, rcl, 1200);
        }

        if (this.needBuilder(room, population, populationLimit)) {
            return this.createBuilder(spawn, roomName, rcl, 1200);
        }

        if (this.lookForMiner(spawn, room, rcl) === true) return;
    },

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
                    return this.createSupporter(spawn, roomName, capitalName, 2500) === OK;
                }
            }
        }

        // --- B. SCOUTS (Integration with ExpansionManager) ---
        const scoutTarget = expansionManager.getScoutTarget();
        if (scoutTarget) {
            if (this.isRoomWithinRange(roomName, scoutTarget, MAX_SCOUT_DISTANCE)) {
                // Έλεγχος αν υπάρχει ήδη scout καθ' οδόν για αυτό το δωμάτιο
                const existingScout = _.find(Game.creeps, c =>
                    c.memory.role === ROLES.SCOUT &&
                    c.memory.targetRoom === scoutTarget
                );

                if (!existingScout) {
                    console.log(`🔭 ${roomName}: Spawning Scout for ${scoutTarget}`);
                    const result = this.createScout(spawn, roomName, scoutTarget);
                    if (result === OK) {
                        // Καθαρίζουμε τη σημαία αμέσως μόλις ξεκινήσει η παραγωγή
                        expansionManager.clearScoutFlag(scoutTarget);
                        return true;
                    }
                }
            }
        }

        // --- C. CLAIMERS ---
        const claimTarget = _.findKey(Memory.rooms, (r) => r.type === 'claim_target');
        if (claimTarget && this.isRoomWithinRange(roomName, claimTarget, 1)) {
            const existingClaimer = _.find(Game.creeps, c =>
                c.memory.role === ROLES.CLAIMER &&
                c.memory.targetRoom === claimTarget
            );
            if (!existingClaimer) {
                console.log(`🚩 ${roomName}: Spawning Claimer for ${claimTarget}`);
                return this.createClaimer(spawn, roomName, claimTarget, 5000) === OK;
            }
        }

        // Βοήθεια σε γειτονικά δωμάτια (Initial Setup / Remote Mining)
        if (this.helpNearingRoom(spawn, room) === true) {
            return true;
        }

        return false;
    },

    helpNearingRoom: function(spawn, room) {
        // Χρησιμοποιούμε το neighbors από τη μνήμη του δωματίου (όπως ορίζεται στο expansionManager)
        let neighborRooms = Memory.rooms[room.name]?.neighbors;
        if (!neighborRooms) return false;

        for (const targetNeighbor of neighborRooms) {
            const neighborMemory = Memory.rooms[targetNeighbor];
            if (!neighborMemory) continue;

            if (neighborMemory.type === 'initial_setup') {
                const setupRoom = Game.rooms[targetNeighbor];
                if (setupRoom?.controller?.my && setupRoom.controller.level > 4) {
                    delete Memory.rooms[targetNeighbor].type;
                    continue;
                }
                const setupCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name && c.memory.targetRoom === targetNeighbor);
                if (setupCreeps.filter(c => c.memory.role === ROLES.SUPPORTER).length < SUPPORTER_LIMIT_PER_ROOM) {
                    return this.createSupporter(spawn, room.name, targetNeighbor) === OK;
                }
            }

            if (neighborMemory.type === 'remote_mining') {
                if (this.isRoomWithinRange(room.name, targetNeighbor, 1)) {
                    const remoteHarvesters = _.filter(Game.creeps,
                        c => c.memory.role === ROLES.LD_HARVESTER && c.memory.targetRoom === targetNeighbor).length;
                    if (remoteHarvesters < 1) {
                        return this.createLDHarvester(spawn, room.name, targetNeighbor) === OK;
                    }
                }
            }
        }

        if (room.controller.level === 8 && room.storage && room.storage.store[RESOURCE_ENERGY] > REMOTE_SPAWNING_STORE_LIMIT) {
            return this.supportNeighbors(spawn, room.name);
        }
        return false;
    },

    
    supportNeighbors: function(spawn, roomName) {
        const room = spawn.room;
        let neighborRooms = Memory.rooms[roomName]?.neighbors;
        if (!neighborRooms) return false;

        for (const targetNeighbor of neighborRooms) {
            if (targetNeighbor === roomName) continue;
            const neighborRoom = Game.rooms[targetNeighbor];
            if (!neighborRoom || !neighborRoom.controller?.my || neighborRoom.controller.level === 8) continue;

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
            if (isAssigned || mineral.mineralAmount === 0) continue;

            const totalInMarket = room.terminal ? room.terminal.store[mineral.mineralType] || 0 : 0;
            if (totalInMarket >= MINERAL_MARKET_LIMIT) continue;

            let body = [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
            return spawn.spawnCreep(body, `miner_${room.name}_${Game.time}`, {
                memory: { role: ROLES.MINER, mineralId: mineral.id, homeRoom: room.name, working: false }
            }) === OK;
        }
        return false;
    },

    cleanupDeadCreeps: function(roomName) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) delete Memory.creeps[name];
        }
    },

    findAvailableSpawn: function(roomName) {
        const room = Game.rooms[roomName];
        return _.find(room.find(FIND_MY_SPAWNS), s => !s.spawning) || null;
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

    isRoomWithinRange: function(fromRoom, toRoom, maxDist) {
        return Game.map.getRoomLinearDistance(fromRoom, toRoom) <= maxDist;
    },

    needStaticHarvester: function(room, population, populationMax) {
        return population[ROLES.STATIC_HARVESTER] < populationMax.STATIC_HARVESTER;
    },

    needSimpleHarvester: function(room, population, populationMax) {
        const current = population[ROLES.SIMPLE_HARVESTER];
        if (current >= populationMax.SIMPLE_HARVESTER) return false;
        if (room.storage) return false;
        const noEnergyEco = population[ROLES.STATIC_HARVESTER] === 0 || population[ROLES.HAULER] === 0;
        return noEnergyEco && current < 1;
    },

    needHauler: function(room, population, populationMax) {
        const hasDropPoint = room.storage || room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length > 0;
        return hasDropPoint && population[ROLES.HAULER] < populationMax.HAULER;
    },

    needUpgrader: function(population, populationMax) {
        return population[ROLES.UPGRADER] < populationMax.UPGRADER;
    },

    needBuilder: function(room, population, populationMax) {
        return population[ROLES.BUILDER] < populationMax.BUILDER;
    },

    createStaticHarvester: function(spawn, roomName) {
        const sources = spawn.room.find(FIND_SOURCES);
        const assigned = _.filter(Game.creeps, c => c.memory.role === ROLES.STATIC_HARVESTER && c.memory.homeRoom === roomName).map(c => c.memory.sourceId);
        const freeSource = sources.find(s => !assigned.includes(s.id));
        if (!freeSource) return false;
        const energy = spawn.room.energyCapacityAvailable - 300;
        let body = (energy >= 600) ? [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE] : [WORK, WORK, CARRY, MOVE];
        return spawn.spawnCreep(body, `Static_${roomName}_${Game.time}`, { memory: { role: ROLES.STATIC_HARVESTER, sourceId: freeSource.id, homeRoom: roomName } }) === OK;
    },

    createSimpleHarvester: function(spawn, roomName, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 200) { body.push(WORK, CARRY, MOVE); energy -= 200; }
        return spawn.spawnCreep(body.sort(), `Simple_${Game.time}`, { memory: { role: ROLES.SIMPLE_HARVESTER, homeRoom: roomName } }) === OK;
    },

    createHauler: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 100) { body.push(CARRY, MOVE); energy -= 100; }
        return spawn.spawnCreep(body.sort(), `Hauler_${Game.time}`, { memory: { role: ROLES.HAULER, homeRoom: roomName } }) === OK;
    },

    createUpgrader: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) { body.push(WORK, CARRY, MOVE, MOVE); energy -= 250; }
        return spawn.spawnCreep(body.sort(), `Upgrader_${Game.time}`, { memory: { role: ROLES.UPGRADER, homeRoom: roomName } }) === OK;
    },

    createBuilder: function(spawn, roomName, rcl, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) { body.push(WORK, CARRY, MOVE, MOVE); energy -= 250; }
        return spawn.spawnCreep(body.sort(), `Builder_${Game.time}`, { memory: { role: ROLES.BUILDER, homeRoom: roomName } }) === OK;
    },

    createSupporter: function(spawn, homeRoom, targetRoom, maxEnergy = 1000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxEnergy);
        let body = [];
        while (energy >= 250) { body.push(WORK, CARRY, MOVE, MOVE); energy -= 250; }
        return spawn.spawnCreep(body.sort(), `Supporter_${homeRoom}_${targetRoom}_${Game.time}`, { memory: { role: ROLES.SUPPORTER, homeRoom: homeRoom, targetRoom: targetRoom } }) === OK;
    },

    createScout: function(spawn, homeRoom, targetRoom) {
        return spawn.spawnCreep([MOVE], `Scout_${homeRoom}_${targetRoom}_${Game.time}`, { memory: { role: ROLES.SCOUT, homeRoom: homeRoom, targetRoom: targetRoom } });
    },

    createClaimer: function(spawn, homeRoom, targetRoom, maxPreferredEnergy = 2000) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxPreferredEnergy);
        let body = [WORK,MOVE,CARRY,CARRY,MOVE,MOVE, CLAIM]; // Basic
        return spawn.spawnCreep(body, `Claimer_${homeRoom}_${targetRoom}_${Game.time}`, { memory: { role: ROLES.CLAIMER, homeRoom: homeRoom, targetRoom: targetRoom } });
    },

    createLDHarvester: function(spawn, roomName, setupRoomName, maxPreferredEnergy = 1500) {
        let energy = Math.min(spawn.room.energyCapacityAvailable, maxPreferredEnergy);
        let body = [];
        let cost = 0;
        while (cost + 250 <= energy) { body.push(WORK, CARRY, MOVE, MOVE); cost += 250; }
        const sourceId = Memory.rooms[setupRoomName]?.sources?.[0]?.id;
        return spawn.spawnCreep(body.sort(), `LDHarvester_${roomName}_${setupRoomName}_${Game.time}`, {
            memory: { role: ROLES.LD_HARVESTER, homeRoom: roomName, targetRoom: setupRoomName, source: sourceId, working: false }
        });
    }
};

function initPopulation(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return;
    const sourceCount = room.find(FIND_SOURCES).length;
    if (!room.memory.populationLimits) room.memory.populationLimits = {};

    if (room.storage) {
        room.memory.populationLimits.SIMPLE_HARVESTER = 1;
        room.memory.populationLimits.STATIC_HARVESTER = sourceCount;
        room.memory.populationLimits.HAULER = Math.ceil(1 + (2 * sourceCount / 3));
        if (room.controller.level === 8) {
            room.memory.populationLimits.UPGRADER = 0;
            room.memory.populationLimits.BUILDER = 1;
        } else {
            room.memory.populationLimits.UPGRADER = 1;
            room.memory.populationLimits.BUILDER = (room.storage.store[RESOURCE_ENERGY] > 500000) ? sourceCount + 2 : sourceCount;
        }
    } else {
        room.memory.populationLimits.SIMPLE_HARVESTER = Math.ceil(1 + (2 * sourceCount / 3));
        room.memory.populationLimits.STATIC_HARVESTER = sourceCount;
        room.memory.populationLimits.HAULER = 1;
        room.memory.populationLimits.UPGRADER = 1;
        room.memory.populationLimits.BUILDER = sourceCount;
    }
    room.memory.populationLimits.lastRcl = room.controller.level;
}

module.exports = respawController;
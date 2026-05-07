/**
 * MODULE: Global Spawn Manager
 * VERSION: 2.7.0
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί την κλάση SpawnQueue
 * για τη διαχείριση των αιτημάτων και το populationManager για το Recovery Mode.
 * * CHANGE LOG:
 * 2.7.0: Υλοποίηση parts-based spawning. Αντικατάσταση TODO με countPartsInRoom logic.
 * 2.6.1: Τοποθέτηση της ουράς σε νέο αρχείο.
 * 2.6.0: Απόσπαση της διαχείρισης ουράς στην κλάση SpawnQueue.
 * 2.5.2: Βελτιστοποίηση CPU: Αντικατάσταση findRoute με getRoomLinearDistance και conditional sorting.
 * 2.5.1: Refactoring της updateRequests σε μικρότερες μεθόδους.
 * 2.5.0: Εφαρμογή προτεραιότητας Local Spawning. Τα creeps πλέον προτιμούν το δικό τους δωμάτιο
 * και χρησιμοποιούν remote spawns μόνο ως fallback (εκτός από Harvesters/Haulers).
 * 2.4.0: Εισαγωγή PopulationManager integration.
 */

const SpawnQueue = require('spawn.SpawnQueue');
const populationManager = require('spawn.populationManager');
const { POPULATION_GLOBAL_CONFIG, ROLES, PRIORITY, BODY_ENERGY_LIMITS } = require('spawn.constants');
// --- ΕΣΩΤΕΡΙΚΕΣ ΣΤΑΘΕΡΕΣ ΔΙΑΧΕΙΡΙΣΤΗ ---
const TICKS_UPDATE_REQUESTS = 10;
const TICKS_UPDATE_LIMITS = 100;
const TICKS_LOG_DEBUG = 20;
const TICKS_CLEANUP_MEMORY = 50;

class SpawnManager {
    constructor() {
        this.queue = new SpawnQueue();
        this.run = this.run.bind(this);
        this.cleanup = this.cleanup.bind(this);
    }

    run() {
        this.cleanup();

        for (let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                // Περιοδική ενημέρωση ορίων πληθυσμού
                if (Game.time % TICKS_UPDATE_LIMITS === 0) {
                    populationManager.updateRoomLimits(roomName);
                }

                // Περιοδικός έλεγχος αναγκών δωματίου
                if (Game.time % TICKS_UPDATE_REQUESTS === 0) {
                    this.checkRoomNeeds(room);
                }
            }
        }

        this.processQueue();

        if (Game.time % TICKS_LOG_DEBUG === 0) {
            // this.logStatus(); // Debug info
        }
    }

    /**
     * Ελέγχει τις ανάγκες του δωματίου και προσθέτει αιτήματα στην ουρά.
     * @param {Room} room 
     */
    checkRoomNeeds(room) {
        const roomMemory = Memory.rooms[room.name];
        if (!roomMemory || !roomMemory[POPULATION_GLOBAL_CONFIG.MEMORY_KEY]) return;

        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        const config = POPULATION_GLOBAL_CONFIG;
        const limits = roomMemory[config.MEMORY_KEY];

        // 1. Έλεγχος βάσει Αριθμού Creeps (κυρίως Harvesters/Static roles)
        const creepLimits = limits[config.MEMORY_KEY_CREEP];
        if (creepLimits) {
            for (let roleName in creepLimits) {
                const limit = creepLimits[roleName];
                if (limit <= 0) continue;

                if (roleName === ROLES.STATIC_HARVESTER) {
                    this.manageStaticHarvesterRequests(room, creepsInRoom);
                } else {
                    this.manageStandardRoleRequests(room.name, roleName, limit, creepsInRoom);
                }
            }
        }

        // 2. Έλεγχος βάσει Body Parts (Haulers, Upgraders, Builders)
        const partsLimits = limits[config.MEMORY_KEY_PARTS];
        if (partsLimits) {
            for (let roleName in partsLimits) {
                const targetParts = partsLimits[roleName];
                if (targetParts <= 0) continue;

                // Επιλογή τύπου part προς μέτρηση
                let partType = WORK;
                if (roleName === ROLES.HAULER || roleName === ROLES.LD_HAULER) {
                    partType = CARRY;
                }

                const currentParts = this.countPartsInRoom(creepsInRoom, roleName, partType);

                if (currentParts < targetParts) {
                    this.addRoleToQueue(room.name, roleName);
                }
            }
        }
    }

    /**
     * Μετράει τα ενεργά συγκεκριμένα parts για ένα ρόλο στο δωμάτιο.
     */
    countPartsInRoom(creeps, role, partType) {
        return _.sum(creeps, c => {
            if (c.memory.role !== role) return 0;
            // Μετράμε ενεργά parts (εξαιρούνται τα parts που χάθηκαν από damage ή αν το creep κάνει spawn)
            return c.getActiveBodyparts(partType);
        });
    }

    manageStaticHarvesterRequests(room, creepsInRoom) {
        const sources = room.find(FIND_SOURCES);
        for (let source of sources) {
            const hasHarvester = _.some(creepsInRoom, c =>
                c.memory.role === ROLES.STATIC_HARVESTER && c.memory.sourceId === source.id
            );

            if (!hasHarvester && !this.queue.hasRequest(room.name, ROLES.STATIC_HARVESTER, source.id)) {
                this.queue.add({
                    role: ROLES.STATIC_HARVESTER,
                    priority: PRIORITY[ROLES.STATIC_HARVESTER],
                    homeRoom: room.name,
                    targetRoom: room.name,
                    sourceId: source.id
                });
            }
        }
    }

    manageStandardRoleRequests(roomName, roleName, limit, creepsInRoom) {
        const currentCount = _.filter(creepsInRoom, c => c.memory.role === roleName).length;
        const pendingCount = this.queue.countRequests(roomName, roleName);

        if (currentCount + pendingCount < limit) {
            this.addRoleToQueue(roomName, roleName);
        }
    }

    addRoleToQueue(roomName, roleName) {
        if (!this.queue.hasRequest(roomName, roleName)) {
            this.queue.add({
                role: roleName,
                priority: PRIORITY[roleName] || 50,
                homeRoom: roomName,
                targetRoom: roomName
            });
        }
    }

    processQueue() {
        if (this.queue.length === 0) return;

        for (let i = 0; i < this.queue.length; i++) {
            const request = this.queue.getAt(i);
            const spawn = this.findBestSpawn(request);

            if (spawn) {
                const body = this.calculateBody(request.role, spawn.room.energyCapacityAvailable, request.homeRoom);
                const name = `${request.role}_${Game.time}_${Math.floor(Math.random() * 100)}`;

                const result = spawn.spawnCreep(body, name, {
                    memory: {
                        role: request.role,
                        homeRoom: request.homeRoom,
                        targetRoom: request.targetRoom,
                        sourceId: request.sourceId
                    }
                });

                if (result === OK) {
                    this.queue.removeAt(i);
                    break; // Ένα spawn ανά tick για εξοικονόμηση CPU
                }
            }
        }
    }

    findBestSpawn(request) {
        const activeSpawns = _.filter(Game.spawns, s => !s.spawning);
        if (activeSpawns.length === 0) return null;

        // Ταξινόμηση βάσει απόστασης
        activeSpawns.sort((a, b) => {
            const distA = Game.map.getRoomLinearDistance(a.room.name, request.homeRoom);
            const distB = Game.map.getRoomLinearDistance(b.room.name, request.homeRoom);
            return distA - distB;
        });

        // Προτίμηση στο τοπικό spawn αν έχει ενέργεια
        const localSpawn = _.find(activeSpawns, s => s.room.name === request.homeRoom);
        if (localSpawn && localSpawn.room.energyAvailable >= 300) {
            return localSpawn;
        }

        // Fallback σε οποιοδήποτε διαθέσιμο spawn που μπορεί να καλύψει το κόστος
        return activeSpawns[0];
    }

    calculateBody(role, maxEnergy, roomName) {
        let body = [];
        // Cap energy based on constants
        maxEnergy = Math.min(maxEnergy, BODY_ENERGY_LIMITS[role] || 800);

        switch (role) {
            case ROLES.STATIC_HARVESTER:
                body = [CARRY, MOVE];
                let workParts = 0;
                while (this.getBodyCost(body) + 100 <= maxEnergy && workParts < 6) {
                    body.push(WORK);
                    workParts++;
                }
                break;
            case ROLES.HAULER:
                let hParts = 0;
                while (this.getBodyCost(body) + 150 <= maxEnergy && hParts < 20) {
                    body.push(CARRY, CARRY, MOVE);
                    hParts++;
                }
                break;
            case ROLES.UPGRADER:
                let uParts = 0;
                while (this.getBodyCost(body) + 350 <= maxEnergy && uParts < 15) {
                    body.push(WORK, WORK, CARRY, MOVE, MOVE);
                    uParts++;
                }
                break;
            case ROLES.SIMPLE_HARVESTER:
            case ROLES.BUILDER:
                let bParts = 0;
                while (this.getBodyCost(body) + 250 <= maxEnergy && bParts < 15) {
                    body.push(WORK, CARRY, MOVE, MOVE);
                    bParts++;
                }
                break;
            default:
                body = [WORK, CARRY, MOVE];
        }
        return body;
    }

    getBodyCost(body) {
        return _.sum(body, part => BODYPART_COST[part]);
    }

    cleanup() {
        if (Game.time % TICKS_CLEANUP_MEMORY === 0) {
            for (const name in Memory.creeps) {
                if (!Game.creeps[name]) {
                    delete Memory.creeps[name];
                }
            }
        }
    }
} // end of class

module.exports = new SpawnManager();
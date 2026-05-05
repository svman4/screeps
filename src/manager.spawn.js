/**
 * MODULE: Global Spawn Manager
 * VERSION: 2.5.2
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί το populationManager 
 * για τον έλεγχο κατάρρευσης οικονομίας (Recovery Mode).
 * * CHANGE LOG:
 * 2.5.2: Βελτιστοποίηση CPU: Αντικατάσταση findRoute με getRoomLinearDistance και conditional sorting.
 * 2.5.1: Refactoring της updateRequests σε μικρότερες μεθόδους.
 * 2.5.0: Εφαρμογή προτεραιότητας Local Spawning. Τα creeps πλέον προτιμούν το δικό τους δωμάτιο
 * και χρησιμοποιούν remote spawns μόνο ως fallback (εκτός από Harvesters/Haulers).
 * 2.4.0: Εισαγωγή PopulationManager integration.
 */
// --- ΕΣΩΤΕΡΙΚΕΣ ΣΤΑΘΕΡΕΣ ΔΙΑΧΕΙΡΙΣΤΗ ---
const TICKS_UPDATE_REQUESTS = 10;   // Συχνότητα ελέγχου αναγκών
const TICKS_UPDATE_LIMITS = 100;     // Συχνότητα επικαιροποίησης ορίων πληθυσμού
const TICKS_LOG_DEBUG = 20;         // Συχνότητα εμφάνισης debug logs
const TICKS_CLEANUP_MEMORY = 50;    // Συχνότητα καθαρισμού νεκρών creeps
const ENERGY_THRESHOLD_NORMAL = 0.95; // Απαιτούμενο ποσοστό ενέργειας για μη κρίσιμα creeps
const CRITICAL_PRIORITY_LEVEL = 15; // Επίπεδο προτεραιότητας που θεωρείται "Emergency"

const { NEED_REPLACEMENT_FLAG, ROLES, PRIORITY, BODY_ENERGY_LIMITS } = require('spawn.constants');
const expansionManager = require('manager.expansion');
const populationManager = require('spawn.populationManager');

class SpawnManager {
    constructor() {
        if (!Memory.spawnQueue) {
            Memory.spawnQueue = [];
        }
        this.queue = Memory.spawnQueue;
        this._queueNeedsSort = true; // Flag για αποφυγή περιττών sorting
    }

    /**
     * Κεντρικός κύκλος λειτουργίας.
     */
    run() {
        this.cleanup();
        
        if (Game.time % TICKS_UPDATE_REQUESTS === 0) {
            this.updateRequests();
        }
		
        this.processQueue();
        
        if (Game.time % TICKS_LOG_DEBUG === 0 && this.queue.length > 0) {
            console.log(`[SpawnManager] Pending requests: ${this.queue.length}. Top: ${this.queue[0].role} for ${this.queue[0].targetRoom}`);
        }
    }

    /**
     * Ενημερώνει τις ανάγκες παραγωγής για όλα τα δωμάτια.
     */
    updateRequests() {
        for (let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            this.refreshRoomLimits(roomName);
            
            const roomMemory = Memory.rooms[roomName];
            if (!roomMemory || !roomMemory.populationLimits) continue;

            this.checkRoomNeeds(room);
        }
    }

    /**
     * Επικαιροποιεί τα όρια πληθυσμού αν απαιτείται.
     */
    refreshRoomLimits(roomName) {
        if (Game.time % TICKS_UPDATE_LIMITS === 0 || !Memory.rooms[roomName].populationLimits) { 
            populationManager.updateRoomLimits(roomName);	
        }
    }

    /**
     * Ελέγχει τις ανάγκες ενός συγκεκριμένου δωματίου.
     */
    checkRoomNeeds(room) {
        const roomMemory = Memory.rooms[room.name];
        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);

        for (let roleName in roomMemory.populationLimits) {
            if (roleName === 'isRecovery') continue;

            const limit = roomMemory.populationLimits[roleName];
            if (limit <= 0) continue;

            if (roleName === ROLES.STATIC_HARVESTER) {
                this.manageStaticHarvesterRequests(room, creepsInRoom);
            } else {
                this.manageStandardRoleRequests(room.name, roleName, limit, creepsInRoom);
            }
        }
    }

    /**
     * Διαχειρίζεται τα αιτήματα για Static Harvesters ανά πηγή.
     */
    manageStaticHarvesterRequests(room, creepsInRoom) {
        const sources = room.find(FIND_SOURCES);
        
        sources.forEach(source => {
            const harvesterAtSource = _.find(creepsInRoom, c => 
                c.memory.role === ROLES.STATIC_HARVESTER && c.memory.sourceId === source.id
            );

            if (!harvesterAtSource) {
                this.addRoleToQueue(room.name, ROLES.STATIC_HARVESTER, { sourceId: source.id, init: true });
            } else if (this.checkIfNeedReplace(harvesterAtSource)) {
                this.addRoleToQueue(room.name, ROLES.STATIC_HARVESTER, { sourceId: source.id, init: true });
                this.dropFlagForReplace(harvesterAtSource);
            }
        });
    }

    /**
     * Διαχειρίζεται τα αιτήματα για τους υπόλοιπους ρόλους.
     */
    manageStandardRoleRequests(roomName, roleName, limit, creepsInRoom) {
        const count = _.filter(creepsInRoom, c => c.memory.role === roleName).length;
        if (count < limit) {
            this.addRoleToQueue(roomName, roleName);
        }
    }

    /**
     * Προσθέτει ένα αίτημα στην ουρά με τους σωστούς υπολογισμούς προτεραιότητας.
     */
    addRoleToQueue(roomName, roleName, customMemory = {}) {
        const roomMemory = Memory.rooms[roomName];
        let priority = PRIORITY[roleName] || 100;

        if (roomMemory.isRecovery) {
            if (roleName === ROLES.SIMPLE_HARVESTER || roleName === ROLES.HAULER) {
                priority = 1;
            } else if (roleName === ROLES.STATIC_HARVESTER) {
                priority = 5;
            }
        }

        this.addToQueue({
            role: roleName,
            homeRoom: roomName,
            targetRoom: roomName,
            priority: priority,
            memory: customMemory
        });
    }

	checkIfNeedReplace(creep){ 
		if(creep.memory[NEED_REPLACEMENT_FLAG] && creep.memory[NEED_REPLACEMENT_FLAG]===true) {
			return true;
		}
		return false;
	}

	dropFlagForReplace(creep) {
		if(creep.memory[NEED_REPLACEMENT_FLAG]) {
			creep.memory[NEED_REPLACEMENT_FLAG]=false;
		}
		return;
	}

    addToQueue(request) {
        const isAlreadyInQueue = this.queue.some(r => 
            r.role === request.role && 
            r.targetRoom === request.targetRoom &&
            (!request.memory || r.memory.sourceId === request.memory.sourceId)
        );

        if (!isAlreadyInQueue) {
            this.queue.push({
                role: request.role,
                priority: request.priority,
                homeRoom: request.homeRoom,
                targetRoom: request.targetRoom || request.homeRoom,
                memory: request.memory || {},
                addedAt: Game.time
            });
            this._queueNeedsSort = true;
        }
    }

    sortQueue() {
        if (this._queueNeedsSort) {
            this.queue.sort((a, b) => a.priority - b.priority);
            this._queueNeedsSort = false;
        }
    }

    processQueue() {
        if (this.queue.length === 0) return;
        
        this.sortQueue();

        const freeSpawns = _.filter(Game.spawns, s => !s.spawning);
        if (freeSpawns.length === 0) return;

        for (let i = 0; i < this.queue.length; i++) {
            const request = this.queue[i];
            const spawn = this.findBestSpawn(request, freeSpawns);

            if (spawn) {
                const result = this.spawnCreep(spawn, request);
                if (result === OK) {
                    this.queue.splice(i, 1);
                    _.remove(freeSpawns, s => s.id === spawn.id);
                    i--; 
                    if (freeSpawns.length === 0) break;
                }
            }
        }
    }

    /**
     * Βελτιστοποιημένη επιλογή Spawn χρησιμοποιώντας γραμμική απόσταση.
     */
    findBestSpawn(request, freeSpawns) {
        const localSpawn = freeSpawns.find(s => s.room.name === request.homeRoom);
        if (localSpawn) {
            return localSpawn;
        }

        if (request.role !== ROLES.STATIC_HARVESTER && request.role !== ROLES.HAULER) {
            return freeSpawns.find(s => {
                // Χρήση γραμμικής απόστασης αντί για findRoute για εξοικονόμηση CPU
                const distance = Game.map.getRoomLinearDistance(s.room.name, request.homeRoom);
                return distance <= 1;
            });
        }

        return null;
    }

    spawnCreep(spawn, request) {
        const energyAvailable = spawn.room.energyAvailable;
        const energyCapacity = spawn.room.energyCapacityAvailable;
        const isCritical = request.priority <= CRITICAL_PRIORITY_LEVEL;
		const roleLimit = BODY_ENERGY_LIMITS[request.role] || BODY_ENERGY_LIMITS['default'];

		if (!isCritical && energyAvailable < roleLimit && energyAvailable < energyCapacity) {
			return ERR_NOT_ENOUGH_ENERGY;
        }

        const body = this.calculateBody(request.role, energyAvailable);
        if (!body || body.length === 0) return ERR_INVALID_ARGS;
		
        body.sort(); 
        const name = `${request.role}_${request.homeRoom}_${Game.time % 10000}`;
        const memory = _.assign({}, request.memory, { 
            role: request.role, 
            homeRoom: request.homeRoom,
            targetRoom: request.targetRoom 
        });

        const result = spawn.spawnCreep(body, name, { memory: memory });
        
        if (result === OK) {
            console.log(`⚡ [Spawn] ${spawn.name}(${spawn.room.name}) -> ${request.role}_${request.targetRoom} [Priority: ${request.priority}]`);
        }
        
        return result;
    }

    calculateBody(role, energy) {
        const limit = BODY_ENERGY_LIMITS[role] || BODY_ENERGY_LIMITS['default'] || energy;
        const maxEnergy = Math.min(energy, limit);
        let body = [];
        
        switch (role) {
            case ROLES.SCOUT:
                body = [MOVE];
                break;
            case ROLES.STATIC_HARVESTER:
                body = [MOVE,CARRY, WORK, WORK]; 
                let workParts = 2;
                while (this.getBodyCost(body) + 100 <= maxEnergy && workParts < 5) {
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
                    body.push(WORK,WORK, CARRY, MOVE,MOVE);
                    uParts++;
                }
                break;
			case ROLES.SIMPLE_HARVESTER:
            case ROLES.BUILDER:
                let bParts = 0;
                while (this.getBodyCost(body) + 250 <= maxEnergy && bParts < 15) {
                    body.push(WORK, CARRY, MOVE,MOVE);
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
}

const manager = new SpawnManager();
module.exports = manager;
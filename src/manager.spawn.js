/**
 * MODULE: Global Spawn Manager
 * VERSION: 2.3.3
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί το populationManager 
 * για τον έλεγχο κατάρρευσης οικονομίας (Recovery Mode).
 */

// --- ΕΣΩΤΕΡΙΚΕΣ ΣΤΑΘΕΡΕΣ ΔΙΑΧΕΙΡΙΣΤΗ ---
const TICKS_UPDATE_REQUESTS = 10;   // Συχνότητα ελέγχου αναγκών
const TICKS_UPDATE_LIMITS = 20;     // Συχνότητα επικαιροποίησης ορίων πληθυσμού
const TICKS_LOG_DEBUG = 20;         // Συχνότητα εμφάνισης debug logs
const TICKS_CLEANUP_MEMORY = 50;    // Συχνότητα καθαρισμού νεκρών creeps
const ENERGY_THRESHOLD_NORMAL = 0.8; // Απαιτούμενο ποσοστό ενέργειας για μη κρίσιμα creeps
const CRITICAL_PRIORITY_LEVEL = 15; // Επίπεδο προτεραιότητας που θεωρείται "Emergency"

// --- ΕΞΩΤΕΡΙΚΕΣ ΣΥΝΔΕΣΕΙΣ ---
const { ROLES, PRIORITY, BODY_ENERGY_LIMITS } = require('spawn.constants');
const expansionManager = require('manager.expansion');
const populationManager = require('spawn.populationManager');

class SpawnManager {
    constructor() {
        if (!Memory.spawnQueue) {
            Memory.spawnQueue = [];
        }
        this.queue = Memory.spawnQueue;
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
     * Ενημερώνει τις ανάγκες παραγωγής.
     * Εκμεταλλεύεται το roomMemory.isRecovery για άμεση ανάκαμψη.
     */
    updateRequests() {
		for (let roomName in Game.rooms) {
			const room = Game.rooms[roomName];
			if (!room.controller || !room.controller.my) continue;
			
			if (Game.time % TICKS_UPDATE_LIMITS === 0 || !Memory.rooms[roomName].populationLimits) { 
				populationManager.updateRoomLimits(roomName);	
			}
			
			const roomMemory = Memory.rooms[roomName];
			if (!roomMemory || !roomMemory.populationLimits) continue;

			const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === roomName);

			for (let roleName in roomMemory.populationLimits) {
                if (roleName === 'isRecovery') continue;

				const limit = roomMemory.populationLimits[roleName];
                if (limit <= 0) continue;

				if (roleName === ROLES.STATIC_HARVESTER) {
					const sources = room.find(FIND_SOURCES);
					sources.forEach(source => {
						const harvesterAtSource = _.some(creepsInRoom, c => 
							c.memory.role === roleName && c.memory.sourceId === source.id
						);

						if (!harvesterAtSource) {
							this.addToQueue({
								role: roleName,
								homeRoom: roomName,
								targetRoom: roomName,
								priority: roomMemory.isRecovery ? 5 : (PRIORITY[roleName] || 20),
								memory: { sourceId: source.id } 
							});
						}
					});
				} else {
					const count = _.filter(creepsInRoom, c => c.memory.role === roleName).length;

					if (count < limit) {
                        let priority = PRIORITY[roleName] || 100;
                        
                        // ΕΛΕΓΧΟΣ RECOVERY: Αν η οικονομία έχει καταρρεύσει (μέσω populationManager)
                        if (roomMemory.isRecovery && (roleName === ROLES.SIMPLE_HARVESTER || roleName === ROLES.HAULER)) {
                            priority = 1; 
                        }

						this.addToQueue({
							role: roleName,
							homeRoom: roomName,
							targetRoom: roomName,
							priority: priority
						});
					}
				}
			}
		}
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
            this.sortQueue();
        }
    }

    sortQueue() {
        this.queue.sort((a, b) => a.priority - b.priority);
    }

    processQueue() {
        if (this.queue.length === 0) return;

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

    findBestSpawn(request, freeSpawns) {
        return freeSpawns.find(s => {
            if (request.role === ROLES.STATIC_HARVESTER || request.role === ROLES.HAULER) {
                return s.room.name === request.homeRoom;
            }
            if (s.room.name === request.homeRoom) return true;
            const route = Game.map.findRoute(s.room.name, request.homeRoom);
            return route !== ERR_NO_PATH && route.length <= 1;
        });
    }

    spawnCreep(spawn, request) {
        const energyAvailable = spawn.room.energyAvailable;
        const energyCapacity = spawn.room.energyCapacityAvailable;
        
        // Χρήση της σταθεράς CRITICAL_PRIORITY_LEVEL για έλεγχο άμεσης παραγωγής
        const isCritical = request.priority <= CRITICAL_PRIORITY_LEVEL;
        if (!isCritical && energyAvailable < energyCapacity * ENERGY_THRESHOLD_NORMAL) {
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
                body = [MOVE, WORK, WORK]; 
                let workParts = 2;
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
            case ROLES.SIMPLE_HARVESTER:
            case ROLES.UPGRADER:
            case ROLES.BUILDER:
                let bParts = 0;
                while (this.getBodyCost(body) + 200 <= maxEnergy && bParts < 15) {
                    body.push(WORK, CARRY, MOVE);
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
// manager.logistics.js
const movementManager = require('manager.movement'); // <-- IMPORT

const PRIORITIES = {
    SPAWN_EXTENSION: 100,
    TOWER: 80,
    CONTROLLER_CONTAINER: 70,
    LAB: 40,
    TERMINAL: 40,
    NUKER: 35 , 
    FACTORY: 35, 
    POWER_SPAWN: 35,
    STORAGE: 10,
    
    DROP_ENERGY: 100,
    SOURCE_CONTAINER: 90,
    RECOVERY_CONTAINER: 85,
    RUIN: 80,
    TERMINAL_SOURCE: 40,
    STORAGE_LINK: 75,
    STORAGE_SOURCE: 76
};

const TARGET_FULL_PERCENT = { 
    TERMINAL: 0.8,
    STORAGE: 0.8,
    TOWER: 0.8,
    CONTROLLER_CONTAINER: 0.6,
    FACTORY: 0.5,
    LAB: 1,
    NUKER : 1,
    POWER_SPAWN : 1 
};

const MIN_LIFE_TO_LIVE = 50;
const UPDATE_TASKS_INTERVAL = 2;

const logisticsManager = {
    
    init: function(roomName) {
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }

        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory.logistics) {
            roomMemory.logistics = {
                energyTasks: [],
                haulerAssignments: {},
                taskReservations: {}
            };
        }
    },

    run: function(roomName) {
        this.init(roomName);
        
        const room = Game.rooms[roomName];
        if (!room) return;
        
        const roomMemory = room.memory.logistics;

        if (Game.time % UPDATE_TASKS_INTERVAL === 0) {
            this.updateEnergyTasks(room, roomMemory);
        }

        this.manageHaulers(room, roomMemory);

        if (Game.time % 30 === 0) {
            this.cleanupReservations(roomMemory);
            this.cleanupTasks(roomMemory);
        }
    },
    
    updateEnergyTasks: function(room, roomMemory) {
        const roomName = room.name;
        const tasks = [];
        const deliveryTargets = this.findDeliveryTargets(room);
        
        if (deliveryTargets.length > 0) {
            deliveryTargets.forEach(target => {
                const sources = this.findSourcesForTarget(room, target);
                sources.forEach(source => {
                    if (source.id !== target.id) {
                        if (this.isSameStructureTypeTransfer(source, target)) return;
                        tasks.push(this.createTask(roomName, source, target, 'deliver'));
                    }
                });
            });
        } else {
            const storage = room.storage;
            if (storage) {
                const cleanupSources = this.findCleanupSources(room);
                const storageTarget = {
                    id: storage.id,
                    type: 'storage',
                    priority: PRIORITIES.STORAGE,
                    obj: storage
                };
                cleanupSources.forEach(source => {
                    if (source.id !== storage.id) {
                        tasks.push(this.createTask(roomName, source, storageTarget, 'cleanup'));
                    }
                });
            }
        }
        
        tasks.sort((a, b) => b.priority - a.priority);
        roomMemory.energyTasks = tasks;
    },

    isSameStructureTypeTransfer: function(source, target) {
        if ((source.type === 'storage' && target.type === 'storage') ||
            (source.type === 'terminal' && target.type === 'terminal') ||
            (source.type === 'storageLink' && target.type === 'storageLink')) {
            return true;
        }
        if ((source.type === 'terminal' && target.type === 'storage') ||
            (source.type === 'storage' && target.type === 'terminal')) {
            return true;
        }
        return false;
    },

    findDeliveryTargets: function(room) {
        const targets = [];
        const allStructures = room.find(FIND_MY_STRUCTURES);

        allStructures.forEach(s => {
            const freeCapacity = s.store ? s.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
            const energyAmount = s.store ? s.store[RESOURCE_ENERGY] : 0;
            const capacity = s.store ? s.store.getCapacity(RESOURCE_ENERGY) : 0;

            let priority = 0;
            let condition = false;

            switch (s.structureType) {
                case STRUCTURE_SPAWN:
                case STRUCTURE_EXTENSION:
                    priority = PRIORITIES.SPAWN_EXTENSION;
                    condition = freeCapacity > 0;
                    break;
                case STRUCTURE_TOWER:
                    priority = PRIORITIES.TOWER;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.TOWER;
                    break;
                case STRUCTURE_LAB:
                    priority = PRIORITIES.LAB;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.LAB;
                    break;
                case STRUCTURE_TERMINAL:
                    priority = PRIORITIES.TERMINAL;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.TERMINAL;
                    break;
                case STRUCTURE_FACTORY:
                    priority=PRIORITIES.FACTORY;
                    condition=energyAmount<capacity*TARGET_FULL_PERCENT.FACTORY;
                    break;
                case STRUCTURE_NUKER: 
                    priority=PRIORITIES.NUKER;
                    condition=energyAmount<capacity*TARGET_FULL_PERCENT.NUKER;
                    break;
                case STRUCTURE_POWER_SPAWN:
                    priority=PRIORITIES.POWER_SPAWN;
                    condition=energyAmount<capacity*TARGET_FULL_PERCENT.POWER_SPAWN;
                    break;
                default:
                    return;
            }

            if (condition) {
                targets.push({ id: s.id, type: s.structureType, priority: priority, obj: s });
            }
        });

        if (room.memory.controllerContainerId) {
            const cc = Game.getObjectById(room.memory.controllerContainerId);
            if (cc && cc.store && cc.store[RESOURCE_ENERGY] < cc.store.getCapacity(RESOURCE_ENERGY) * TARGET_FULL_PERCENT.CONTROLLER_CONTAINER) {
                targets.push({
                    id: cc.id, type: 'controllerContainer', priority: PRIORITIES.CONTROLLER_CONTAINER, obj: cc
                });
            }
        }
        return targets.sort((a, b) => b.priority - a.priority);
    },

    findSourcesForTarget: function(room, target) {
        const sources = [];
        
        room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 200
        }).forEach(energy => sources.push({
            id: energy.id, type: 'dropped', priority: PRIORITIES.DROP_ENERGY, obj: energy
        }));
   
        room.find(FIND_STRUCTURES).forEach(s => {
            let priority = 0;
            let condition = false;
            if (s.id === target.id) return;

            switch (s.structureType) {
                case STRUCTURE_CONTAINER:
                    if (s.store[RESOURCE_ENERGY] > 100 && this.isContainerNearSource(s)) {
                        priority = PRIORITIES.SOURCE_CONTAINER;
                        condition = true;
                    }
                    else if (room.memory.recoveryContainerId === s.id && s.store[RESOURCE_ENERGY] > 100) {
                        priority = PRIORITIES.RECOVERY_CONTAINER;
                        condition = true;
                    }
                    break;
                case STRUCTURE_TERMINAL:
                    if (s.my && s.store[RESOURCE_ENERGY] > 1000) {
                        priority = PRIORITIES.TERMINAL_SOURCE; 
                        condition = true;
                    }
                    break;
                case STRUCTURE_LINK:
                    if (room.memory.storageLinkId === s.id && s.store[RESOURCE_ENERGY] > 100) {
                        priority = PRIORITIES.STORAGE_LINK;
                        condition = true;
                    }
                    break;
                case STRUCTURE_STORAGE:
                    if (s.my && s.store[RESOURCE_ENERGY] > 1000) {
                        priority = PRIORITIES.STORAGE_SOURCE;
                        condition = true;
                    }
                    break;
                default:
                    return;
            }
            if (condition) {
                sources.push({ id: s.id, type: s.structureType.toLowerCase(), priority: priority, obj: s });
            }
        });
        
        room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 50
        }).forEach(ruin => sources.push({
            id: ruin.id, type: 'ruin', priority: PRIORITIES.RUIN, obj: ruin
        }));

        return sources.sort((a, b) => b.priority - a.priority);
    },

    findCleanupSources: function(room) {
        const sources = [];
        const storage = room.storage;
        
        this.findSourcesForTarget(room, {id: null}).forEach(source => {
            if (source.type === 'dropped' || source.type === 'ruin') {
                sources.push(source);
            }
        });

        room.find(FIND_STRUCTURES).forEach(s => {
            if (storage && s.id === storage.id) return;

            let priority = 0;
            let condition = false;

            switch (s.structureType) {
                case STRUCTURE_CONTAINER:
                    if (s.store[RESOURCE_ENERGY] > 100 && this.isContainerNearSource(s)) {
                        priority = PRIORITIES.SOURCE_CONTAINER;
                        condition = true;
                    }
                    else if (room.memory.recoveryContainerId === s.id && s.store[RESOURCE_ENERGY] > 100) {
                        priority = PRIORITIES.RECOVERY_CONTAINER;
                        condition = true;
                    }
                    break;
                case STRUCTURE_LINK:
                    if (room.memory.storageLinkId === s.id && s.store[RESOURCE_ENERGY] > 100) {
                        priority = PRIORITIES.STORAGE_LINK;
                        condition = true;
                    }
                    break;
                case STRUCTURE_TERMINAL:
                    if (s.my && s.store[RESOURCE_ENERGY] > 50000) {
                        priority = PRIORITIES.TERMINAL_SOURCE;
                        condition = true;
                    }
                    break;
                default:
                    return;
            }
            if (condition) {
                sources.push({ id: s.id, type: s.structureType.toLowerCase(), priority: priority, obj: s });
            }
        });

        return sources.sort((a, b) => b.priority - a.priority);
    },
    
    createTask: function(roomName, source, target, taskType) {
        return {
            id: `${source.id}-${target.id}-${Game.time}`,
            room: roomName,
            sourceId: source.id,
            sourceType: source.type,
            targetId: target.id,
            targetType: target.type,
            taskType: taskType,
            priority: source.priority + target.priority,
            created: Game.time
        };
    },

    isContainerNearSource: function(container) {
        return container.pos.findInRange(FIND_SOURCES, 2).length > 0;
    },
    
    manageHaulers: function(room, roomMemory) {
        const roomName = room.name;
        const haulers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'hauler' && 
            creep.memory.homeRoom === roomName &&
            !creep.spawning
        );
        
        const assignments = roomMemory.haulerAssignments;
        const reservations = roomMemory.taskReservations;
        const tasks = roomMemory.energyTasks;

        for (const haulerName in assignments) {
            if (!Game.creeps[haulerName]) {
                const assignedTask = assignments[haulerName];
                if (assignedTask) {
                    delete reservations[assignedTask.taskId];
                }
                delete assignments[haulerName];
            }
        }

        haulers.forEach(hauler => {
            this.assignTaskToHauler(hauler, tasks, assignments, reservations);
        });

        haulers.forEach(hauler => {
            this.runHaulerWithTask(hauler, assignments[hauler.name]);
        });
    },

    assignTaskToHauler: function(hauler, tasks, assignments, reservations) {
        const currentAssignment = assignments[hauler.name];

        if (currentAssignment) {
            const taskStillValid = this.validateTask(currentAssignment);
            if (taskStillValid) {
                return;
            } else {
                if (reservations[currentAssignment.taskId]) {
                    delete reservations[currentAssignment.taskId];
                }
                delete assignments[hauler.name];
            }
        }

        const availableTask = this.findBestTaskForHauler(hauler, tasks, reservations);

        if (availableTask) {
            reservations[availableTask.id] = {
                haulerName: hauler.name,
                reservedAt: Game.time
            };

            assignments[hauler.name] = {
                taskId: availableTask.id,
                sourceId: availableTask.sourceId,
                sourceType: availableTask.sourceType,
                targetId: availableTask.targetId,
                targetType: availableTask.targetType,
                taskType: availableTask.taskType,
                assignedAt: Game.time
            };
        }
    },

    findBestTaskForHauler: function(hauler, tasks, reservations) {
        if (tasks.length === 0) return null;

        let bestTask = null;
        let bestScore = -Infinity;
        const topTasks = tasks.slice(0, 10); 

        for (const task of topTasks) {
            const reservation = reservations[task.id];
            
            if (reservation && reservation.haulerName !== hauler.name) {
                continue;
            }
            
            const target = Game.getObjectById(task.targetId);
            if (!target) continue;
            
            const distance = hauler.pos.getRangeTo(target);
            const distancePenalty = distance * 0.1; 
            const totalScore = task.priority - distancePenalty;
            
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestTask = task;
            }
        }

        return bestTask;
    },

    validateTask: function(task) {
        const source = Game.getObjectById(task.sourceId);
        const target = Game.getObjectById(task.targetId);
        
        if (!source || !target) return false;
        if (source.id === target.id) return false;

        const hasEnergy = this.checkSourceHasEnergy(source, task.sourceType);
        const canAcceptEnergy = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;

        return hasEnergy && canAcceptEnergy;
    },

    runHaulerWithTask: function(creep, assignment) {
        if (creep.ticksToLive < MIN_LIFE_TO_LIVE && creep.room.memory.recoveryContainerId) {
            creep.memory.role = "to_be_recycled";
            return;
        }

        if (!assignment) return;
        
        const isCarrying = creep.store[RESOURCE_ENERGY] > 0;

        if (!isCarrying) {
            this.collectFromSource(creep, assignment);
        } else {
            this.deliverToTarget(creep, assignment);
        }
    },

    // --- ΚΙΝΗΣΗ ΜΕ ΧΡΗΣΗ TOY movementManager ---

    collectFromSource: function(creep, assignment) {
        const source = Game.getObjectById(assignment.sourceId);
        
        if (!source) {
            this.completeTask(creep);
            return;
        }
        
        const hasEnergy = this.checkSourceHasEnergy(source, assignment.sourceType);
        if (!hasEnergy) {
            this.completeTask(creep);
            return;
        }
        
        if (creep.pos.isNearTo(source)) {
            const result = this.withdrawFromSource(creep, source, assignment.sourceType);
            if (result !== OK) {
                this.completeTask(creep);
            }
        } else {
            movementManager.smartMove(creep, source, 1); // <-- ΑΛΛΑΓΗ
        }
    },

    deliverToTarget: function(creep, assignment) {
        const target = Game.getObjectById(assignment.targetId);
        
        if (!target) {
            this.completeTask(creep);
            return;
        }

        const source = Game.getObjectById(assignment.sourceId);
        if (source && source.id === target.id) {
            this.completeTask(creep);
            return;
        }

        const canAccept = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        if (!canAccept) {
            this.completeTask(creep);
            return;
        }

        if (creep.pos.isNearTo(target)) {
            const result = creep.transfer(target, RESOURCE_ENERGY);
            
            if (result === OK || result === ERR_FULL) {
                this.completeTask(creep);
            } else {
                this.completeTask(creep);
            }
        } else {
            movementManager.smartMove(creep, target, 1); // <-- ΑΛΛΑΓΗ
        }
    },

    checkSourceHasEnergy: function(source, sourceType) {
        switch (sourceType) {
            case 'dropped': return source.amount > 20;
            case 'ruin': return source.store[RESOURCE_ENERGY] > 20;
            case 'container':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage': return source.store[RESOURCE_ENERGY] > 50;
            default: return false;
        }
    },

    withdrawFromSource: function(creep, source, sourceType) {
        switch (sourceType) {
            case 'dropped': return creep.pickup(source);
            case 'ruin':
            case 'container':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage': return creep.withdraw(source, RESOURCE_ENERGY);
            default: return ERR_INVALID_ARGS;
        }
    },

    completeTask: function(creep) {
        const roomName = creep.memory.homeRoom;
        if (!Memory.rooms[roomName] || !Memory.rooms[roomName].logistics) return;

        const roomMemory = Memory.rooms[roomName].logistics;
        const assignments = roomMemory.haulerAssignments;
        const reservations = roomMemory.taskReservations;
        
        if (assignments[creep.name]) {
            delete reservations[assignments[creep.name].taskId];
            delete assignments[creep.name];
            
            // Clean move memory
            delete creep.memory._lastPos;
            delete creep.memory._stuckCount;

            const tasks = roomMemory.energyTasks;
            this.assignTaskToHauler(creep, tasks, assignments, reservations);
        }
    },

    cleanupTasks: function(roomMemory) {
        const now = Game.time;
        roomMemory.energyTasks = roomMemory.energyTasks.filter(task => (now - task.created) < 50);
    },

    cleanupReservations: function(roomMemory) {
        const reservations = roomMemory.taskReservations;
        const now = Game.time;

        for (const taskId in reservations) {
            const reservation = reservations[taskId];
            if (now - reservation.reservedAt > 100 || !Game.creeps[reservation.haulerName]) {
                delete reservations[taskId];
            }
        }
    },

    showTasksInfo: function(room) {
        const visual = new RoomVisual(room.name);
        if (!room.memory.logistics) return;
        const tasks = room.memory.logistics.energyTasks;
        
        let y = 10;
        visual.text(`Tasks: ${tasks.length}`, 1, y++, { align: 'left', color: '#ffff00' });
        
        tasks.slice(0, 5).forEach((task, index) => {
            const info = `${task.taskType}: ${task.sourceType}->${task.targetType} (prio:${task.priority})`;
            visual.text(info, 1, y++, { align: 'left', color: '#ffffff' });
        });
    }
};

module.exports = logisticsManager;
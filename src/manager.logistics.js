// manager.logistics.js
const movementManager = require('manager.movement');
const { STORAGE_LINK_ID } = require('manager.link');
const { LEAD_TIME_KEY } = require("spawn.constants");
const roomCache = require('utils.RoomCache');
const utilsRoomCache = require('./utils.RoomCache');
/*
version 1.1.0
- Added high priority for Storage Link emptying using room.memory.storageLinkId
*/
const PRIORITIES = {
    STORAGE_LINK: 105, // Υψηλότερη προτεραιότητα από Spawn/Extension για να αδειάζει αμέσως το δίκτυο
    SPAWN_EXTENSION: 100,
    DROP_ENERGY: 100,
    SOURCE_CONTAINER: 90,
    RECOVERY_CONTAINER: 85,
    TOWER: 80,
    RUIN: 80,
    STORAGE_SOURCE: 76,
    STORAGE_LINK_NORMAL: 75, // Backup priority
    CONTROLLER_CONTAINER: 70,
    LAB: 40,
    TERMINAL_SOURCE: 40,
    NUKER: 35,
    FACTORY: 35,
    POWER_SPAWN: 35,
    STORAGE: 10,
    TERMINAL: 5
};

const TARGET_FULL_PERCENT = {
    TERMINAL: 0.00,
    STORAGE: 0.8,
    TOWER: 0.8,
    CONTROLLER_CONTAINER: 0.6,
    FACTORY: 0.00,
    LAB: 0.00,
    NUKER: 0.00,
    POWER_SPAWN: 0
};

const MIN_LIFE_TO_LIVE = 50;
const UPDATE_TASKS_INTERVAL = 2;

const DROPPED_SOURCE_ENERGY_LIMIT = 200;
const RUINS_SOURCE_ENERGY_LIMIT = 50;
const logisticsManager = {

    init: function (roomName) {
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

    run: function (roomName) {
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

    updateEnergyTasks: function (room, roomMemory) {
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

    isSameStructureTypeTransfer: function (source, target) {
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

    findDeliveryTargets: function (room) {
        const targets = [];
        const allStructures = roomCache.in(room.name).structures;


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
                    priority = PRIORITIES.FACTORY;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.FACTORY;
                    break;
                case STRUCTURE_NUKER:
                    priority = PRIORITIES.NUKER;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.NUKER;
                    break;
                case STRUCTURE_POWER_SPAWN:
                    priority = PRIORITIES.POWER_SPAWN;
                    condition = energyAmount < capacity * TARGET_FULL_PERCENT.POWER_SPAWN;
                    break;
                default:
                    return;
            }

            if (condition) {
                targets.push(
                    {
                        id: s.id,
                        type: s.structureType,
                        priority: priority,
                        obj: s
                    }
                );
            }
        });
        const controllerContainer = roomCache.in(room.name).controllerContainer;

        if (controllerContainer &&
            controllerContainer.store &&
            controllerContainer.store[RESOURCE_ENERGY] <
            controllerContainer.store.getCapacity(RESOURCE_ENERGY) * TARGET_FULL_PERCENT.CONTROLLER_CONTAINER) {
            targets.push({
                id: controllerContainer.id,
                type: 'controllerContainer',
                priority: PRIORITIES.CONTROLLER_CONTAINER,
                obj: controllerContainer
            });
        }

        return targets.sort((a, b) => b.priority - a.priority);
    },
    /**
     * Για έναν δεδομένο στόχο, βρίσκει όλες τις πιθανές πηγές ενέργειας στο δωμάτιο, αξιολογεί την προτεραιότητά τους και επιστρέφει μια ταξινομημένη λίστα.
      - Περιλαμβάνει dropped energy, ruins, και διάφορες δομές (links, containers, terminal, storage) με βάση συγκεκριμένες συνθήκες.
      - Κάθε πηγή επιστρέφεται με ένα αντικείμενο που περιέχει το id, τον τύπο της πηγής, την προτεραιότητα και το ίδιο το αντικείμενο για εύκολη πρόσβαση αργότερα.    
     */
    findSourcesForTarget: function (room, target) {
        const sources = [];
        const cache = roomCache.in(room.name);
        cache.droppedEnergy
            .filter(r => r.amount > DROPPED_SOURCE_ENERGY_LIMIT)
            .forEach(energy =>
                sources.push(
                    {
                        id: energy.id,
                        type: 'dropped',
                        priority: PRIORITIES.DROP_ENERGY,
                        obj: energy
                    }));
        const ruins = cache.ruins.filter(r => r.store[RESOURCE_ENERGY] > RUINS_SOURCE_ENERGY_LIMIT);
        ruins.forEach(ruin =>
            sources.push(
                {
                    id: ruin.id,
                    type: 'ruin',
                    priority: PRIORITIES.RUIN,
                    obj: ruin
                }));

        const storageLink = cache.storageLink;
        if (storageLink && storageLink.store[RESOURCE_ENERGY] > 0) {
            sources.push(
                {
                    id: storageLink.id,
                    type: storageLink.structureType.toLowerCase(),
                    priority: PRIORITIES.STORAGE_LINK,
                    obj: storageLink
                });
        }

        cache.sourceContainers.forEach(s => {
            if (s.store[RESOURCE_ENERGY] > 250) {
                sources.push(
                    {
                        id: s.id,
                        type: s.structureType.toLowerCase(),
                        priority: PRIORITIES.SOURCE_CONTAINER,
                        obj: s
                    });
            }
        });
        const recoveryContainer = cache.recoveryContainer;
        if (recoveryContainer && recoveryContainer.store[RESOURCE_ENERGY] > 100) {
            sources.push(
                {
                    id: recoveryContainer.id,
                    type: recoveryContainer.structureType.toLowerCase(), priority: PRIORITIES.RECOVERY_CONTAINER,
                    obj: recoveryContainer
                });
        }

        const terminal = room.terminal;
        if (terminal && terminal.store[RESOURCE_ENERGY] > 1000) {
            sources.push(
                {
                    id: terminal.id,
                    type: terminal.structureType.toLowerCase(),
                    priority: PRIORITIES.TERMINAL_SOURCE,
                    obj: terminal
                }
            );
        }
        if (target && room.storage && room.storage.store[RESOURCE_ENERGY] > 1000) {
            sources.push(
                {
                    id: room.storage.id,
                    type: 'storage',
                    priority: PRIORITIES.STORAGE_SOURCE,
                    obj: room.storage
                });
        }

        return sources.sort((a, b) => b.priority - a.priority);
    },

    findCleanupSources: function (room) {
        const sources = [];



        const sourcesForTarget = this.findSourcesForTarget(room, { id: null });
        sources.push(...sourcesForTarget);
        return sources.sort((a, b) => b.priority - a.priority);
    },

    createTask: function (roomName, source, target, taskType) {
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


    manageHaulers: function (room, roomMemory) {
        const roomName = room.name;
        const haulers = _.filter(roomCache.in(roomName).myCreeps, creep =>
            creep.memory.role === 'hauler' &&
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
            this.assignTaskToHauler(
                hauler,
                tasks,
                assignments,
                reservations);
        });

        haulers.forEach(hauler => {
            this.runHaulerWithTask(
                hauler,
                assignments[hauler.name]);
        });
    },

    assignTaskToHauler: function (hauler, tasks, assignments, reservations) {
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

    findBestTaskForHauler: function (hauler, tasks, reservations) {
        if (tasks.length === 0) return null;

        let bestTask = null;
        let bestScore = -Infinity;
        const topTasks = tasks.slice(0, 15); // Αυξήθηκε λίγο το εύρος για να πιάνει τα νέα link tasks

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

    validateTask: function (task) {
        const source = Game.getObjectById(task.sourceId);
        const target = Game.getObjectById(task.targetId);

        if (!source || !target) return false;
        if (source.id === target.id) return false;

        const hasEnergy = this.checkSourceHasEnergy(source, task.sourceType);
        const canAcceptEnergy = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;

        return hasEnergy && canAcceptEnergy;
    },
    /**
             * Εκτελείται μία φορά όταν το creep φτάσει στη θέση του.
             */
    initialiseLifecycle: function (creep) {
        if (creep.memory.init === true) {
            const spawnTimeConstant = (typeof CREEP_SPAWN_TIME !== 'undefined') ? CREEP_SPAWN_TIME : 3;
            const spawnDuration = creep.body.length * spawnTimeConstant;
            creep.memory[LEAD_TIME_KEY] = spawnDuration + 15;
            delete creep.memory.init;
        }
    },
    runHaulerWithTask: function (creep, assignment) {
        if (creep.ticksToLive < MIN_LIFE_TO_LIVE) {
            // Αν ο hauler έχει λίγη ζωή, του αναθέτουμε να πάει για ανακύκλωση αντί να ξεκινήσει νέο task
            creep.memory.role = "to_be_recycled";
            return;
        }
        this.initialiseLifecycle(creep);

        if (!assignment) return;

        const isCarrying = creep.store[RESOURCE_ENERGY] > 0;

        if (!isCarrying) {
            this.collectFromSource(creep, assignment);
        } else {
            this.deliverToTarget(creep, assignment);
        }
    },

    collectFromSource: function (creep, assignment) {
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
            // Αν δεν έχει γεμίσει το store και έχει δίπλα(απόσταση 1) άλλη πηγή να παίρνει απο εκεί.
            if (result !== OK) {

                // FEATURE: Scavenge adjacent structures/piles if hauler has free space left
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    console.log("I am hungry");
                    const adjacentStructures = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: (s) => s.store && s.store[RESOURCE_ENERGY] > 0 && s.id !== source.id
                    });
                    if (adjacentStructures.length > 0) {
                        creep.withdraw(adjacentStructures[0], RESOURCE_ENERGY);
                    } else {
                        const adjacentDrops = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
                            filter: (d) => d.resourceType === RESOURCE_ENERGY
                        });
                        if (adjacentDrops.length > 0) creep.pickup(adjacentDrops[0]);
                    }
                }



                this.completeTask(creep);
            }
        } else {
            movementManager.smartMove(creep, source, 1);
        }
    },

    deliverToTarget: function (creep, assignment) {
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
            movementManager.smartMove(creep, target, 1);
        }
    },

    checkSourceHasEnergy: function (source, sourceType) {
        switch (sourceType) {
            case 'dropped': return source.amount > DROPPED_SOURCE_ENERGY_LIMIT;
            case 'ruin': return source.store[RESOURCE_ENERGY] > RUINS_SOURCE_ENERGY_LIMIT;
            case 'link':
            case 'container':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage': return source.store[RESOURCE_ENERGY] > 0; // Αδειάζουμε μέχρι τέλους
            default: return false;
        }
    },

    withdrawFromSource: function (creep, source, sourceType) {
        switch (sourceType) {
            case 'dropped': return creep.pickup(source);
            case 'ruin':
            case 'link':
            case 'container':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage': return creep.withdraw(source, RESOURCE_ENERGY);
            default: return ERR_INVALID_ARGS;
        }
    },

    completeTask: function (creep) {
        const roomName = creep.memory.homeRoom;
        if (!Memory.rooms[roomName] || !Memory.rooms[roomName].logistics) return;

        const roomMemory = Memory.rooms[roomName].logistics;
        const assignments = roomMemory.haulerAssignments;
        const reservations = roomMemory.taskReservations;

        if (assignments[creep.name]) {
            delete reservations[assignments[creep.name].taskId];
            delete assignments[creep.name];

            delete creep.memory._lastPos;
            delete creep.memory._stuckCount;

            const tasks = roomMemory.energyTasks;
            this.assignTaskToHauler(creep, tasks, assignments, reservations);
        }
    },

    cleanupTasks: function (roomMemory) {
        const now = Game.time;
        roomMemory.energyTasks = roomMemory.energyTasks.filter(task => (now - task.created) < 50);
    },

    cleanupReservations: function (roomMemory) {
        const reservations = roomMemory.taskReservations;
        const now = Game.time;

        for (const taskId in reservations) {
            const reservation = reservations[taskId];
            if (now - reservation.reservedAt > 100 || !Game.creeps[reservation.haulerName]) {
                delete reservations[taskId];
            }
        }
    },

    showTasksInfo: function (room) {
        const visual = new RoomVisual(room.name);
        if (!room.memory.logistics) return;
        const tasks = room.memory.logistics.energyTasks;

        let y = 10;
        visual.text(`Tasks: ${tasks.length}`, 1, y++, { align: 'left', color: '#ffff00' });

        tasks.slice(0, 5).forEach((task, index) => {
            const info = `${task.taskType}: ${task.sourceId === room.memory.storageLinkId ? 'STORAGE_LINK' : task.sourceType}->${task.targetType} (prio:${task.priority})`;
            visual.text(info, 1, y++, { align: 'left', color: '#ffffff' });
        });
    }
};

module.exports = logisticsManager;
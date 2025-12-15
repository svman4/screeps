// manager.logistics.js - ΒΕΛΤΙΩΜΕΝΗ ΛΟΓΙΚΗ ΜΕ PRIORITY-BASED ENERGY DISTRIBUTION & CPU OPTIMIZATION

const PRIORITIES = {
    // Προτεραιότητες Στόχων
    SPAWN_EXTENSION: 100,
    TOWER: 80,
    CONTROLLER_CONTAINER: 70,
    LAB: 40,
    TERMINAL: 40,
    STORAGE: 10,
    
    // Προτεραιότητες Πηγών (για ανάκτηση)
    DROP_ENERGY: 100,
    SOURCE_CONTAINER: 90,
    RECOVERY_CONTAINER: 85,
    RUIN: 80,
    TERMINAL_SOURCE: 60,
    STORAGE_LINK: 75,
    STORAGE_SOURCE: 76
};
const TARGET_FULL_PERCENT= { 
    TERMINAL : 0.8,
    STORAGE : 0.8,
    TOWER : 0.8,
    CONTROLLER_CONTAINER : 0.6,
    FACTORY : 0.5,
    LAB: 1
};

const MIN_LIFE_TO_LIVE = 50;
const UPDATE_TASKS_INTERVAL = 2;

const logisticsManager = {
    
    /**
     * ΑΡΧΙΚΟΠΟΙΗΣΗ ΜΝΗΜΗΣ ΔΩΜΑΤΙΟΥ
     */
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

    /**
     * ΚΥΡΙΑ ΛΕΙΤΟΥΡΓΙΑ
     */
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
    
    // ********* ΕΝΗΜΕΡΩΣΗ ENERGY TASKS *********
    
    /**
     * ΕΝΗΜΕΡΩΣΗ ENERGY TASKS - ΚΕΝΤΡΙΚΗ ΛΟΓΙΚΗ
     */ 
    updateEnergyTasks: function(room, roomMemory) {
        const roomName = room.name;
        const tasks = [];
        
        // ΒΗΜΑ 1: ΕΥΡΕΣΗ ΣΤΟΧΩΝ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΕΝΕΡΓΕΙΑ
        const deliveryTargets = this.findDeliveryTargets(room);
        
        if (deliveryTargets.length > 0) {
            // ΛΕΙΤΟΥΡΓΙΑ ΠΛΗΡΩΣΗΣ
            deliveryTargets.forEach(target => {
                const sources = this.findSourcesForTarget(room, target);
            
                sources.forEach(source => {
                    // ΑΠΟΦΥΓΗ μεταφοράς από το ίδιο αντικείμενο
                    if (source.id !== target.id) {
                        // Επιπλέον έλεγχος για storage/terminal
                        if (this.isSameStructureTypeTransfer(source, target)) {
                            return; // Αγνόησε αυτό το task
                        }
                        tasks.push(this.createTask(roomName, source, target, 'deliver'));
                    }
                });
            });
        } else {
            // ΛΕΙΤΟΥΡΓΙΑ CLEANUP
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
                    // ΑΠΟΦΥΓΗ storage->storage μεταφορών
                    if (source.id !== storage.id) {
                        tasks.push(this.createTask(roomName, source, storageTarget, 'cleanup'));
                    }
                });
            }
        }
        
        tasks.sort((a, b) => b.priority - a.priority);
        roomMemory.energyTasks = tasks;
    },

    /**
     * ΕΛΕΓΧΟΣ ΜΕΤΑΦΟΡΑΣ ΑΠΟ ΤΟ ΙΔΙΟ ΕΙΔΟΣ ΔΟΜΗΜΑΤΟΣ
     */
    isSameStructureTypeTransfer: function(source, target) {
        // Αν και τα δύο είναι storage ή terminal
        if ((source.type === 'storage' && target.type === 'storage') ||
            (source.type === 'terminal' && target.type === 'terminal') ||
            (source.type === 'storageLink' && target.type === 'storageLink')) {
            return true;
        }
        
        // Αποφυγή μεταφοράς από terminal σε storage ή αντίστροφα (αν δεν είναι επιθυμητό)
        if ((source.type === 'terminal' && target.type === 'storage') ||
            (source.type === 'storage' && target.type === 'terminal')) {
            return true;
        }
        
        return false;
    },

    /**
     * ΕΥΡΕΣΗ ΣΤΟΧΩΝ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΕΝΕΡΓΕΙΑ - CPU Optimized
     */
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
                case STRUCTURE_FACTORY :
                    priority=PRIORITIES.FACTORY;
                    condition=energyAmount<capacity*TARGET_FULL_PERCENT.FACTORY;
                    break;
                default:
                    return;
            }

            if (condition) {
                targets.push({ id: s.id, type: s.structureType, priority: priority, obj: s });
            }
        });

        // Controller Container
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

    /**
     * ΕΥΡΕΣΗ ΠΗΓΩΝ ΓΙΑ ΣΥΓΚΕΚΡΙΜΕΝΟ ΣΤΟΧΟ
     */
    findSourcesForTarget: function(room, target) {
        const sources = [];
        
        // 1. DROPPED ENERGY (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 200
        }).forEach(energy => sources.push({
            id: energy.id, type: 'dropped', priority: PRIORITIES.DROP_ENERGY, obj: energy
        }));
  
        // 2. STRUCTURES (Containers, Terminal, Links, Storage)
        room.find(FIND_STRUCTURES).forEach(s => {
            let priority = 0;
            let condition = false;

            // ΑΠΟΦΥΓΗ της πηγής να είναι ο ίδιος στόχος
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
                        priority = PRIORITIES.TERMINAL_SOURCE; // Χρησιμοποιούμε διαφορετική προτεραιότητα
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
        
        // 3. RUINS
        room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 50
        }).forEach(ruin => sources.push({
            id: ruin.id, type: 'ruin', priority: PRIORITIES.RUIN, obj: ruin
        }));

        return sources.sort((a, b) => b.priority - a.priority);
    },

    /**
     * ΕΥΡΕΣΗ ΠΗΓΩΝ ΓΙΑ CLEANUP (ΜΕΤΑΦΟΡΑ ΣΤΟ STORAGE)
     */
    findCleanupSources: function(room) {
        const sources = [];
        const storage = room.storage;
        
        // 1. DROPPED ENERGY, RUINS
        this.findSourcesForTarget(room, {id: null}).forEach(source => {
            if (source.type === 'dropped' || source.type === 'ruin') {
                sources.push(source);
            }
        });

        // 2. CONTAINERS, STORAGE LINK, TERMINAL (με περιορισμούς)
        room.find(FIND_STRUCTURES).forEach(s => {
            // ΑΠΟΦΥΓΗ storage ως πηγή για cleanup
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
                    // Terminal μόνο αν έχει πολύ ενέργεια και δεν υπάρχουν άλλες πηγές
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
    
    /**
     * ΔΗΜΙΟΥΡΓΙΑ TASK (Χρήση μόνο ID)
     */
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

    /**
     * ΕΛΕΓΧΟΣ AN TO CONTAINER ΕΙΝΑΙ ΔΙΠΛΑ ΣΕ SOURCE
     */
    isContainerNearSource: function(container) {
        return container.pos.findInRange(FIND_SOURCES, 2).length > 0;
    },
    
    // ********* ΔΙΑΧΕΙΡΙΣΗ HAULERS *********

    /**
     * ΔΙΑΧΕΙΡΙΣΗ HAULERS ΚΑΙ ΑΝΑΘΕΣΗ TASKS
     */
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

        // Καθαρισμός assignments για νεκρούς haulers
        for (const haulerName in assignments) {
            if (!Game.creeps[haulerName]) {
                const assignedTask = assignments[haulerName];
                if (assignedTask) {
                    delete reservations[assignedTask.taskId];
                }
                delete assignments[haulerName];
            }
        }

        // Ανάθεση tasks σε haulers
        haulers.forEach(hauler => {
            this.assignTaskToHauler(hauler, tasks, assignments, reservations);
        });

        // Εκτέλεση tasks από haulers
        haulers.forEach(hauler => {
            this.runHaulerWithTask(hauler, assignments[hauler.name]);
        });
    },

    /**
     * ΑΝΑΘΕΣΗ TASK ΣΕ HAULER
     */
    assignTaskToHauler: function(hauler, tasks, assignments, reservations) {
        const currentAssignment = assignments[hauler.name];

        // 1. Έλεγχος τρέχοντος assignment
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

        // 2. Εύρεση νέου task
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

    /**
     * ΕΥΡΕΣΗ ΚΑΛΥΤΕΡΟΥ TASK ΓΙΑ HAULER - ΒΕΛΤΙΩΜΕΝΗ ΜΕ ΑΠΟΣΤΑΣΗ (CPU Optimized)
     */
    findBestTaskForHauler: function(hauler, tasks, reservations) {
        if (tasks.length === 0) return null;

        let bestTask = null;
        let bestScore = -Infinity;

        // Ελέγχουμε μόνο τα 10 κορυφαία tasks (μείωση CPU)
        const topTasks = tasks.slice(0, 10); 

        for (const task of topTasks) {
            const reservation = reservations[task.id];
            
            if (reservation && reservation.haulerName !== hauler.name) {
                continue;
            }
            
            const target = Game.getObjectById(task.targetId);
            if (!target) continue;
            
            const distance = hauler.pos.getRangeTo(target);
            
            // Score = Προτεραιότητα - Ποινή Απόστασης
            const distancePenalty = distance * 0.1; 
            const totalScore = task.priority - distancePenalty;
            
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestTask = task;
            }
        }

        return bestTask;
    },

    /**
     * ΕΛΕΓΧΟΣ ΕΓΚΥΡΟΤΗΤΑΣ TASK
     */
    validateTask: function(task) {
        const source = Game.getObjectById(task.sourceId);
        const target = Game.getObjectById(task.targetId);
        
        if (!source || !target) return false;

        // Έλεγχος ότι source και target δεν είναι το ίδιο
        if (source.id === target.id) return false;

        const hasEnergy = this.checkSourceHasEnergy(source, task.sourceType);
        const canAcceptEnergy = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;

        return hasEnergy && canAcceptEnergy;
    },

    /**
     * ΕΚΤΕΛΕΣΗ HAULER ΜΕ TASK
     */
    runHaulerWithTask: function(creep, assignment) {
        if (creep.ticksToLive < MIN_LIFE_TO_LIVE && creep.room.memory.recoveryContainerId) {
            creep.memory.role = "to_be_recycled";
            return;
        }

        if (!assignment) {
            return;
        }
        
        const isCarrying = creep.store[RESOURCE_ENERGY] > 0;

        if (!isCarrying) {
            this.collectFromSource(creep, assignment);
        } else {
            this.deliverToTarget(creep, assignment);
        }
    },

    /**
     * ΣΥΛΛΟΓΗ ΑΠΟ ΠΗΓΗ
     */
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
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 6 });
        }
    },

    /**
     * ΠΑΡΑΔΟΣΗ ΣΕ ΣΤΟΧΟ
     */
    deliverToTarget: function(creep, assignment) {
        const target = Game.getObjectById(assignment.targetId);
        
        if (!target) {
            this.completeTask(creep);
            return;
        }

        // Έλεγχος ότι δεν προσπαθούμε να μεταφέρουμε στο ίδιο αντικείμενο
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
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 6 });
        }
    },

    /**
     * ΕΛΕΓΧΟΣ AN Η ΠΗΓΗ ΕΧΕΙ ΕΝΕΡΓΕΙΑ
     */
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

    /**
     * ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ ΑΠΟ ΠΗΓΗ
     */
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

   /**
    * ΟΛΟΚΛΗΡΩΣΗ TASK
    */
   completeTask: function(creep) {
        const roomName = creep.memory.homeRoom;
        const roomMemory = Memory.rooms[roomName].logistics;
        const assignments = roomMemory.haulerAssignments;
        const reservations = roomMemory.taskReservations;
        
        if (assignments[creep.name]) {
            delete reservations[assignments[creep.name].taskId];
            delete assignments[creep.name];
            
            // ΆΜΕΣΗ ΕΠΑΝΑΝΑΘΕΣΗ ΝΕΟΥ TASK
            const tasks = roomMemory.energyTasks;
            this.assignTaskToHauler(creep, tasks, assignments, reservations);
        }
    },

    /**
     * ΚΑΘΑΡΙΣΜΟΙ TASKS
     */
    cleanupTasks: function(roomMemory) {
        const now = Game.time;
        roomMemory.energyTasks = roomMemory.energyTasks.filter(task => (now - task.created) < 50);
    },

    /**
     * ΚΑΘΑΡΙΣΜΟΙ RESERVATIONS
     */
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

    /**
     * ΒΟΗΘΗΤΙΚΗ: ΕΜΦΑΝΙΣΗ ΠΛΗΡΟΦΟΡΙΩΝ TASKS
     */
    showTasksInfo: function(room) {
        const visual = new RoomVisual(room.name);
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
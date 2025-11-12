// manager.logistics.js - ΒΕΛΤΙΩΜΕΝΟ ΜΕ RUINS SUPPORT
const logisticsManager = {
    // Αρχικοποίηση μνήμης
    init: function() {
        if (!Memory.energyQueue) {
            Memory.energyQueue = {};
        }
        if (!Memory.haulerAssignments) {
            Memory.haulerAssignments = {};
        }
    },

    run: function(roomName) {
        this.init();
        
        const room = Game.rooms[roomName];
        if (!room) return;

        // Ενημέρωση ουράς κάθε 5 ticks
        if (Game.time % 5 === 0) {
            this.updateEnergyQueue(room);
        }

        // Διαχείριση haulers κάθε 3 ticks
        if (Game.time % 3 === 0) {
            this.manageHaulers(room);
        }

        // Καθαρισμός ουράς κάθε 100 ticks
        if (Game.time % 100 === 0) {
            this.cleanupQueue(room);
        }
    },

    /**
     * ΕΝΗΜΕΡΩΣΗ ΟΥΡΑΣ ENERGY SOURCES
     */
    updateEnergyQueue: function(room) {
        const roomName = room.name;
        
        if (!Memory.energyQueue[roomName]) {
            Memory.energyQueue[roomName] = [];
        }

        const queue = Memory.energyQueue[roomName];
        const currentSources = new Set();

        // 1. ΠΡΟΣΘΗΚΗ DROPPED ENERGY (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 20
        });

        droppedEnergy.forEach(energy => {
            const priority = this.calculateDroppedEnergyPriority(energy);
            this.addToQueue(roomName, {
                id: energy.id,
                type: 'dropped',
                pos: { x: energy.pos.x, y: energy.pos.y },
                amount: energy.amount,
                priority: priority,
                timestamp: Game.time
            });
            currentSources.add(energy.id);
        });

        // 2. ΠΡΟΣΘΗΚΗ RUINS (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ - ΣΥΝΗΘΩΣ ΠΕΡΙΣΣΟΤΕΡΗ ΕΝΕΡΓΕΙΑ)
        const ruins = room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 20
        });

        ruins.forEach(ruin => {
            const priority = this.calculateRuinPriority(ruin);
            this.addToQueue(roomName, {
                id: ruin.id,
                type: 'ruin',
                pos: { x: ruin.pos.x, y: ruin.pos.y },
                amount: ruin.store[RESOURCE_ENERGY],
                priority: priority,
                timestamp: Game.time
            });
            currentSources.add(ruin.id);
        });

        // 3. ΠΡΟΣΘΗΚΗ CONTAINERS (ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 50
        });

        containers.forEach(container => {
            const priority = this.calculateContainerPriority(container, room);
            this.addToQueue(roomName, {
                id: container.id,
                type: 'container',
                pos: { x: container.pos.x, y: container.pos.y },
                amount: container.store[RESOURCE_ENERGY],
                priority: priority,
                timestamp: Game.time
            });
            currentSources.add(container.id);
        });

        // 4. ΠΡΟΣΘΗΚΗ STORAGE (ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000) {
            const priority = this.calculateStoragePriority(room.storage);
            this.addToQueue(roomName, {
                id: room.storage.id,
                type: 'storage',
                pos: { x: room.storage.pos.x, y: room.storage.pos.y },
                amount: room.storage.store[RESOURCE_ENERGY],
                priority: priority,
                timestamp: Game.time
            });
            currentSources.add(room.storage.id);
        }

        // ΑΦΑΙΡΕΣΗ ΠΑΛΑΙΩΝ Η ΜΗ ΔΙΑΘΕΣΙΜΩΝ SOURCES
        this.cleanQueue(roomName, currentSources);

        // ΤΑΞΙΝΟΜΗΣΗ ΟΥΡΑΣ ΒΑΣΕΙ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ
        this.sortQueue(roomName);
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ DROPPED ENERGY
     */
    calculateDroppedEnergyPriority: function(energy) {
        let priority = 50; // Βασική προτεραιότητα

        // Βάση ποσότητας - περισσότερη ενέργεια = υψηλότερη προτεραιότητα
        if (energy.amount > 500) priority += 30;
        else if (energy.amount > 200) priority += 20;
        else if (energy.amount > 100) priority += 10;

        // Βάση τοποθεσίας - αν είναι κοντά σε spawn/extension = υψηλότερη προτεραιότητα
        const spawns = energy.pos.findInRange(FIND_MY_SPAWNS, 5);
        if (spawns.length > 0) priority += 15;

        const extensions = energy.pos.findInRange(FIND_MY_STRUCTURES, 5, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        if (extensions.length > 0) priority += 10;

        return priority;
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ RUINS
     */
    calculateRuinPriority: function(ruin) {
        let priority = 55; // Βασική προτεραιότητα (υψηλότερη από dropped energy)

        // Βάση ποσότητας - τα ruins συνήθως έχουν περισσότερη ενέργεια
        if (ruin.store[RESOURCE_ENERGY] > 1000) priority += 40;
        else if (ruin.store[RESOURCE_ENERGY] > 500) priority += 30;
        else if (ruin.store[RESOURCE_ENERGY] > 200) priority += 20;
        else if (ruin.store[RESOURCE_ENERGY] > 100) priority += 10;

        // Βάση τοποθεσίας - αν είναι κοντά σε spawn/extension = υψηλότερη προτεραιότητα
        const spawns = ruin.pos.findInRange(FIND_MY_SPAWNS, 5);
        if (spawns.length > 0) priority += 15;

        const extensions = ruin.pos.findInRange(FIND_MY_STRUCTURES, 5, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        if (extensions.length > 0) priority += 10;

        return priority;
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ CONTAINER
     */
    calculateContainerPriority: function(container, room) {
        let priority = 40; // Βασική προτεραιότητα

        // Βάση ποσότητας
        if (container.store[RESOURCE_ENERGY] > 500) priority += 20;
        else if (container.store[RESOURCE_ENERGY] > 200) priority += 10;

        // Βάση θέσης - containers κοντά σε πηγές έχουν υψηλότερη προτεραιότητα
        const nearbySources = container.pos.findInRange(FIND_SOURCES, 3);
        if (nearbySources.length > 0) priority += 15;

        // Βάση απόστασης από spawn
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (spawn) {
            const distance = container.pos.getRangeTo(spawn.pos);
            if (distance < 10) priority += 5;
        }

        return priority;
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ STORAGE
     */
    calculateStoragePriority: function(storage) {
        let priority = 30; // Βασική προτεραιότητα (χαμηλότερη)

        // Μόνο αν έχει πολύ ενέργεια
        if (storage.store[RESOURCE_ENERGY] > 5000) priority += 10;
        else if (storage.store[RESOURCE_ENERGY] > 2000) priority += 5;

        return priority;
    },

    /**
     * ΠΡΟΣΘΗΚΗ ΣΤΗΝ ΟΥΡΑ (Η ΕΝΗΜΕΡΩΣΗ ΑΝ ΥΠΑΡΧΕΙ)
     */
    addToQueue: function(roomName, source) {
        const queue = Memory.energyQueue[roomName];
        const existingIndex = queue.findIndex(item => item.id === source.id);

        if (existingIndex >= 0) {
            // Ενημέρωση υπάρχοντος
            queue[existingIndex] = {
                ...queue[existingIndex],
                amount: source.amount,
                priority: source.priority,
                timestamp: Game.time
            };
        } else {
            // Προσθήκη νέου
            queue.push(source);
        }
    },

    /**
     * ΚΑΘΑΡΙΣΜΟΣ ΟΥΡΑΣ ΑΠΟ ΜΗ ΔΙΑΘΕΣΙΜΑ SOURCES
     */
    cleanQueue: function(roomName, currentSources) {
        const queue = Memory.energyQueue[roomName];
        Memory.energyQueue[roomName] = queue.filter(item => {
            // Κράτα μόνο τα sources που είναι ακόμα διαθέσιμα
            return currentSources.has(item.id);
        });
    },

    /**
     * ΤΑΞΙΝΟΜΗΣΗ ΟΥΡΑΣ ΒΑΣΕΙ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ (ΥΨΗΛΗ -> ΧΑΜΗΛΗ)
     */
    sortQueue: function(roomName) {
        const queue = Memory.energyQueue[roomName];
        queue.sort((a, b) => b.priority - a.priority);
    },

    /**
     * ΔΙΑΧΕΙΡΙΣΗ HAULERS ΚΑΙ ΑΝΑΘΕΣΗ ΕΡΓΑΣΙΩΝ
     */
    manageHaulers: function(room) {
        const roomName = room.name;
        const haulers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'hauler' && 
            creep.memory.homeRoom === roomName &&
            !creep.spawning
        );

        if (!Memory.haulerAssignments[roomName]) {
            Memory.haulerAssignments[roomName] = {};
        }

        const assignments = Memory.haulerAssignments[roomName];
        const queue = Memory.energyQueue[roomName] || [];

        // Καθαρισμός assignments για νεκρούς haulers
        for (const haulerName in assignments) {
            if (!Game.creeps[haulerName]) {
                delete assignments[haulerName];
            }
        }

        // Ανάθεση εργασιών σε haulers
        haulers.forEach(hauler => {
            this.assignTaskToHauler(hauler, roomName, queue, assignments);
        });

        // Εκτέλεση tasks από haulers
        haulers.forEach(hauler => {
            this.runHaulerWithTask(hauler, assignments[hauler.name]);
        });
    },

    /**
     * ΑΝΑΘΕΣΗ ΕΡΓΑΣΙΑΣ ΣΕ HAULER
     */
    assignTaskToHauler: function(hauler, roomName, queue, assignments) {
        const currentAssignment = assignments[hauler.name];

        // Έλεγχος αν ο hauler έχει ήδη task και αν είναι ακόμα έγκυρο
        if (currentAssignment) {
            const taskStillValid = queue.some(item => item.id === currentAssignment.sourceId);
            if (taskStillValid) {
                return; // Ο hauler έχει ακόμα έγκυρο task
            } else {
                // Task δεν είναι έγκυρο πια, αφαίρεσέ το
                delete assignments[hauler.name];
            }
        }

        // Εύρεση νέου task για τον hauler
        const availableTask = this.findBestTaskForHauler(hauler, queue, assignments);

        if (availableTask) {
            assignments[hauler.name] = {
                sourceId: availableTask.id,
                sourceType: availableTask.type,
                pos: availableTask.pos,
                assignedAt: Game.time,
                priority: availableTask.priority
            };
            hauler.say(`🎯 ${availableTask.type}`);
            console.log(`🚚 Hauler ${hauler.name} assigned to ${availableTask.type} (prio: ${availableTask.priority})`);
        }
    },

    /**
     * ΕΥΡΕΣΗ ΚΑΛΥΤΕΡΟΥ TASK ΓΙΑ HAULER
     */
    findBestTaskForHauler: function(hauler, queue, assignments) {
        if (queue.length === 0) return null;

        // Λίστα με ήδη ανατεθειμένα tasks
        const assignedSourceIds = new Set();
        for (const haulerName in assignments) {
            assignedSourceIds.add(assignments[haulerName].sourceId);
        }

        // Βρες το task με την υψηλότερη προτεραιότητα που δεν έχει ανατεθεί
        for (const task of queue) {
            if (!assignedSourceIds.has(task.id)) {
                return task;
            }
        }

        return null; // Δεν βρέθηκε διαθέσιμο task
    },

    /**
     * ΕΚΤΕΛΕΣΗ HAULER ΜΕ TASK
     */
    runHaulerWithTask: function(creep, assignment) {
        if (!assignment) {
            creep.say('😴 no task');
            return;
        }

        // State management
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 collect');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('🚚 deliver');
        }

        if (creep.memory.delivering) {
            this.deliverEnergy(creep);
        } else {
            this.collectFromAssignedSource(creep, assignment);
        }
    },

    /**
     * ΣΥΛΛΟΓΗ ΑΠΟ ΑΝΑΤΕΘΕΙΜΕΝΗ ΠΗΓΗ
     */
    collectFromAssignedSource: function(creep, assignment) {
        let source;

        switch (assignment.sourceType) {
            case 'dropped':
                source = Game.getObjectById(assignment.sourceId);
                if (!source || source.amount === 0) {
                    this.completeTask(creep);
                    return;
                }
                if (creep.pos.isNearTo(source)) {
                    creep.pickup(source);
                } else {
                    creep.moveTo(source, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 6
                    });
                }
                break;

            case 'ruin':
                source = Game.getObjectById(assignment.sourceId);
                if (!source || source.store[RESOURCE_ENERGY] === 0) {
                    this.completeTask(creep);
                    return;
                }
                if (creep.pos.isNearTo(source)) {
                    creep.withdraw(source, RESOURCE_ENERGY);
                } else {
                    creep.moveTo(source, {
                        visualizePathStyle: { stroke: '#ff5500' },
                        reusePath: 6
                    });
                }
                break;

            case 'container':
            case 'storage':
                source = Game.getObjectById(assignment.sourceId);
                if (!source || source.store[RESOURCE_ENERGY] === 0) {
                    this.completeTask(creep);
                    return;
                }
                if (creep.pos.isNearTo(source)) {
                    creep.withdraw(source, RESOURCE_ENERGY);
                } else {
                    creep.moveTo(source, {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 6
                    });
                }
                break;
        }
    },

    /**
     * ΠΑΡΑΔΟΣΗ ΕΝΕΡΓΕΙΑΣ
     */
    deliverEnergy: function(creep) {
        const targets = this.getDeliveryTargets(creep);
        
        for (const target of targets) {
            const transferResult = creep.transfer(target, RESOURCE_ENERGY);
            
            if (transferResult === OK) {
                return;
            } else if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: { stroke: '#ffffff' },
                    reusePath: 6
                });
                return;
            }
        }
    },

    /**
     * ΟΛΟΚΛΗΡΩΣΗ TASK
     */
    completeTask: function(creep) {
        const roomName = creep.memory.homeRoom;
        if (Memory.haulerAssignments[roomName]) {
            delete Memory.haulerAssignments[roomName][creep.name];
        }
        creep.say('✅ task done');
    },

    /**
     * ΠΡΟΟΡΙΣΜΟΙ ΠΑΡΑΔΟΣΗΣ
     */
    getDeliveryTargets: function(creep) {
        const room = creep.room;
        const targets = [];
        
        // Προτεραιότητα 1: Spawns
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        targets.push(...spawns);
        
        // Προτεραιότητα 2: Extensions
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        targets.push(...extensions);
        
        // Προτεραιότητα 3: Controller Container (αν energy < 500)
        if (room.memory.controllerContainerId) {
            const controllerContainer = Game.getObjectById(room.memory.controllerContainerId);
            if (controllerContainer && controllerContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && 
                controllerContainer.store[RESOURCE_ENERGY] < 1500) {
                targets.push(controllerContainer);
            }
        }
        
        // Προτεραιότητα 4: Towers
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 300
        });
        targets.push(...towers);
        
        // Προτεραιότητα 5: Storage
        if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            targets.push(room.storage);
        }
        
        return targets;
    },

    /**
     * ΚΑΘΑΡΙΣΜΟΣ ΟΥΡΑΣ ΑΠΟ ΠΑΛΑΙΑ TASKS
     */
    cleanupQueue: function(room) {
        const roomName = room.name;
        if (!Memory.energyQueue[roomName]) return;

        const now = Game.time;
        Memory.energyQueue[roomName] = Memory.energyQueue[roomName].filter(task => {
            // Κράτα tasks που είναι νεότερα από 50 ticks
            return (now - task.timestamp) < 50;
        });
    },

    /**
     * ΒΟΗΘΗΤΙΚΗ: ΕΜΦΑΝΙΣΗ ΠΛΗΡΟΦΟΡΙΩΝ ΟΥΡΑΣ
     */
    showQueueInfo: function(room) {
        const visual = new RoomVisual(room.name);
        const queue = Memory.energyQueue[room.name] || [];
        
        let y = 10;
        visual.text(`Queue: ${queue.length} tasks`, 1, y++, { align: 'left', color: '#ffff00' });
        
        queue.slice(0, 5).forEach((task, index) => {
            const info = `${task.type}:${task.amount} (prio:${task.priority})`;
            visual.text(info, 1, y++, { align: 'left', color: '#ffffff' });
        });
    }
};

module.exports = logisticsManager;
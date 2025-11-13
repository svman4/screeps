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
        if (!Memory.taskReservations) {
            Memory.taskReservations = {};
        }
        if (!Memory.deliveryReservations) {
            Memory.deliveryReservations = {};
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

        // Καθαρισμός ουράς και reservations κάθε 100 ticks
        if (Game.time % 100 === 0) {
            this.cleanupQueue(room);
            this.cleanupReservations(room);
            this.cleanupDeliveryReservations(room);
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
                         s.id!=room.memory.controllerContainerId &&
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
        if (energy.amount > 500) priority += 50;
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
        let priority = 60; // Βασική προτεραιότητα (υψηλότερη από dropped energy)

        // Βάση ποσότητας - τα ruins συνήθως έχουν περισσότερη ενέργεια
        if (ruin.store[RESOURCE_ENERGY] > 1000) priority += 13;
        else if (ruin.store[RESOURCE_ENERGY] > 500) priority += 12;
        else if (ruin.store[RESOURCE_ENERGY] > 200) priority += 11;
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
        if (!Memory.taskReservations[roomName]) {
            Memory.taskReservations[roomName] = {};
        }

        const assignments = Memory.haulerAssignments[roomName];
        const reservations = Memory.taskReservations[roomName];
        const queue = Memory.energyQueue[roomName] || [];

        // Καθαρισμός assignments για νεκρούς haulers
        for (const haulerName in assignments) {
            if (!Game.creeps[haulerName]) {
                delete assignments[haulerName];
            }
        }

        // Καθαρισμός παλιών reservations
        this.cleanupReservations(room);

        // Ανάθεση εργασιών σε haulers
        haulers.forEach(hauler => {
            this.assignTaskToHauler(hauler, roomName, queue, assignments, reservations);
        });

        // Εκτέλεση tasks από haulers
        haulers.forEach(hauler => {
            this.runHaulerWithTask(hauler, assignments[hauler.name]);
        });
    },

    /**
     * ΑΝΑΘΕΣΗ ΕΡΓΑΣΙΑΣ ΣΕ HAULER
     */
   assignTaskToHauler: function(hauler, roomName, queue, assignments, reservations) {
        const currentAssignment = assignments[hauler.name];

        // Έλεγχος αν ο hauler έχει ήδη task και αν είναι ακόμα έγκυρο
        if (currentAssignment) {
            const taskStillValid = this.validateTask(currentAssignment.sourceId, currentAssignment.sourceType);
            if (taskStillValid) {
                return; // Ο hauler έχει ακόμα έγκυρο task
            } else {
                // Task δεν είναι έγκυρο πια, αφαίρεσέ το
                delete assignments[hauler.name];
                // Αφαίρεση reservation
                delete reservations[currentAssignment.sourceId];
            }
        }

        // Εύρεση νέου task για τον hauler
        const availableTask = this.findBestTaskForHauler(hauler, queue, reservations);

        if (availableTask) {
            // Δημιουργία reservation για αυτό το task
            reservations[availableTask.id] = {
                haulerName: hauler.name,
                reservedAt: Game.time,
                priority: availableTask.priority
            };

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
    findBestTaskForHauler: function(hauler, queue, reservations) {
        if (queue.length === 0) return null;

        // Βρες tasks που δεν έχουν reservation ή έχουν λήξει τα reservations
        const availableTasks = queue.filter(task => {
            const reservation = reservations[task.id];
            
            // Αν δεν υπάρχει reservation, το task είναι διαθέσιμο
            if (!reservation) return true;
            
            // Αν το reservation έχει λήξει (πάνω από 50 ticks), το task είναι διαθέσιμο
            if (Game.time - reservation.reservedAt > 50) {
                delete reservations[task.id];
                return true;
            }
            
            // Αν ο hauler που έχει το reservation είναι νεκρός, το task είναι διαθέσιμο
            if (!Game.creeps[reservation.haulerName]) {
                delete reservations[task.id];
                return true;
            }
            
            return false;
        });

        if (availableTasks.length === 0) return null;

        // Επίλεξε το task με την υψηλότερη προτεραιότητα
        return availableTasks[0];
    },
 validateTask: function(sourceId, sourceType) {
        const source = Game.getObjectById(sourceId);
        if (!source) return false;

        switch (sourceType) {
            case 'dropped':
                return source.amount > 20;
            case 'ruin':
                return source.store[RESOURCE_ENERGY] > 20;
            case 'container':
            case 'storage':
                return source.store[RESOURCE_ENERGY] > 50;
            default:
                return false;
        }
    },
    cleanupReservations: function(room) {
        const roomName = room.name;
        if (!Memory.taskReservations[roomName]) return;

        const reservations = Memory.taskReservations[roomName];
        const now = Game.time;

        for (const sourceId in reservations) {
            const reservation = reservations[sourceId];
            
            // Διάγραψε reservations που είναι παλιά (> 100 ticks)
            if (now - reservation.reservedAt > 100) {
                delete reservations[sourceId];
                continue;
            }
            
            // Διάγραψε reservations για haulers που δεν υπάρχουν πια
            if (!Game.creeps[reservation.haulerName]) {
                delete reservations[sourceId];
            }
        }
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
        const target = this.findDeliveryTargetForHauler(creep);
        
        if (!target) {
            // Αναζήτηση emergency targets χωρίς reservations
            const emergencyTargets = this.getEmergencyTargets(creep);
            if (emergencyTargets.length > 0) {
                const emergencyTarget = creep.pos.findClosestByRange(emergencyTargets);
                if (emergencyTarget) {
                    this.transferToTarget(creep, emergencyTarget);
                    return;
                }
            }
            creep.say('😴 no target');
            return;
        }

        this.transferToTarget(creep, target);
    },
    transferToTarget: function(creep, target) {
        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
        
        if (transferResult === OK) {
            this.clearDeliveryReservation(creep.room.name, target.id);
            //creep.say('✅ delivered');
        } else if (transferResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ffffff' },
                reusePath: 6
            });
        } else {
            this.clearDeliveryReservation(creep.room.name, target.id);
            creep.say('❌ delivery error');
        }
    },
    getEmergencyTargets: function(creep) {
        const room = creep.room;
        const targets = [];
        
        // Προσθήκη όλων των πιθανών στόχων χωρίς reservations
        targets.push(...room.find(FIND_MY_SPAWNS, {
            filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        }));
        
        targets.push(...room.find(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || 
                         s.structureType === STRUCTURE_TOWER) && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        }));
        
        if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            targets.push(room.storage);
        }
        
        return targets;
    },
    clearDeliveryReservation: function(roomName, targetId) {
        if (Memory.deliveryReservations[roomName] && 
            Memory.deliveryReservations[roomName][targetId]) {
            delete Memory.deliveryReservations[roomName][targetId];
        }
    },

     findDeliveryTargetForHauler: function(creep) {
        const room = creep.room;
        const roomName = room.name;
        
        if (!Memory.deliveryReservations[roomName]) {
            Memory.deliveryReservations[roomName] = {};
        }

        const reservations = Memory.deliveryReservations[roomName];
        
        // Καθαρισμός παλιών reservations
        this.cleanupDeliveryReservations(room);

        // Λίστα με όλους τους πιθανούς στόχους χωρίς reservations
        let allTargets = [];
        
        // 1. Spawns & Extensions (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const spawnExtensions = this.findSpawnAndExtensionTargets(room, reservations, creep);
        allTargets.push(...spawnExtensions.map(target => ({ target, priority: 100 })));
        
        // 2. Towers (ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const towers = this.findTowerTargets(room, reservations);
        allTargets.push(...towers.map(target => ({ target, priority: 80 })));
        
        // 3. Controller Container (ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const controllerContainers = this.findControllerContainerTargets(room, reservations);
        allTargets.push(...controllerContainers.map(target => ({ target, priority: 70 })));
        
        // 4. Storage (ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const storages = this.findStorageTargets(room, reservations);
        allTargets.push(...storages.map(target => ({ target, priority: 50 })));

        // Φιλτράρισμα targets που έχουν ήδη reservations
        const availableTargets = allTargets.filter(({ target }) => {
            const reservation = reservations[target.id];
            return !reservation || 
                   reservation.haulerName === creep.name || 
                   (Game.time - reservation.timestamp > 25);
        });

        if (availableTargets.length === 0) {
            return null;
        }

        // Ταξινόμηση βάσει προτεραιότητας και απόστασης
        availableTargets.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            // Αν ίδια προτεραιότητα, επιλογή του πλησιέστερου
            const distA = creep.pos.getRangeTo(a.target.pos);
            const distB = creep.pos.getRangeTo(b.target.pos);
            return distA - distB;
        });

        // Επιστροφή του καλύτερου target
        const bestTarget = availableTargets[0].target;
        
        // Δημιουργία reservation
        reservations[bestTarget.id] = {
            haulerName: creep.name,
            timestamp: Game.time,
            room: roomName
        };
        
        return bestTarget;
    },

   

    /**
     * ΚΑΘΑΡΙΣΜΟΣ ΟΥΡΑΣ ΚΑΙ RESERVATIONS
     */
    cleanupQueue: function(room) {
        const roomName = room.name;
        if (!Memory.energyQueue[roomName]) return;

        const now = Game.time;
        Memory.energyQueue[roomName] = Memory.energyQueue[roomName].filter(task => {
            return (now - task.timestamp) < 50;
        });
    },

    /**
     * ΚΑΘΑΡΙΣΜΟΣ TASK RESERVATIONS
     */
    cleanupReservations: function(room) {
        const roomName = room.name;
        if (!Memory.taskReservations[roomName]) return;

        const reservations = Memory.taskReservations[roomName];
        const now = Game.time;

        for (const sourceId in reservations) {
            const reservation = reservations[sourceId];
            
            if (now - reservation.reservedAt > 100) {
                delete reservations[sourceId];
                continue;
            }
            
            if (!Game.creeps[reservation.haulerName]) {
                delete reservations[sourceId];
            }
        }
    },
    cleanupDeliveryReservations: function(room) {
        const roomName = room.name;
        if (!Memory.deliveryReservations[roomName]) return;

        const reservations = Memory.deliveryReservations[roomName];
        const now = Game.time;

        for (const targetId in reservations) {
            const reservation = reservations[targetId];
            
            // Διάγραψε reservations που είναι παλιά (> 50 ticks)
            if (now - reservation.timestamp > 50) {
                delete reservations[targetId];
                continue;
            }
            
            // Διάγραψε reservations για haulers που δεν υπάρχουν πια
            if (!Game.creeps[reservation.haulerName]) {
                delete reservations[targetId];
            }
            
            // Διάγραψε reservations για targets που δεν χρειάζονται πια ενέργεια
            const target = Game.getObjectById(targetId);
            if (target && target.store) {
                if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    delete reservations[targetId];
                }
            }
        }
    },
    findControllerContainerTargets: function(room, reservations) {
        if (!room.memory.controllerContainerId) return [];
        
        const controllerContainer = Game.getObjectById(room.memory.controllerContainerId);
        if (controllerContainer && 
            controllerContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && 
            controllerContainer.store[RESOURCE_ENERGY] < 1500) {
            return [controllerContainer];
        }
        return [];
    },
     reserveTargetForHauler: function(creep, targets, reservations) {
        if (targets.length === 0) return null;

        // Επιλογή του πλησιέστερου target
        const target = creep.pos.findClosestByRange(targets);
        
        if (target) {
            // Δημιουργία reservation
            reservations[target.id] = {
                haulerName: creep.name,
                timestamp: Game.time,
                room: creep.room.name
            };
            return target;
        }
        
        return null;
    },
      findStorageTargets: function(room, reservations) {
        if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            return [room.storage];
        }
        return [];
    },

    
    findTowerTargets: function(room, reservations) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        const needyTowers = towers.filter(tower => {
            const hasHostiles = room.find(FIND_HOSTILE_CREEPS).length > 0;
            const isVeryLow = tower.store[RESOURCE_ENERGY] < 200;
            const isLowAndNoHostiles = tower.store[RESOURCE_ENERGY] < 400 && !hasHostiles;
            
            return isVeryLow || isLowAndNoHostiles;
        });

        return needyTowers;
    },
findSpawnAndExtensionTargets: function(room, reservations, creep) {
        const targets = [];
        
        // Spawns - με έλεγχο reservations
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        spawns.forEach(spawn => {
            const reservation = reservations[spawn.id];
            if (!reservation || reservation.haulerName === creep.name || 
                (Game.time - reservation.timestamp > 25)) {
                targets.push(spawn);
            }
        });
        
        // Extensions - χωρίς περιορισμούς reservations (για να αποφευχθεί το no target)
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        
        // Προσθήκη όλων των extensions στους στόχους
        targets.push(...extensions);
        
        return targets;
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

    getDeliveryTargets: function(creep) {
    const room = creep.room;
    const targets = [];
    
    // Προτεραιότητα 1: Spawns & Extensions
    const spawns = room.find(FIND_MY_SPAWNS, {
        filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    targets.push(...spawns);
    
    const extensions = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION && 
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    targets.push(...extensions);
    
    // Προτεραιότητα 2: Towers - ΕΞΥΠΝΗ ΛΟΓΙΚΗ
    const towers = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER && 
                     s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    
    const needyTowers = towers.filter(tower => {
        // Αν το tower είναι σχεδόν άδειο (< 200) ή αν υπάρχει κίνδυνος επίθεσης
        const hasHostiles = room.find(FIND_HOSTILE_CREEPS).length > 0;
        const isVeryLow = tower.store[RESOURCE_ENERGY] < 200;
        const isLowAndNoHostiles = tower.store[RESOURCE_ENERGY] < 400 && !hasHostiles;
        
        return isVeryLow || isLowAndNoHostiles;
    });
    
    targets.push(...needyTowers);
    
    // Προτεραιότητα 3: Controller Container
    if (room.memory.controllerContainerId) {
        const controllerContainer = Game.getObjectById(room.memory.controllerContainerId);
        if (controllerContainer && controllerContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && 
            controllerContainer.store[RESOURCE_ENERGY] < 1500) {
            targets.push(controllerContainer);
        }
    }
    
    // Προτεραιότητα 4: Storage
    if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        targets.push(room.storage);
    }
    
    // Προτεραιότητα 5: Όλα τα υπόλοιπα towers
    const remainingTowers = towers.filter(tower => !needyTowers.includes(tower));
    targets.push(...remainingTowers);
    
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
// manager.logistics.js - ΒΕΛΤΙΩΜΕΝΗ ΛΟΓΙΚΗ ΜΕ PRIORITY-BASED ENERGY DISTRIBUTION
//
// ΒΑΣΙΚΗ ΛΟΓΙΚΗ:
// 1. ΠΡΩΤΑ ελέγχουμε ποιοί στόχοι χρειάζονται ενέργεια (spawn, extensions, towers, controller container)
// 2. Για την πλήρωση τους, χρησιμοποιούμε πηγές με την ακόλουθη ΠΡΟΤΕΡΑΙΟΤΗΤΑ:
//    - Δropped Energy (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
//    - Containers στα Sources
//    - Recovery Container  
//    - Ruins
//    - Terminal
//    - Storage Link
//    - Storage (ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
// 3. Αν ΔΕΝ υπάρχουν στόχοι που χρειάζονται ενέργεια, τότε μεταφέρουμε ενέργεια από διάφορες πηγές στο Storage
// 4. Κάθε μεταφορά (transfer) ολοκληρώνει το task - ΔΕΝ χρειάζεται να γεμίσει ο στόχος ή να αδειάσει η πηγή
// 5. ΑΠΟΦΥΓΗ storage->storage μεταφορών

const PRIORITIES = {
    // Προτεραιότητες Στόχων
    SPAWN_EXTENSION: 100,
    TOWER: 80,
    CONTROLLER_CONTAINER: 70,
    LAB:40,
    TERMINAL:40,
    STORAGE: 10,
    
    // Προτεραιότητες Πηγών (για ανάκτηση)
    DROP_ENERGY: 100,
    SOURCE_CONTAINER: 90,
    RECOVERY_CONTAINER: 85,
    RUIN: 80,
    TERMINAL: 75,
    STORAGE_LINK: 70,
    STORAGE_SOURCE: 5
};

const MIN_LIFE_TO_LIVE = 50;

const logisticsManager = {
    /**
     * ΑΡΧΙΚΟΠΟΙΗΣΗ ΜΝΗΜΗΣ ΔΩΜΑΤΙΟΥ
     */
    init: function(roomName) {
        if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {logistics:{}};
        }

        
        if (!Memory.rooms[roomName].logistics) {
            Memory.rooms[roomName].logistics={};
        
        }
        const roomMemory = Memory.rooms[roomName].logistics;
        
        if (!roomMemory.energyTasks) {
            roomMemory.energyTasks = [];
        }
        if (!roomMemory.haulerAssignments) {
            roomMemory.haulerAssignments = {};
        }
        if (!roomMemory.taskReservations) {
            roomMemory.taskReservations = {};
        }
    },

    /**
     * ΚΥΡΙΑ ΛΕΙΤΟΥΡΓΙΑ
     */
    run: function(roomName) {
        this.init(roomName);
        
        const room = Game.rooms[roomName];
        if (!room) return;

        // Ενημέρωση tasks κάθε 5 ticks
        if (Game.time % 5 === 0) {
            this.updateEnergyTasks(room);
        }

        // Διαχείριση haulers κάθε tick
        if (Game.time % 1 === 0) {
            this.manageHaulers(room);
        }

        // Καθαρισμός tasks και reservations κάθε 50 ticks
        if (Game.time % 30 === 0) {
            this.cleanupTasks(room);
            this.cleanupReservations(room);
        }
    },

    /**
     * ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΠΡΟΣΒΑΣΗΣ ΜΝΗΜΗΣ
     */
    getRoomMemory: function(roomName) {
        return Memory.rooms[roomName].logistics || {};
    },

    getEnergyTasks: function(roomName) {
        return this.getRoomMemory(roomName).energyTasks || [];
    },

    setEnergyTasks: function(roomName, tasks) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        Memory.rooms[roomName].logistics.energyTasks = tasks;
    },

    getHaulerAssignments: function(roomName) {
        return this.getRoomMemory(roomName).haulerAssignments || {};
    },

    setHaulerAssignments: function(roomName, assignments) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        Memory.rooms[roomName].logistics.haulerAssignments = assignments;
    },

    getTaskReservations: function(roomName) {
        return this.getRoomMemory(roomName).taskReservations || {};
    },

    setTaskReservations: function(roomName, reservations) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        Memory.rooms[roomName].logistics.taskReservations = reservations;
    },

    /**
     * ΕΝΗΜΕΡΩΣΗ ENERGY TASKS - ΚΕΝΤΡΙΚΗ ΛΟΓΙΚΗ
     */ 
    updateEnergyTasks: function(room) {
        const roomName = room.name;
        const tasks = [];
        
        // ΒΗΜΑ 1: ΕΥΡΕΣΗ ΣΤΟΧΩΝ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΕΝΕΡΓΕΙΑ
        const deliveryTargets = this.findDeliveryTargets(room);
        
        if (deliveryTargets.length > 0) {
            // ΛΕΙΤΟΥΡΓΙΑ ΠΛΗΡΩΣΗΣ: Υπάρχουν στόχοι που χρειάζονται ενέργεια
            deliveryTargets.forEach(target => {
                const sources = this.findSourcesForTarget(room, target);
                sources.forEach(source => {
                    // Δημιουργία task για κάθε πηγή που μπορεί να τροφοδοτήσει τον στόχο
                    tasks.push(this.createTask(roomName, source, target, 'deliver'));
                });
            });
        } else {
            // ΛΕΙΤΟΥΡΓΙΑ CLEANUP: Μεταφορά ενέργειας από διάφορες πηγές στο Storage
            const cleanupSources = this.findCleanupSources(room);
            const storage = room.storage;
            
            if (storage && cleanupSources.length > 0) {
                cleanupSources.forEach(source => {
                    // Δημιουργία task για μεταφορά από πηγή στο storage
                    tasks.push(this.createTask(roomName, source, storage, 'cleanup'));
                });
            }
        }
        
        // Ταξινόμηση tasks βάσει προτεραιότητας
        tasks.sort((a, b) => b.priority - a.priority);
        this.setEnergyTasks(roomName, tasks);
    },

    /**
     * ΕΥΡΕΣΗ ΣΤΟΧΩΝ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΕΝΕΡΓΕΙΑ
     */
    findDeliveryTargets: function(room) {
        const targets = [];
        
        // 1. SPAWNS & EXTENSIONS (100% πλήρωση - ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        targets.push(...spawns.map(spawn => ({
            id: spawn.id,
            type: 'spawn',
            priority: PRIORITIES.SPAWN_EXTENSION,
            obj: spawn
        })));
        
        const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && 
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        targets.push(...extensions.map(ext => ({
            id: ext.id,
            type: 'extension', 
            priority: PRIORITIES.SPAWN_EXTENSION,
            obj: ext
        })));

        // 2. TOWERS (80% πλήρωση - ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && 
                         s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.8
        });
        targets.push(...towers.map(tower => ({
            id: tower.id,
            type: 'tower',
            priority: PRIORITIES.TOWER,
            obj: tower
        })));

        const labs = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB && 
                         s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 1
        });
        targets.push(...labs.map(lab => ({
            id: lab.id,
            type: 'lab',
            priority: PRIORITIES.LAB,
            obj: lab
        })));


        const terminal = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TERMINAL && 
                         s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.2
        });
        targets.push(...terminal.map(terminal => ({
            id: terminal.id,
            type: 'terminal',
            priority: PRIORITIES.TERMINAL,
            obj: terminal
        })));
        
        // 3. CONTROLLER CONTAINER (50% πλήρωση - ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        if (room.memory.controllerContainerId) {
            const controllerContainer = Game.getObjectById(room.memory.controllerContainerId);
            if (controllerContainer && 
                controllerContainer.store[RESOURCE_ENERGY] < controllerContainer.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                targets.push({
                    id: controllerContainer.id,
                    type: 'controllerContainer',
                    priority: PRIORITIES.CONTROLLER_CONTAINER,
                    obj: controllerContainer
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
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
        });
        sources.push(...droppedEnergy.map(energy => ({
            id: energy.id,
            type: 'dropped',
            priority: PRIORITIES.DROP_ENERGY,
            obj: energy
        })));

        // 2. CONTAINERS ΣΤΑ SOURCES
        const sourceContainers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 100 &&
                         this.isContainerNearSource(s)
        });
        sources.push(...sourceContainers.map(container => ({
            id: container.id,
            type: 'sourceContainer',
            priority: PRIORITIES.SOURCE_CONTAINER,
            obj: container
        })));

        // 3. RECOVERY CONTAINER
        if (room.memory.recoveryContainerId) {
            const recoveryContainer = Game.getObjectById(room.memory.recoveryContainerId);
            if (recoveryContainer && recoveryContainer.store[RESOURCE_ENERGY] > 100) {
                sources.push({
                    id: recoveryContainer.id,
                    type: 'recoveryContainer',
                    priority: PRIORITIES.RECOVERY_CONTAINER,
                    obj: recoveryContainer
                });
            }
        }

        // 4. RUINS
        const ruins = room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 50
        });
        sources.push(...ruins.map(ruin => ({
            id: ruin.id,
            type: 'ruin',
            priority: PRIORITIES.RUIN,
            obj: ruin
        })));

        // 5. TERMINAL
        if (room.terminal && room.terminal.store[RESOURCE_ENERGY] > 1000) {
            sources.push({
                id: room.terminal.id,
                type: 'terminal',
                priority: PRIORITIES.TERMINAL,
                obj: room.terminal
            });
        }

        // 6. STORAGE LINK
        if (room.memory.storageLinkId) {
            const storageLink = Game.getObjectById(room.memory.storageLinkId);
            if (storageLink && storageLink.store[RESOURCE_ENERGY] > 100) {
                sources.push({
                    id: storageLink.id,
                    type: 'storageLink',
                    priority: PRIORITIES.STORAGE_LINK,
                    obj: storageLink
                });
            }
        }

        // 7. STORAGE (ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ - ΜΟΝΟ ΑΝ ΑΠΟΤΕΛΕΣΜΑΤΙΚΑ ΧΡΕΙΑΖΕΤΑΙ)
        if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000) {
            sources.push({
                id: room.storage.id,
                type: 'storage',
                priority: PRIORITIES.STORAGE_SOURCE,
                obj: room.storage
            });
        }

        return sources.sort((a, b) => b.priority - a.priority);
    },

    /**
     * ΕΥΡΕΣΗ ΠΗΓΩΝ ΓΙΑ CLEANUP (ΜΕΤΑΦΟΡΑ ΣΤΟ STORAGE)
     */
    findCleanupSources: function(room) {
        const sources = [];
        
        // 1. DROPPED ENERGY (ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ)
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
        });
        sources.push(...droppedEnergy.map(energy => ({
            id: energy.id,
            type: 'dropped',
            priority: PRIORITIES.DROP_ENERGY,
            obj: energy
        })));

        // 2. CONTAINERS ΣΤΑ SOURCES
        const sourceContainers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                         s.store[RESOURCE_ENERGY] > 100 &&
                         this.isContainerNearSource(s)
        });
        sources.push(...sourceContainers.map(container => ({
            id: container.id,
            type: 'sourceContainer',
            priority: PRIORITIES.SOURCE_CONTAINER,
            obj: container
        })));

        // 3. RECOVERY CONTAINER
        if (room.memory.recoveryContainerId) {
            const recoveryContainer = Game.getObjectById(room.memory.recoveryContainerId);
            if (recoveryContainer && recoveryContainer.store[RESOURCE_ENERGY] > 100) {
                sources.push({
                    id: recoveryContainer.id,
                    type: 'recoveryContainer',
                    priority: PRIORITIES.RECOVERY_CONTAINER,
                    obj: recoveryContainer
                });
            }
        }

        // 4. RUINS
        const ruins = room.find(FIND_RUINS, {
            filter: ruin => ruin.store[RESOURCE_ENERGY] > 50
        });
        sources.push(...ruins.map(ruin => ({
            id: ruin.id,
            type: 'ruin',
            priority: PRIORITIES.RUIN,
            obj: ruin
        })));

        // 5. STORAGE LINK
        if (room.memory.storageLinkId) {
            const storageLink = Game.getObjectById(room.memory.storageLinkId);
            if (storageLink && storageLink.store[RESOURCE_ENERGY] > 100) {
                sources.push({
                    id: storageLink.id,
                    type: 'storageLink',
                    priority: PRIORITIES.STORAGE_LINK,
                    obj: storageLink
                });
            }
        }

        return sources.sort((a, b) => b.priority - a.priority);
    },

    /**
     * ΔΗΜΙΟΥΡΓΙΑ TASK
     */
    createTask: function(roomName, source, target, taskType) {
        const taskId = `${source.id}-${target.id}-${Game.time}`;
        
        return {
            id: taskId,
            room: roomName,
            sourceId: source.id,
            sourceType: source.type,
            sourceObj: source.obj,
            targetId: target.id,
            targetType: target.type,
            targetObj: target.obj,
            taskType: taskType,
            priority: source.priority + target.priority,
            created: Game.time
        };
    },

    /**
     * ΕΛΕΓΧΟΣ AN TO CONTAINER ΕΙΝΑΙ ΔΙΠΛΑ ΣΕ SOURCE
     */
    isContainerNearSource: function(container) {
        const nearbySources = container.pos.findInRange(FIND_SOURCES, 2);
        return nearbySources.length > 0;
    },

    /**
     * ΔΙΑΧΕΙΡΙΣΗ HAULERS ΚΑΙ ΑΝΑΘΕΣΗ TASKS
     */
    manageHaulers: function(room) {
        const roomName = room.name;
        const haulers = _.filter(Game.creeps, creep => 
            creep.memory.role === 'hauler' && 
            creep.memory.homeRoom === roomName &&
            !creep.spawning
        );

        const assignments = this.getHaulerAssignments(roomName);
        const reservations = this.getTaskReservations(roomName);
        const tasks = this.getEnergyTasks(roomName);

        // Καθαρισμός assignments για νεκρούς haulers
        for (const haulerName in assignments) {
            if (!Game.creeps[haulerName]) {
                delete assignments[haulerName];
            }
        }

        // Καθαρισμός παλιών reservations
        this.cleanupReservations(room);

        // Ανάθεση tasks σε haulers
        haulers.forEach(hauler => {
            this.assignTaskToHauler(hauler, roomName, tasks, assignments, reservations);
        });

        // Αποθήκευση των assignments και reservations
        this.setHaulerAssignments(roomName, assignments);
        this.setTaskReservations(roomName, reservations);

        // Εκτέλεση tasks από haulers
        haulers.forEach(hauler => {
            this.runHaulerWithTask(hauler, assignments[hauler.name]);
        });
    },

    /**
     * ΑΝΑΘΕΣΗ TASK ΣΕ HAULER
     */
    assignTaskToHauler: function(hauler, roomName, tasks, assignments, reservations) {
        const currentAssignment = assignments[hauler.name];

        // Αν ο hauler έχει ήδη task, ελέγχουμε αν είναι έγκυρο
        if (currentAssignment) {
            const taskStillValid = this.validateTask(currentAssignment);
            if (taskStillValid) {
                return; // Ο hauler συνεχίζει με το τρέχον task
            } else {
                // Task δεν είναι έγκυρο - απελευθέρωση
                delete assignments[hauler.name];
                delete reservations[currentAssignment.taskId];
            }
        }

        // Εύρεση νέου task για τον hauler
        const availableTask = this.findBestTaskForHauler(hauler, tasks, reservations);

        if (availableTask) {
            // Κράτηση task
            reservations[availableTask.id] = {
                haulerName: hauler.name,
                reservedAt: Game.time
            };

            // Ανάθεση task στον hauler
            assignments[hauler.name] = {
                taskId: availableTask.id,
                sourceId: availableTask.sourceId,
                sourceType: availableTask.sourceType,
                targetId: availableTask.targetId,
                targetType: availableTask.targetType,
                taskType: availableTask.taskType,
                assignedAt: Game.time
            };
            
            //hauler.say(`🎯 ${availableTask.taskType}`);
        }
    },

    /**
     * ΕΥΡΕΣΗ ΚΑΛΥΤΕΡΟΥ TASK ΓΙΑ HAULER
     */
    /**
 * ΕΥΡΕΣΗ ΚΑΛΥΤΕΡΟΥ TASK ΓΙΑ HAULER - ΒΕΛΤΙΩΜΕΝΗ ΜΕ ΑΠΟΣΤΑΣΗ
 */
findBestTaskForHauler: function(hauler, tasks, reservations) {
    if (tasks.length === 0) return null;

    // Φιλτράρισμα tasks που είναι διαθέσιμα (δεν έχουν reservation ή το reservation έχει λήξει)
    const availableTasks = tasks.filter(task => {
        const reservation = reservations[task.id];
        
        if (!reservation) return true;
        
        // Reservation έχει λήξει (25 ticks)
        if (Game.time - reservation.reservedAt > 25) {
            delete reservations[task.id];
            return true;
        }
        
        // Hauler του reservation δεν υπάρχει πλέον
        if (!Game.creeps[reservation.haulerName]) {
            delete reservations[task.id];
            return true;
        }
        
        return false;
    });

    if (availableTasks.length === 0) return null;

    // ΒΕΛΤΙΩΜΕΝΗ ΛΟΓΙΚΗ: Επιλογή task βάσει προτεραιότητας ΚΑΙ απόστασης
    let bestTask = null;
    let bestScore = -Infinity;

    availableTasks.forEach(task => {
        // Βασική προτεραιότητα από το task
        const basePriority = task.priority;
        
        // Υπολογισμός απόστασης από τον hauler προς τον στόχο
        const target = Game.getObjectById(task.targetId);
        if (!target) return;
        
        const distance = hauler.pos.getRangeTo(target);
        
        // ΥΠΟΛΟΓΙΣΜΟΣ SCORE: 
        // - Βασική προτεραιότητα (60% βάρους)
        // - Απόσταση (40% βάρους - μικρότερη απόσταση = υψηλότερο score)
        const priorityScore = basePriority * 0.6;
        const distanceScore = (50 - Math.min(distance, 50)) * 0.4; // Μέγιστη απόσταση 50, αντιστρέφουμε
        
        const totalScore = priorityScore + distanceScore;
        
        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestTask = task;
        }
    });

    return bestTask;
},

    /**
     * ΕΛΕΓΧΟΣ ΕΓΚΥΡΟΤΗΤΑΣ TASK
     */
    validateTask: function(task) {
        const source = Game.getObjectById(task.sourceId);
        const target = Game.getObjectById(task.targetId);
        
        if (!source || !target) return false;

        // Ελέγχουμε αν η πηγή έχει ενέργεια
        let hasEnergy = false;
        switch (task.sourceType) {
            case 'dropped':
                hasEnergy = source.amount > 20;
                break;
            case 'ruin':
                hasEnergy = source.store[RESOURCE_ENERGY] > 20;
                break;
            case 'sourceContainer':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage':
                hasEnergy = source.store[RESOURCE_ENERGY] > 50;
                break;
            default:
                hasEnergy = false;
        }

        // Ελέγχουμε αν ο στόχος μπορεί να δεχτεί ενέργεια
        let canAcceptEnergy = false;
        switch (task.targetType) {
            case 'spawn':
            case 'extension':
            case 'tower':
            case 'controllerContainer':
                canAcceptEnergy = target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                break;
            case 'storage':
                canAcceptEnergy = target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                break;
            default:
                canAcceptEnergy = false;
        }

        return hasEnergy && canAcceptEnergy;
    },

    /**
     * ΕΚΤΕΛΕΣΗ HAULER ΜΕ TASK
     */
    runHaulerWithTask: function(creep, assignment) {
        // Έλεγχος αν ο hauler είναι πολύ παλιός για recycling
        if (creep.ticksToLive < MIN_LIFE_TO_LIVE && creep.room.memory.recoveryContainerId) {
            creep.memory.role = "to_be_recycled";
            return;
        }

        if (!assignment) {
            //creep.say('😴 no task');
            return;
        }

        // Λογική μεταφοράς: 
        // - Αν ο hauler ΔΕΝ έχει ενέργεια, πάει στην πηγή
        // - Αν ο hauler έχει ενέργεια, πάει στον στόχο
        // - Μετά από κάθε επιτυχημένη μεταφορά, το task ολοκληρώνεται

        if (creep.store[RESOURCE_ENERGY] === 0) {
            // ΦΑΣΗ ΣΥΛΛΟΓΗΣ: Ο hauler δεν έχει ενέργεια, πάει στην πηγή
            this.collectFromSource(creep, assignment);
        } else {
            // ΦΑΣΗ ΠΑΡΑΔΟΣΗΣ: Ο hauler έχει ενέργεια, πάει στον στόχο
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

        // Έλεγχος αν η πηγή έχει ενέργεια
        const hasEnergy = this.checkSourceHasEnergy(source, assignment.sourceType);
        if (!hasEnergy) {
            this.completeTask(creep);
            return;
        }

        if (creep.pos.isNearTo(source)) {
            // Σύλληξη ενέργειας από την πηγή
            const result = this.withdrawFromSource(creep, source, assignment.sourceType);
            if (result === OK) {
                //creep.say('📥 collected');
            } else {
                this.completeTask(creep);
            }
        } else {
            // Μετακίνηση προς την πηγή
            creep.moveTo(source, {
                visualizePathStyle: { stroke: '#ffaa00' },
                reusePath: 6
            });
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

        // Έλεγχος αν ο στόχος μπορεί να δεχτεί ενέργεια
        const canAccept = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        if (!canAccept) {
            this.completeTask(creep);
            return;
        }

        if (creep.pos.isNearTo(target)) {
            // Παράδοση ενέργειας στον στόχο
            const result = creep.transfer(target, RESOURCE_ENERGY);
            
            if (result === OK) {
                //creep.say('📤 delivered');
                this.completeTask(creep); // ΟΛΟΚΛΗΡΩΣΗ TASK ΜΕΤΑ ΑΠΟ ΕΠΙΤΥΧΗΜΕΝΗ ΜΕΤΑΦΟΡΑ
            } else if (result === ERR_FULL) {
                this.completeTask(creep); // Στόχος γεμάτος - ολοκλήρωση task
            } else {
                this.completeTask(creep); // Σφάλμα - ολοκλήρωση task
            }
        } else {
            // Μετακίνηση προς τον στόχο
            creep.moveTo(target, {
                visualizePathStyle: { stroke: '#ffffff' },
                reusePath: 6
            });
        }
    },

    /**
     * ΕΛΕΓΧΟΣ AN Η ΠΗΓΗ ΕΧΕΙ ΕΝΕΡΓΕΙΑ
     */
    checkSourceHasEnergy: function(source, sourceType) {
        switch (sourceType) {
            case 'dropped':
                return source.amount > 20;
            case 'ruin':
                return source.store[RESOURCE_ENERGY] > 20;
            case 'sourceContainer':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage':
                return source.store[RESOURCE_ENERGY] > 50;
            default:
                return false;
        }
    },

    /**
     * ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ ΑΠΟ ΠΗΓΗ
     */
    withdrawFromSource: function(creep, source, sourceType) {
        switch (sourceType) {
            case 'dropped':
                return creep.pickup(source);
            case 'ruin':
            case 'sourceContainer':
            case 'recoveryContainer':
            case 'terminal':
            case 'storageLink':
            case 'storage':
                return creep.withdraw(source, RESOURCE_ENERGY);
            default:
                return ERR_INVALID_ARGS;
        }
    },

   completeTask: function(creep) {
    const roomName = creep.memory.homeRoom;
    const assignments = this.getHaulerAssignments(roomName);
    const reservations = this.getTaskReservations(roomName);
    
    if (assignments[creep.name]) {
        // Αφαίρεση reservation
        delete reservations[assignments[creep.name].taskId];
        // Αφαίρεση assignment
        delete assignments[creep.name];
        
        this.setHaulerAssignments(roomName, assignments);
        this.setTaskReservations(roomName, reservations);
        
        // 🔥 ΑΜΕΣΗ ΕΠΑΝΑΝΑΘΕΣΗ ΝΕΟΥ TASK
        const tasks = this.getEnergyTasks(roomName);
        this.assignTaskToHauler(creep, roomName, tasks, assignments, reservations);
        
        // Αποθήκευση των νέων assignments
        this.setHaulerAssignments(roomName, assignments);
        this.setTaskReservations(roomName, reservations);
    }
    
    //creep.say('✅ task done');
},

    /**
     * ΚΑΘΑΡΙΣΜΟΙ
     */
    cleanupTasks: function(room) {
        const roomName = room.name;
        const tasks = this.getEnergyTasks(roomName);
        const now = Game.time;
        
        // Διατήρηση tasks μόνο για 50 ticks
        const filteredTasks = tasks.filter(task => (now - task.created) < 50);
        this.setEnergyTasks(roomName, filteredTasks);
    },

    cleanupReservations: function(room) {
        const roomName = room.name;
        const reservations = this.getTaskReservations(roomName);
        const now = Game.time;

        for (const taskId in reservations) {
            const reservation = reservations[taskId];
            
            // Διαγραφή reservations που είναι παλιά (100 ticks)
            if (now - reservation.reservedAt > 100) {
                delete reservations[taskId];
                continue;
            }
            
            // Διαγραφή reservations για haulers που δεν υπάρχουν πλέον
            if (!Game.creeps[reservation.haulerName]) {
                delete reservations[taskId];
            }
        }
        this.setTaskReservations(roomName, reservations);
    },

    /**
     * ΒΟΗΘΗΤΙΚΗ: ΕΜΦΑΝΙΣΗ ΠΛΗΡΟΦΟΡΙΩΝ TASKS
     */
    showTasksInfo: function(room) {
        const visual = new RoomVisual(room.name);
        const tasks = this.getEnergyTasks(room.name);
        
        let y = 10;
        visual.text(`Tasks: ${tasks.length}`, 1, y++, { align: 'left', color: '#ffff00' });
        
        tasks.slice(0, 5).forEach((task, index) => {
            const info = `${task.taskType}: ${task.sourceType}->${task.targetType} (prio:${task.priority})`;
            visual.text(info, 1, y++, { align: 'left', color: '#ffffff' });
        });
    }
};

module.exports = logisticsManager;
/**
 * MODULE: Global Spawn Manager
 * VERSION: 3.0.0
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί την κλάση SpawnQueue
 * για τη διαχείριση των αιτημάτων και το populationManager για το Recovery Mode.
 * * CHANGE LOG:
  3.0.0: - Κλείδωμα του προ-υπολογισμένου `body` απευθείας στην ουρά (addRoleToQueue).
 *        - Υλοποίηση συστήματος "Anti-Energy-Stealing" στην processQueue για αποφυγή
 *          κατανάλωσης ενέργειας από χαμηλότερης προτεραιότητας creeps.
 * 2.9.0: - Κατάργηση της ενιαίας createNewCreep.
 *        - Διαχωρισμός σε handleCountBasedNeed (για simple/static Harvesters) 
 *          και handlePartsBasedNeed (για Workers/Haulers) για καλύτερο efficiency.
 * 2.8.0: - Υλοποίηση προηγμένης createNewCreep με Logic Consolidation.
 * - Προσθήκη Thresholds για αποφυγή παραγωγής αναποτελεσματικών creeps.
 * - Αυτόματη αναβάθμιση πληθυσμού όταν αυξάνεται το energyCapacity του δωματίου.
 * 2.7.0: Υλοποίηση parts-based spawning. Αντικατάσταση TODO με countPartsInRoom logic.
 * 2.6.0: Απόσπαση της διαχείρισης ουράς στην κλάση SpawnQueue.
 */
const debugConsole = require("utils.debugConsole");
const SpawnQueue = require('spawn.SpawnQueue');
const PopulationManager = require('spawn.populationManager');
const { ROLES, POPULATION_MODULE_CONFIG, POPULATION_GLOBAL_CONFIG, BODY_ENERGY_LIMITS, PRIORITY, SPAWN_MANAGER_CONFIG } = require('./spawn.constants');

class SpawnManager {
    constructor() {
        this.queue = new SpawnQueue();
        this.populationManager = new PopulationManager();
    }

    /**
     * Κεντρική μέθοδος που τρέχει σε κάθε tick.
     */
    run() {
        this.cleanup();

        // Εκτύπωση της ουράς για debugging
        //if (this.queue.length > 0) {
        //debugConsole.debugObject("spawnManager", "--- Current Spawn Queue " + this.queue.length + " ---", this.queue);
        //}
        // Έλεγχος αναγκών για κάθε δωμάτιο που ελέγχουμε
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                this.checkRoomNeeds(roomName);
            }
        }

        // Επεξεργασία της ουράς και εκτέλεση του spawning
        this.processQueue();
    }

    /**
     * Αναλύει τις ανάγκες του δωματίου και αποφασίζει αν θα ζητήσει νέα creeps.
     */
    checkRoomNeeds(roomName) {
        // Ενημέρωση των ορίων (limits) βάσει της τρέχουσας κατάστασης του δωματίου
        if (Game.time % SPAWN_MANAGER_CONFIG.POPULATION_LIMIT_REFRESH_RATE === 0 || !Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY]) {
            // Κάθε 50tick ή αν δεν υπάρχει πληθυσμός.
            this.populationManager.updateRoomLimits(roomName);

        }
        const limits = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY];
        if (!limits) return;
        debugConsole.debugObject("spawnManager", `Checking needs for ${roomName}`, limits);
        /*
            {
  "creeps": {
    "simpleHarvester": 0,
    "staticHarvester": 2
  },
  "parts": {
    "hauler": 11,
    "upgrader": 18,
    "builder": 0
  },
  "isRecovery": false
}
        */
        // 1. Έλεγχος βάσει αριθμού Creeps (κυρίως για Harvesters σε Recovery/Early stage)
        return;
        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
                const currentCount = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role).length;
                const targetCount = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP][role];
                //TODO δημιουργεί staticHarverter με 6 work χωρίς carry parts παρ΄όλο που στον έλεγχο είχαμε link.
                if (currentCount < targetCount) {
                    this.handleCountBasedNeed(roomName, role, currentCount, targetCount);
                }
            }
        }
        return;
        // 2. Έλεγχος βάσει Body Parts (για Scaling & Efficiency)
        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
                const targetParts = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS][role];
                const currentParts = this.countPartsInRoom(roomName, role);

                //this.handlePartsBasedNeed(roomName, role, currentParts, targetParts);
            }
        }
    }
    /**
     * Διαχείριση αναγκών με βάση το ΠΛΗΘΟΣ των creeps (π.χ. Harvesters).
     */
    handleCountBasedNeed(roomName, role, currentCount, targetCount) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const maxEnergyAvailable = room.energyCapacityAvailable;
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];

        // Στο recovery, βγάζουμε άμεσα ό,τι αντέχει η τρέχουσα ενέργεια
        if (isRecovery) {
            this.addRoleToQueue(roomName, role, room.energyAvailable);
            return;
        }

        // Υπολογίζουμε το κόστος του "ιδανικού" creep για το τρέχον RCL/Energy Capacity
        const sampleBody = this.calculateBody(role, maxEnergyAvailable, roomName);
        const bodyCost = this.getBodyCost(sampleBody);

        // Αν έχουμε έλλειμμα, σπρώχνουμε στην ουρά με budget το κόστος αυτού του creep
        this.addRoleToQueue(roomName, role, bodyCost);
    }
    /**
         * Διαχείριση αναγκών με βάση τα BODY PARTS (π.χ. Haulers, Upgraders, Builders).
         */
    handlePartsBasedNeed(roomName, role, currentParts, targetParts) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const maxBudget = room.energyCapacityAvailable;
        const sampleBody = this.calculateBody(role, maxBudget, roomName);
        const bodyCost = this.getBodyCost(sampleBody);

        const primaryPart = (role === ROLES.HAULER || role === ROLES.LD_HAULER) ? CARRY : WORK;
        const partsPerMaxCreep = _.filter(sampleBody, p => p === primaryPart).length;
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];

        // 1. Περίπτωση Ελλείμματος (Deficit)
        if (currentParts < targetParts) {
            if (isRecovery) {
                this.addRoleToQueue(roomName, role, room.energyAvailable);
                return;
            }

            const deficit = targetParts - currentParts;
            // Κατώφλι (threshold): Μην βγάλεις creep αν πρόκειται να έχει κάτω από το 40% των parts του μέγιστου δυνατού, 
            // ΕΚΤΟΣ αν η ενέργεια στο δωμάτιο είναι ήδη γεμάτη (οπότε δεν κερδίζεις κάτι περιμένοντας).
            const threshold = Math.max(1, Math.floor(partsPerMaxCreep * 0.4));

            if (deficit >= threshold || room.energyAvailable >= bodyCost) {
                this.addRoleToQueue(roomName, role, bodyCost);
            }
            return;
        }

        // 2. Περίπτωση Αναβάθμισης (Consolidation Logic)
        // Αν έχουμε τα parts αλλά είναι μοιρασμένα σε πολλά μικρά/παλιά creeps, κάνουμε upgrade σε μεγαλύτερα
        if (!isRecovery) {
            const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role);
            if (creepsInRoom.length <= 1) return;

            const smallestCreep = _.min(creepsInRoom, c => c.getActiveBodyparts(primaryPart));
            const smallestParts = smallestCreep.getActiveBodyparts(primaryPart);

            // Αν το μέγιστο creep που μπορούμε να βγάλουμε τώρα είναι τουλάχιστον διπλάσιο από το μικρότερο που κυκλοφορεί
            // και έχουμε την ενέργεια, κάνουμε trigger την αντικατάστασή του.
            if (partsPerMaxCreep >= smallestParts * 2 && room.energyAvailable >= maxBudget * 0.9) {
                debugConsole.debugText("spawnManager", `Consolidating/Upgrading ${role} in ${roomName}`);
                this.addRoleToQueue(roomName, role, maxBudget);
            }
        }
    }
    /**
     * Η "καρδιά" του Spawner. Αποφασίζει αν πρέπει να γίνει spawn και αν αξίζει η επένδυση.
     * @param {string} roomName Το δωμάτιο που αφορά το αίτημα.
     * @param {string} role Ο ρόλος του creep.
     * @param {number} current Τρέχουσα τιμή (counts ή parts).
     * @param {number} target Στόχος (counts ή parts).
     * @param {boolean} isCountBased Αν ο έλεγχος γίνεται με αριθμό creeps ή parts.
     @Deprecated
     */
    createNewCreep(roomName, role, current, target, isCountBased) {
        const room = Game.rooms[roomName];
        if (!room) return;

        // 1. Προετοιμασία δεδομένων
        const maxEnergyAvailable = room.energyCapacityAvailable;

        const maxBudget = maxEnergyAvailable;

        const sampleBody = this.calculateBody(role, maxBudget, roomName);
        const bodyCost = this.getBodyCost(sampleBody);

        const primaryPart = (role === ROLES.HAULER || role === ROLES.LD_HAULER) ? CARRY : WORK;
        const partsPerMaxCreep = _.filter(sampleBody, p => p === primaryPart).length;
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];

        // 2. Έλεγχος Ελλείμματος (Deficit Logic)
        if (current < target) {
            this._handleLowPopulation(room, role, current, target, partsPerMaxCreep, bodyCost, isRecovery);
            return; // Σημαντικό: σταματάμε εδώ αν βρήκαμε ανάγκη
        }

        // 3. Έλεγχος Αναβάθμισης (Consolidation Logic)
        if (!isRecovery && !isCountBased) {
            this._handlePopulationUpgrade(room, role, primaryPart, partsPerMaxCreep, maxBudget);
        }
    }
    _handleLowPopulation(room, role, current, target, partsPerMaxCreep, bodyCost, isRecovery) {
        if (isRecovery) {
            this.addRoleToQueue(room.name, role, room.energyAvailable); // Στο recovery χρησιμοποιούμε ό,τι έχουμε
            return;
        }

        const deficit = target - current;
        const threshold = Math.max(1, Math.floor(partsPerMaxCreep * 0.4));

        if (deficit >= threshold || room.energyAvailable >= bodyCost) {
            // Εδώ υπολογίζουμε το "έξυπνο" budget: 
            // Μόνο όσο χρειάζεται για να καλύψουμε το έλλειμμα, αλλά όχι πάνω από το όριο του role
            this.addRoleToQueue(room.name, role, bodyCost);
        }
    }

    _handlePopulationUpgrade(room, role, primaryPart, partsPerMaxCreep, maxBudget) {
        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === room.name && c.memory.role === role);
        if (creepsInRoom.length <= 1) return;

        const smallestCreep = _.min(creepsInRoom, c => c.getActiveBodyparts(primaryPart));
        const smallestParts = smallestCreep.getActiveBodyparts(primaryPart);

        if (partsPerMaxCreep >= smallestParts * 2 && room.energyAvailable >= maxBudget * 0.9) {
            debugConsole.debugText("spawnManager", `Upgrading ${role} in ${room.name}`);
            this.addRoleToQueue(room.name, role, maxBudget);
        }
    }
    _handlePopulationUpgrade(room, role, primaryPart, partsPerMaxCreep, maxBudget) {
        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === room.name && c.memory.role === role);
        if (creepsInRoom.length <= 1) return;

        const smallestCreep = _.min(creepsInRoom, c => c.getActiveBodyparts(primaryPart));
        const smallestParts = smallestCreep.getActiveBodyparts(primaryPart);

        if (partsPerMaxCreep >= smallestParts * 2 && room.energyAvailable >= maxBudget * 0.9) {
            debugConsole.debugText("spawnManager", `Upgrading ${role} in ${room.name}`);
            this.addRoleToQueue(room.name, role, maxBudget);
        }
    }
    // TODO τι κάνει αυτό.
    /**
    * Προσθήκη αιτήματος στην ουρά με κλειδωμένο προ-υπολογισμένο body.
    */
    addRoleToQueue(roomName, role, budget, body) {
        const request = {
            role: role,
            targetRoom: roomName,
            priority: PRIORITY[role] || 50,
            energyBudget: budget,
            body: body, // Κλείδωμα του body!
            addedAt: Game.time
        };
        //debugConsole.debugObject("spawnManager","roleToQueue",request);
        this.queue.add(request);
    }
    addRoleToQueue(roomName, role, budget) {
        const answer = {
            role: role,
            targetRoom: roomName,
            priority: PRIORITY[role] || 50,
            energyBudget: budget,
            addedAt: Game.time
        };

        this.queue.add(answer);
    }

    /**
     * Μετράει το σύνολο των ενεργών body parts ενός συγκεκριμένου τύπου σε ένα δωμάτιο.
     */
    countPartsInRoom(roomName, role) {
        const primaryPart = (role === ROLES.HAULER || role === ROLES.LD_HAULER) ? CARRY : WORK;
        const creeps = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role && (!c.ticksToLive || c.ticksToLive > 50));
        return _.sum(creeps, c => c.getActiveBodyparts(primaryPart));
    }

    /**
     * Επεξεργάζεται την ουρά και αναθέτει παραγωγή στα διαθέσιμα Spawns.
     */
    processQueue() {
        if (this.queue.length === 0) return;
        //TODO δεν δημιουργεί σωστά τα creep.

        for (let i = 0; i < this.queue.length; i++) {
            const request = this.queue.getAt(i);
            const spawn = this.findBestSpawn(request);
            debugConsole.debugObject("spawn", "process", request);

            if (spawn) {
                const energyToUse = Math.min(spawn.room.energyAvailable, request.energyBudget || spawn.room.energyAvailable);
                const body = this.calculateBody(request.role, energyToUse, request.targetRoom);
                const name = `${request.role}_${Game.time % 10000}`;

                const result = spawn.spawnCreep(body, name, {
                    memory: {
                        role: request.role,
                        homeRoom: request.targetRoom,
                        bornTick: Game.time
                    }
                });

                if (result === OK) {
                    debugConsole.debugObject("spawnManager", `Spawning ${name} at ${spawn.name} for ${request.targetRoom}`);
                    this.queue.removeAt(i);
                    i--; // Διόρθωση index μετά την αφαίρεση
                }
            }
        }
    }

    /**
     * Βρίσκει το καταλληλότερο Spawn για ένα αίτημα.
     */
    findBestSpawn(request) {
        // Προτεραιότητα σε spawns του ίδιου δωματίου
        const localSpawns = _.filter(Game.spawns, s => s.room.name === request.targetRoom && !s.spawning);
        if (localSpawns.length > 0) return localSpawns[0];

        // Fallback σε άλλα δωμάτια αν επιτρέπεται (εκτός από βασικούς Harvesters)
        if (request.role !== ROLES.STATIC_HARVESTER && request.role !== ROLES.SIMPLE_HARVESTER) {
            const remoteSpawns = _.filter(Game.spawns, s => !s.spawning && Game.map.getRoomLinearDistance(s.room.name, request.targetRoom) <= 2);
            if (remoteSpawns.length > 0) return remoteSpawns[0];
        }

        return null;
    }

    /**
     * Υπολογίζει το βέλτιστο σώμα βάσει διαθέσιμης ενέργειας και ρόλου.
     */
    calculateBody(role, maxEnergy, roomName) {
        let body = [];
        const hasRoads = Memory.rooms[roomName] ? Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.HAVE_ROAD_KEY] : false;

        switch (role) {
            case ROLES.STATIC_HARVESTER:
                body = [WORK, WORK, MOVE]; // Minimum base
                let workParts = 2;
                // Οι Static Harvesters χρειάζονται max 5-6 WORK. Πάνω από 800 energy είναι overkill.
                while (this.getBodyCost(body) + 100 <= maxEnergy && workParts < 6) {
                    body.push(WORK);
                    workParts++;
                }
                break;
            case ROLES.HAULER:
                // 2:1 ratio CARRY:MOVE αν υπάρχουν δρόμοι, 1:1 αν όχι
                let hParts = 0;
                const costPerUnit = hasRoads ? 150 : 100; // [C,C,M] vs [C,M]
                while (this.getBodyCost(body) + costPerUnit <= maxEnergy && hParts < 20) {
                    if (hasRoads) {
                        body.push(CARRY, CARRY, MOVE);
                    } else {
                        body.push(CARRY, MOVE);
                    }
                    hParts++;
                }
                break;
            case ROLES.UPGRADER:
                let uParts = 0;
                while (this.getBodyCost(body) + 200 <= maxEnergy && uParts < 15) {
                    body.push(WORK, CARRY, MOVE);
                    uParts++;
                }
                break;
            case ROLES.SIMPLE_HARVESTER:
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

    /**
     * Επιστρέφει το κόστος ενός σώματος σε ενέργεια.
     */
    getBodyCost(body) {
        return _.sum(body, part => BODYPART_COST[part]);
    } // end of getBodyCost

    /**
     * Καθαρισμός της Memory από νεκρά creeps.
     */
    cleanup() {
        if (Game.time % 100 === 0) {
            for (const name in Memory.creeps) {
                if (!Game.creeps[name]) {
                    delete Memory.creeps[name];
                }
            }
        }
    } // end of cleanUp
} // end of class SpawnManager

module.exports = new SpawnManager();
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
            this.queue.flushOnRoom(roomName); // Καθαρισμός ουράς για το δωμάτιο σε περίπτωση αλλαγής ορίων
            debugConsole.debugObject("spawnManager", `Checking needs for ${roomName}`, limits);
        }
        const limits = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY];
        if (!limits) return;
        //debugConsole.debugObject("spawnManager", `Checking needs for ${roomName}`, limits);
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

        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
                const currentCount = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role).length;
                const targetCount = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP][role];

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
        // TODO ελεγχος για σηκωμένες σημαίες αντικατάστασης.
    } // end of checkRoomNeeds
    /**
     * Διαχείριση αναγκών με βάση το ΠΛΗΘΟΣ των creeps (π.χ. Harvesters).
     */
    handleCountBasedNeed(roomName, role, currentCount, targetCount) {
        const room = Game.rooms[roomName];
        if (!room) return;
        // Η ενέργεια του δωματίου(και ας μην υπάρχει στα extension τώρα).
        const maxEnergyAvailable = room.energyCapacityAvailable;
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];
        let body = [];
        // Για να καλεσθεί η συνάρτηση σημαίνει ότι λείπει ένα creep του συγκεκριμμένου role.

        for (let i = currentCount; i < targetCount; i++) {
            // Στο recovery, βγάζουμε άμεσα ό,τι αντέχει η τρέχουσα ενέργεια
            if (isRecovery) {
                body = this.calculateBody(roomName, role, room.energyAvailable, 0);
            } else {
                body = this.calculateBody(roomName, role, maxEnergyAvailable, 0);
            }
            if (role === ROLES.STATIC_HARVESTER) {
                this.handleStaticHarvesterNeed(roomName, this.getBodyCost(body), body);
            } else {
                this.addRoleToQueue(roomName, role, this.getBodyCost(body), body);
            }

        }
    } // end of handleCountBasedNeed
    handleStaticHarvesterNeed(roomName, budget, body) {
        const room = Game.rooms[roomName];
        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === roomName);
        const sources = room.find(FIND_SOURCES);
        const roleName = ROLES.STATIC_HARVESTER;
        sources.forEach(source => {

            const harvesterAtSource = _.find(creepsInRoom, c =>
                c.memory.role === roleName && c.memory.sourceId === source.id
            );

            if (!harvesterAtSource) {
                // Αν δεν έχει harvest σε αυτή την πηγή, δημιουργεί.
                this.addRoleToQueue(roomName, ROLES.STATIC_HARVESTER, budget, body, { sourceId: source.id, init: true });
                return;
            }
        });
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
    * Προσθήκη αιτήματος στην ουρά με κλειδωμένο προ-υπολογισμένο body.
    */
    addRoleToQueue(roomName, role, budget, body, memory = {}, targetRoom = "") {
        const request = {
            role: role,
            homeRoom: roomName,
            targetRoom: targetRoom || roomName,
            priority: PRIORITY[role] || 50,
            energyBudget: budget,
            body: body,
            memory: memory,
            addedAt: Game.time
        };
        debugConsole.debugObject("spawnManager", "roleToQueue", request);
        this.queue.add(request);
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

        for (let i = 0; i < this.queue.length; i++) {
            const request = this.queue.getAt(i);
            const spawn = this.findBestSpawn(request);
            debugConsole.debugObject("spawn", "processQueue", request);

            if (spawn) {
                const energyToUse = Math.min(spawn.room.energyAvailable, request.energyBudget || spawn.room.energyAvailable);
                const body = request.body;
                const name = `${request.role}_${request.homeRoom}_${Game.time % 10000}`;
                let mem = {
                    role: request.role,
                    homeRoom: request.homeRoom,
                    targetRoom: request.targetRoom,
                    ...request.memory
                };

                const result = spawn.spawnCreep(body, name, {
                    memory: mem
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
        // θα πρέπει να μπορεί να φτιάξει το body που ζηταιίαται και να μην είναι ήδη busy
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
    calculateBody(roomName, role, maxEnergy, diffParts) {
        let body = [];
        const hasRoads = Memory.rooms[roomName] ? Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.HAVE_ROAD_KEY] : false;
        const hasLinks = Memory.rooms[roomName] ? Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.HAVE_LINK_KEY] : false;
        let parts = 0;
        if (role === ROLES.STATIC_HARVESTER || role === ROLES.SIMPLE_HARVESTER) {
            diffParts = 5;
        }
        switch (role) {

            case ROLES.STATIC_HARVESTER:
                body = [WORK, WORK, MOVE]; // Minimum base
                parts = 2;
                if (hasLinks) {
                    body.push(CARRY);// Αν έχουμε link, προσθέτουμε ένα CARRY για να μεταφέρουμε ενέργεια στο link.
                    parts++;
                }
                // Οι Static Harvesters χρειάζονται max 5-6 WORK. Πάνω από 800 energy είναι overkill.
                while (this.getBodyCost(body) + 100 <= maxEnergy && parts < diffParts) {
                    body.push(WORK);
                    parts++;
                }
                break;
            case ROLES.SIMPLE_HARVESTER:
                parts = 0;
                while (this.getBodyCost(body) + 200 <= maxEnergy && parts < diffParts) {
                    body.push(WORK, CARRY, MOVE);
                    parts++;
                }
                break;
            case ROLES.HAULER:
                // 2:1 ratio CARRY:MOVE αν υπάρχουν δρόμοι, 1:1 αν όχι
                parts = 0;
                const costPerUnit = hasRoads ? 150 : 100; // [C,C,M] vs [C,M]
                while (this.getBodyCost(body) + costPerUnit <= maxEnergy && parts < diffParts) {
                    if (hasRoads) {
                        body.push(CARRY, CARRY, MOVE);
                        parts += 2;
                    } else {
                        body.push(CARRY, MOVE);
                        parts++;
                    }

                }
                break;
            case ROLES.UPGRADER:
                parts = 0;
                while (this.getBodyCost(body) + 200 <= maxEnergy && parts < diffParts) {
                    body.push(WORK, CARRY, MOVE);
                    parts++;
                }
                break;

            case ROLES.BUILDER:
                parts = 0;
                while (this.getBodyCost(body) + 200 <= maxEnergy && parts < diffParts) {
                    body.push(WORK, CARRY, MOVE);
                    parts++;
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
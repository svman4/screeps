/**
 * MODULE: Global Spawn Manager
 * VERSION: 2.8.0
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί την κλάση SpawnQueue
 * για τη διαχείριση των αιτημάτων και το populationManager για το Recovery Mode.
 * * CHANGE LOG:
 * 2.8.0: - Υλοποίηση προηγμένης createNewCreep με Logic Consolidation.
 * - Προσθήκη Thresholds για αποφυγή παραγωγής αναποτελεσματικών creeps.
 * - Αυτόματη αναβάθμιση πληθυσμού όταν αυξάνεται το energyCapacity του δωματίου.
 * 2.7.0: Υλοποίηση parts-based spawning. Αντικατάσταση TODO με countPartsInRoom logic.
 * 2.6.0: Απόσπαση της διαχείρισης ουράς στην κλάση SpawnQueue.
 */

const DEBUG_STATE = true;
const debugText = function (text) {
    if (DEBUG_STATE) {
        console.log(`[SpawnManager] ${text}`);
    }
}

const SpawnQueue = require('spawn.SpawnQueue');
const PopulationManager = require('spawn.populationManager');

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
        this.populationManager.updateRoomLimits(roomName);

        const limits = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY];
        if (!limits) return;

        // 1. Έλεγχος βάσει αριθμού Creeps (κυρίως για Harvesters σε Recovery/Early stage)
        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
                const currentCount = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role).length;
                const targetCount = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP][role];

                if (currentCount < targetCount) {
                    this.createNewCreep(roomName, role, currentCount, targetCount, true);
                }
            }
        }

        // 2. Έλεγχος βάσει Body Parts (για Scaling & Efficiency)
        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
                const targetParts = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS][role];
                const currentParts = this.countPartsInRoom(roomName, role);

                this.createNewCreep(roomName, role, currentParts, targetParts, false);
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
     */
    createNewCreep(roomName, role, current, target, isCountBased) {
        const room = Game.rooms[roomName];
        if (!room) return;

        // Αποφυγή πολλαπλών αιτημάτων για τον ίδιο ρόλο στην ουρά
        if (this.queue.countRequests(roomName, role) > 0) return;

        // Υπολογισμός μέγιστου δυνατού σώματος για το τρέχον RCL του δωματίου
        const maxEnergyAvailable = room.energyCapacityAvailable;
        const roleLimit = BODY_ENERGY_LIMITS[role] || 800;
        const maxBudget = Math.min(maxEnergyAvailable, roleLimit);
        const sampleBody = this.calculateBody(role, maxBudget, roomName);

        // Καθορισμός του κύριου part για τον υπολογισμό efficiency (WORK για εργάτες, CARRY για haulers)
        const primaryPart = (role === ROLES.HAULER || role === ROLES.LD_HAULER) ? CARRY : WORK;
        const partsPerMaxCreep = _.filter(sampleBody, p => p === primaryPart).length;

        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];

        // --- LOGIC 1: ΕΛΛΕΙΨΗ (Missing Resources) ---
        if (current < target) {
            // Σε Recovery Mode βγάζουμε creeps ΑΜΕΣΑ χωρίς threshold
            if (isRecovery) {
                this.addRoleToQueue(roomName, role);
                return;
            }

            // Threshold Logic: Μην βγάζεις creep αν του λείπουν ελάχιστα parts (π.χ. < 40% ενός μεγάλου)
            // ΕΚΤΟΣ αν η ενέργεια στο δωμάτιο είναι ήδη γεμάτη, οπότε "καίμε" την ενέργεια για να μην πάει χαμένη.
            const deficit = target - current;
            const threshold = Math.max(1, Math.floor(partsPerMaxCreep * 0.4));

            if (deficit >= threshold || room.energyAvailable >= this.getBodyCost(sampleBody)) {
                this.addRoleToQueue(roomName, role);
                return;
            }
        }

        // --- LOGIC 2: ΣΥΓΧΩΝΕΥΣΗ (Consolidation) ---
        // Αν έχουμε ήδη το target, αλλά το πετυχαίνουμε με πολλά μικρά creeps,
        // προσπαθούμε να τα αντικαταστήσουμε με ένα μεγάλο για εξοικονόμηση CPU/Spawning time.
        if (!isRecovery && !isCountBased) {
            const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role);
            if (creepsInRoom.length > 1) {
                // Βρες το μικρότερο creep που έχουμε αυτή τη στιγμή
                const smallestCreep = _.min(creepsInRoom, c => c.getActiveBodyparts(primaryPart));
                const smallestParts = smallestCreep.getActiveBodyparts(primaryPart);

                // Αν το νέο "Max" creep είναι τουλάχιστον 2 φορές μεγαλύτερο από το μικρότερο τρέχον,
                // και έχουμε αρκετή ενέργεια, κάνουμε upgrade τον πληθυσμό.
                if (partsPerMaxCreep >= smallestParts * 2 && room.energyAvailable >= maxBudget * 0.9) {
                    debugText(`Consolidating ${role} in ${roomName}: Smallest had ${smallestParts}, New will have ${partsPerMaxCreep}`);
                    this.addRoleToQueue(roomName, role);
                }
            }
        }
    }

    /**
     * Προσθέτει ένα ρόλο στην ουρά με τις κατάλληλες παραμέτρους.
     */
    addRoleToQueue(roomName, role) {
        this.queue.add({
            role: role,
            targetRoom: roomName,
            priority: PRIORITY[role] || 50,
            addedAt: Game.time
        });
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

            if (spawn) {
                const body = this.calculateBody(request.role, spawn.room.energyAvailable, request.targetRoom);
                const name = `${request.role}_${Game.time % 10000}`;

                const result = spawn.spawnCreep(body, name, {
                    memory: {
                        role: request.role,
                        homeRoom: request.targetRoom,
                        bornTick: Game.time
                    }
                });

                if (result === OK) {
                    debugText(`Spawning ${name} at ${spawn.name} for ${request.targetRoom}`);
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
    }

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
    }
}

module.exports = new SpawnManager();
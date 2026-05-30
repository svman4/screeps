/**
 * MODULE: Global Spawn Manager
 * VERSION: 3.2.0
 * TYPE: Modular Class-based Singleton
 * ΠΕΡΙΓΡΑΦΗ: Κεντρικός διαχειριστής παραγωγής. Χρησιμοποιεί την κλάση SpawnQueue
 * για τη διαχείριση των αιτημάτων και το populationManager για το Recovery Mode.
 * * CHANGE LOG:
 * 3.2.0: - Προσθήκη διαχείρισης σημαίας αντικατάστασης για στατικούς harvesters.
 * 3.1.0: - Προσθήκη thresholds για αποφυγή παραγωγής αναποτελεσματικών creeps.
 * 3.0.0: - Κλείδωμα του προ-υπολογισμένου `body` απευθείας στην ουρά (addRoleToQueue).
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
const { ROLES, POPULATION_MODULE_CONFIG, POPULATION_GLOBAL_CONFIG, BODY_ENERGY_LIMITS, PRIORITY, SPAWN_MANAGER_CONFIG, NEED_REPLACEMENT_FLAG } = require('./spawn.constants');
const UPGRADER_LIMIT=5;
const roomCache = require('utils.RoomCache');

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
        if (Game.time % SPAWN_MANAGER_CONFIG.POPULATION_LIMIT_REFRESH_RATE === 0) {
            this.queue.flush(); // Καθαρισμός ουράς για το δωμάτιο σε περίπτωση αλλαγής ορίων
        }
        // Εκτύπωση της ουράς για debugging
        //  if (this.queue.length > 0) {
        //      debugConsole.debugObject("spawnManager", "--- Current Spawn Queue " + this.queue.length + " ---", this.queue);
        //  }
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
    optimizeCreepSizes(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const cache = roomCache.in(roomName);
        const maxEnergyAvailable = room.energyCapacityAvailable;

        // Λίστα με τους ρόλους που θέλουμε να συμπτύξουμε (scaling roles)
        const scalableRoles = [ROLES.HAULER, ROLES.UPGRADER, ROLES.BUILDER];

        scalableRoles.forEach(role => {
            // Φιλτράρουμε τα ζωντανά creeps του συγκεκριμένου ρόλου στο δωμάτιο
            const activeCreeps = _.filter(cache.myCreeps, c => c.memory.role === role && (!c.ticksToLive || c.ticksToLive > 100));
            if (activeCreeps.length <= 1) return; // Αν υπάρχει μόνο ένα ή κανένα, δεν χρειάζεται σύμπτυξη

            // Υπολογίζουμε το μέγιστο δυνατό σώμα που μπορεί να παραχθεί ΑΥΤΗ τη στιγμή
            // Δίνουμε ένα μεγάλο diffParts (π.χ. 50) για να δούμε το απόλυτο max cap του budget
            const maxPossibleBody = this.calculateBody(roomName, role, maxEnergyAvailable, 50);
            const primaryPart = (role === ROLES.HAULER) ? CARRY : WORK;
            const maxPossibleParts = _.filter(maxPossibleBody, p => p === primaryPart).length;

            if (maxPossibleParts === 0) return;

            // Ταξινομούμε τα creeps από το μικρότερο προς το μεγαλύτερο με βάση τα parts τους
            const sortedCreeps = _.sortBy(activeCreeps, c => c.getActiveBodyparts(primaryPart));

            let accumulatedParts = 0;
            let creepsToRecycle = [];

            for (const creep of sortedCreeps) {
                const currentParts = creep.getActiveBodyparts(primaryPart);

                // Αν το creep έχει ήδη το μέγιστο δυνατό σώμα, το προσπερνάμε
                if (currentParts >= maxPossibleParts) continue;

                accumulatedParts += currentParts;
                creepsToRecycle.push(creep);

                // ΑΝ το άθροισμα των parts των μικρών creeps χωράει σε ΕΝΑ νέο μεγάλο creep,
                // τότε ενεργοποιούμε τη διαδικασία αντικατάστασης/ανακύκλωσης.
                if (accumulatedParts <= maxPossibleParts && creepsToRecycle.length >= 2) {
                    creepsToRecycle.forEach(oldCreep => {
                        // Αλλάζουμε το role σε recycle (το σύστημα του Room σου πρέπει να το διαχειρίζεται αυτό)
                        oldCreep.memory.role = 'to_be_recycled';

                    });

                    debugConsole.debugText("spawnManager", `[Maximizing] Consolidating ${creepsToRecycle.length} small ${role}s into a larger one in ${roomName}.`);
                    break; // Σταματάμε για αυτό το tick ώστε να αποφύγουμε μαζικό suicide
                }
            }
        });
    }
    /**
     * Αναλύει τις ανάγκες του δωματίου και αποφασίζει αν θα ζητήσει νέα creeps.
     */
    checkRoomNeeds(roomName) {
        // Ενημέρωση των ορίων (limits) βάσει της τρέχουσας κατάστασης του δωματίου
        if (Game.time % SPAWN_MANAGER_CONFIG.POPULATION_LIMIT_REFRESH_RATE === 0 || !Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY]) {
            // Κάθε 50tick ή αν δεν υπάρχει πληθυσμός.
			
            this.populationManager.updateRoomLimits(roomName);
            this.optimizeCreepSizes(roomName);

        }

        const limits = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY];
        if (!limits) return;

        let cache = roomCache.in(roomName);
        // 1. Έλεγχος βάσει αριθμού Creeps (κυρίως για Harvesters σε Recovery/Early stage)

        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
                const currentCount = _.filter(cache.myCreeps, c => c.memory.role === role).length;
                const targetCount = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP][role];


                if (currentCount < targetCount) {
                    this.handleCountBasedNeed(roomName, role, currentCount, targetCount);
                }
            }
        }


        // 2. Έλεγχος βάσει Body Parts (για Scaling & Efficiency)
        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS]) {
                const targetParts = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_PARTS][role];
                const currentParts = this.countPartsInRoom(roomName, role);

                this.handlePartsBasedNeed(roomName, role, currentParts, targetParts);
            }
        }
        // έλεγχος για σηκωμένες σημαίες αντικατάστασης

        const creepWithFlag = _.filter(cache.myCreeps, c => c.memory[NEED_REPLACEMENT_FLAG] === true);
        if (creepWithFlag && creepWithFlag.length === 0) {
            return;
        }

        const maxEnergyAvailable = Game.rooms[roomName].energyCapacityAvailable;

        creepWithFlag.forEach(creep => {
            if (creep.ticksToLive) {
                if (creep.memory.role === ROLES.STATIC_HARVESTER) {
                    const body = this.calculateBody(roomName, creep.memory.role, maxEnergyAvailable, 0);

                    this.addRoleToQueue(
                        roomName,
                        creep.memory.role,
                        this.getBodyCost(body),
                        body, { sourceId: creep.memory.sourceId, init: true }, creep.memory.targetRoom);
                    creep.memory[NEED_REPLACEMENT_FLAG] = false; // reset flag
                    // debugConsole.debugText("spawnManager", `Creep ${creep.name} is flagged for replacement. Requesting new ${creep.memory.role}.`);
                }
            }
        });

    } // end of checkRoomNeeds
    /**
     * Διαχείριση αναγκών με βάση το ΠΛΗΘΟΣ των creeps (π.χ. Harvesters).
     */
    handleCountBasedNeed(roomName, role, currentCount, targetCount) {
        const room = Game.rooms[roomName];
        if (!room) return;
        // Η ενέργεια του δωματίου(και ας μην υπάρχει στα extension τώρα).
        const maxEnergyAvailable = room.energyCapacityAvailable;
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];
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
        const creepsInRoom = roomCache.in(roomName).myCreeps;
        const sources = roomCache.in(roomName).sources;
        const roleName = ROLES.STATIC_HARVESTER;
        for (const source of sources) {
            const harvesterAtSource = _.find(creepsInRoom, c =>
                c.memory.role === roleName && c.memory.sourceId === source.id
            );

            if (!harvesterAtSource) {
                // Αν δεν έχει harvest σε αυτή την πηγή, δημιουργεί.
                this.addRoleToQueue(roomName, ROLES.STATIC_HARVESTER, budget, body, { sourceId: source.id, init: true });
                return;
            }
        }
    }
    /**
         * Διαχείριση αναγκών με βάση τα BODY PARTS (π.χ. Haulers, Upgraders, Builders).
         */
    handlePartsBasedNeed(roomName, role, currentParts, targetParts) {
        const room = Game.rooms[roomName];
        if (!room) return;
        
        const maxEnergyAvailable = room.energyCapacityAvailable;
        const diffParts = targetParts - currentParts;
        if (diffParts <= 0) return; // Δεν χρειάζεται να κάνουμε τίποτα αν έχουμε ήδη αρκετά parts
        
        const isRecovery = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY][POPULATION_GLOBAL_CONFIG.RECOVERY_KEY];
        let body = [];
		if(role===ROLES.UPGRADER) {
			
			const upgraderCounter=roomCache.in(roomName).myCreeps.filter(c=>c.role===ROLES.UPGRADER).length;
			
			if(upgraderCounter>UPGRADER_LIMIT) {
				return;
			}
		}
        // 1. Περίπτωση Ελλείμματος (Deficit)
        if (currentParts < targetParts) {
            if (isRecovery) {
                body = this.calculateBody(roomName, role, room.energyAvailable, diffParts);
                this.addRoleToQueue(roomName, role, room.energyAvailable, body);
                return;
            }
            body = this.calculateBody(roomName, role, maxEnergyAvailable, diffParts);
            this.addRoleToQueue(roomName, role, this.getBodyCost(body), body);
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
        //debugConsole.debugObject("spawnManager", "roleToQueue", request);
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
    /**
     * Επεξεργάζεται την ουρά και αναθέτει παραγωγή στα διαθέσιμα Spawns.
     */
    processQueue() {
        if (this.queue.length === 0) return;
        //debugConsole.debugText("spawnManager", "Processing spawn queue... queue length: " + this.queue.length);
        this.queue.sort(); // Ταξινόμηση βάσει προτεραιότητας


        const request = this.queue.getAt(0);
        const spawn = this.findBestSpawn(request);
        //debugConsole.debugObject("spawn", "processQueue", request);




        if (spawn) {

            // Έλεγχος αν το δωμάτιο έχει ΑΥΤΗ τη στιγμή την ενέργεια για το συγκεκριμένο body
            const bodyCost = this.getBodyCost(request.body);
            if (spawn.room.energyAvailable < bodyCost) {
                // Anti-Energy-Stealing: Αν είναι το πρώτο στην ουρά (υψηλή προτεραιότητα), 
                // μπλοκάρουμε την παραγωγή άλλων μέχρι να μαζευτεί η ενέργεια.
                return;
            }

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
                debugConsole.debugText("spawnManager", `Spawning ${name} at ${spawn.name} for ${request.targetRoom}`);
                this.queue.removeAt(0);

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
        const cache = roomCache.in(roomName);
        const hasRoads = cache.hasRoads;
        const hasLinks = cache.hasLinks;
        const roomLevel = Memory.rooms[roomName] ? Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.ROOM_LEVEL_KEY] : 1;
    
        let parts = 0;
        let costPerUnit = 0;
        console.log(role+" "+maxEnergy);
        switch (role) {

            case ROLES.STATIC_HARVESTER:
                diffParts = 5;
                body = [WORK, WORK, MOVE]; // Minimum base
                parts = 2;
                if (hasLinks) {
                    body.push(CARRY);// Αν έχουμε link, προσθέτουμε ένα CARRY για να μεταφέρουμε ενέργεια στο link.

                }
                // Οι Static Harvesters χρειάζονται max 5-6 WORK. Πάνω από 800 energy είναι overkill.
                while (this.getBodyCost(body) + 100 <= maxEnergy && parts < diffParts) {
                    body.push(WORK);
                    parts++;
                }
                break;
            case ROLES.SIMPLE_HARVESTER:
                diffParts = 5;
                parts = 0;
                while ((this.getBodyCost(body) + 250) <= maxEnergy && parts <= diffParts) {
                    body.push(WORK, CARRY, MOVE, MOVE);
                    parts++;
                }
                break;
            case ROLES.HAULER:
                // 2:1 ratio CARRY:MOVE αν υπάρχουν δρόμοι, 1:1 αν όχι
                parts = 0;
                costPerUnit = hasRoads ? 150 : 100; // [C,C,M] vs [C,M]
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

                costPerUnit = hasRoads ? 200 : 250; // [C,C,M] vs [C,M]
                costPerUnit = (maxEnergy > 400) ? 350 : 250;

                while (this.getBodyCost(body) + costPerUnit <= maxEnergy && parts < diffParts) {

                    if (maxEnergy > 400) {
                        if ((diffParts - parts) === 1) {
                            body.push(WORK, CARRY, MOVE);
                            parts += 1;
                        } else {
                            body.push(WORK, WORK, CARRY, MOVE, MOVE);
                            parts += 2;
                        }
                    } else {
                        body.push(WORK, CARRY, MOVE, MOVE);
                        parts += 1;
                    }

                }
                break;

            case ROLES.BUILDER:
                parts = 0;
                while (this.getBodyCost(body) + 250 <= maxEnergy && parts < diffParts) {
                    body.push(WORK, CARRY, MOVE, MOVE);
                    parts++;
                }
                break;
            default:
                body = [WORK, CARRY, MOVE];
        }
        body.sort();
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
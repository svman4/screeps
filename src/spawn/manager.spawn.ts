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
const debugText = function (text: string) {
    if (DEBUG_STATE) {
        console.log(`[SpawnManager] ${text}`);
    }
}
const debugObject = function (obj: any, text: string) {
    if (!DEBUG_STATE) return;
    console.log(text + "\n" + JSON.stringify(obj, null, 2));
}

import SpawnQueue from './SpawnQueue';
import PopulationManager from './populationManager';
import { ROLES, POPULATION_MODULE_CONFIG, POPULATION_GLOBAL_CONFIG, BODY_ENERGY_LIMITS, PRIORITY } from './spawn.constants';
import _ from "lodash";

class SpawnManager {
    queue: SpawnQueue;
    populationManager: PopulationManager;
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
        if (this.queue.length > 0) {
            debugObject(this.queue, "--- Current Spawn Queue " + this.queue.length + " ---");
        }

        // Έλεγχος αναγκών για κάθε δωμάτιο που ελέγχουμε
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                //this.checkRoomNeeds(roomName);
            }
        }

        // Επεξεργασία της ουράς και εκτέλεση του spawning
        this.processQueue();
    }

    /**
     * Αναλύει τις ανάγκες του δωματίου και αποφασίζει αν θα ζητήσει νέα creeps.
     */
    checkRoomNeeds(roomName: string) {
        // Ενημέρωση των ορίων (limits) βάσει της τρέχουσας κατάστασης του δωματίου
        this.populationManager.updateRoomLimits(roomName);

        const limits = Memory.rooms[roomName][POPULATION_GLOBAL_CONFIG.MEMORY_KEY];
        if (!limits) return;
        debugObject(limits, `Checking needs for ${roomName}`);
        // 1. Έλεγχος βάσει αριθμού Creeps (κυρίως για Harvesters σε Recovery/Early stage)

        if (limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
            for (const role in limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP]) {
                const currentCount = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role).length;
                const targetCount = limits[POPULATION_GLOBAL_CONFIG.MEMORY_KEY_CREEP][role];
                //TODO δημιουργεί staticHarverter με 6 work χωρίς carry parts παρ΄όλο που στον έλεγχο είχαμε link.
                if (currentCount < targetCount) {
                    this.createNewCreep(roomName, role, currentCount, targetCount, true);
                }
            }
        }
        return;
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
    createNewCreep(roomName: string, role: string, current: number, target: number, isCountBased: boolean) {
        // TODO απαιτεί έλεγχο. ΔΗμιουργούνται τεράστια creep που τελικά δεν εξαρτώνται από το Limit ούτε από τις απαιτήσεις.
        const room = Game.rooms[roomName];
        if (!room) return;

        // 1. Προετοιμασία δεδομένων
        const maxEnergyAvailable = room.energyCapacityAvailable;
        const roleLimit = BODY_ENERGY_LIMITS[role] || 800;
        const maxBudget = Math.min(maxEnergyAvailable, roleLimit);

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
    _handleLowPopulation(room: Room, role: string, current: number, target: number, partsPerMaxCreep: number, bodyCost: number, isRecovery: boolean) {
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

    _handlePopulationUpgrade(room: Room, role: string, primaryPart: BodyPartConstant, partsPerMaxCreep: number, maxBudget: number) {
        const creepsInRoom = _.filter(Game.creeps, c => c.memory.homeRoom === room.name && c.memory.role === role);
        if (creepsInRoom.length <= 1) return;

        const smallestCreep = _.minBy(creepsInRoom, (c: Creep) => c.getActiveBodyparts(primaryPart)) as Creep;


        const smallestParts = smallestCreep.getActiveBodyparts(primaryPart);

        if (partsPerMaxCreep >= smallestParts * 2 && room.energyAvailable >= maxBudget * 0.9) {
            debugText(`Upgrading ${role} in ${room.name}`);
            this.addRoleToQueue(room.name, role, maxBudget);
        }
    }

    addRoleToQueue(roomName: string, role: string, budget: number) {
        this.queue.add({
            role: role,
            targetRoom: roomName,
            priority: PRIORITY[role] || 50,
            energyBudget: budget, // Αποθήκευση του budget στην ουρά
            addedAt: Game.time
        });
    }

    /**
     * Μετράει το σύνολο των ενεργών body parts ενός συγκεκριμένου τύπου σε ένα δωμάτιο.
     */
    countPartsInRoom(roomName: string, role: string) {
        const primaryPart = (role === ROLES.HAULER || role === ROLES.LD_HAULER) ? CARRY : WORK;
        const creeps = _.filter(Game.creeps, c => c.memory.homeRoom === roomName && c.memory.role === role && (!c.ticksToLive || c.ticksToLive > 50));
        return _.sum(creeps.map(c => c.getActiveBodyparts(primaryPart)));
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
                const energyToUse = Math.min(spawn.room.energyAvailable, request.energyBudget || spawn.room.energyAvailable);
                const body = this.calculateBody(request.role, energyToUse, request.targetRoom);
                const name = `${request.role}_${Game.time % 10000}`;

                const result = spawn.spawnCreep(body, name, {
                    memory: {
                        role: request.role,
                        homeRoom: request.targetRoom,

                    }
                });

                if (result === OK) {
                    debugText(`Spawning ${name} at ${spawn.name} for ${request.targetRoom}`);
                    this.queue.removeAt(i);
                    i--; // Προσαρμογή του δείκτη μετά την αφαίρεση          
                }
            }
        }
    }

    /**
     * Βρίσκει το καταλληλότερο Spawn για ένα αίτημα.
     */
    findBestSpawn(request: any) {
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
    calculateBody(role: string, maxEnergy: number, roomName: string) {
        let body: BodyPartConstant[] = [];
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
    getBodyCost(body: BodyPartConstant[]) {

        return _.sum(body.map(part => BODYPART_COST[part]));
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

export default new SpawnManager();
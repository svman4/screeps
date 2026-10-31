/*
    CHANGELOG:
    version 1.4.2
    - Διόρθωση λογικής στην updateSpecialContainer: Έλεγχος εγκυρότητας των IDs μέσω Game.getObjectById().
    - Αυτόματη επαναφορά αναζήτησης αν ένα ειδικό container καταστραφεί.
    - Καθαρισμός κώδικα και διόρθωση σειράς ορισμού μεταβλητών.
    
    version 1.4.1
    - Μεταφορά του κεντρικού κλειδιού μνήμης "construction" στα constants (MEMORY_KEYS.ROOT).
    
    version 1.4.0
    - Ολοκλήρωση της μεθόδου updateSpecialContainer για εντοπισμό Recovery & Controller Containers.
    - Πλήρης ενσωμάτωση των MEMORY_KEYS από το αρχείο constants.
    - Κατάργηση hardcoded strings στη διαχείριση μνήμης.
*/
const defenceManager = require('manager.defense');
const ConstructionVisualizer = require('construction.visualizer');
const BaseLayout = require('construction.layout.BaseLayout');
const FileLayout = require('construction.layout.FileLayout');
const RoadPlanner = require('construction.roadPlanner');
const debugConsole = require("utils.debugConsole");
const roomCache = require('utils.RoomCache');
const { MEMORY_KEYS, MAX_CONSTRUCTION_SITE } = require('construction.constants');
const constructionFSM = {
    'earlyEra': function () {

        if (defenceManager.isWarModeActive(room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return populationManagerStates.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (!this.checkIfMemoryIsOk(this.room)) {
            // εφόσον δεν υπάρχει αρχικοποιημένη μνήμη, ξεκινάμε την ανάλυση του δωματίου.
            this.initRoom(this.room);
            return;
        }
        // construction of containers(controller and sources)
        // construction of criticalRoads


        if (
            this.info[room.name].constructionRemain &&
            this.info[room.name].constructionRemain.length === 0 &&
            this.room.controller.level > 1
        ) {
            constructionFSM.transition(this, 'containerEra', this.room.memory);
            return populationManagerStates.states['containerEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }

    },
    'containerEra': function () {
        // αν χτίστηκε το storage που απαιτούνται τότε προχωράμε στην container εποχή.
        constructionFSM.transition(this, 'storageEra', this.room.memory);
        return populationManagerStates.states['storageEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return populationManagerStates.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return populationManagerStates.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }

    },
    'storageEra': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return populationManagerStates.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return populationManagerStates.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        //αν είμαστε σε rcl 8 τότε
        constructionFSM.transition(this, 'topLevel', this.room.memory);
        return populationManagerStates.states['topLevel'].call(this); // Αμέσως εκτέλεση της νέας εποχής


    },
    'topLevel': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return populationManagerStates.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return populationManagerStates.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }

    }, // end of topLevel
    'warTime': function () {
        //Σε κατάσταση πολέμου δε προσπαθούμε να χτίσουμε κάτι.
        // Απλά αναμονή για λήξη πολέμου.
        if (!defenceManager.isWarModeActive(room)) {
            //εφόσον έληξε η πολεμική λειτουργία. Επανερχόμαστε.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return populationManagerStates.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
    } // end of warTime
} // end of constructionFSM

/**
 * CONSTRUCTION MANAGER CLASS
 */
class ConstructionManager {
    constructor(roomName) {
        this.visualizer = new ConstructionVisualizer(roomName);
        this.info = {};
    }
    checkIfMemoryIsOk(room) {
        if (room.memory[MEMORY_KEYS.ROOT] && this.info[room.name]) {
            return true;
        } else {
            return false;
        }
    } // end of checkIfMemory
    initRoom(room) {

    } // end of initinitRoom(room)
    initMemory() {
        if (!Memory.rooms[this.roomName]) Memory.rooms[this.roomName] = {};
        if (!Memory.debug) Memory.debug = {};
        if (!Memory.debug[MEMORY_KEYS.ROOT]) Memory.debug[MEMORY_KEYS.ROOT] = false;

        if (!Memory.rooms[this.roomName][MEMORY_KEYS.ROOT]) {
            Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] = {
                [MEMORY_KEYS.STRUCTURES]: {}
            };
        }

    }

    run(room) {

        if (!room.memory) {
            return;
        }
        if (room.controller || room.controller.my) {
            return;
        }

        const limits = constructionFSM.run(this, "earlyEra", Memory.
            rooms[room.name]);

        // if (Game.time % SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
        //     this.updateBuiltCache(room);
        // }

        // if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
        //     this.processConstruction(room);
        // }

        this.drawVisuals(room);
    }

    updateBuiltCache(room) {
        const structures = roomCache.in(room.name).structures;
        const cache = {};

        structures.forEach(s => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });

        const constructionMem = Memory.rooms[roomName][MEMORY_KEYS.ROOT];
        constructionMem[MEMORY_KEYS.STRUCTURES] = cache;


    } // end of updateBuiildCache




    processConstruction(room) {
        const cache = roomCache.in(room.name);
        let sites = cache.constructionSites;

        const maxSites = MAX_CONSTRUCTION_SITE || 2;

        if (sites.length >= maxSites) return;

        const constructionMem = Memory.rooms[roomName][MEMORY_KEYS.ROOT];
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};
        const rcl = room.controller.level;

        const fullPlan = this.layout.getPlanForRCL(rcl, builtMap);
        if (fullPlan.length === 0) return;

        let remainingQuota = maxSites - sites.length;
        let startingRemainingQuota = remainingQuota;
        remainingQuota = this.buildStructures(fullPlan, remainingQuota);
        //console.log("start "+ remainingQuota + " "+startingRemainingQuota);
        if (startingRemainingQuota === remainingQuota) {
            const remainQuotaForDefence = 100;
            // Θέλουμε να χτίζει μονομιάς όλα τα αμυντικά κτίρια.
            remainingQuota = this.buildDefenses(fullPlan, remainQuotaForDefence);
            if (remainingQuota != remainQuotaForDefence) {
                remainingQuota = 0;
            } else {
                remainingQuota = startingRemainingQuota;
            }
            //  console.log("roads "+ remainingQuota + " "+startingRemainingQuota);
        }
        if (startingRemainingQuota === remainingQuota) {
            const remainQuotaForRoads = 100;
            //console.log("Defence " +remainingQuota + " "+startingRemainingQuota);
            // Θέλουμε να χτίζει μονομιάς όλους τους δρόμους στο τρέχον rcl.
            this.buildRoads(fullPlan, remainQuotaForRoads, rcl, builtMap);
        }
    } // end of processConstruction

    buildStructures(fullPlan, quota) {
        const structures = fullPlan.filter(s => !['road', 'rampart', 'constructedWall'].includes(s.type));
        let placed = 0;
        for (const s of structures) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) placed++;
        }
        return quota - placed;
    } // end of buildStructures

    buildDefenses(fullPlan, quota) {
        const defenses = fullPlan.filter(s => ['rampart', 'constructedWall'].includes(s.type));
        let placed = 0;
        for (const s of defenses) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) placed++;
        }
        return quota - placed;
    } // end of buildDefences

    buildRoads(fullPlan, quota, rcl, builtMap) {
        const roads = fullPlan.filter(s => s.type === 'road');
        let placed = 0;
        for (const s of roads) {
            if (placed >= quota) break;
            //if (RoadPlanner.shouldBuildRoad(s, {}, builtMap, rcl)) {
            if (this.createSite(s.x, s.y, 'road')) placed++;
            //}
        }
        return quota - placed;
    }

    createSite(x, y, type) {
        const structureType = this.mapType(type);
        const res = this.room.createConstructionSite(x, y, structureType);
        if (res === OK) {
            console.log(`[Construction] ${this.roomName}: Placed ${type} at ${x},${y}`);
            return true;
        }
        return false;
    }

    mapType(type) {
        const types = {
            'spawn': STRUCTURE_SPAWN,
            'extension': STRUCTURE_EXTENSION,
            'road': STRUCTURE_ROAD,
            'tower': STRUCTURE_TOWER,
            'storage': STRUCTURE_STORAGE,
            'container': STRUCTURE_CONTAINER,
            'link': STRUCTURE_LINK,
            'terminal': STRUCTURE_TERMINAL,
            'lab': STRUCTURE_LAB,
            'rampart': STRUCTURE_RAMPART,
            'constructedWall': STRUCTURE_WALL,
            'controller': STRUCTURE_CONTROLLER
        };
        return types[type] || type;
    }

    drawVisuals() {
        if (Memory.debug && Memory.debug.construction === false) {
            return;
        }
        if (!this.layout || !this.layout.blueprint) {
            return;
        }

        const currentRCL = this.room.controller ? this.room.controller.level : 0;

        // Ανάκτηση του builtMap από τη μνήμη (όπως γίνεται και στην processConstruction)
        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] || {};
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};

        // Κλήση του visualizer με το σωστό object
        this.visualizer.drawBlueprint(this.layout.blueprint, builtMap, currentRCL);


    }
} // end of class ConstructionManager
module.exports = new ConstructionManager();

// module.exports = {
//     run: function (roomName) {
//         const manager = new ConstructionManager(roomName);
//         manager.run();
//     }
// };
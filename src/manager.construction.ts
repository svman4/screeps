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
import defenceManager = require('./manager.defense');
import ConstructionVisualizer = require('./construction.visualizer');
import BaseLayout = require('./construction.layout.BaseLayout');
import FileLayout = require('./construction.layout.FileLayout');
import RoadPlanner = require('./construction.roadPlanner');
const debugConsole = require("./utils.debugConsole");
import roomCache = require('./utils.RoomCache');
import {
    MEMORY_KEYS,
    MAX_CONSTRUCTION_SITE,
    STORAGE_LIMIT_FOR_INDUSTRIAL_ERA,
    CONTROLLER_LEVEL_FOR_INDUSTRIAL_ERA
} = require('construction.constants');
const constructionFSM = new FSM({
    'earlyEra': function () {

        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (!this.checkIfMemoryIsOk(this.room)) {
            // εφόσον δεν υπάρχει αρχικοποιημένη μνήμη, ξεκινάμε την ανάλυση του δωματίου.
            this.initRoom(this.room);

        }
        if (this.room.controller.level === 1) {
            return;
        }

        if (
            this.room.controller.level > 1
        ) {
            // ο controller είναι πάνω από level 2
            constructionFSM.transition(this, 'basicEra', this.room.memory);
            return constructionFSM.states['basicEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }

    },
    'basicEra': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (this.room.controller.level !== this.info[this.room.name].level) {
            // construction of criticalRoads
            this.info[this.room.name].constructionRemain.push(...this.getCriticalRoads(this.room));
            this.info[this.room.name].constructionRemain.push(...this.getUnlockedStructuresToBuild(this.room));
            this.info[this.room.name].level = this.room.controller.level;
        }
        this.processConstruction(this.room);


        debugConsole.debugText("ConstructionMAnager,basicEra", "constructionRemain length is " + this.info[this.room.name].constructionRemain.length);

        if (
            this.room.controller.level > CONTROLLER_LEVEL_FOR_INDUSTRIAL_ERA &&
            this.info[this.room.name].constructionRemain.length === 0
            && this.room.storage &&
            this.room.storage.store.getUsedCapacity() < STORAGE_LIMIT_FOR_INDUSTRIAL_ERA
        ) {
            // ο controller είναι πάνω από level 2
            constructionFSM.transition(this, 'basicEra', this.room.memory);
            return constructionFSM.states['basicEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        constructionFSM.transition(this, 'industrialEra', this.room.memory);
        return constructionFSM.states['industrialEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής


    },
    'industrialEra': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        //χτίσιμο lab και factory.

    },

    'warTime': function () {
        //Σε κατάσταση πολέμου δε προσπαθούμε να χτίσουμε κάτι.
        // Απλά αναμονή για λήξη πολέμου.
        if (!defenceManager.isWarModeActive(this.room)) {
            //εφόσον έληξε η πολεμική λειτουργία. Επανερχόμαστε.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
    } // end of warTime
}); // end of constructionFSM
interface RoomInfoData {
    level: number;
    constructionRemain: BlueprintStructure[];
}
/**
 * CONSTRUCTION MANAGER CLASS
 */
class ConstructionManager {
    public roomName!: string;
    public visualizer: ConstructionVisualizer;
    public layout: BaseLayout;
    public info: { [roomName: string]: RoomInfoData };

    constructor(roomName: string) {

        if (roomName) {
            this.roomName = roomName;
            this.visualizer = new ConstructionVisualizer(roomName);
            this.layout = new FileLayout(roomName);
        }
        this.info = {};
    }
    checkIfMemoryIsOk(room: Room): boolean {
        if (room.memory[MEMORY_KEYS.ROOT] && this.info[room.name]) {
            return true;
        } else {
            return false;
        }
    } // end of checkIfMemory
    initRoom(room: Room): void {
        if (!this.info[room.name]) {
            this.info[room.name] = {
                level: room.controller ? room.controller.level : 0,
                constructionRemain: []
            };
        } else {
            this.info[room.name].level = room.controller ? room.controller.level : 0,
                this.info[room.name].constructionRemain = []
        }
    } // end of initinitRoom(room)
    initMemory(): void {

        if (!Memory.rooms[this.roomName])
            Memory.rooms[this.roomName] = {};
        if (!Memory.debug)
            Memory.debug = {};


        if (!Memory.debug[MEMORY_KEYS.ROOT])
            Memory.debug[MEMORY_KEYS.ROOT] = false;

        if (!Memory.rooms[this.roomName][MEMORY_KEYS.ROOT]) {
            Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] = {
                [MEMORY_KEYS.STRUCTURES]: {}
            };
        }
    } // end of initMemory

    run(room: Room): void {

        if (!room.memory) {
            return;
        }
        if (room.controller || room.controller.my) {
            return;
        }
        this.roomName = room.name;
        const limits = constructionFSM.run(this, "earlyEra", Memory.
            rooms[room.name]);

        if (!this.visualizer)
            this.visualizer = new ConstructionVisualizer(room.name);
        if (!this.layout)
            this.layout = new FileLayout(room.name);
        // if (Game.time % SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
        //     this.updateBuiltCache(room);
        // }

        // if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
        //     this.processConstruction(room);
        // }

        this.drawVisuals(room);
    }

    updateBuiltCache(room: Room): void {
        const cache: { [coords: string]: string } = {};
        const structures = roomCache.in(room.name).structures;


        structures.forEach((s: Structure) => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });

        const constructionMem = Memory.rooms[room.name][MEMORY_KEYS.ROOT];
        constructionMem[MEMORY_KEYS.STRUCTURES] = cache;
    } // end of updateBuiildCache




    processConstruction(room: Room): void {
        const cache = roomCache.in(room.name);
        let sites = cache.constructionSites;

        const maxSites = MAX_CONSTRUCTION_SITE || 2;

        if (sites.length >= maxSites) {
            // Εφόσον τα buildingSite είναι περισσότερα ή όσα επιτρέπονται 
            return;
        }

        const constructionMem = Memory.rooms[room.name][MEMORY_KEYS.ROOT];
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};
        const rcl = room.controller.level;

        const fullPlan = this.info[room.name]?.constructionRemain;
        if (!fullPlan || fullPlan.length === 0)
            return;

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
    /**
     * Αναζητεί από το blueprint του δωματίου τα critical roads.
     * @param {*} room 
     */
    getCriticalRoads(room) {

        const blueprint = room.memory[MEMORY_KEYS.ROOT][MEMORY_KEYS.BLUE_PRINT];
        const roads = blueprint.filter(s => s.type === 'road');
        debugConsole.debugText("Construction,getCriticalRoads", "found " + roads.length + " roads");

        // TODO πρεπει να βρίσκει τη θέση των storage, firstSpawn και containers
        const placeOfstorage = { x=5, y=5 }; // Ο χώρος που θα μπει το storage
        const placeOfFirstSpawn = { x=5, y=5 }; // Ο χώρος που θα μπει το spawn
        const placeOfContainers = [{ x=5, y=5 }, { x=5, y=5 }, { x=5, y=5 }, { x=5, y=5 }] // ο χώρος που θα βρίσκονται τα containers (Πηγών και controller)

        const criticalRoads = findCriticalPath(roads, placeOfstorage, placeOfFirstSpawn, placeOfContainers);

        debugConsole.debugText("Construction,getCriticalRoads", "found " + criticalRoads.length + " critical roads");



        return criticalRoads;

    } // end of getCriticalRoads
    findCriticalPath(roads, storage, spawn, containers) {
        throw new Error(`[BaseLayout] loadRawData not implemented for ${this.constructor.name}`);
    }
    buildStructures(fullPlan, quota) {
        const structures = fullPlan.filter(s => !['road', 'rampart', 'constructedWall'].includes(s.type));

        for (const s of structures) {
            if (quota <= 0) {
                break;
            }
            if (this.createSite(s.x, s.y, s.type)) quota--;
        }
        return quota;
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
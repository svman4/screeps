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

const ConstructionVisualizer = require('construction.visualizer');
const BaseLayout = require('construction.layout.BaseLayout');
const FileLayout = require('construction.layout.FileLayout');
const RoadPlanner = require('construction.roadPlanner');
const roomCache = require('utils.RoomCache');
const { MEMORY_KEYS, MAX_CONSTRUCTION_SITE } = require('construction.constants');

/**
 * SCAN INTERVALS
 */
const SCAN_INTERVALS = {
    UPDATE_BUILT_CACHE: 10,
    CHECK_CONSTRUCTION_SITES: 5
};

/**
 * CONSTRUCTION MANAGER CLASS
 */
class ConstructionManager {
    constructor(roomName) {
        this.roomName = roomName;
        this.room = Game.rooms[roomName];
        this.initMemory();
        this.layout = new FileLayout(roomName);
        this.visualizer = new ConstructionVisualizer(roomName);
    }

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

    run() {
        if (!this.room || !this.room.controller || !this.room.controller.my) return;

        if (Game.time % SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
            this.updateBuiltCache();
        }

        if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
            this.processConstruction();
        }

        this.drawVisuals();
    }

    updateBuiltCache() {
        const structures = roomCache.in(this.room.name).structures;
        const cache = {};

        structures.forEach(s => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });

        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT];
        constructionMem[MEMORY_KEYS.STRUCTURES] = cache;


    }




    processConstruction() {
        const cache = roomCache.in(this.room.name);
        let sites = cache.constructionSites;
        //this.room.find(FIND_MY_CONSTRUCTION_SITES);
        const maxSites = MAX_CONSTRUCTION_SITE || 2;
        if (sites.length >= maxSites) return;

        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT];
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};
        const rcl = this.room.controller.level;

        const fullPlan = this.layout.getPlanForRCL(rcl, builtMap);
        if (fullPlan.length === 0) return;

        let remainingQuota = maxSites - sites.length;
        remainingQuota = this.buildStructures(fullPlan, remainingQuota);
        if (remainingQuota > 0) {
            remainingQuota = this.buildDefenses(fullPlan, remainingQuota);
        }
        if (remainingQuota > 0) {
            this.buildRoads(fullPlan, remainingQuota, rcl, builtMap);
        }
    }

    buildStructures(fullPlan, quota) {
        const structures = fullPlan.filter(s => !['road', 'rampart', 'constructedWall'].includes(s.type));
        let placed = 0;
        for (const s of structures) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) placed++;
        }
        return quota - placed;
    }

    buildDefenses(fullPlan, quota) {
        const defenses = fullPlan.filter(s => ['rampart', 'constructedWall'].includes(s.type));
        let placed = 0;
        for (const s of defenses) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) placed++;
        }
        return quota - placed;
    }

    buildRoads(fullPlan, quota, rcl, builtMap) {
        const roads = fullPlan.filter(s => s.type === 'road');
        let placed = 0;
        for (const s of roads) {
            if (placed >= quota) break;
            if (RoadPlanner.shouldBuildRoad(s, {}, builtMap, rcl)) {
                if (this.createSite(s.x, s.y, 'road')) placed++;
            }
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
        if (Memory.debug && Memory.debug.construction === false) return;
        if (!this.layout || !this.layout.blueprint) return;

        const currentRCL = this.room.controller ? this.room.controller.level : 0;

        // Ανάκτηση του builtMap από τη μνήμη (όπως γίνεται και στην processConstruction)
        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] || {};
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};

        // Κλήση του visualizer με το σωστό object
        this.visualizer.drawBlueprint(this.layout.blueprint, builtMap, currentRCL);


    }
}

module.exports = {
    run: function (roomName) {
        const manager = new ConstructionManager(roomName);
        manager.run();
    }
};
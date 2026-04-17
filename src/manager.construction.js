require('RoomVisual');
const BaseLayout=require('construction.layout.BaseLayout');
const FileLayout=require('construction.layout.FileLayout');
/**
 * SCAN INTERVALS & CONSTANTS
 */
const SCAN_INTERVALS = {
    UPDATE_BUILT_CACHE: 10,
    CHECK_CONSTRUCTION_SITES: 5
};

const PRIORITIES = {
    SPAWN: 130, TOWER: 120, EXTENSION: 110, STORAGE: 100,
    CONTAINER: 110, TERMINAL: 80, LINK: 70, LAB: 60,
    FACTORY: 50, POWER_SPAWN: 40, NUKER: 30, OBSERVER: 20,
    ROAD: 10, RAMPART: 1, CONSTRUCTEDWALL: 3
};

const STRUCTURE_RCL_STEPS = {
    'spawn': [1, 7, 8],
    'tower': [3, 5, 7, 8, 8, 8],
    'extension': { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
    'link': [5, 5, 6, 7, 8, 8],
    'lab': [6, 6, 6, 7, 7, 8, 8, 8, 8, 8],
    'container': { 1: 3, 4: 5 },
};




/**
 * CONSTRUCTION MANAGER CLASS
 */
class ConstructionManager {
    constructor(roomName) {
        this.roomName = roomName;
        this.room = Game.rooms[roomName];
        this.initMemory();
        
        // Επιλογή layout (προς το παρόν μόνο FileLayout)
        this.layout = new FileLayout(roomName);
    }

    initMemory() {
        if (!Memory.rooms[this.roomName]) Memory.rooms[this.roomName] = {};
        if (!Memory.rooms[this.roomName].construction) {
            Memory.rooms[this.roomName].construction = { builtStructures: {} };
        }
    }

    run() {
        if (!this.room || !this.room.controller || !this.room.controller.my) return;

        // Cache update
        if (Game.time % SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
            this.updateBuiltCache();
        }

        // Build logic
        if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
            this.tryBuild();
        }

        // Visuals
        if (Memory.debug && Memory.debug.construction) {
            this.drawVisuals();
        }
    }

    updateBuiltCache() {
        const found = {};
        this.room.find(FIND_STRUCTURES).forEach(s => {
            found[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        Memory.rooms[this.roomName].construction.builtStructures = found;
        
        // Helper checks (recovery/controller containers)
        this.checkSpecialContainers();
    }

    tryBuild() {
        const maxSites = (this.room.storage) ? 3 : 1;
        const currentSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        if (currentSites.length >= maxSites) return;

        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        const plan = this.layout.getPlanForRCL(this.room.controller.level, builtMap);

        for (const s of plan) {
            if (this.siteExistsAt(currentSites, s.x, s.y)) continue;

            const structureType = this.mapType(s.type);
            const res = this.room.createConstructionSite(s.x, s.y, structureType);
            if (res === OK) {
                console.log(`🔨 [${this.roomName}] Building ${s.type} at ${s.x},${s.y}`);
                break; // Χτίζουμε ένα ανά tick ελέγχου
            }
        }
    }

    siteExistsAt(sites, x, y) {
        const site = sites.find(s => s.pos.x === x && s.pos.y === y);
        if (!site) return false;
        // Επιτρέπουμε να "χτίζουμε" πάνω από δρόμους αν το blueprint έχει κάτι άλλο εκεί
        return !(site.structureType === STRUCTURE_ROAD || site.structureType === STRUCTURE_RAMPART);
    }

    mapType(type) {
        const MAP = {
            'spawn': STRUCTURE_SPAWN, 'extension': STRUCTURE_EXTENSION, 'road': STRUCTURE_ROAD,
            'constructedWall': STRUCTURE_WALL, 'rampart': STRUCTURE_RAMPART, 'link': STRUCTURE_LINK,
            'storage': STRUCTURE_STORAGE, 'tower': STRUCTURE_TOWER, 'observer': STRUCTURE_OBSERVER,
            'powerSpawn': STRUCTURE_POWER_SPAWN, 'extractor': STRUCTURE_EXTRACTOR, 'lab': STRUCTURE_LAB,
            'terminal': STRUCTURE_TERMINAL, 'container': STRUCTURE_CONTAINER, 'nuker': STRUCTURE_NUKER,
            'factory': STRUCTURE_FACTORY
        };
        return MAP[type];
    }

    drawVisuals() {
        const visual = new RoomVisual(this.roomName);
        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        
        this.layout.blueprint.forEach(s => {
            if (builtMap[`${s.x},${s.y}`]) return;
            const canBuild = s.rcl <= this.room.controller.level;
            visual.structure(s.x, s.y, this.mapType(s.type), { opacity: canBuild ? 0.5 : 0.1 });
        });
    }

    checkSpecialContainers() {
        // ... (υπάρχουσα λογική για recoveryContainerId και controllerContainerId)
    }
}

/**
 * EXPORT: Singleton-style interface για συμβατότητα με το loop
 */
module.exports = {
    run: function(roomName) {
        const manager = new ConstructionManager(roomName);
        manager.run();
    }
};
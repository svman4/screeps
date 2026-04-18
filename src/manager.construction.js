require('RoomVisual');
const BaseLayout = require('construction.layout.BaseLayout');
const FileLayout = require('construction.layout.FileLayout');
const { MAX_CONSTRUCTION_SITE } = require('construction.constants');
const RoadPlanner = require('construction.roadPlanner');

/**
 * SCAN INTERVALS & CONSTANTS
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

        // Logic update (Slower)
        if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
            this.processConstruction();
        }

        // Visuals (Every tick if enabled)
        this.drawVisuals();
    }

    /**
     * Ενημερώνει τη μνήμη με τα κτίρια που υπάρχουν ήδη στο δωμάτιο.
     */
    updateBuiltCache() {
        const structures = this.room.find(FIND_STRUCTURES);
        const cache = {};
        structures.forEach(s => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        Memory.rooms[this.roomName].construction.builtStructures = cache;
    }

    /**
     * Κεντρική διαχείριση κατασκευών.
     */
    processConstruction() {
        let sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        const maxSites = MAX_CONSTRUCTION_SITE || 2;
        
        if (sites.length >= maxSites) return;

        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        const rcl = this.room.controller.level;
        
        // Φιλτράρουμε το blueprint για όσα λείπουν και είναι διαθέσιμα στο τρέχον RCL
        const fullPlan = this.layout.getPlanForRCL(rcl, builtMap);
        if (fullPlan.length === 0) return;

        // Διαχωρισμός και εκτέλεση ανά κατηγορία
        let remainingQuota = maxSites - sites.length;

        // 1. Κτίρια (Structures)
        remainingQuota = this.buildStructures(fullPlan, remainingQuota);

        // 2. Αμυντικά (Defenses)
        if (remainingQuota > 0) {
            remainingQuota = this.buildDefenses(fullPlan, remainingQuota);
        }

        // 3. Δρόμοι (Roads)
        if (remainingQuota > 0) {
            this.buildRoads(fullPlan, remainingQuota, rcl, builtMap);
        }
    }

    /**
     * Φάση 1: Κανονικά κτίρια (Spawn, Extensions, Towers κλπ)
     */
    buildStructures(fullPlan, quota) {
        const structures = fullPlan.filter(s => s.type !== 'road' && s.type !== 'rampart' && s.type !== 'constructedWall');
        let placed = 0;

        for (const s of structures) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) {
                placed++;
            }
        }
        return quota - placed;
    }

    /**
     * Φάση 2: Αμυντικά έργα
     */
    buildDefenses(fullPlan, quota) {
        const defenses = fullPlan.filter(s => s.type === 'rampart' || s.type === 'constructedWall');
        let placed = 0;

        for (const s of defenses) {
            if (placed >= quota) break;
            if (this.createSite(s.x, s.y, s.type)) {
                placed++;
            }
        }
        return quota - placed;
    }

    /**
     * Φάση 3: Οδοποιία
     */
    buildRoads(fullPlan, quota, rcl, builtMap) {
        const roads = fullPlan.filter(s => s.type === 'road');
        let placed = 0;

        for (const s of roads) {
            if (placed >= quota) break;

            // Έλεγχος από τον RoadPlanner αν όντως πρέπει να χτιστεί τώρα ο δρόμος
            if (RoadPlanner.shouldBuildRoad(s, {}, builtMap, rcl)) {
                if (this.createSite(s.x, s.y, 'road')) {
                    placed++;
                }
            }
        }
        return quota - placed;
    }

    /**
     * Helper για τη δημιουργία Construction Site με error logging.
     */
    createSite(x, y, type) {
        const structureType = this.mapType(type);
        const res = this.room.createConstructionSite(x, y, structureType);
        
        if (res === OK) {
            console.log(`[Construction] Placed ${type} at ${x},${y}`);
            return true;
        }
        return false;
    }

    /**
     * Μετατρέπει τα εσωτερικά strings σε Screeps constants.
     */
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

    /**
     * Visuals Logic - Διαχωρισμένο σε υπομεθόδους.
     */
    drawVisuals() {
        if (Memory.debug && Memory.debug.construction === false) return;
        if (!this.layout || !this.layout.blueprint) return;

        const visual = new RoomVisual(this.roomName);
        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        const currentRCL = this.room.controller.level;

        this.drawMismatchedStructures(visual, builtMap);
        this.drawBlueprint(visual, builtMap, currentRCL);
    }

    drawMismatchedStructures(visual, builtMap) {
        const allowedAtPos = {};
        for (const s of this.layout.blueprint) {
            allowedAtPos[`${s.x},${s.y}`] = s;
        }

        for (const coord in builtMap) {
            const [x, y] = coord.split(',').map(Number);
            const structureType = builtMap[coord];
            const blueprintItem = allowedAtPos[coord];

            if (['road', 'constructedWall', 'rampart', 'controller'].includes(structureType)) continue;

            if (!blueprintItem || blueprintItem.type !== structureType) {
                visual.line(x - 0.4, y - 0.4, x + 0.4, y + 0.4, { color: '#ff0000', width: 0.1, opacity: 0.9 });
                visual.line(x + 0.4, y - 0.4, x - 0.4, y + 0.4, { color: '#ff0000', width: 0.1, opacity: 0.9 });
                visual.text("⚠️ REMOVE", x, y + 0.6, { color: '#ff0000', font: 0.25, backgroundColor: '#000000', opacity: 0.8 });
            }
        }
    }

    drawBlueprint(visual, builtMap, currentRCL) {
        this.layout.blueprint.forEach(s => {
            if (builtMap[`${s.x},${s.y}`] === s.type) return;

            const isAvailable = s.rcl <= currentRCL;
            const opacity = isAvailable ? 0.5 : 0.15;

            if (s.type === 'road') {
                const color = s.category === 'critical' ? '#ff0000' : (s.category === 'logistics' ? '#00ffff' : '#ffffff');
                visual.circle(s.x, s.y, { fill: color, radius: 0.12, opacity: opacity });
            } else {
                visual.structure(s.x, s.y, this.mapType(s.type), { opacity: opacity });
                this.drawStructureBadge(visual, s.x, s.y, s.rcl, isAvailable, opacity);
            }
        });
    }

    drawStructureBadge(visual, x, y, rcl, isAvailable, opacity) {
        const rclColor = isAvailable ? '#00ff00' : '#ff4444';
        const labelY = x % 2 === 0 ? y - 0.6 : y + 0.8;

        visual.rect(x - 0.4, labelY - 0.2, 0.8, 0.35, {
            fill: '#000000',
            opacity: opacity,
            stroke: rclColor,
            strokeWidth: 0.03
        });

        visual.text(`L${rcl}`, x, labelY + 0.05, {
            color: '#ffffff',
            font: 'bold 0.2 verdana',
            opacity: opacity + 0.3
        });
    }
}
module.exports = {
    run: function(roomName) {
        const manager = new ConstructionManager(roomName);
        manager.run();
    }
};
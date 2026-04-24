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

require('RoomVisual');
const BaseLayout = require('construction.layout.BaseLayout');
const FileLayout = require('construction.layout.FileLayout');
const RoadPlanner = require('construction.roadPlanner');
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
    }

    initMemory() {
        if (!Memory.rooms[this.roomName]) Memory.rooms[this.roomName] = {};
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
        const structures = this.room.find(FIND_STRUCTURES);
        const cache = {};
        
        structures.forEach(s => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        
        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT];
        constructionMem[MEMORY_KEYS.STRUCTURES] = cache;
        
		this.updateSpecialContainer(structures);
    }

    /**
     * Εντοπίζει και αποθηκεύει τα IDs των ειδικών containers.
     * Περιλαμβάνει έλεγχο εγκυρότητας (validation) για την αποφυγή "ορφανών" IDs στη μνήμη.
     */
    updateSpecialContainer(structures = null) { 
        const mem = Memory.rooms[this.roomName];
        
        // Έλεγχος αν τα υπάρχοντα IDs είναι ακόμα έγκυρα
        const currentRecovery = Game.getObjectById(mem[MEMORY_KEYS.RECOVERY]);
        const currentController = Game.getObjectById(mem[MEMORY_KEYS.CONTROLLER]);

        // Αν και τα δύο είναι ζωντανά, σταματάμε εδώ για εξοικονόμηση CPU
        if (currentRecovery && currentController) {
			console.log(currentRecovery.id);
            return; 
        }
		console.log("updateSpecialContainer "+this.room.name);
        const allStructures = structures || this.room.find(FIND_STRUCTURES);
        const containers = allStructures.filter(s => s.structureType === STRUCTURE_CONTAINER);
        if (containers.length === 0) return;

        const spawns = this.room.find(FIND_MY_SPAWNS);
        const controller = this.room.controller;
        const sources = this.room.find(FIND_SOURCES);

        let recoveryId = currentRecovery ? currentRecovery.id : null;
        let controllerId = currentController ? currentController.id : null;

        for (const container of containers) {
            // Αν το έχουμε ήδη βρει σε προηγούμενο tick/loop, το προσπερνάμε
            if (container.id === recoveryId || container.id === controllerId) continue;

            // 1. Recovery Container: Δίπλα σε Spawn
            if (!recoveryId) {
                const isNearSpawn = spawns.some(spawn => container.pos.isNearTo(spawn));
                if (isNearSpawn) {
                    recoveryId = container.id;
                    continue; 
                }
            }

            // 2. Controller Container: Κοντά στον Controller (Range <= 4)
            if (!controllerId && container.pos.getRangeTo(controller) <= 4) {
                const isNearSource = sources.some(src => container.pos.getRangeTo(src) <= 2);
                if (!isNearSource) {
                    controllerId = container.id;
                }
            }
        }

        // Ενημέρωση μνήμης (αν κάτι άλλαξε ή αν χάθηκε κτίριο, θα αποθηκευτεί null)
        mem[MEMORY_KEYS.RECOVERY] = recoveryId;
        mem[MEMORY_KEYS.CONTROLLER] = controllerId;
    }

    processConstruction() {
        let sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
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

        const visual = new RoomVisual(this.roomName);
        const builtMap = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT][MEMORY_KEYS.STRUCTURES] || {};
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
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
            this.checkSpecialContainers();
        }

        // Build logic
        if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
            this.processConstruction();
        }

        // Οπτική απεικόνιση
        this.drawVisuals();
    }

    updateBuiltCache() {
        const structures = this.room.find(FIND_STRUCTURES);
        const builtMap = {};
        structures.forEach(s => {
            builtMap[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        Memory.rooms[this.roomName].construction.builtStructures = builtMap;
    }

    /**
     * Κύρια μέθοδος επεξεργασίας κατασκευών.
     */
    processConstruction() {
        // Υπολογίζουμε πόσα sites υπάρχουν ήδη
        let sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        const maxSites = MAX_CONSTRUCTION_SITE || 5;
        
        if (sites.length >= maxSites) return;

        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        const rcl = this.room.controller.level;
        
        // Φέρνουμε όλα τα κτίρια που πρέπει να χτιστούν για το τρέχον RCL
        const fullPlan = this.layout.getPlanForRCL(rcl, builtMap);
        if (fullPlan.length === 0) return;

        // 1. Προτεραιότητα σε Structures (Extensions, Spawns, Towers κλπ)
        const structuresPlan = fullPlan.filter(s => s.type !== 'road' && s.type !== 'constructedWall' && s.type !== 'rampart');
        if (structuresPlan.length > 0) {
            this.handleStructureConstruction(structuresPlan, sites.length, maxSites);
            sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        }

        // 2. Έλεγχος για άμυνα (Walls & Ramparts)
        if (sites.length < maxSites) {
            const defensePlan = fullPlan.filter(s => s.type === 'constructedWall' || s.type === 'rampart');
            if (defensePlan.length > 0) {
                this.handleDefenseConstruction(defensePlan, sites.length, maxSites);
                sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
            }
        }

        // 3. Δρόμοι (μόνο αν περισσεύει χώρος για sites)
        if (sites.length < maxSites) {
            const roadsPlan = fullPlan.filter(s => s.type === 'road');
            if (roadsPlan.length > 0) {
                this.handleRoadConstruction(roadsPlan, sites.length, maxSites, rcl, builtMap);
            }
        }
    }

    /**
     * Υπορουτίνα για το χτίσιμο κτιρίων.
     */
    handleStructureConstruction(structuresPlan, currentSiteCount, maxSites) {
        let addedSites = 0;
        for (const target of structuresPlan) {
            if (currentSiteCount + addedSites >= maxSites) break;

            if (this.room.createConstructionSite(target.x, target.y, this.mapType(target.type)) === OK) {
                addedSites++;
            }
        }
    }

    /**
     * Υπορουτίνα για το χτίσιμο αμυντικών έργων (Walls/Ramparts).
     */
    handleDefenseConstruction(defensePlan, currentSiteCount, maxSites) {
        let addedSites = 0;
        for (const target of defensePlan) {
            if (currentSiteCount + addedSites >= maxSites) break;

            // Χρησιμοποιούμε τη mapType για να πάρουμε το σωστό STRUCTURE constant
            if (this.room.createConstructionSite(target.x, target.y, this.mapType(target.type)) === OK) {
                addedSites++;
            }
        }
    }

    /**
     * Υπορουτίνα για το χτίσιμο δρόμων.
     */
    handleRoadConstruction(roadsPlan, currentSiteCount, maxSites, rcl, builtMap) {
        let addedSites = 0;
        for (const roadTarget of roadsPlan) {
            if (currentSiteCount + addedSites >= maxSites) break;
            
            if (RoadPlanner.shouldBuildRoad(roadTarget, global.roomBlueprints[this.roomName], builtMap, rcl)) {
                if (this.room.createConstructionSite(roadTarget.x, roadTarget.y, STRUCTURE_ROAD) === OK) {
                    addedSites++;
                }
            }
        }
    }

    checkSpecialContainers() {
        this.checkRecoverContainer(this.room);
        this.checkControllerContainer(this.room);
    }

    checkRecoverContainer(room) {
        if (room.memory.recoveryContainerId) {
            const existing = Game.getObjectById(room.memory.recoveryContainerId);
            if (existing) return false;
            delete room.memory.recoveryContainerId;
        }
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return false;
        const containers = spawn.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (containers.length > 0) {
            room.memory.recoveryContainerId = containers[0].id;
            return true;
        }
        return false;
    }

    checkControllerContainer(room) {
        if (room.memory.controllerContainerId) {
            const existing = Game.getObjectById(room.memory.controllerContainerId);
            if (existing) return false;
            delete room.memory.controllerContainerId;
        }
        const controller = room.controller;
        if (!controller) return false;
        const containers = controller.pos.findInRange(FIND_STRUCTURES, 4, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (containers.length > 0) {
            room.memory.controllerContainerId = containers[0].id;
            return true;
        }
        return false;
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

    /**
     * Εμφανίζει τα μελλοντικά κτίρια με βελτιωμένο UI (Badge style).
     */
    drawVisuals() {
        if (Memory.debug && Memory.debug.construction === false) return;
        
        const visual = new RoomVisual(this.roomName);
        const builtMap = Memory.rooms[this.roomName].construction.builtStructures || {};
        const currentRCL = this.room.controller.level;
        
        if (this.layout && this.layout.blueprint) {
            this.layout.blueprint.forEach(s => {
                if (builtMap[`${s.x},${s.y}`]) return;

                const isAvailable = s.rcl <= currentRCL;
                const opacity = isAvailable ? 0.6 : 0.2;
                
                // 1. Σχεδιασμός ειδώλου κτιρίου
                visual.structure(s.x, s.y, this.mapType(s.type), { opacity: opacity });

                // 2. Σχεδιασμός \"Badge\" για πληροφορίες
                const rclColor = isAvailable ? '#00ff00' : '#ff4444';
                const textColor = '#ffffff';
                const label = `L${s.rcl} | ${s.score.toFixed(0)}`;
                
                // Υπολογισμός θέσης (λίγο πιο πάνω από το κτίριο)
                const labelY = s.x % 2 === 0 ? s.y - 0.6 : s.y + 0.8;
                
                visual.rect(s.x - 0.65, labelY - 0.25, 1.3, 0.4, {
                    fill: '#000000',
                    opacity: opacity + 0.1,
                    stroke: rclColor,
                    strokeWidth: 0.05
                });

                visual.text(label, s.x, labelY + 0.05, {
                    color: textColor,
                    font: 'bold 0.25 verdana',
                    opacity: opacity + 0.3,
                    align: 'center'
                });
            });
        }
    }
}

module.exports = {
    run: function(roomName) {
        const manager = new ConstructionManager(roomName);
        manager.run();
    }
};
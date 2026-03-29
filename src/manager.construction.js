// manager.construction.js
const MIN_RCL_FOR_ROADS = 2;
const SCAN_INTERVALS = {
    UPDATE_BUILT_CACHE: 30,
    CHECK_CONSTRUCTION_SITES: 50
};

/**
 * Πόσα sites επιτρέπονται ταυτόχρονα
 */
const MAX_CONCURRENT_SITES = 1;

/**
 * Factor για την απόσταση από το κέντρο.
 * Χαμηλή τιμή ώστε να λειτουργεί ως tie-breaker για ίδια κτίρια.
 */
const DISTANCE_FACTOR = 0.1;

const constructionManager = {
    // Προτεραιότητες κατασκευής (Υψηλότερο = Πιο σημαντικό)
    PRIORITIES: {
        SPAWN: 130,
        TOWER: 120,
        EXTENSION: 110,
        STORAGE: 100,
        CONTAINER: 90,
        TERMINAL: 80,
        LINK: 70,
        LAB: 60,
        FACTORY: 50,
        POWER_SPAWN: 40,
        NUKER: 30,
        OBSERVER: 20,
        ROAD: 10,
        RAMPART: 5,
        WALL: 1
    },

    run: function (roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;

        if (!global.roomBlueprints || !global.roomBlueprints[roomName]) return;

        this.initRoomMemory(roomName);

        if (!this.hasBlueprint(roomName)) {
            this.loadBlueprintFromFile(roomName);
        }

        if (Game.time % SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
            this.updateBuiltStructures(room);
        }

        if (Game.time % SCAN_INTERVALS.CHECK_CONSTRUCTION_SITES === 0) {
            this.buildMissingStructures(room);
        }

        if (Memory.debug && Memory.debug.construction) {
            this.visualizeBlueprint(roomName);
        }
    },

    /**
     * VISUALIZATION
     * Εμφανίζει το blueprint και το priority score.
     */
    visualizeBlueprint: function (roomName) {
        const constructionMemory = Memory.rooms[roomName].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return;

        const visual = new RoomVisual(roomName);
        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = Game.rooms[roomName].controller.level;

        for (const s of blueprint) {
            const posKey = `${s.x},${s.y}`;
            const isBuilt = builtStructures[posKey] === s.type;
            const canBuild = s.rcl <= currentRCL;

            let color = isBuilt ? '#00ff00' : (canBuild ? '#ffff00' : '#ff0000');
            let opacity = isBuilt ? 0.1 : 0.5;

            // Σχεδίαση σχήματος
            if (s.type === 'road') {
                visual.circle(s.x, s.y, { radius: 0.15, fill: color, opacity: opacity });
            } else if (['container', 'storage', 'terminal', 'factory'].includes(s.type)) {
                visual.rect(s.x - 0.35, s.y - 0.35, 0.7, 0.7, { stroke: color, strokeWidth: 0.05, opacity: opacity, fill: 'transparent' });
            } else if (s.type === 'rampart' || s.type === 'constructedWall') {
                visual.rect(s.x - 0.5, s.y - 0.5, 1, 1, { fill: color, opacity: 0.1 });
            } else {
                visual.circle(s.x, s.y, { radius: 0.4, stroke: color, strokeWidth: 0.05, opacity: opacity, fill: 'transparent' });
            }

            // Εμφάνιση Score Προτεραιότητας αν δεν έχει χτιστεί
            if (!isBuilt && canBuild) {
                visual.text(s.score, s.x, s.y + 0.2, { color: color, size: 0.3, opacity: 0.8 });
            }
        }
    },

    /**
     * LOGIC: Δημιουργία Construction Sites
     */
    buildMissingStructures: function (room) {
        const constructionMemory = Memory.rooms[room.name].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return false;

        const currentSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (currentSites.length >= MAX_CONCURRENT_SITES) return false;

        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = room.controller.level;

        // Ταξινομούμε εκ νέου αν χρειάζεται (αν και είναι ήδη ταξινομημένα από το load)
        // Εδώ επιλέγουμε το πρώτο διαθέσιμο βάσει της ήδη υπάρχουσας ταξινόμησης
        const validStructure = blueprint.find(s => {
            const posKey = `${s.x},${s.y}`;
            return !builtStructures[posKey] &&
                s.rcl <= currentRCL &&
                !this.siteExistsAt(currentSites, s.x, s.y);
        });

        if (!validStructure) return false;

        const screepsType = this.mapStructureType(validStructure.type);
        if (screepsType) {
            const result = room.createConstructionSite(validStructure.x, validStructure.y, screepsType);
            if (result === OK) {
                console.log(`${room.name} - 🔨 New Construction Site: ${screepsType} at [${validStructure.x}, ${validStructure.y}] (Score: ${validStructure.score.toFixed(1)})`);
                return true;
            }
        }
        return false;
    },

    // --- UTILITIES ---

    siteExistsAt: function (sites, x, y) {
        return sites.some(s => s.pos.x === x && s.pos.y === y);
    },

    mapStructureType: function (type) {
        const MAP = {
            'spawn': STRUCTURE_SPAWN, 'extension': STRUCTURE_EXTENSION, 'road': STRUCTURE_ROAD,
            'constructedWall': STRUCTURE_WALL, 'rampart': STRUCTURE_RAMPART, 'link': STRUCTURE_LINK,
            'storage': STRUCTURE_STORAGE, 'tower': STRUCTURE_TOWER, 'observer': STRUCTURE_OBSERVER,
            'powerSpawn': STRUCTURE_POWER_SPAWN, 'extractor': STRUCTURE_EXTRACTOR, 'lab': STRUCTURE_LAB,
            'terminal': STRUCTURE_TERMINAL, 'container': STRUCTURE_CONTAINER, 'nuker': STRUCTURE_NUKER,
            'factory': STRUCTURE_FACTORY
        };
        return MAP[type];
    },

    initRoomMemory: function (roomName) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        if (!Memory.rooms[roomName].construction) {
            Memory.rooms[roomName].construction = { blueprint: null, builtStructures: {} };
        }
    },

    hasBlueprint: function (roomName) {
        return Memory.rooms[roomName].construction.blueprint != null;
    },

    loadBlueprintFromFile: function (roomName) {
        if (global.roomBlueprints && global.roomBlueprints[roomName]) {
            const rawData = global.roomBlueprints[roomName];
            const center = rawData.buildings.center || { x: 25, y: 25 };
            const flattened = [];

            for (const [type, positions] of Object.entries(rawData.buildings)) {
                if (type === 'center') continue;

                positions.forEach(pos => {
                    const typeUpper = type.toUpperCase();
                    const basePriority = this.PRIORITIES[typeUpper] || 0;

                    // Υπολογισμός Chebyshev Distance από το center
                    const distance = Math.max(Math.abs(pos.x - center.x), Math.abs(pos.y - center.y));

                    // Score = BasePriority - (Distance * Factor)
                    // Έτσι, μικρότερη απόσταση = υψηλότερο score
                    const finalScore = basePriority - (distance * DISTANCE_FACTOR);

                    flattened.push({
                        type: type,
                        x: pos.x,
                        y: pos.y,
                        rcl: this.getRCLRequirement(type),
                        score: finalScore,
                        dist: distance
                    });
                });
            }

            // Ταξινόμηση βάσει Score (Φθίνουσα)
            flattened.sort((a, b) => b.score - a.score);

            Memory.rooms[roomName].construction.blueprint = flattened;
            console.log(`✅ Blueprint loaded for ${roomName} (${flattened.length} structures) with distance-aware priorities.`);
        }
    },

    updateBuiltStructures: function (room) {
        const found = {};
        room.find(FIND_STRUCTURES).forEach(s => {
            found[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        Memory.rooms[room.name].construction.builtStructures = found;
    },

    getRCLRequirement: function (type) {
        const RCL = {
            'road': 2, 'container': 1, 'spawn': 1, 'extension': 2, 'rampart': 2, 'constructedWall': 2,
            'tower': 3, 'storage': 4, 'link': 5, 'extractor': 6, 'lab': 6, 'terminal': 6,
            'factory': 7, 'nuker': 8, 'powerSpawn': 8, 'observer': 8
        };
        return RCL[type] || 8;
    }
};

module.exports = constructionManager;
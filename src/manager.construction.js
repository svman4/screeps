// manager.construction.js
const MIN_RCL_FOR_ROADS = 2;
const SCAN_INTERVALS = {
    UPDATE_BUILT_CACHE: 10,
    CHECK_CONSTRUCTION_SITES: 5
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
        CONTAINER: 110,
        TERMINAL: 80,
        LINK: 70,
        LAB: 60,
        FACTORY: 50,
        POWER_SPAWN: 40,
        NUKER: 30,
        OBSERVER: 20,
        ROAD: 10,
        RAMPART: 1,
        WALL: 5
    },

    /**
     * Επίπεδα RCL ανά ποσότητα κτιρίων (π.χ. το 1ο spawn στο rcl 1, το 2ο στο rcl 7)
     */
    STRUCTURE_RCL_STEPS: {
        'spawn': [1, 7, 8],
        'tower': [3, 5, 7, 8, 8, 8],
        'extension': {
            1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60
        },
        'link': [5, 5, 6, 7, 8, 8],
        'lab': [6, 6, 6, 7, 7, 8, 8, 8, 8, 8],
		'container':{1:3,4:2},

    },

    run: function (roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;

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

            if (s.type === 'road') {
                visual.circle(s.x, s.y, { radius: 0.15, fill: color, opacity: opacity });
            } else if (['container', 'storage', 'terminal', 'factory'].includes(s.type)) {
                visual.rect(s.x - 0.35, s.y - 0.35, 0.7, 0.7, { stroke: color, strokeWidth: 0.05, opacity: opacity, fill: 'transparent' });
            } else {
                visual.circle(s.x, s.y, { radius: 0.4, stroke: color, strokeWidth: 0.05, opacity: opacity, fill: 'transparent' });
            }

            if (!isBuilt) {
                if (!canBuild) {
                    visual.text(`R${s.rcl}`, s.x, s.y, { color: '#ff0000', size: 0.4 });
                } else {
                    visual.text(s.score.toFixed(0), s.x, s.y + 0.2, { color: color, size: 0.3, opacity: 0.8 });
                }
            }
        }
    },

    buildMissingStructures: function (room) {
        const constructionMemory = Memory.rooms[room.name].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return false;
		
        const currentSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (currentSites.length >= MAX_CONCURRENT_SITES) return false;
	
        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = room.controller.level;
	
        // Επιλογή του πρώτου στη λίστα (υψηλότερο score) που επιτρέπεται από το RCL
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
                console.log(`${room.name} - 🔨 Construction: ${validStructure.type} at [${validStructure.x}, ${validStructure.y}] (Score: ${validStructure.score.toFixed(1)}, RCL Req: ${validStructure.rcl})`);
                return true;
            }
        }
        return false;
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

                const sortedPositions = [...positions].sort((a, b) => {
                    const distA = Math.max(Math.abs(a.x - center.x), Math.abs(a.y - center.y));
                    const distB = Math.max(Math.abs(b.x - center.x), Math.abs(b.y - center.y));
                    return distA - distB;
                });

                sortedPositions.forEach((pos, index) => {
                    const typeUpper = type.toUpperCase();
                    const basePriority = this.PRIORITIES[typeUpper] || 0;
                    const distance = Math.max(Math.abs(pos.x - center.x), Math.abs(pos.y - center.y));
                    
                    const rclReq = this.calculateRCLRequirement(type, index);

                    // Score για tie-breaking (υψηλότερο score = προηγείται)
                    const finalScore = basePriority - (distance * DISTANCE_FACTOR);

                    flattened.push({
                        type: type,
                        x: pos.x,
                        y: pos.y,
                        rcl: rclReq,
                        score: finalScore,
                        dist: distance
                    });
                });
            }

            /**
             * ΤΕΛΙΚΗ ΤΑΞΙΝΟΜΗΣΗ (ΔΙΟΡΘΩΜΕΝΗ)
             * Ταξινομούμε αποκλειστικά βάσει Score (Priority).
             * Η συνάρτηση buildMissingStructures θα φιλτράρει το RCL.
             */
            flattened.sort((a, b) => {
                return b.score - a.score;
            });

            Memory.rooms[roomName].construction.blueprint = flattened;
            console.log(`✅ Blueprint loaded for ${roomName}. Sorted by Priority Score (Tower/Extensions before Roads).`);
        }
    },

    /**
     * Υπολογίζει το απαιτούμενο RCL για μια συγκεκριμένη δομή βάσει του πλήθους της.
     */
    calculateRCLRequirement: function (type, index) {
        if (this.STRUCTURE_RCL_STEPS[type]) {
            const steps = this.STRUCTURE_RCL_STEPS[type];
            if (Array.isArray(steps)) {
                return steps[index] || steps[steps.length - 1];
            }
            if (type === 'extension') {
                for (let rcl = 1; rcl <= 8; rcl++) {
                    if (index < steps[rcl]) return rcl;
                }
                return 8;
            }
        }

        const DEFAULTS = {
            'road': 3, 'container': 1, 'spawn': 1, 'extension': 2, 'rampart': 4, 'constructedWall': 4,
            'tower': 3, 'storage': 4, 'link': 5, 'extractor': 6, 'lab': 6, 'terminal': 6,
            'factory': 7, 'nuker': 8, 'powerSpawn': 8, 'observer': 8
        };
        return DEFAULTS[type] || 8;
    },

    siteExistsAt: function (sites, x, y) {
        const answer= sites.some(s => s.pos.x === x && s.pos.y === y);
		if (answer===true)
			console.log("Βρέθηκε άλλο κτίριο στη θεση ("+x+","+y+")");
		return answer;
    },

    updateBuiltStructures: function (room) {
        const found = {};
        room.find(FIND_STRUCTURES).forEach(s => {
            found[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        this.checkRecoveryContainer(room);
        this.checkControllerContainer(room);
        Memory.rooms[room.name].construction.builtStructures = found;
    }
    ,checkRecoveryContainer:function(room) {
        // TODO έλεγχος αν έχει χτιστεί το recovery Container και εισαγωγή του στο memory του δωματίου
        return ;
    } 
    , checkControllerContainer:function(room) {
        // TODO έλεγχος αν έχει χτιστεί το controller Container και εισαγωγή του στο memory του δωματίου
        return;
    }
};

module.exports = constructionManager;
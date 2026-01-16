// manager.construction.js
// Καθαρή έκδοση: Χρήση native RoomVisual API, αφαίρεση περιττών custom drawings.

const constructionManager = {
    // Ρυθμίσεις
    constructionSitesMax: 1, // Πόσα sites επιτρέπονται ταυτόχρονα (για να μην μπλοκάρουν οι builders)
    
    // Προτεραιότητες κατασκευής (Υψηλότερο = Πιο σημαντικό)
    PRIORITIES: {
        SPAWN: 10, EXTENSION: 20, ROAD: 50, CONTAINER: 40, TOWER: 50,
        STORAGE: 60, LINK: 70, TERMINAL: 80, LAB: 90, FACTORY: 100,
        POWER_SPAWN: 110, NUKER: 120, OBSERVER: 130, RAMPART: 100, WALL: 150
    },

    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;
        
        // Έλεγχος αν υπάρχει blueprint στη μνήμη (global ή local)
        if (!global.roomBlueprints || !global.roomBlueprints[roomName]) return;

        // 1. Αρχικοποίηση μνήμης (αν χρειάζεται)
        this.initRoomMemory(roomName);

        // 2. Φόρτωση Blueprint (αν δεν έχει φορτωθεί ήδη)
        if (!this.hasBlueprint(roomName)) {
            this.loadBlueprintFromFile(roomName);
        }

        // 3. Ενημέρωση λίστας χτισμένων δομών (για να ξέρουμε τι λείπει)
        // Εκτελείται κάθε 10 ticks για εξοικονόμηση CPU
        if (Game.time % 10 === 0) {
            this.updateBuiltStructures(room);
        }

        // 4. Δημιουργία Construction Sites (αν χρειάζεται)
        // Εκτελείται κάθε 20 ticks
        if (Game.time % 20 === 0) {
            this.buildMissingStructures(room);
        }

        // 5. Visuals: Εμφάνιση Blueprint (ΜΟΝΟ αν είναι ενεργό το debug)
        if (Memory.debug && Memory.debug.construction) {
            this.visualizeBlueprint(roomName);
        }
    },

    /**
     * --- VISUALIZATION (Το κομμάτι που ζήτησες να καθαρίσει) ---
     * Χρησιμοποιεί αποκλειστικά το native RoomVisual API.
     */
    visualizeBlueprint: function(roomName) {
        const constructionMemory = Memory.rooms[roomName].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return;

        const visual = new RoomVisual(roomName); // Native Visual Object
        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = Game.rooms[roomName].controller.level;

        for (const s of blueprint) {
            const posKey = `${s.x},${s.y}`;
            const isBuilt = builtStructures[posKey] === s.type;
            const canBuild = s.rcl <= currentRCL;

            // Χρώματα ανάλογα με την κατάσταση
            // Πράσινο: Χτισμένο, Κίτρινο: Μπορεί να χτιστεί, Κόκκινο: Future (High RCL)
            let color = isBuilt ? '#00ff00' : (canBuild ? '#ffff00' : '#ff0000');
            let opacity = isBuilt ? 0.1 : 0.5; // Τα χτισμένα αχνοφαίνονται

            // Απλοποιημένη σχεδίαση
            if (s.type === 'road') {
                visual.circle(s.x, s.y, { radius: 0.15, fill: color, opacity: opacity });
            } 
            else if (['container', 'storage', 'terminal', 'factory'].includes(s.type)) {
                visual.rect(s.x - 0.35, s.y - 0.35, 0.7, 0.7, { stroke: color, strokeWidth: 0.1, opacity: opacity, fill: 'transparent' });
            }
            else if (s.type === 'rampart' || s.type === 'constructedWall') {
                // Τα τείχη ως μικρά τετραγωνάκια για να μην καλύπτουν το view
                visual.rect(s.x - 0.5, s.y - 0.5, 1, 1, { fill: color, opacity: 0.1 });
            }
            else {
                // Όλα τα υπόλοιπα (Spawns, Extensions, Labs, Towers) ως κύκλοι
                visual.circle(s.x, s.y, { radius: 0.4, stroke: color, strokeWidth: 0.1, opacity: opacity, fill: 'transparent' });
            }
        }
    },

    /**
     * --- LOGIC: Δημιουργία Construction Sites ---
     */
    buildMissingStructures: function(room) {
        const constructionMemory = Memory.rooms[room.name].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return;

        const currentSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (currentSites.length >= this.constructionSitesMax) return; // Όριο sites

        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = room.controller.level;

        // Βρίσκουμε τι λείπει και μπορούμε να το χτίσουμε τώρα
        const validStructure = blueprint.find(s => {
            const posKey = `${s.x},${s.y}`;
            // 1. Δεν είναι χτισμένο
            // 2. Το επιτρέπει το RCL
            // 3. Δεν υπάρχει ήδη site εκεί
            return !builtStructures[posKey] && 
                   s.rcl <= currentRCL &&
                   !this.siteExistsAt(currentSites, s.x, s.y);
        });

        if (validStructure) {
            const screepsType = this.mapStructureType(validStructure.type);
            if (screepsType) {
                const result = room.createConstructionSite(validStructure.x, validStructure.y, screepsType);
                if (result === OK) {
                    console.log(`🔨 New Construction Site: ${screepsType} at [${validStructure.x}, ${validStructure.y}]`);
                }
            }
        }
    },

    // --- UTILITIES ---

    siteExistsAt: function(sites, x, y) {
        return sites.some(s => s.pos.x === x && s.pos.y === y);
    },

    mapStructureType: function(type) {
        // Mapping string -> Constant
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

    initRoomMemory: function(roomName) {
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        if (!Memory.rooms[roomName].construction) {
            Memory.rooms[roomName].construction = { blueprint: null, builtStructures: {} };
        }
    },

    hasBlueprint: function(roomName) {
        return Memory.rooms[roomName].construction.blueprint != null;
    },

    loadBlueprintFromFile: function(roomName) {
        if (global.roomBlueprints && global.roomBlueprints[roomName]) {
            const rawData = global.roomBlueprints[roomName];
            const flattened = [];
            
            // Μετατροπή από { buildings: { extension: [{x,y},...] } } σε Array [{type, x, y, rcl}]
            for (const [type, positions] of Object.entries(rawData.buildings)) {
                positions.forEach(pos => {
                    flattened.push({
                        type: type,
                        x: pos.x,
                        y: pos.y,
                        rcl: this.getRCLRequirement(type) // Βοηθητική συνάρτηση για RCL
                    });
                });
            }
            
            // Sort by Priority
            flattened.sort((a, b) => (this.PRIORITIES[b.type.toUpperCase()] || 0) - (this.PRIORITIES[a.type.toUpperCase()] || 0));
            
            Memory.rooms[roomName].construction.blueprint = flattened;
            console.log(`✅ Blueprint loaded for ${roomName} (${flattened.length} structures)`);
        }
    },

    updateBuiltStructures: function(room) {
        const found = {};
        room.find(FIND_STRUCTURES).forEach(s => {
            found[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });
        Memory.rooms[room.name].construction.builtStructures = found;
    },

    getRCLRequirement: function(type) {
        const RCL = {
            'road': 1, 'container': 1, 'spawn': 1, 'extension': 2, 'rampart': 2, 'constructedWall': 2,
            'tower': 3, 'storage': 4, 'link': 5, 'extractor': 6, 'lab': 6, 'terminal': 6,
            'factory': 7, 'nuker': 8, 'powerSpawn': 8, 'observer': 8
        };
        return RCL[type] || 8;
    }
};

module.exports = constructionManager;
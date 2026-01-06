// manager.construction.js - ΒΕΛΤΙΩΜΕΝΟΣ ΜΕ ΟΠΤΙΚΗ ΑΠΕΙΚΟΝΙΣΗ ΒΑΣΗΣ ΜΕ RoomVisual
const constructionManager = {
    // Ρυθμίσεις
    constructionSitesMax: 1,
    
    // Προτεραιότητες κατασκευής
    PRIORITIES: {
        SPAWN: 10,
        EXTENSION: 20,
        ROAD: 50,
        CONTAINER: 40,
        TOWER: 50,
        STORAGE: 60,
        LINK: 70,
        TERMINAL: 80,
        LAB: 90,
        FACTORY: 100,
        POWER_SPAWN: 110,
        NUKER: 120,
        OBSERVER: 130,
        RAMPART: 100,
        WALL: 150
    },

    // Χρώματα για κάθε τύπο δομής
    STRUCTURE_COLORS: {
        'spawn': '#ff00ff',
        'extension': '#00ff00',
        'road': '#ffffff',
        'container': '#ffff00',
        'tower': '#ff0000',
        'storage': '#ffa500',
        'link': '#00ffff',
        'terminal': '#800080',
        'lab': '#008080',
        'factory': '#808080',
        'observer': '#0000ff',
        'powerSpawn': '#ff1493',
        'nuker': '#8b0000',
        'rampart': '#ffd700',
        'constructedWall': '#a9a9a9',
        'extractor': '#00ff80'
    },

    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;
        
        // Αρχικοποίηση μνήμης
        this.initRoomMemory(roomName);

        // ΒΗΜΑ 1: Φόρτωση blueprint αν δεν υπάρχει
        if (!this.hasBlueprint(roomName)) {
            this.loadBlueprintFromFile(roomName);
        }

        // ΒΗΜΑ 2: Ενημέρωση καταστάσεων χτισμένων δομών
        this.updateBuiltStructures(room);

        // ΒΗΜΑ 3: Δημιουργία construction sites
        this.buildMissingStructures(room);

        // ΒΗΜΑ 4: Οπτική απεικόνιση βάσης με RoomVisual
        if(Memory.debug && Memory.debug.construction) {
            this.visualizeBaseDesign(roomName);
        }
    
    },

    /**
     * ΔΗΜΙΟΥΡΓΙΑ CONSTRUCTION SITES ΓΙΑ ΔΟΜΕΣ ΠΟΥ ΛΕΙΠΟΥΝ
     */
     buildMissingStructures: function(room) {
         
        const constructionMemory = Memory.rooms[room.name].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return;

        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = room.controller.level;
        const currentSites = room.find(FIND_CONSTRUCTION_SITES);
        
        if (currentSites.length >= this.constructionSitesMax) {
            return;
        }

       // console.log(`🔨 Έλεγχος για construction sites στο ${room.name} (RCL: ${currentRCL}, Sites: ${currentSites.length}/${this.constructionSitesMax})`);

        // Φιλτράρισμα δομών που μπορούν να χτιστούν
        const structuresToBuild = blueprint.filter(structure => {
            const posKey = `${structure.x},${structure.y}`;
            const isBuilt = builtStructures[posKey] === structure.type;
            const canBuild = structure.rcl <= currentRCL;
            const hasConstructionSite = currentSites.some(site => 
                site.pos.x === structure.x && site.pos.y === structure.y
            );

            return !isBuilt && canBuild && !hasConstructionSite;
        });

        if (structuresToBuild.length === 0) {
            return;
        }

        // Υπολογισμός προτεραιότητας βάσει απόστασης από storage/controller
        const prioritizedStructures = this.prioritizeStructuresByDistance(room, structuresToBuild);

        // Δημιουργία construction sites
        let sitesCreated = 0;
        for (const structure of prioritizedStructures) {
            if (sitesCreated >= (this.constructionSitesMax - currentSites.length)) {
                break;
            }

            const structureType = this.mapToScreepsStructureType(structure.type);
            if (!structureType) {
                console.log(`❌ Άγνωστος τύπος δομής: ${structure.type}`);
                continue;
            }

            const result = this.createConstructionSite(room, structure.x, structure.y, structureType);
            if (result === OK) {
                console.log(`🏗️ Δημιουργήθηκε construction site: ${structureType} at (${structure.x},${structure.y}) - Priority: ${structure.priorityScore.toFixed(2)}`);
                sitesCreated++;
            } else if (result !== ERR_INVALID_TARGET && result !== ERR_FULL) {
                //console.log(`❌ Σφάλμα δημιουργίας construction site: ${structureType} at (${structure.x},${structure.y}) - ${result}`);
            }
        }

        if (sitesCreated > 0) {
            console.log(`✅ Δημιουργήθηκαν ${sitesCreated} construction sites στο ${room.name}`);
        }
    },
     prioritizeStructuresByDistance: function(room, structures) {
        const centerPoint = this.getConstructionCenterPoint(room);
        
        if (!centerPoint) {
            // Επιστροφή προεπιλεγμένης προτεραιότητας αν δεν βρεθεί κεντρικό σημείο
            return structures.sort((a, b) => a.priority - b.priority);
        }

        // Υπολογισμός προτεραιότητας για κάθε δομή
        const prioritized = structures.map(structure => {
            const structurePos = new RoomPosition(structure.x, structure.y, room.name);
            const distance = structurePos.getRangeTo(centerPoint.x, centerPoint.y);
            
            // Σκορ προτεραιότητας: υψηλότερη προτεραιότητα = υψηλότερο score
            // Βασική προτεραιότητα από το blueprint (αντίστροφη - χαμηλότερος αριθμός = υψηλότερη προτεραιότητα)
            const basePriorityScore = 100 - structure.priority;
            
            // Μείωση βαθμολογίας βάσει απόστασης (πιο κοντινές δομές = υψηλότερο score)
            const distanceScore = Math.max(0, 50 - distance * 5); // Μέγιστη απόσταση 10 για πλήρη βαθμολογία
            
            // Τελικό score (70% προτεραιότητα, 30% απόσταση)
            const priorityScore = (basePriorityScore * 0.7) + (distanceScore * 0.3);
            
            return {
                ...structure,
                priorityScore: priorityScore,
                distance: distance
            };
        });

        // Ταξινόμηση κατά φθίνον προτεραιότητα
        return prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
    },
    /**
     * ΕΥΡΕΣΗ ΚΕΝΤΡΙΚΟΥ ΣΗΜΕΙΟΥ ΓΙΑ ΠΡΟΤΕΡΑΙΟΠΟΙΗΣΗ
     */
    getConstructionCenterPoint: function(room) {
        // Προτεραιότητα 1: Storage
        if (room.storage) {
            return {
                x: room.storage.pos.x,
                y: room.storage.pos.y,
                type: 'storage'
            };
        }
        
        // Προτεραιότητα 2: Controller
        if (room.controller) {
            return {
                x: room.controller.pos.x,
                y: room.controller.pos.y,
                type: 'controller'
            };
        }
        
        // Προτεραιότητα 3: Πρώτο spawn
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            return {
                x: spawns[0].pos.x,
                y: spawns[0].pos.y,
                type: 'spawn'
            };
        }
        
        return null;
    },
 /**
     * ΑΝΑΓΝΩΡΙΣΗ ΤΥΠΟΥ ΔΟΜΗΣ ΣΕ SCREEPS STRUCTURE TYPE
     */
    mapToScreepsStructureType: function(structureType) {
        const mapping = {
            'spawn': STRUCTURE_SPAWN,
            'extension': STRUCTURE_EXTENSION,
            'road': STRUCTURE_ROAD,
            'container': STRUCTURE_CONTAINER,
            'tower': STRUCTURE_TOWER,
            'storage': STRUCTURE_STORAGE,
            'link': STRUCTURE_LINK,
            'terminal': STRUCTURE_TERMINAL,
            'lab': STRUCTURE_LAB,
            'factory': STRUCTURE_FACTORY,
            'observer': STRUCTURE_OBSERVER,
            'powerSpawn': STRUCTURE_POWER_SPAWN,
            'nuker': STRUCTURE_NUKER,
            'rampart': STRUCTURE_RAMPART,
            'constructedWall': STRUCTURE_WALL,
            'extractor': STRUCTURE_EXTRACTOR
        };
        
        return mapping[structureType] || null;
    },
    /**
     * ΔΗΜΙΟΥΡΓΙΑ CONSTRUCTION SITE - ΔΙΟΡΘΩΜΕΝΟ
     */
    createConstructionSite: function(room, x, y, structureType) {
        // 1. Έλεγχος Terrain
        const terrain = room.getTerrain();
        if (terrain.get(x, y) === TERRAIN_MASK_WALL && structureType !== STRUCTURE_EXTRACTOR) {
            return ERR_INVALID_TARGET;
        }

        // 2. Έλεγχος για υπάρχοντα αντικείμενα στη θέση
        const objects = room.lookAt(x, y);
        
        for (const object of objects) {
            // Αν υπάρχει ήδη το ίδιο construction site, σταμάτα
            if (object.type === LOOK_CONSTRUCTION_SITES) {
                return ERR_INVALID_TARGET; 
            }

            // Αν υπάρχει ήδη η ίδια δομή, σταμάτα
            if (object.type === LOOK_STRUCTURES && object.structure.structureType === structureType) {
                return ERR_INVALID_TARGET;
            }

            // Ειδικοί κανόνες Screeps:
            // Επιτρέπεται Rampart πάνω από οποιαδήποτε δομή (εκτός άλλου rampart)
            // Επιτρέπεται οποιαδήποτε δομή πάνω από Road (εκτός αν είναι άλλη οδός)
            if (object.type === LOOK_STRUCTURES) {
                const isRampart = structureType === STRUCTURE_RAMPART;
                const isRoad = object.structure.structureType === STRUCTURE_ROAD;
                
                // Αν ΔΕΝ χτίζουμε rampart ΚΑΙ η υπάρχουσα δομή ΔΕΝ είναι δρόμος, τότε η θέση είναι κατειλημμένη
                if (!isRampart && !isRoad) {
                    return ERR_INVALID_TARGET;
                }
            }

            // Εμπόδια όπως πηγές ενέργειας
            if (object.type === LOOK_SOURCES || object.type === LOOK_MINERALS) {
                return ERR_INVALID_TARGET;
            }
        }

        // 3. Προσπάθεια δημιουργίας
        return room.createConstructionSite(x, y, structureType);
    },

    /**
     * ΟΠΤΙΚΗ ΑΠΕΙΚΟΝΙΣΗ ΜΕ RoomVisual
     */
    visualizeBaseDesign: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const constructionMemory = Memory.rooms[roomName].construction;
        if (!constructionMemory || !constructionMemory.blueprint) return;

        const blueprint = constructionMemory.blueprint;
        const builtStructures = constructionMemory.builtStructures || {};
        const currentRCL = room.controller ? room.controller.level : 1;

        // Καθαρισμός προηγούμενων οπτικών
        room.visual.clear();

        // Σχεδίαση κάθε δομής με RoomVisual
        blueprint.forEach(structure => {
            this.drawStructureWithRoomVisual(room, structure, builtStructures, currentRCL);
        });

        // Πληροφορίες δωματίου
        this.drawRoomInfo(room, blueprint, builtStructures, currentRCL);
    },

    /**
     * ΣΧΕΔΙΑΣΜΟΣ ΔΟΜΗΣ ΜΕ RoomVisual
     */
    drawStructureWithRoomVisual: function(room, structure, builtStructures, currentRCL) {
        const pos = new RoomPosition(structure.x, structure.y, room.name);
        const posKey = `${structure.x},${structure.y}`;
        const isBuilt = builtStructures[posKey] === structure.type;
        const canBuild = structure.rcl <= currentRCL;

        // Χρώμα βάσει κατάστασης
        let color, opacity;

        if (isBuilt) {
            color = this.STRUCTURE_COLORS[structure.type] || '#cccccc';
            opacity = 0.8;
        } else if (canBuild) {
            color = this.STRUCTURE_COLORS[structure.type] || '#cccccc';
            opacity = 0.6;
        } else {
            color = '#555555';
            opacity = 0.3;
        }

        // Σχεδίαση με βασικές μεθόδους RoomVisual
        this.drawStructureShape(room, structure, color, opacity);

        // Κείμενο με συντομογραφία τύπου
        const abbr = structure.type.substring(0, 3).toUpperCase();
        room.visual.text(abbr, structure.x, structure.y, {
            color: isBuilt ? '#00ff00' : (canBuild ? '#ffffff' : '#888888'),
            font: 0.4,
            stroke: '#000000',
            align: 'center'
        });

        // RCL απαίτηση για μη χτισμένες δομές
        if (!isBuilt && !canBuild) {
            room.visual.text(`R${structure.rcl}`, structure.x, structure.y + 0.4, {
                color: '#ffaa00',
                font: 0.3,
                align: 'center'
            });
        }
    },

    /**
     * Σχεδίαση σχήματος δομής με βασικές μεθόδους RoomVisual
     */
    drawStructureShape: function(room, structure, color, opacity) {
        const x = structure.x;
        const y = structure.y;

        switch(structure.type) {
            case 'spawn':
                room.visual.circle(x, y, {radius: 0.5, fill: color, opacity: opacity});
                room.visual.circle(x, y, {radius: 0.3, fill: '#ffcc00', opacity: opacity});
                break;
            case 'extension':
                room.visual.circle(x, y, {radius: 0.4, fill: color, opacity: opacity});
                break;
            case 'road':
                room.visual.circle(x, y, {radius: 0.25, fill: color, opacity: opacity});
                break;
            case 'container':
                room.visual.rect(x - 0.3, y - 0.3, 0.6, 0.6, {fill: color, opacity: opacity});
                break;
            case 'tower':
                room.visual.poly([
                    {x: x, y: y - 0.4},
                    {x: x + 0.4, y: y + 0.4},
                    {x: x - 0.4, y: y + 0.4}
                ], {fill: color, opacity: opacity});
                break;
            case 'storage':
                room.visual.rect(x - 0.5, y - 0.5, 1.0, 1.0, {fill: color, opacity: opacity});
                break;
            case 'link':
                room.visual.circle(x, y, {radius: 0.4, fill: color, opacity: opacity});
                room.visual.rect(x - 0.2, y - 0.2, 0.4, 0.4, {fill: '#000000', opacity: opacity});
                break;
            case 'terminal':
                room.visual.rect(x - 0.5, y - 0.5, 1.0, 1.0, {fill: color, opacity: opacity});
                room.visual.rect(x - 0.3, y - 0.3, 0.6, 0.6, {fill: '#000000', opacity: opacity});
                break;
            case 'lab':
                room.visual.rect(x - 0.4, y - 0.4, 0.8, 0.8, {fill: color, opacity: opacity});
                room.visual.rect(x - 0.2, y - 0.2, 0.4, 0.4, {fill: '#000000', opacity: opacity});
                break;
            case 'factory':
                room.visual.rect(x - 0.5, y - 0.5, 1.0, 1.0, {fill: color, opacity: opacity});
                room.visual.circle(x, y, {radius: 0.3, fill: '#000000', opacity: opacity});
                break;
            case 'observer':
                room.visual.circle(x, y, {radius: 0.4, fill: color, opacity: opacity});
                room.visual.circle(x, y, {radius: 0.2, fill: '#000000', opacity: opacity});
                break;
            case 'powerSpawn':
                room.visual.circle(x, y, {radius: 0.5, fill: color, opacity: opacity});
                room.visual.rect(x - 0.3, y - 0.3, 0.6, 0.6, {fill: '#000000', opacity: opacity});
                break;
            case 'nuker':
                room.visual.rect(x - 0.5, y - 0.5, 1.0, 1.0, {fill: color, opacity: opacity});
                room.visual.rect(x - 0.2, y - 0.2, 0.4, 0.4, {fill: '#000000', opacity: opacity});
                break;
            case 'rampart':
                room.visual.circle(x, y, {radius: 0.5, fill: color, opacity: opacity});
                break;
            case 'constructedWall':
                room.visual.rect(x - 0.3, y - 0.3, 0.6, 0.6, {fill: color, opacity: opacity});
                break;
            case 'extractor':
                room.visual.circle(x, y, {radius: 0.5, fill: color, opacity: opacity});
                room.visual.rect(x - 0.3, y - 0.1, 0.6, 0.2, {fill: '#000000', opacity: opacity});
                break;
            default:
                room.visual.circle(x, y, {radius: 0.4, fill: color, opacity: opacity});
        }
    },

    /**
     * ΣΧΕΔΙΑΣΜΟΣ ΠΛΗΡΟΦΟΡΙΩΝ ΔΩΜΑΤΙΟΥ
     */
    drawRoomInfo: function(room, blueprint, builtStructures, currentRCL) {
        const infoX = 1;
        let infoY = 1;

        // Φόντο πληροφοριών
        room.visual.rect(infoX - 0.5, infoY - 0.5, 12, 5, {
            fill: '#000000',
            opacity: 0.7
        });

        room.visual.text(`🏠 ${room.name} - RCL ${currentRCL}`, infoX, infoY, {
            color: '#ffff00',
            font: 0.6
        });
        infoY += 0.8;

        // Στατιστικά
        const stats = this.calculateConstructionStats(blueprint, builtStructures, currentRCL);
        
        room.visual.text(`📊 Blueprint: ${stats.totalStructures}`, infoX, infoY, {
            color: '#ffffff',
            font: 0.4
        });
        infoY += 0.5;

        room.visual.text(`✅ Built: ${stats.builtStructures} (${stats.builtPercentage}%)`, infoX, infoY, {
            color: '#00ff00',
            font: 0.4
        });
        infoY += 0.5;

        room.visual.text(`🛠️ Can Build: ${stats.canBuild}`, infoX, infoY, {
            color: '#ffffff',
            font: 0.4
        });
        infoY += 0.5;

        room.visual.text(`🏗️ Sites: ${stats.constructionSites}/${this.constructionSitesMax}`, infoX, infoY, {
            color: stats.constructionSites > 0 ? '#ffff00' : '#ffffff',
            font: 0.4
        });
    },

    /**
     * ΑΡΧΙΚΟΠΟΙΗΣΗ ΜΝΗΜΗΣ ΔΩΜΑΤΙΟΥ
     */
    initRoomMemory: function(roomName) {
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {
                construction: {
                    blueprint: null,
                    builtStructures: {},
                    lastRCL: 0
                }
            };
        }

        if (!Memory.rooms[roomName].construction) {
            Memory.rooms[roomName].construction = {
                blueprint: null,
                builtStructures: {},
                lastRCL: 0
            };
        }

        if (!Memory.rooms[roomName].construction.builtStructures) {
            Memory.rooms[roomName].construction.builtStructures = {};
        }
    },

    /**
     * ΕΛΕΓΧΟΣ AN ΥΠΑΡΧΕΙ BLUEPRINT
     */
    hasBlueprint: function(roomName) {
        return Memory.rooms[roomName] && 
               Memory.rooms[roomName].construction && 
               Memory.rooms[roomName].construction.blueprint !== null;
    },

    /**
     * ΦΟΡΤΩΣΗ BLUEPRINT ΑΠΟ ΑΡΧΕΙΟ ΔΩΜΑΤΙΟΥ
     */
    loadBlueprintFromFile: function(roomName) {
        try {
            // Προσπάθεια φόρτωσης από global blueprints
            if (global.roomBlueprints && global.roomBlueprints[roomName]) {
                const blueprintData = global.roomBlueprints[roomName];
                if (this.processBlueprintData(roomName, blueprintData)) {
                    console.log(`✅ Φορτώθηκε blueprint από αρχείο: ${roomName}`);
                    return true;
                }
            }

            console.log(`❌ Δεν βρέθηκε blueprint για δωμάτιο: ${roomName}`);
            return false;
            
        } catch (error) {
            console.log(`❌ Σφάλμα φόρτωσης blueprint για ${roomName}: ${error}`);
            return false;
        }
    },

    /**
     * ΕΠΕΞΕΡΓΑΣΙΑ ΔΕΔΟΜΕΝΩΝ BLUEPRINT
     */
    processBlueprintData: function(roomName, blueprintData) {
        if (!blueprintData || !blueprintData.buildings) {
            console.log(`❌ Μη έγκυρα blueprint data για ${roomName}`);
            return false;
        }

        const constructionMemory = Memory.rooms[roomName].construction;
        const formattedBlueprint = [];

        // Μετατροπή των δεδομένων σε ενοποιημένο format
        Object.keys(blueprintData.buildings).forEach(structureType => {
            const structures = blueprintData.buildings[structureType];
            
            if (!Array.isArray(structures)) {
                console.log(`⚠️ Μη έγκυρο structure array για ${structureType} στο ${roomName}`);
                return;
            }
            
            structures.forEach(structure => {
                const priority = this.PRIORITIES[structureType.toUpperCase()] || 100;
                
                formattedBlueprint.push({
                    type: structureType,
                    x: structure.x,
                    y: structure.y,
                    priority: priority,
                    rcl: this.getRCLForStructure(structureType)
                });
            });
        });

        // Ταξινόμηση κατά προτεραιότητα
        formattedBlueprint.sort((a, b) => a.priority - b.priority);
        
        constructionMemory.blueprint = formattedBlueprint;
        constructionMemory.lastRCL = 0;

        console.log(`📊 Δημιουργήθηκε blueprint με ${formattedBlueprint.length} δομές για ${roomName}`);
        return true;
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ RCL ΓΙΑ ΚΑΘΕ STRUCTURE TYPE
     */
    getRCLForStructure: function(structureType) {
        const rclRequirements = {
            'spawn': 1,
            'extension': 2,
            'road': 1,
            'constructedWall': 2,
            'rampart': 4,
            'container': 1,
            'tower': 3,
            'storage': 4,
            'link': 5,
            'terminal': 6,
            'lab': 6,
            'factory': 7,
            'observer': 8,
            'powerSpawn': 8,
            'nuker': 8,
            'extractor': 6
        };

        return rclRequirements[structureType] || 8;
    },

    /**
     * ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΑΣΗΣ ΧΤΙΣΜΕΝΩΝ ΔΟΜΩΝ
     */
   updateBuiltStructures: function(room) {
        const constructionMemory = Memory.rooms[room.name].construction;
        
        // 1. Δημιουργούμε ένα νέο προσωρινό αντικείμενο για τα κτίρια που όντως υπάρχουν αυτή τη στιγμή
        const currentStructures = {};
        const allStructures = room.find(FIND_STRUCTURES);
        
        allStructures.forEach(structure => {
            const posKey = `${structure.pos.x},${structure.pos.y}`;
            currentStructures[posKey] = structure.structureType;
        });

        // 2. Αντικαθιστούμε την παλιά μνήμη με τη φρέσκια εικόνα του δωματίου
        // Έτσι, αν κάτι καταστράφηκε, απλά δεν θα υπάρχει στο currentStructures
        constructionMemory.builtStructures = currentStructures;
    },

    /**
     * ΥΠΟΛΟΓΙΣΜΟΣ ΣΤΑΤΙΣΤΙΚΩΝ ΚΑΤΑΣΚΕΥΗΣ
     */
    calculateConstructionStats: function(blueprint, builtStructures, currentRCL) {
        let totalStructures = blueprint.length;
        let builtStructuresCount = 0;
        let canBuildCount = 0;
        let needsRCLCount = 0;

        blueprint.forEach(structure => {
            const posKey = `${structure.x},${structure.y}`;
            
            if (builtStructures[posKey] === structure.type) {
                builtStructuresCount++;
            } else if (structure.rcl <= currentRCL) {
                canBuildCount++;
            } else {
                needsRCLCount++;
            }
        });

        const builtPercentage = totalStructures > 0 ? 
            Math.round((builtStructuresCount / totalStructures) * 100) : 0;

        return {
            totalStructures,
            builtStructures: builtStructuresCount,
            builtPercentage,
            canBuild: canBuildCount,
            needsRCL: needsRCLCount,
            constructionSites: Object.keys(Game.constructionSites).length
        };
    }
};

module.exports = constructionManager;
// manager.construction.js
const constructionManager = {
    // Ρυθμίσεις
    constructionSitesMax:2,
    
    run: function(roomName,debug=false) {
        if (Memory.debug.construction) {
            this.visualizeBlueprint(roomName,8);}
        
        
        // // Εκτέλεση κάθε 10 ticks για εξοικονόμηση CPU
         if (Game.time % 10 !== 0) return;
        
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;
        
        const rcl = room.controller.level;
        
        // Αρχικοποίηση μνήμης
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = { construction: {} };
        }
        if (!Memory.rooms[roomName].construction) {
            Memory.rooms[roomName].construction = {};
        }
        
        // Δημιουργία/ενημέρωση blueprint
        this.updateBlueprint(room, rcl);
        
        // Κατασκευή από blueprint
        //this.buildFromBlueprint(room, rcl);
        
        // Συντήρηση
        this.maintainStructures(room);
    },
    
    updateBlueprint: function(room, rcl) {
        const constructionMemory = Memory.rooms[room.name].construction;
        
        // Δημιουργία blueprint μόνο την πρώτη φορά ή όταν αλλάζει το RCL
        if (!constructionMemory.blueprint || constructionMemory.lastRCL !== rcl) {
            constructionMemory.blueprint = this.generateBlueprint(room, rcl);
            constructionMemory.lastRCL = rcl;
            constructionMemory.builtStructures = constructionMemory.builtStructures || {};
        }
        
        // Ενημέρωση καταστασης χτισμένων δομών
        this.updateBuiltStructures(room);
    },
    
    generateBlueprint: function(room, rcl) {
    const blueprint = [];
    
    for (let level = 1; level <= rcl; level++) {
        const structures = this.getStructuresForRCL(room, level);
        blueprint.push(...structures);
    }
    
    // Ταξινόμηση κατά προτεραιότητα (αύξουσα - μικρότερη τιμή = υψηλότερη προτεραιότητα)
    blueprint.sort((a, b) => a.priority - b.priority);
    
    return blueprint;
},
findOptimalExtensionPositions: function(room, spawn, count) {
    const terrain = room.getTerrain();
    const positions = [];
    
    // Use BFS from spawn to find optimal positions
    const queue = [{
        x: spawn.pos.x, 
        y: spawn.pos.y, 
        distance: 0
    }];
    const visited = new Set();
    
    while (queue.length > 0 && positions.length < count) {
        const current = queue.shift();
        const posKey = `${current.x},${current.y}`;
        
        if (visited.has(posKey)) continue;
        visited.add(posKey);
        
        // Check if position is valid for extension
        if (this.canBuildAt(room, current.x, current.y, STRUCTURE_EXTENSION) &&
            terrain.get(current.x, current.y) !== TERRAIN_MASK_WALL) {
            positions.push({
                x: current.x,
                y: current.y,
                distance: current.distance
            });
        }
        
        // Add adjacent positions
        const directions = [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];
        for (const [dx, dy] of directions) {
            const newX = current.x + dx;
            const newY = current.y + dy;
            const newKey = `${newX},${newY}`;
            
            if (!visited.has(newKey) && 
                newX >= 0 && newX < 50 && 
                newY >= 0 && newY < 50 &&
                terrain.get(newX, newY) !== TERRAIN_MASK_WALL) {
                queue.push({
                    x: newX,
                    y: newY,
                    distance: current.distance + 1
                });
            }
        }
    }
    
    return positions.sort((a, b) => a.distance - b.distance);
}
,
    
    getStructuresForRCL: function(room, rcl) {
        const structures = [];
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return structures;
        
        switch(rcl) {
            case 1:
                 structures.push(...this.getRoadsToSources(room, spawn));
                 structures.push(...this.getContainersAtSources(room));
                structures.push(...this.getContainerAtController(room));
                break;
            case 2:
                structures.push(...this.getExtensions(room, spawn, 5));
                structures.push(...this.getRoadNetwork(room, spawn));
                break;
            case 3:
                structures.push(...this.getExtensions(room, spawn, 10));
                structures.push(...this.getTowers(room, spawn, 1));
                structures.push(...this.getRoadToController(room, spawn));
                break;
            case 4:
                structures.push(...this.getExtensions(room, spawn, 20));
                structures.push(...this.getStorage(room, spawn));
                structures.push(...this.getTowers(room, spawn, 1));
                break;
            case 5:
                structures.push(...this.getExtensions(room, spawn, 30));
                structures.push(...this.getLinks(room, spawn));
                structures.push(...this.getTowers(room, spawn, 2));
                structures.push(...this.getRoadToMineral(room, spawn));
                break;
            // ... προσθέστε περισσότερα levels ανάλογα με τις ανάγκες σας
        }
        
        return structures;
    },
    
    getRoadsToSources: function(room, spawn) {
    const structures = [];
    const sources = room.find(FIND_SOURCES);
    
    sources.forEach(source => {
        const path = spawn.pos.findPathTo(source.pos, {
            ignoreCreeps: true,
            swampCost: 1
        });
        
        path.forEach((step, index) => {
            structures.push({
                type: STRUCTURE_ROAD,
                x: step.x,
                y: step.y,
                priority: 30 + index, // Προηγουμένως: 100 - index
                rcl: 1
            });
        });
    });
    
    return structures;
},
    getContainerAtController: function(room) {
    const structures = [];
    const controller = room.controller;
    
    if (controller) {
        const positions = this.findContainerPositionsNear(room, controller.pos, 2);
        if (positions.length > 0) {
            structures.push({
                type: STRUCTURE_CONTAINER,
                x: positions[0].x,
                y: positions[0].y,
                priority: 15, // Υψηλότερη προτεραιότητα από τα containers στις πηγές
                rcl: 1
            });
        }
    }
    
    return structures;
},
   getContainersAtSources: function(room) {
    const structures = [];
    const sources = room.find(FIND_SOURCES);
    
    sources.forEach(source => {
        const positions = this.findContainerPositionsNear(room, source.pos, 1);
        if (positions.length > 0) {
            structures.push({
                type: STRUCTURE_CONTAINER,
                x: positions[0].x,
                y: positions[0].y,
                priority: 20, // Χαμηλότερη τιμή = υψηλότερη προτεραιότητα
                rcl: 1
            });
        }
    });
    
    return structures;
},
    
    getExtensions: function(room, spawn, count) {
    const structures = [];
    const positions = this.findExtensionPositions(room, spawn, count);
    
    positions.forEach((pos, index) => {
        structures.push({
            type: STRUCTURE_EXTENSION,
            x: pos.x,
            y: pos.y,
            priority: 10 + index, // Προηγουμένως: 300 - index
            rcl: 2
        });
    });
    
    return structures;
},
    
   getTowers: function(room, spawn, count) {
    const structures = [];
    const positions = this.findTowerPositions(room, spawn, count);
    
    positions.forEach(pos => {
        structures.push({
            type: STRUCTURE_TOWER,
            x: pos.x,
            y: pos.y,
            priority: 25, // Προηγουμένως: 85
            rcl: 3
        });
    });
    
    return structures;
},
    
   getRoadNetwork: function(room, spawn) {
    const structures = [];
    const controller = room.controller;
    const sources = room.find(FIND_SOURCES);
    
    if (controller) {
        const path = spawn.pos.findPathTo(controller.pos, {
            ignoreCreeps: true,
            swampCost: 1
        });
        
        path.forEach((step, index) => {
            structures.push({
                type: STRUCTURE_ROAD,
                x: step.x,
                y: step.y,
                priority: 35 + index, // Προηγουμένως: 70 - index
                rcl: 2
            });
        });
    }
    
    return structures;
},
    
    getRoadToController: function(room, spawn) {
    const structures = [];
    const controller = room.controller;
    
    if (controller) {
        const path = spawn.pos.findPathTo(controller.pos, {
            ignoreCreeps: true,
            swampCost: 1
        });
        
        path.forEach((step, index) => {
            structures.push({
                type: STRUCTURE_ROAD,
                x: step.x,
                y: step.y,
                priority: 40 + index, // Προηγουμένως: 75 - index
                rcl: 3
            });
        });
    }
    
    return structures;
},
    
    getStorage: function(room, spawn) {
    const structures = [];
    const positions = this.findStoragePosition(room, spawn);
    
    if (positions.length > 0) {
        structures.push({
            type: STRUCTURE_STORAGE,
            x: positions[0].x,
            y: positions[0].y,
            priority: 5, // Προηγουμένως: 95
            rcl: 4
        });
    }
    
    return structures;
},
    
   getLinks: function(room, spawn) {
    const structures = [];
    const sources = room.find(FIND_SOURCES);
    
    sources.forEach(source => {
        const positions = this.findLinkPositions(room, source.pos, 2);
        if (positions.length > 0) {
            structures.push({
                type: STRUCTURE_LINK,
                x: positions[0].x,
                y: positions[0].y,
                priority: 45, // Προηγουμένως: 60
                rcl: 5
            });
        }
    });
    
    return structures;
},
    
getRoadToMineral: function(room, spawn) {
    const structures = [];
    const mineral = room.find(FIND_MINERALS)[0];
    
    if (mineral) {
        const path = spawn.pos.findPathTo(mineral.pos, {
            ignoreCreeps: true,
            swampCost: 1
        });
        
        path.forEach((step, index) => {
            structures.push({
                type: STRUCTURE_ROAD,
                x: step.x,
                y: step.y,
                priority: 50 + index, // Προηγουμένως: 50 - index
                rcl: 5
            });
        });
    }
    
    return structures;
},
    
    buildFromBlueprint: function(room, rcl) {
        const constructionMemory = Memory.rooms[room.name].construction;
        const blueprint = constructionMemory.blueprint || [];
        const builtStructures = constructionMemory.builtStructures || {};
        
        // Υπολογισμός τρεχόντων construction sites
        const currentSites = room.find(FIND_CONSTRUCTION_SITES);
        
        if (currentSites.length >= this.constructionSitesMax) {
            
            return; // Έχουμε φτάσει το όριο
        }
        
        // Φιλτράρισμα blueprint: μόνο για τρέχον RCL, μη χτισμένα, και χωρίς construction site
        const availableStructures = blueprint.filter(structure => {
            if (structure.rcl > rcl) return false; // Μόνο για τρέχον ή προηγούμενα RCL
            
            const posKey = `${structure.x},${structure.y}`;
            if (builtStructures[posKey] === structure.type) return false; // Ήδη χτισμένο
            
            // Έλεγχος αν υπάρχει ήδη construction site σε αυτή τη θέση
            const existingSite = currentSites.find(site => 
                site.pos.x === structure.x && site.pos.y === structure.y
            );
            return !existingSite;
        });
        console.log("CurrentSite : " +currentSites.length+"|"+this.constructionSitesMax);
        // Κατασκευή δομών μέχρι να φτάσουμε το όριο
        for (let i = 0; i < availableStructures.length && currentSites.length + i < this.constructionSitesMax; i++) {
            const structure = availableStructures[i];
                
            if (this.canBuildAt(room, structure.x, structure.y, structure.type)) {
                const result = room.createConstructionSite(structure.x, structure.y, structure.type);
                if (result === OK) {
                    console.log(`Construction started: ${structure.type} at (${structure.x},${structure.y}) in ${room.name}`);
                }
            }
        }
    },
    
    // Αντικατάσταση της μεθόδου updateBuiltStructures
updateBuiltStructures: function(room) {
    const constructionMemory = Memory.rooms[room.name].construction;
    if (!constructionMemory.builtStructures) {
        constructionMemory.builtStructures = {};
    }
    
    const builtStructures = constructionMemory.builtStructures;
    const allStructures = room.find(FIND_STRUCTURES);
    
    // Ενημέρωση καταστάσεων
    allStructures.forEach(structure => {
        const posKey = `${structure.pos.x},${structure.pos.y}`;
        builtStructures[posKey] = structure.structureType;
        
        // Ειδική μεταχείριση για container στο controller
        if (structure.structureType === STRUCTURE_CONTAINER) {
            const controller = room.controller;
            if (controller && structure.pos.getRangeTo(controller.pos) <= 3) {
                // Αποθήκευση ID του container στο controller στη μνήμη ΜΟΝΟ αν έχει αλλάξει
                const currentContainerId = Memory.rooms[room.name].controllerContainerId;
                if (currentContainerId !== structure.id) {
                    Memory.rooms[room.name].controllerContainerId = structure.id;
                    console.log(`Controller container ID stored: ${structure.id} in room ${room.name}`);
                }
            }
        }
    });
    
    // Καθαρισμός positions που δεν υπάρχουν πλέον
    Object.keys(builtStructures).forEach(posKey => {
        const [x, y] = posKey.split(',').map(Number);
        const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, x, y);
        const hasStructure = structuresAtPos.some(s => s.structureType === builtStructures[posKey]);
        
        if (!hasStructure) {
            // Εάν διαγραφεί το container του controller, καθαρίζουμε και τη μνήμη
            if (builtStructures[posKey] === STRUCTURE_CONTAINER) {
                const controller = room.controller;
                if (controller) {
                    const pos = new RoomPosition(x, y, room.name);
                    if (pos.getRangeTo(controller.pos) <= 2) {
                        if (Memory.rooms[room.name].controllerContainerId) {
                            console.log(`Controller container destroyed: ${Memory.rooms[room.name].controllerContainerId} in room ${room.name}`);
                            delete Memory.rooms[room.name].controllerContainerId;
                        }
                    }
                }
            }
            delete builtStructures[posKey];
        }
    });
},
    
    // Βοηθητικές μέθοδοι για εύρεση θέσεων
    findContainerPositionsNear: function(room, centerPos, radius) {
        const terrain = room.getTerrain();
        const positions = [];
        
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const x = centerPos.x + dx;
                const y = centerPos.y + dy;
                
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL && 
                    centerPos.getRangeTo(x, y) <= radius &&
                    this.canBuildAt(room, x, y, STRUCTURE_CONTAINER)) {
                    positions.push({x, y, range: centerPos.getRangeTo(x, y)});
                }
            }
        }
        
        return positions.sort((a, b) => a.range - b.range);
    },
    
    findExtensionPositions: function(room, spawn, count) {
        const positions = [];
        const terrain = room.getTerrain();
        
        // Αλγόριθμος για εύρεση θέσεων extensions σε κύκλους γύρω από spawn
        for (let distance = 2; distance <= 5 && positions.length < count; distance++) {
            for (let dx = -distance; dx <= distance && positions.length < count; dx++) {
                for (let dy = -distance; dy <= distance && positions.length < count; dy++) {
                    if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                        const x = spawn.pos.x + dx;
                        const y = spawn.pos.y + dy;
                        
                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL && 
                            this.canBuildAt(room, x, y, STRUCTURE_EXTENSION)) {
                            positions.push({x, y, range: spawn.pos.getRangeTo(x, y)});
                        }
                    }
                }
            }
        }
        
        return positions.sort((a, b) => a.range - b.range).slice(0, count);
    },
    
    findTowerPositions: function(room, spawn, count) {
        const positions = [];
        const terrain = room.getTerrain();
        
        // Εύρεση θέσεων με καλή ορατότητα κοντά στο spawn
        for (let distance = 3; distance <= 8 && positions.length < count; distance++) {
            for (let dx = -distance; dx <= distance && positions.length < count; dx++) {
                for (let dy = -distance; dy <= distance && positions.length < count; dy++) {
                    if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                        const x = spawn.pos.x + dx;
                        const y = spawn.pos.y + dy;
                        
                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL && 
                            this.canBuildAt(room, x, y, STRUCTURE_TOWER)) {
                            positions.push({x, y, range: spawn.pos.getRangeTo(x, y)});
                        }
                    }
                }
            }
        }
        
        return positions.sort((a, b) => a.range - b.range).slice(0, count);
    },
    
    findStoragePosition: function(room, spawn) {
        const terrain = room.getTerrain();
        
        // Απλή εύρεση θέσης storage κοντά στο spawn
        for (let distance = 2; distance <= 4; distance++) {
            for (let dx = -distance; dx <= distance; dx++) {
                for (let dy = -distance; dy <= distance; dy++) {
                    if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                        const x = spawn.pos.x + dx;
                        const y = spawn.pos.y + dy;
                        
                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL && 
                            this.canBuildAt(room, x, y, STRUCTURE_STORAGE)) {
                            return [{x, y}];
                        }
                    }
                }
            }
        }
        return [];
    },
    
    findLinkPositions: function(room, centerPos, radius) {
        return this.findContainerPositionsNear(room, centerPos, radius);
    },
    
    canBuildAt: function(room, x, y, structureType) {
        const terrain = room.getTerrain();
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        
        const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
        const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
        
        if (structures.length > 0 || constructionSites.length > 0) return false;
        
        const otherObjects = room.lookForAt(LOOK_SOURCES, x, y)
            .concat(room.lookForAt(LOOK_MINERALS, x, y));
            
        return otherObjects.length === 0;
    },
    
    maintainStructures: function(room) {
        // Ο κώδικας συντήρησης παραμένει ίδιος
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 && 
                        s.structureType !== STRUCTURE_WALL && 
                        s.structureType !== STRUCTURE_RAMPART
        });
        
        if (damagedStructures.length > 0) {
            Memory.rooms[room.name].needsRepair = true;
        } else {
            Memory.rooms[room.name].needsRepair = false;
        }
    },
// Debug functions
    debugBlueprint: function(roomName, rcl = null) {
        const room = Game.rooms[roomName];
        if (!room) {
            console.log(`Room ${roomName} not visible or accessible`);
            return;
        }
        
        if (!Memory.rooms[roomName] || !Memory.rooms[roomName].construction) {
            console.log(`No construction memory found for room ${roomName}`);
            return;
        }
        
        const constructionMemory = Memory.rooms[roomName].construction;
        const currentRCL = rcl || room.controller.level;
        
        console.log(`=== BLUEPRINT DEBUG - Room: ${roomName} RCL: ${currentRCL} ===`);
        
        // Εμφάνιση συνοπτικής κατάστασης
        this.printBlueprintSummary(roomName, currentRCL);
        
        // Εμφάνιση λεπτομερούς λίστας
        this.printBlueprintDetails(roomName, currentRCL);
        
        // Οπτική αναπαράσταση στον χάρτη
        this.visualizeBlueprint(roomName, currentRCL);
        
        return constructionMemory.blueprint;
    },
    
    printBlueprintSummary: function(roomName, rcl) {
        const constructionMemory = Memory.rooms[roomName].construction;
        const blueprint = constructionMemory.blueprint || [];
        const builtStructures = constructionMemory.builtStructures || {};
        
        const structuresByType = {};
        const builtByType = {};
        const plannedByType = {};
        
        // Κατηγοριοποίηση δομών
        blueprint.forEach(structure => {
            if (structure.rcl <= rcl) {
                if (!structuresByType[structure.type]) {
                    structuresByType[structure.type] = 0;
                }
                structuresByType[structure.type]++;
                
                const posKey = `${structure.x},${structure.y}`;
                if (builtStructures[posKey] === structure.type) {
                    if (!builtByType[structure.type]) {
                        builtByType[structure.type] = 0;
                    }
                    builtByType[structure.type]++;
                } else {
                    if (!plannedByType[structure.type]) {
                        plannedByType[structure.type] = 0;
                    }
                    plannedByType[structure.type]++;
                }
            }
        });
        
        console.log('\n--- BLUEPRINT SUMMARY ---');
        console.log('Type\t| Total\t| Built\t| Planned');
        console.log('---------------------------');
        
        Object.keys(structuresByType).sort().forEach(type => {
            const total = structuresByType[type];
            const built = builtByType[type] || 0;
            const planned = plannedByType[type] || 0;
            console.log(`${type}\t| ${total}\t| ${built}\t| ${planned}`);
        });
        
        // Construction sites
        const room = Game.rooms[roomName];
        if (room) {
            const sites = room.find(FIND_CONSTRUCTION_SITES);
            console.log(`\nConstruction Sites: ${sites.length}/${this.constructionSitesMax}`);
            sites.forEach(site => {
                console.log(`  - ${site.structureType} at (${site.pos.x},${site.pos.y}) - ${site.progress}/${site.progressTotal}`);
            });
        }
    },
    
    printBlueprintDetails: function(roomName, rcl) {
        const constructionMemory = Memory.rooms[roomName].construction;
        const blueprint = constructionMemory.blueprint || [];
        const builtStructures = constructionMemory.builtStructures || {};
        
        console.log('\n--- BLUEPRINT DETAILS ---');
        console.log('Pos\t\t| Type\t\t| RCL\t| Prio\t| Status');
        console.log('---------------------------------------------');
        
        // Φιλτράρισμα και ταξινόμηση
        const filteredBlueprint = blueprint
            .filter(structure => structure.rcl <= rcl)
            .sort((a, b) => {
                // Ταξινόμηση κατά προτεραιότητα και RCL
                if (b.priority !== a.priority) return b.priority - a.priority;
                return a.rcl - b.rcl;
            });
        
        filteredBlueprint.forEach(structure => {
            const posKey = `${structure.x},${structure.y}`;
            const isBuilt = builtStructures[posKey] === structure.type;
            const status = isBuilt ? 'BUILT' : 'PLANNED';
            
            console.log(`(${structure.x},${structure.y})\t| ${structure.type}\t| ${structure.rcl}\t| ${structure.priority}\t| ${status}`);
        });
    },
    
    visualizeBlueprint: function(roomName, rcl) {
        const room = Game.rooms[roomName];
        if (!room) return;
        
        const constructionMemory = Memory.rooms[roomName].construction;
        if (!constructionMemory) {
            console.log("Cant find construtionMemory");
            return;
        }
        const blueprint = constructionMemory.blueprint || [];
        const builtStructures = constructionMemory.builtStructures || {};
        
        // Χρώματα για διαφορετικούς τύπους δομών
        const structureColors = {
            [STRUCTURE_ROAD]: '#ffffff',
            [STRUCTURE_EXTENSION]: '#00ff00',
            [STRUCTURE_TOWER]: '#ff0000',
            [STRUCTURE_CONTAINER]: '#ffff00',
            [STRUCTURE_STORAGE]: '#ffa500',
            [STRUCTURE_LINK]: '#00ffff',
            [STRUCTURE_SPAWN]: '#ff00ff',
            [STRUCTURE_TERMINAL]: '#800080',
            [STRUCTURE_LAB]: '#008080',
            [STRUCTURE_FACTORY]: '#808080'
        };
        if (!blueprint) {
            console.log("Cant find blueprint");
            return;
        }
        
        // Οπτική αναπαράσταση
        blueprint.forEach(structure => {
            if (structure.rcl > rcl) return;
            
            const pos = new RoomPosition(structure.x, structure.y, roomName);
            const posKey = `${structure.x},${structure.y}`;
            const isBuilt = builtStructures[posKey] === structure.type;
            
            const color = structureColors[structure.type] || '#cccccc';
            const opacity = isBuilt ? 0.3 : 0.7;
            const size = isBuilt ? 0.35 : 0.5;
            
            // Σχήμα ανά τύπο δομής
            switch(structure.type) {
                case STRUCTURE_ROAD:
                    room.visual.circle(pos, {fill: color, opacity: opacity, radius: 0.2});
                    break;
                case STRUCTURE_EXTENSION:
                    room.visual.circle(pos, {fill: color, opacity: opacity, radius: size});
                    break;
                case STRUCTURE_TOWER:
                    room.visual.rect(pos.x - 0.4, pos.y - 0.4, 0.8, 0.8, {fill: color, opacity: opacity});
                    break;
                case STRUCTURE_CONTAINER:
                    room.visual.poly([
                        {x: pos.x - 0.4, y: pos.y - 0.4},
                        {x: pos.x + 0.4, y: pos.y - 0.4},
                        {x: pos.x + 0.4, y: pos.y + 0.4},
                        {x: pos.x - 0.4, y: pos.y + 0.4}
                    ], {fill: color, opacity: opacity});
                    break;
                default:
                    room.visual.circle(pos, {fill: color, opacity: opacity, radius: size});
            }
            
            // Κείμενο με τον τύπο (συντμημένο)
            const typeAbbr = structure.type.replace('STRUCTURE_', '').substring(0, 3);
            room.visual.text(typeAbbr, pos, {
                color: isBuilt ? '#00ff00' : '#ffffff',
                font: 0.3,
                stroke: '#000000'
            });
            
            // Προτεραιότητα για μη χτισμένες δομές
            if (!isBuilt) {
                   room.visual.text(structure.priority.toString(), pos.x, pos.y + 0.4, {
                    color: '#ffff00',
                    font: 0.3,
                    stroke: '#000000'
                });
            }
        });
        
        // Legend
        this.drawBlueprintLegend(room);
        
        console.log(`Blueprint visualization rendered for room ${roomName}. Check your room visual.`);
    },
    
    drawBlueprintLegend: function(room) {
        const legendX = 1;
        let legendY = 1;
        
        const legendItems = [
            {color: '#ffffff', text: 'ROAD - Roads'},
            {color: '#00ff00', text: 'EXT - Extensions'},
            {color: '#ff0000', text: 'TWR - Towers'},
            {color: '#ffff00', text: 'CON - Containers'},
            {color: '#ffa500', text: 'STR - Storage'},
            {color: '#00ffff', text: 'LNK - Links'},
            {color: '#ff00ff', text: 'SPN - Spawns'}
        ];
        
        // Background για το legend
        room.visual.rect(legendX - 0.5, legendY - 0.5, 12, legendItems.length * 0.6 + 0.5, {
            fill: '#000000',
            opacity: 0.7
        });
        
        room.visual.text('BLUEPRINT LEGEND', legendX, legendY, {
            color: '#ffff00',
            font: 0.5,
            stroke: '#000000'
        });
        
        legendY += 0.8;
        
        legendItems.forEach(item => {
            room.visual.circle(legendX + 0.3, legendY, {
                fill: item.color,
                radius: 0.3,
                opacity: 0.7
            });
            
            room.visual.text(item.text, legendX + 1, legendY, {
                color: '#ffffff',
                font: 0.4,
                stroke: '#000000'
            });
            
            legendY += 0.6;
        });
    },
    
    // Συνάρτηση για να δημιουργήσει/ανανεώσει το blueprint χειροκίνητα
    forceUpdateBlueprint: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller) {
            console.log(`Cannot update blueprint: Room ${roomName} not found or not owned`);
            return false;
        }
        
        const rcl = room.controller.level;
        
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }
        if (!Memory.rooms[roomName].construction) {
            Memory.rooms[roomName].construction = {};
        }
        
        Memory.rooms[roomName].construction.blueprint = this.generateBlueprint(room, rcl);
        Memory.rooms[roomName].construction.lastRCL = rcl;
        
        console.log(`Blueprint force-updated for room ${roomName} at RCL ${rcl}`);
        return true;
    },
    
    // Συνάρτηση για εκκαθάριση blueprint (debug)
    clearBlueprint: function(roomName) {
        if (Memory.rooms[roomName] && Memory.rooms[roomName].construction) {
            delete Memory.rooms[roomName].construction.blueprint;
            delete Memory.rooms[roomName].construction.lastRCL;
            console.log(`Blueprint cleared for room ${roomName}`);
            return true;
        }
        return false;
    }
};


// Global functions για εύκολο debugging από την κονσόλα
global.debugBlueprint = function(roomName, rcl = null) {
    return constructionManager.debugBlueprint(roomName, rcl);
};

global.forceUpdateBlueprint = function(roomName) {
    return constructionManager.forceUpdateBlueprint(roomName);
};

global.clearBlueprint = function(roomName) {
    return constructionManager.clearBlueprint(roomName);
};

module.exports = constructionManager;
// manager.construction.js
const constructionManager = {
    run: function(roomName) {
        // Εκτέλεση κάθε 10 ticks για εξοικονόμηση CPU
        if (Game.time % 10 !== 0) return;
        
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;
        
        const rcl = room.controller.level;
        
        // Αρχικοποίηση μνήμης αν χρειαστεί
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }
        
        // Αυτόματη κατασκευή βασικών δομών
        this.buildBasicStructures(room, rcl);
        
        // Συντήρηση - επισκευή δομών
        this.maintainStructures(room);
    },
    
    buildBasicStructures: function(room, rcl) {
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        
        // Περιορισμός ταυτόχρονων construction sites
        if (constructionSites.length >= 5) return;
        
        // Κατασκευή ανά RCL level
        switch(rcl) {
            case 1:
                this.buildRCL1(room);
                break;
            case 2:
                this.buildRCL2(room);
                break;
            case 3:
                this.buildRCL3(room);
                break;
            // ... προσθέστε περισσότερα levels
        }
    },
    
    buildRCL1: function(room) {
        // Βασικές δομές για RCL 1 - κυρίως roads και containers
        this.buildRoadsToSources(room);
        this.buildContainersNearSources(room);
    },
    
    buildRCL2: function(room) {
        // Extensions και περισσότεροι δρόμοι
        this.buildExtensions(room, 5);
        this.buildRoadNetwork(room);
    },
    
    buildRCL3: function(room) {
        // Tower και extensions
        this.buildTower(room);
        this.buildExtensions(room, 10);
    },
    
    buildRoadsToSources: function(room) {
        const sources = room.find(FIND_SOURCES);
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        
        if (!spawn) return;
        
        sources.forEach(source => {
            // Δημιουργία δρόμου από spawn προς πηγή
            const path = spawn.pos.findPathTo(source.pos, {
                ignoreCreeps: true,
                costCallback: (roomName, costMatrix) => {
                    // Αποφυγή κατασκευών
                    room.find(FIND_STRUCTURES).forEach(struct => {
                        if (struct.structureType !== STRUCTURE_ROAD && 
                            struct.structureType !== STRUCTURE_CONTAINER) {
                            costMatrix.set(struct.pos.x, struct.pos.y, 255);
                        }
                    });
                    return costMatrix;
                }
            });
            
            // Δημιουργία construction sites για δρόμους (κάθε 2ο tile)
            for (let i = 0; i < path.length; i += 2) {
                const pos = path[i];
                if (this.canBuildAt(room, pos.x, pos.y, STRUCTURE_ROAD)) {
                    room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                    break; // Ένα site τη φορά
                }
            }
        });
    },
    
    buildContainersNearSources: function(room) {
        const sources = room.find(FIND_SOURCES);
        
        sources.forEach(source => {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            if (containers.length === 0) {
                // Βρες την καλύτερη θέση για container δίπλα στη πηγή
                const terrain = room.getTerrain();
                const positions = [];
                
                for (let dx = -2; dx <= 2; dx++) {
                    for (let dy = -2; dy <= 2; dy++) {
                        const x = source.pos.x + dx;
                        const y = source.pos.y + dy;
                        
                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL && 
                            source.pos.getRangeTo(x, y) <= 2 &&
                            this.canBuildAt(room, x, y, STRUCTURE_CONTAINER)) {
                            positions.push({x, y, range: source.pos.getRangeTo(x, y)});
                        }
                    }
                }
                
                // Επέλεξε την πλησιέστερη θέση
                positions.sort((a, b) => a.range - b.range);
                if (positions.length > 0) {
                    const bestPos = positions[0];
                    room.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_CONTAINER);
                }
            }
        });
    },
    
    buildExtensions: function(room, count) {
        const existingExtensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        const totalExtensions = existingExtensions + extensionSites;
        
        if (totalExtensions < count) {
            this.createExtensionCluster(room, count - totalExtensions);
        }
    },
    
    createExtensionCluster: function(room, needed) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;
        
        // Απλός αλγόριθμος για δημιουργία extensions κοντά στο spawn
        for (let distance = 2; distance <= 5 && needed > 0; distance++) {
            for (let dx = -distance; dx <= distance && needed > 0; dx++) {
                for (let dy = -distance; dy <= distance && needed > 0; dy++) {
                    if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                        const x = spawn.pos.x + dx;
                        const y = spawn.pos.y + dy;
                        
                        if (this.canBuildAt(room, x, y, STRUCTURE_EXTENSION)) {
                            const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                            if (result === OK) {
                                needed--;
                            }
                        }
                    }
                }
            }
        }
    },
    
    buildTower: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;
        
        const towerSites = room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;
        
        if (towers + towerSites === 0) {
            // Βρες καλή θέση για tower (κοντά στο spawn με καλή ορατότητα)
            const spawn = room.find(FIND_MY_SPAWNS)[0];
            if (spawn) {
                for (let distance = 3; distance <= 8; distance++) {
                    for (let dx = -distance; dx <= distance; dx++) {
                        for (let dy = -distance; dy <= distance; dy++) {
                            if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                                const x = spawn.pos.x + dx;
                                const y = spawn.pos.y + dy;
                                
                                if (this.canBuildAt(room, x, y, STRUCTURE_TOWER)) {
                                    const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
                                    if (result === OK) return;
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    
    canBuildAt: function(room, x, y, structureType) {
        // Έλεγχος αν μπορούμε να χτίσουμε σε αυτή τη θέση
        const terrain = room.getTerrain();
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        
        const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
        const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
        
        // Ελέγχουμε αν υπάρχει ήδη δομή ή construction site
        if (structures.length > 0 || constructionSites.length > 0) return false;
        
        // Ελέγχουμε για sources, minerals, κλπ.
        const otherObjects = room.lookForAt(LOOK_SOURCES, x, y)
            .concat(room.lookForAt(LOOK_MINERALS, x, y))
            .concat(room.lookForAt(LOOK_TERRAIN, x, y));
            
        return otherObjects.every(obj => {
            if (obj instanceof Source || obj instanceof Mineral) return false;
            if (obj === TERRAIN_MASK_WALL) return false;
            return true;
        });
    },
    
    maintainStructures: function(room) {
        // Απλή λογική συντήρησης - μπορεί να επεκταθεί
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.8 && 
                        s.structureType !== STRUCTURE_WALL && 
                        s.structureType !== STRUCTURE_RAMPART
        });
        
        // Θα μπορούσατε να ορίσετε builders για επισκευή
        if (damagedStructures.length > 0) {
            Memory.rooms[room.name].needsRepair = true;
        } else {
            Memory.rooms[room.name].needsRepair = false;
        }
    },
    
    buildRoadNetwork: function(room) {
        // Βασικό road network - συνδέει spawn, sources, controller
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);
        
        if (!spawn) return;
        
        // Δρόμος προς controller
        if (controller) {
            this.buildRoadBetween(spawn.pos, controller.pos, room);
        }
        
        // Δρόμοι προς sources
        sources.forEach(source => {
            this.buildRoadBetween(spawn.pos, source.pos, room);
        });
    },
    
    buildRoadBetween: function(pos1, pos2, room) {
        const path = pos1.findPathTo(pos2, {
            ignoreCreeps: true,
            swampCost: 1
        });
        
        // Δημιουργία roads (κάθε 3ο tile για εξοικονόμηση CPU)
        for (let i = 0; i < path.length; i += 3) {
            const pos = path[i];
            if (this.canBuildAt(room, pos.x, pos.y, STRUCTURE_ROAD)) {
                room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
            }
        }
    }
};

module.exports = constructionManager;
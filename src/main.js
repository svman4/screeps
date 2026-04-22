/*
main.js
 Version 1.1.1
 TODO Μέχρι να φτιαχτεί το storage όλα τα container Που δεν είναι σε source να γίνονται storageContainer. ΘΑ λειτουργεί σαν το storage.
 TODO εφόσον υπάρχει έστω 1 storageContainer να φτιάχνονται static harvester, haulers, σαν να υπάρχει storage δλδ. Μόλις χτιστέι αληθινό storage τότε να γίνεται διάσπαση σε controllerContainer και recoveryContainer
 TODO παρατηρείται ότι τα creep φτιάχνονται πάντα από ένα room ενώ το δωμάτιο που χρειάζεται το creep έχει την ενέργεια που απαιτείται.
 
 TODO οι static Harverster αν γίνεται να ενημερώνουν για δημιουργία νέου staticHarvester για τη συγκεκκριμένη πηγή αλλά αυτοί να συνεχίζουν.
 TODO να βρεθεί τρόπος να ακυρώσουμε το τρόπο εισαγωγής των blueprint να μη χρειάζεται να κάνουμε global μεταβλητές.
 
 */
var spawnManager = require('manager.spawn');
var defenceManager = require('manager.defense');
var constructionManager = require('manager.construction');
var expansionManager = require('manager.expansion');
var logisticsManager = require('manager.logistics');
const militaryController = require('manager.military');
var roleManager = require('manager.role');
var market=require('manager.market');
var pixels=require('manager.pixels');
 global.RoomInfo = function() {
    let answer = "\n--- 🏰 Controller Progress Report ---\n";
    
    // Φιλτράρουμε τα δωμάτια που μας ανήκουν και έχουμε ορατότητα
    const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
    
    if (myRooms.length === 0) return "No rooms with active visibility found.";

    for (const room of myRooms) {
        const controller = room.controller;
        
        // Αν είναι Level 8, δεν υπάρχει πρόοδος προς το επόμενο level
        if (controller.level === 8) {
            answer += `Room ${room.name}: [Lvl ${controller.level}] - Max Level ✨\n`;
            continue;
        }

        const remaining = controller.progressTotal - controller.progress;
        const progressPercent = (controller.progress / controller.progressTotal) * 100;
        
        // Μορφοποίηση χιλιάδων
        const formattedRemaining = remaining.toLocaleString('el-GR');
        
        
        answer += `Room ${room.name}: [Lvl ${controller.level}] -> ${formattedRemaining} left (${progressPercent.toFixed(2)}% done)\n`;
    }
    
    return answer;
};
global.roomBlueprints = {
   
    E14S12:require('E14S12'),
    E15S11:require('E15S11'),
    E15S12:require('E15S12'),
    
    

    
};
// Βοηθητική συνάρτηση για οπτική πληροφόρηση


module.exports.loop = function () {
     var startCpu = Game.cpu.getUsed();
    // Memory Cleanup
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
     try {
    // Αρχικοποίηση Memory
    if (!Memory.rooms) {
        Memory.rooms = {};
    }

    // Εκτέλεση ανά δωμάτιο
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
        //    console.log(`🏠 Επεξεργασία δωματίου: ${roomName} (RCL: ${room.controller.level})`);
            
            // HIGH PRIORITY - Πάντα τρέχουν
            militaryController.run(roomName);
            defenceManager.run(roomName);
            //spawnManager.run(roomName);
            logisticsManager.run(roomName);

            
            // MEDIUM PRIORITY - Τρέχουν πιο σπάνια
            constructionManager.run(roomName);

            market.run(roomName);
            
            
            
             //Οπτική πληροφόρηση
             if (Memory.debug.status  ) {
                 showRoomInfo(room);
             }
        }
    } 
    roleManager.run();	
    spawnManager.run();
    expansionManager.run();
    pixels.run();
    if (Game.time % 10 === 0) {
        var endCpu = Game.cpu.getUsed();
        var cpuUsed = (endCpu - startCpu).toFixed(3);
        if(cpuUsed>10) {
            console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length} | cpusUser: ${cpuUsed} | ${Game.time}`);
        }
    }
     } catch (error) {
        console.log(`🔴 ΣΦΑΛΜΑ: ${error.message}`);
        console.log(`📋 Stack: ${error.stack}`);
    }
};
function showRoomInfo(room) {
    const visual = new RoomVisual(room.name);
    const creeps = room.find(FIND_MY_CREEPS);
    
    // Πληροφορίες πληθυσμού
    const roles = {};
    creeps.forEach(creep => {
        const role = creep.memory.role || 'unknown';
        roles[role] = (roles[role] || 0) + 1;
    });
    
    let infoText = `Pop: ${creeps.length}`;
    for (const role in roles) {
        infoText += ` ${role}:${roles[role]}`;
    }
    
    // Πληροφορίες ενέργειας
    const energyInfo = `Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`;
    
    visual.text(infoText, 1, 1, { align: 'left', color: '#ffffff' });
    visual.text(energyInfo, 1, 2, { align: 'left', color: '#ffff00' });
    
    // Πληροφορίες controller
    if (room.controller) {
        const controllerInfo = `RCL: ${room.controller.level} Progress: ${room.controller.progress}/${room.controller.progressTotal}`;
        visual.text(controllerInfo, 1, 3, { align: 'left', color: '#00ff00' });
    }
    const constructionText=`construction sites :${room.find(FIND_CONSTRUCTION_SITES).length}`;
    visual.text(constructionText,1,4,{ align: 'left', color: '#ffffff' });
    // Πληροφορίες ουράς logistics (αν υπάρχουν)
    if (Memory.energyQueue && Memory.energyQueue[room.name]) {
        logisticsManager.showQueueInfo(room);
    }
}; // end of showRoomInfo(room)
/**
 * Screeps Room Data Exporter
 * * Χρήση στην κονσόλα: exportRoom('E12S28')
 */

global.exportRoom = function(roomName) {
    const room = Game.rooms[roomName];
    if (!room) {
        return "Error: Δεν έχω visibility στο δωμάτιο " + roomName;
    }

    // 1. Βασικές πληροφορίες
    const output = {
        name: room.name,
        shard: Game.shard.name,
        rcl: room.controller ? room.controller.level : 0,
        buildings: {},
        controller: room.controller ? { x: room.controller.pos.x, y: room.controller.pos.y } : null,
        terrain: {
            wall: [],
            swamp: []
        },
        sources: [],
        mineral: null
    };

    // 2. Επεξεργασία Terrain (Σάρωση όλου του grid 50x50)
    const terrain = room.getTerrain();
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const t = terrain.get(x, y);
            if (t === TERRAIN_MASK_WALL) {
                output.terrain.wall.push({ x, y });
            } else if (t === TERRAIN_MASK_SWAMP) {
                output.terrain.swamp.push({ x, y });
            }
        }
    }

    // 3. Επεξεργασία Κτιρίων (Structures)
    // Ομαδοποίηση ανά τύπο κτιρίου
    const structures = room.find(FIND_STRUCTURES);
    structures.forEach(s => {
        if (s.structureType === STRUCTURE_CONTROLLER) return; // Το έχουμε ήδη σε ξεχωριστό field
        
        if (!output.buildings[s.structureType]) {
            output.buildings[s.structureType] = [];
        }
        output.buildings[s.structureType].push({ x: s.pos.x, y: s.pos.y });
    });

    // 4. Sources
    const sources = room.find(FIND_SOURCES);
    sources.forEach(s => {
        output.sources.push({ x: s.pos.x, y: s.pos.y });
    });

    // 5. Mineral
    const minerals = room.find(FIND_MINERALS);
    if (minerals.length > 0) {
        output.mineral = {
            x: minerals[0].pos.x,
            y: minerals[0].pos.y,
            mineralType: minerals[0].mineralType
        };
    }

    // Επιστροφή σε μορφή string για εύκολο copy από το log
    console.log("--- ROOM EXPORT DATA: " + roomName + " ---");
    console.log(JSON.stringify(output));
    return "Done! Ελέγξτε το console log για το JSON.";
};
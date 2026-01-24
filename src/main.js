// main.js
// Version 1.2.2
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
    E11N38: require('E11N38'),
    E12N38: require('E12N38')

    
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
            spawnManager.run(roomName);
            logisticsManager.run(roomName);
            roleManager.run(roomName);
            
            // MEDIUM PRIORITY - Τρέχουν πιο σπάνια
            constructionManager.run(roomName);

            market.run(roomName);
            
            
            
             //Οπτική πληροφόρηση
             if (Memory.debug.status  ) {
                 showRoomInfo(room);
             }
        }
    }
    
    expansionManager.run();
    pixels.run();
    if (Game.time % 10 === 0) {
        var endCpu = Game.cpu.getUsed();
        var cpuUsed = (endCpu - startCpu).toFixed(3);
    
        console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length} | cpusUser: ${cpuUsed} | ${Game.time}`);
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

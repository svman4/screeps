// main.js
var spawnManager = require('manager.spawn');
var defenceManager = require('manager.defense');
var constructionManager = require('manager.construction');
var expansionManager = require('manager.expansion');
var logisticsManager = require('manager.logistics');
var roleManager = require('manager.role');
const debug=false;
// Βοηθητική συνάρτηση για οπτική πληροφόρηση
function showRoomInfo(room) {
    if (!debug) {
        return;
    }
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
}

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
            defenceManager.run(roomName,debug);
            spawnManager.run(roomName,debug);
            logisticsManager.run(roomName,debug);
            roleManager.run(roomName, debug);
            
            // MEDIUM PRIORITY - Τρέχουν πιο σπάνια
            //if (Game.time % 20 === 0) {
                constructionManager.run(roomName,debug);
            //}
            
            // LOW PRIORITY - Μόνο με υψηλό CPU
            if (Game.cpu.bucket > 5000 && Game.time % 100 === 0) {
                expansionManager.run();
            }
            
             //Οπτική πληροφόρηση
             if (debug===true && Game.time % 5 === 0 ) {
                 showRoomInfo(room);
             }
        }
    }
    if (Game.time % 10 === 0) {
        var endCpu = Game.cpu.getUsed();
    var cpuUsed = endCpu - startCpu;
    
        console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length} |cpusUser: ${cpuUsed}`);
    }
     } catch (error) {
        console.log(`🔴 ΣΦΑΛΜΑ: ${error.message}`);
        console.log(`📋 Stack: ${error.stack}`);
    }
};
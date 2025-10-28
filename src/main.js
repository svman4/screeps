var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var respawManager=require('respawController');
var towerMonitor=require('towerController');
var roomPlanner=require('RoomPlanner');

module.exports.loop = function () {
    

    // 1. Έλεγχος και αρχικοποίηση Memory.rooms (αν λείπει)
    if (!Memory.rooms) {
        Memory.rooms = {};
        console.log("Memory.rooms αρχικοποιήθηκε.");
    }
    
    // 2. Επανάληψη σε όλα τα Δωμάτια που ελέγχουμε
    for (const roomName in Game.rooms) {
        // Εδώ το roomName θα είναι 'E25S7' (και όποιο άλλο δωμάτιο ελέγχετε)
        
        // Αρχικοποίηση Memory για το συγκεκριμένο δωμάτιο (Αν δεν γίνει ήδη στον Planner)
        if (!Memory.rooms[roomName]) {
             Memory.rooms[roomName] = {};
        }

        // 3. Εκτέλεση Λογικής Δωματίου
        towerMonitor.run(roomName);
        
        roomPlanner.run(roomName);
    }
    
    // 4. Εκτέλεση Respawn (Συνήθως εκτός βρόχου δωματίων)
    respawManager.run();
    
    // 5. Εκτέλεση Λογικής Creeps
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        } else if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        } else if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }

};
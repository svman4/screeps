var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var respawManager=require('respawController');
var towerMonitor=require('towerController');
var roomPlanner=require('RoomPlanner');
var staticHarvester=require("role.staticHarvester");
var staticBuilder=require("role.staticBuilder");
var staticUpgrader=require("role.staticUpgrader");
var staticHauler=require("role.Hauler");
var LDHarvester=require("role.LDHarvester");
var roleClaimer=require("role.claimer");
var roleLDHauler=require("role.LDHauler");
module.exports.loop = function () {
    
        var startCpu = Game.cpu.getUsed();
    
    // 1. Έλεγχος και αρχικοποίηση Memory.rooms (αν λείπει)
    if (!Memory.rooms) {
        Memory.rooms = {};
        console.log("Memory.rooms αρχικοποιήθηκε.");
    }
    if (!Memory.rooms.E25S7.controllerLink) {
        // Τοποθετεί το link που βρίσκεται δίπλα στο controller
       Memory.rooms.E25S7.controllerLink="69050d532340f4c09a643cdd";
    }
    
    // 2. Επανάληψη σε όλα τα Δωμάτια που ελέγχουμε
    for (const roomName in Game.rooms) {
        // Εδώ το roomName θα είναι 'E25S7' (και όποιο άλλο δωμάτιο ελέγχετε)
        
        // Αρχικοποίηση Memory για το συγκεκριμένο δωμάτιο (Αν δεν γίνει ήδη στον Planner)
        if (!Memory.rooms[roomName]) {
             Memory.rooms[roomName] = {};
        }
        if(Game.rooms[roomName].controller.my) {
            // 3. Εκτέλεση Λογικής Δωματίου
            towerMonitor.run(roomName);
            roomPlanner.run(roomName);
            checkLink(roomName);    
            
            // 4. Εκτέλεση Respawn (Συνήθως εκτός βρόχου δωματίων)
            respawManager.run(roomName);
            
        } else {
            // Το δωμάτιο δεν είναι δικό μας.
            // θα πρέπει να γίνεται έλεγχος αν υπάρχει αντίπαλος.
            const maxRooms = Game.gcl.level;
            const ownedRooms = Object.keys(Game.rooms).filter(roomName => Game.rooms[roomName].controller && Game.rooms[roomName].controller.my).length;
            if (maxRooms>ownedRooms.length) { 
                
            } else {
                // δε μπορώ να Κάνω claim το δωμάτιο.
            }
                
        }
    }
    
    
    
    // 5. Εκτέλεση Λογικής Creeps
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        
        if(creep.memory.role == 'simpleHarvester') {
            roleHarvester.run(creep);
        } else if(creep.memory.role === 'upgrader') {
            roleUpgrader.run(creep);
        } else if(creep.memory.role === 'builder') {
            roleBuilder.run(creep);
        } else if( creep.memory.role==="staticHarvester") {
            staticHarvester.run(creep);
        } else if (creep.memory.role==="staticBuilder") {
            staticBuilder.run(creep);
        } else if (creep.memory.role==="staticUpgrader") {
            staticUpgrader.run(creep);
        } else if (creep.memory.role=== "staticHauler") {
            staticHauler.run(creep);
        }else if (creep.memory.role=== "LDHarvester") {
            LDHarvester.run(creep);
        }else if (creep.memory.role==="claimer") {
            roleClaimer.run(creep);
        } else if (creep.memory.role==="LDHauler") {
            roleLDHauler.run(creep);
        }
        
        
    }  
    
    if (Game.time % 10 === 0) {
        var endCpu = Game.cpu.getUsed();
    var cpuUsed = endCpu - startCpu;
    
        console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length} |cpusUser: ${cpuUsed}`);
    }

}; // end of loop()

checkLink=function(roomName) {
    
    const room=Game.rooms[roomName];
    
    const links=room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LINK }
        }
    );
    //var controllerLink = Game.getObjectById("69050d532340f4c09a643cdd");
    //console.log(Memory.rooms[roomName].controllerLink);
    var controllerLink=Game.getObjectById(Memory.rooms["E25S7"].controllerLink);
    if (!controllerLink) { 
        console.log("No controllerLinkFound)");
        return;
        
    }
    // Βρίσκουμε όλα τα άλλα Links (πιθανούς αποστολείς)
    const senderLinks = links.filter(link => link.id !== controllerLink.id);
    
    if (controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        return;
    }
    for (const sender of senderLinks) {
            // Έλεγχος Cooldown
            if (sender.cooldown > 0) {
                continue; // Πάμε στο επόμενο Link αν αυτό είναι σε cooldown
            }
            
            if (sender.store.getUsedCapacity(RESOURCE_ENERGY) > 550) {
                
                // 3. Εκτέλεση της Μεταφοράς
                const result = sender.transferEnergy(controllerLink);

                if (result === OK) {
                    console.log(`${roomName} - Link: Η μεταφορά ενέργειας από ${sender.id} προς Controller Link ήταν επιτυχής.`);
                    return; // Σταματάμε μόλις γίνει μία επιτυχής μεταφορά (για να σώσουμε CPU)
                } else if (result === ERR_NOT_IN_RANGE) {
                    // Αυτό δεν πρέπει να συμβεί αν όλα τα Links είναι στο ίδιο δωμάτιο
                    console.log("Link Error: Τα Links είναι πολύ μακριά! (Εκτός range)");
                }
            }
        }
};

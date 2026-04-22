/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * VERSION 1.0.0
 */
const { ROLES } = require('spawn.constants');

class PopulationManager {
    /**
     * Υπολογίζει τα όρια πληθυσμού για ένα συγκεκριμένο δωμάτιο.
     * @param {Room} room 
     */
    calculateLimits(room) {
        const sourceCount = room.find(FIND_SOURCES).length;
        const controllerLevel = room.controller.level;
        const storage = room.storage;
        //console.log("Check population limit for room "+room.name);
        // Αρχικοποίηση ορίων
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 1,
            [ROLES.STATIC_HARVESTER]: sourceCount,
            [ROLES.HAULER]: 1,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 1,
            isRecovery: false
        };

        // 1. ΕΛΕΓΧΟΣ RECOVERY (Is Economy Broken?)
        // Ελέγχουμε αν υπάρχουν harvesters και haulers στο δωμάτιο
        const roomCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        const hasHarvesters = _.some(roomCreeps, c => c.memory.role === ROLES.STATIC_HARVESTER || c.memory.role === ROLES.SIMPLE_HARVESTER);
        const hasHaulers = _.some(roomCreeps, c => c.memory.role === ROLES.HAULER);

        if (!hasHarvesters || !hasHaulers) {
            console.log("Emergency population initialization");
            limits.isRecovery = true;
            limits[ROLES.SIMPLE_HARVESTER] = Math.ceil(sourceCount * 1.5);
            limits[ROLES.HAULER] = 0;
            limits[ROLES.UPGRADER] = 0;
            limits[ROLES.BUILDER] = 1;
            return limits;
        }
        const storageContainerCount=room.memory.storageContainer?room.memory.storageContainer.length:0;
        //console.log(storageContainerCount)
        // 2. ΚΑΝΟΝΙΚΗ ΣΤΡΑΤΗΓΙΚΗ ΑΝΑ RCL
        if (storage) {
           // console.log("population on Storage strategy");
            limits[ROLES.SIMPLE_HARVESTER] = 0;
            limits[ROLES.HAULER] = Math.ceil(sourceCount);
            
            if (controllerLevel === 8) {
                limits[ROLES.UPGRADER] = 1;
                limits[ROLES.BUILDER] = 1;
            } else {
                limits[ROLES.UPGRADER] = (storage.store[RESOURCE_ENERGY] > 300000) ? 1 : 1;
                limits[ROLES.BUILDER] = (storage.store[RESOURCE_ENERGY] > 500000) ? sourceCount + 2 : sourceCount;
            }
        } else if (storageContainerCount>0) {
            
            // Αν υπάρχουν storageContainer
            console.log("population on StorageContainer strategy");
            limits[ROLES.SIMPLE_HARVESTER] = 0;
            limits[ROLES.HAULER] = Math.ceil(sourceCount +1);
            
            if (controllerLevel === 8) {
                limits[ROLES.UPGRADER] = 1;
                limits[ROLES.BUILDER] = 1;
            } else {
                limits[ROLES.UPGRADER] = sourceCount;
                limits[ROLES.BUILDER] = sourceCount+2;
                
            }
        }else {
            // Early Game (No storage)
            limits[ROLES.UPGRADER] =  1;
            limits[ROLES.BUILDER] =  1;
            limits[ROLES.SIMPLE_HARVESTER] = sourceCount+1;
            limits[ROLES.HAULER] = 0;
        }

        return limits;
    }

    /**
     * Ενημερώνει το Memory του δωματίου με τα νέα όρια.
     */
    updateRoomLimits(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;

        const newLimits = this.calculateLimits(room);
        
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        Memory.rooms[roomName].populationLimits = newLimits;
        Memory.rooms[roomName].isRecovery = newLimits.isRecovery;
    }
}

module.exports = new PopulationManager();
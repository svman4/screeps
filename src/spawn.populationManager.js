/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * VERSION 1.1.0
   1.1.0 Ακύρωση λειτουργίας storageContainer. 
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
			// TODO δε μου αρέσει ο τρόπος που μπαινει σε emergency. Στα πρώτα βήματα εννοείται πως δεν υπάρχουν haulers. 
            console.log("Emergency population initialization");
            limits.isRecovery = true;
            limits[ROLES.SIMPLE_HARVESTER] = Math.ceil(sourceCount * 1.0);
            limits[ROLES.HAULER] = 1;
            limits[ROLES.UPGRADER] = 1;
            limits[ROLES.BUILDER] = 1;
            return limits;
        }
        // 2. ΚΑΝΟΝΙΚΗ ΣΤΡΑΤΗΓΙΚΗ ΑΝΑ RCL
        if (storage) {
           
            limits[ROLES.SIMPLE_HARVESTER] = 0;
            limits[ROLES.HAULER] = Math.ceil(sourceCount);
            
            if (controllerLevel === 8) {
                limits[ROLES.UPGRADER] = 1;
                limits[ROLES.BUILDER] = 1;
            } else {
                limits[ROLES.UPGRADER] = 1;
                limits[ROLES.BUILDER] = (storage.store[RESOURCE_ENERGY] > 500000) ? sourceCount + 2 : sourceCount;
            }
        } else if (true) { 
			// Όταν έχει χτιστεί extension ή τουλάχιστον 1 container
			limits[ROLES.UPGRADER] =  1;
            limits[ROLES.BUILDER] =  1;
            limits[ROLES.SIMPLE_HARVESTER] = sourceCount;
            limits[ROLES.HAULER] = 1;
		} else {
            // Early Game (No storage)
            limits[ROLES.UPGRADER] =  1;
            limits[ROLES.BUILDER] =  0;
            limits[ROLES.SIMPLE_HARVESTER] = sourceCount+2;
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
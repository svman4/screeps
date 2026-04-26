/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * VERSION 1.4.0
 * - Refactored σε εξειδικευμένες μεθόδους για ευαναγνωσία.
 * - Ενσωμάτωση Builder-as-Upgrader στρατηγικής.
 * 1.2.0 Προσθήκη λειτουργία containers. 
 * - Αν υπάρχει έστω και ένα container τότε αλλάζει η διαχείριση του πληθυσμού.
 * 1.1.0 Ακύρωση λειτουργίας storageContainer. 
 */
const { ROLES } = require('spawn.constants');

class PopulationManager {
    /**
     * Κύρια μέθοδος υπολογισμού ορίων.
     */
    calculateLimits(room) {
        const context = this._getContext(room);

        // 1. Έλεγχος για Recovery Mode (Αν έχει "σπάσει" η οικονομία)
        if (this._isEmergency(room, context)) {
            return this._getRecoveryLimits(context);
        }

        // 2. Επιλογή στρατηγικής βάσει υποδομών
        if (context.storage) {
            return this._getStorageLimits(context);
        } else if (context.hasContainers) {
            return this._getContainerLimits(context);
        } else {
            return this._getEarlyGameLimits(context);
        }
    }

    /**
     * Συγκεντρώνει όλα τα απαραίτητα δεδομένα για τους υπολογισμούς.
     */
    _getContext(room) {
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        return {
            room: room,
            sources: room.find(FIND_SOURCES).length,
            level: room.controller.level,
            storage: room.storage,
            hasContainers: containers.length > 0,
            hasConstruction: room.find(FIND_CONSTRUCTION_SITES).length > 0
        };
    }

    /**
     * Ελέγχει αν το δωμάτιο βρίσκεται σε κατάσταση έκτακτης ανάγκης.
     */
    _isEmergency(room, context) {
        const roomCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        
        const hasHarvesters = _.some(roomCreeps, c => 
            (c.memory.role === ROLES.STATIC_HARVESTER || c.memory.role === ROLES.SIMPLE_HARVESTER) && 
            (c.ticksToLive > 40 || c.spawning)
        );

        // Αν έχουμε containers/storage, χρειαζόμαστε οπωσδήποτε haulers
        const needsHauler = context.hasContainers || context.storage;
        const hasHaulers = _.some(roomCreeps, c => c.memory.role === ROLES.HAULER);

        return !hasHarvesters || (needsHauler && !hasHaulers);
    }

    /**
     * Όρια για Recovery Mode.
     */
    _getRecoveryLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: context.sources ,
            [ROLES.STATIC_HARVESTER]: 0,
            [ROLES.HAULER]: context.hasContainers ? 1 : 0,
            [ROLES.UPGRADER]: 0,
            [ROLES.BUILDER]: 1, // Ένας builder για τυχόν repairs σε κρίσιμα σημεία
            isRecovery: true
        };
    }

    /**
     * Στρατηγική όταν υπάρχει Storage (Mid-Late Game).
     */
    _getStorageLimits(context) {
        const energy = context.storage.store[RESOURCE_ENERGY];
        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources,
            [ROLES.HAULER]: context.sources,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 1,
            isRecovery: false
        };

        // Αυξάνουμε τους Builders (που κάνουν και Upgrade) αν έχουμε πλεόνασμα ενέργειας
        if (context.level < 8) {
            if (energy > 200000) limits[ROLES.BUILDER] = 3;
            if (energy > 500000) limits[ROLES.BUILDER] = 5;
        }

        return limits;
    }

    /**
     * Στρατηγική όταν υπάρχουν Containers αλλά όχι Storage.
     */
    _getContainerLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources,
            [ROLES.HAULER]: context.sources + 1,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 3, // Αυξημένοι builders λόγω έλλειψης storage
            isRecovery: false
        };
    }

    /**
     * Στρατηγική για το ξεκίνημα του παιχνιδιού.
     */
    _getEarlyGameLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: context.sources * 2,
            [ROLES.STATIC_HARVESTER]: 0,
            [ROLES.HAULER]: 0,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 2,
            isRecovery: false
        };
    }

    /**
     * Ενημερώνει το Memory του δωματίου.
     */
    updateRoomLimits(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) return;

        const newLimits = this.calculateLimits(room);
        
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        Memory.rooms[roomName].populationLimits = newLimits;
        Memory.rooms[roomName].isRecovery = newLimits.isRecovery;
    } // end of updateRoomLimits
}

module.exports = new PopulationManager();
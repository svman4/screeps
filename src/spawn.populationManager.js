/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * VERSION 1.5.1
 * - Διόρθωση false-positive emergency: Το δωμάτιο δεν μπαίνει σε recovery αν υπάρχει αποθηκευμένη ενέργεια.
 */
const { ROLES } = require('spawn.constants');

class PopulationManager {
    /**
     * Κύρια μέθοδος υπολογισμού ορίων.
     */
    calculateLimits(room) {
        const context = this._getContext(room);

        // 1. Έλεγχος για Recovery Mode (Αν έχει "σπάσει" η πραγματική οικονομία)
        if (this._isEmergency(room, context)) {
            return this._getRecoveryLimits(context);
        }

        // 2. Επιλογή στρατηγικής βάσει υποδομών
        if (context.link_count > 1) { 
            return this._getLinkLimits(context);
        }
        if (context.storage) {
            return this._getStorageLimits(context);
        } else if (context.hasContainers) {
            return this._getContainerLimits(context);
        } else {
            return this._getEarlyGameLimits(context);
        }
    }

    /**
     * Στρατηγική όταν υπάρχει δίκτυο Links.
     */
    _getLinkLimits(context) {
        const energy = context.storage ? context.storage.store[RESOURCE_ENERGY] : 0;
        
        let haulerCount = 1;
        if (context.link_count < context.sources + 1) {
            haulerCount = 2;
        }

        let limits = {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources,
            [ROLES.HAULER]: haulerCount,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 1,
            isRecovery: false
        };

        if (context.level < 8) {
            if (energy > 150000) limits[ROLES.BUILDER] = 2;
            if (energy > 400000) limits[ROLES.BUILDER] = 4;
        } else {
            if (context.hasConstruction) { 
                limits[ROLES.BUILDER] = 2;
            }
        }

        return limits;
    }

    /**
     * Συγκεντρώνει όλα τα απαραίτητα δεδομένα για τους υπολογισμούς.
     */
    _getContext(room) {
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        const links = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        // Υπολογισμός συνολικής αποθηκευμένης ενέργειας σε containers/storage
        let storedEnergy = 0;
        if (room.storage) storedEnergy += room.storage.store[RESOURCE_ENERGY];
        containers.forEach(c => storedEnergy += c.store[RESOURCE_ENERGY]);

        return {
            room: room,
            sources: room.find(FIND_SOURCES).length,
            level: room.controller.level,
            storage: room.storage,
            link_count: links.length,
            hasContainers: containers.length > 0,
            hasConstruction: room.find(FIND_CONSTRUCTION_SITES).length > 0,
            storedEnergy: storedEnergy
        };
    }

    /**
     * Ελέγχει αν το δωμάτιο βρίσκεται σε κατάσταση έκτακτης ανάγκης.
     */
    _isEmergency(room, context) {
        const roomCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        
        // 1. Έλεγχος Harvesters: Αν δεν υπάρχει κανένας, είναι πάντα emergency.
        const hasHarvesters = _.some(roomCreeps, c => 
            (c.memory.role === ROLES.STATIC_HARVESTER || c.memory.role === ROLES.SIMPLE_HARVESTER) && 
            (c.ticksToLive > 40 || c.spawning)
        );
        if (!hasHarvesters) return true;

        // 2. Έλεγχος Haulers:
        const needsHauler = context.hasContainers || context.storage;
        const hasHaulers = _.some(roomCreeps, c => c.memory.role === ROLES.HAULER && (c.ticksToLive > 30 || c.spawning));

        if (needsHauler && !hasHaulers) {
            // Αν δεν έχουμε Haulers, αλλά το Storage/Containers έχουν ενέργεια, 
            // το Spawn μπορεί να βγάλει νέο Hauler μόνο του. ΔΕΝ είναι emergency.
            // Αν όμως η αποθηκευμένη ενέργεια είναι πολύ χαμηλή (π.χ. < 1000), τότε κινδυνεύουμε.
            if (context.storedEnergy < 1000) {
                return true;
            }
        }

        return false;
    }

    /**
     * Όρια για Recovery Mode.
     */
    _getRecoveryLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: context.sources,
            [ROLES.STATIC_HARVESTER]: 0,
            [ROLES.HAULER]: (context.hasContainers || context.storage) ? 1 : 0,
            [ROLES.UPGRADER]: 0,
            [ROLES.BUILDER]: 1,
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

        if (context.level < 8) {
            if (energy > 200000) limits[ROLES.BUILDER] = 3;
            if (energy > 500000) limits[ROLES.BUILDER] = 5;
        } else {
            if (context.hasConstruction) { 
                limits[ROLES.BUILDER] = 3;
            }
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
            [ROLES.HAULER]: context.sources,
            [ROLES.UPGRADER]: 1,
            [ROLES.BUILDER]: 3,
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
    }
}

module.exports = new PopulationManager();
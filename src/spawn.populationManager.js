/**
 * MODULE: Population Manager
 * ΠΕΡΙΓΡΑΦΗ: Διαχειρίζεται τα όρια πληθυσμού και την κατάσταση Recovery ανά δωμάτιο.
 * Version 1.5.0
 * - Δημιουργία Link. 
 * VERSION 1.4.0
 * - Refactored σε εξειδικευμένες μεθόδους για ευαναγνωσία.
 * - Ενσωμάτωση Builder-as-Upgrader στρατηγικής.
 * 1.2.0 Προσθήκη λειτουργία containers. 
 * - Αν υπάρχει έστω και ένα container τότε αλλάζει η διαχείριση του πληθυσμού.
 * 1.1.0 Ακύρωση λειτουργίας storageContainer. 
 * 
 * TODO ΝΑ υπολογίζει πόσα body parts χρειάζεται ανά ρόλο. Η Δημιουργία των creeps να εξαρτάται από τα body Parts και όχι από το πληθυσμό.
 * - Η manager.spawn θα πρέπει να αλλάξει ώστε να δημιουργεί creeps βάση των body parts.
 */
const { ROLES } = require('spawn.constants');
const CARRY_PART_CAPACITY=50;
const CARRY_PART_FOR_EXTENSIONS=10;
const ROOM_STATE={
	RESERVED:"reserved",
	NEURAL:"neural",
	CLAIM:"reserved"
};
const SOURCE_ENERGY_PER_TICK={
	ROOM_STATE.RESERVED:10,
	ROOM_STATE.NEURAL:5
};
class PopulationManager {
    /**
     * Κύρια μέθοδος υπολογισμού ορίων.
     */
    calculateLimits(room) {
        const context = this._getContext(room);
s
        // 1. Έλεγχος για Recovery Mode (Αν έχει "σπάσει" η οικονομία)
        if (this._isEmergency(room, context)) {
            return this._getRecoveryLimits(context);
        }

        // 2. Επιλογή στρατηγικής βάσει υποδομών
        if(context.LinkCount!==0) {
         return this._getLinkLimits(context);   
        }
        if (context.storage) {
            return this._getStorageLimits(context);
        } else if (context.hasContainers) {
            return this._getContainerLimits(context);
        } else {
            return this._getEarlyGameLimits(context);
        }
    } // end of calculateLimits(room)

    /**
     * Συγκεντρώνει όλα τα απαραίτητα δεδομένα για τους υπολογισμούς.
     */
    _getContext(room) {
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        const links=room.find(FIND_STRUCTURES,{
            filter: s => s.structureType === STRUCTURE_LINK
        });
        const carryParts=this._getCarryParts(room,links);
		const workParts=this._getWorksParts(room);
        return {
            room: room,
            sources: room.find(FIND_SOURCES).length,
            level: room.controller.level,
            storage: room.storage,
            hasContainers: containers.length > 0,
            LinkCount:links.length,
            hasConstruction: room.find(FIND_CONSTRUCTION_SITES).length > 0,
			carryParts:carryParts,
			workParts:workParts;
        };
    } // end of _getContext
	
	_getCarryParts(room,links) {
		// TODO να υπολογίζει πόσα carryParts χρειάζονται για το δωμάτιο room.
		const roomState=ROOM_STATE.CLAIM;
		let carryParts=CARRY_PART_FOR_EXTENSIONS;
		
		//Για κάθε πηγή source
		
		carryParts+=_getCarryPartsPerSource(roomState,source,storage);
		return carryParts;
	} // end of _getCarryParts
	_GetCarryPartsForSource(roomState,source,center) {
		const distance=10; // TODO Να υπολογίζει την απόσταση μεταξύ source-center
		return _getCarryParts(roomState,distance);
	} // end of _GetCarryPartsForSource
	_getCarryParts(roomState,Distance) {
		const EPT=SOURCE_ENERGY_PER_TICK.roomState;
		return EPT*Distance*2/CARRY_PART_CAPACITY;
	} // end of _getCarryPartsPerSource
	_getWorkParts(room) {
		// TODO να υπολογίζει πόσα workParts είναι βέλτιστα για το δωμάτιο room.
		return 16;
	}  // end of _getWorkParts
    /**
     * Ελέγχει αν το δωμάτιο βρίσκεται σε κατάσταση έκτακτης ανάγκης.
     */
    _isEmergency(room, context) {
		/*
			TODO όταν μπούμε σε στρατηγική link, έχουμε ένα hauler. Όταν πεθάνει το room μπαίνει σε emergency. ΑΠΑΙΤΕΙΤΑΙ ΕΛΕΓΧΟΣ
		*/
        const roomCreeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        
        const hasHarvesters = _.some(roomCreeps, c => 
            (c.memory.role === ROLES.STATIC_HARVESTER || c.memory.role === ROLES.SIMPLE_HARVESTER) && 
            (c.ticksToLive > 40 || c.spawning)
        );

        // Αν έχουμε containers/storage, χρειαζόμαστε οπωσδήποτε haulers
        const needsHauler = context.hasContainers || context.storage;
        const hasHaulers = _.some(roomCreeps, c => c.memory.role === ROLES.HAULER);

        return !hasHarvesters || (needsHauler && !hasHaulers);
    }// end of _isEmergency

	_getLinkLimits(context) {
       // console.log("population in linkLimits strategy");
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
            
        } else {
			if (context.hasConstruction) { 
				limits[ROLES.BUILDER] = 3;
			}
		}

        return limits;
    } // end of _getStorageLimits

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
        console.log("population in storage strategy");
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
            
        } else {
			if (context.hasConstruction) { 
				limits[ROLES.BUILDER] = 3;
			}
		}

        return limits;
    } // end of _getStorageLimits

    /**
     * Στρατηγική όταν υπάρχουν Containers αλλά όχι Storage.
     */
    _getContainerLimits(context) {
        return {
            [ROLES.SIMPLE_HARVESTER]: 0,
            [ROLES.STATIC_HARVESTER]: context.sources,
            [ROLES.HAULER]: context.sources ,
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
    } // end of _getEarlyGameLimits

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
var towerController = {
    /**
     * Η κύρια συνάρτηση ελέγχου των Towers σε ένα συγκεκριμένο δωμάτιο.
     * @param {string} roomName - Το όνομα του δωματίου που πρέπει να διαχειριστεί.
     */
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        if (towers.length === 0) return;

        // Cache για αποδοτικότητα - μία φορά αναζήτηση ανά tick
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const woundedCreeps = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.hits < creep.hitsMax
        });

        for (const tower of towers) {
            // Ελέγχουμε την ενέργεια πριν προχωρήσουμε
            if (tower.energy === 0) continue;

            // 1. ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Επίθεση σε εχθρούς
            if (hostiles.length > 0) {
                const target = this.findBestAttackTarget(tower, hostiles);
                if (target) {
                    tower.attack(target);
                    continue;
                }
            }

            // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Θεραπεία τραυματισμένων creeps
            if (woundedCreeps.length > 0) {
                const mostInjured = this.findMostInjuredCreep(woundedCreeps);
                if (mostInjured) {
                    tower.heal(mostInjured);
                    continue;
                }
            }

            // 3. Επισκευή δομών με έξυπνη προτεραιοποίηση
            const repairTarget = this.findBestRepairTarget(tower, room);
            if (repairTarget) {
                tower.repair(repairTarget);
            }
        }
    },

    /**
     * Βρίσκει τον καλύτερο στόχο για επίθεση
     */
    findBestAttackTarget: function(tower, hostiles) {
        // Προτεραιότητα σε επικίνδυνους εχθρούς (με attack parts)
        const dangerous = hostiles.filter(creep => 
            creep.getActiveBodyparts(ATTACK) > 0 || 
            creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
            creep.getActiveBodyparts(HEAL) > 0 ||
            creep.getActiveBodyparts(WORK) > 0
        );

        const targets = dangerous.length > 0 ? dangerous : hostiles;
        
        return tower.pos.findClosestByRange(targets);
    },

    /**
     * Βρίσκει το πιο τραυματισμένο creep
     */
    findMostInjuredCreep: function(woundedCreeps) {
        return woundedCreeps.reduce((mostInjured, creep) => {
            if (!mostInjured) return creep;
            const injuredPercent = (creep.hits / creep.hitsMax);
            const mostInjuredPercent = (mostInjured.hits / mostInjured.hitsMax);
            return injuredPercent < mostInjuredPercent ? creep : mostInjured;
        }, null);
    },

    /**
     * Βρίσκει τον καλύτερο στόχο για επισκευή
     */
    findBestRepairTarget: function(tower, room) {
        const structures = room.find(FIND_STRUCTURES, {
            filter: structure => {
                if (structure.hits >= structure.hitsMax) return false;
                
                // Προτεραιότητα σε κρίσιμες δομές
                const criticalTypes = [
                    STRUCTURE_SPAWN, 
                    STRUCTURE_EXTENSION, 
                    STRUCTURE_TOWER,
                    STRUCTURE_STORAGE,
                    STRUCTURE_TERMINAL
                ];
                
                if (criticalTypes.includes(structure.structureType)) {
                    return true;
                }

                // Προστατευμένες δομές (τείχη/ramparts) - επισκευή μόνο αν χρειάζεται
                if (structure.structureType === STRUCTURE_WALL || 
                    structure.structureType === STRUCTURE_RAMPART) {
                    return structure.hits < 10000; // Προσαρμόστε το όριο όπως θέλετε
                }

                // Άλλες δομές (roads, containers κλπ)
                return structure.hits < structure.hitsMax * 0.8;
            }
        });

        if (structures.length === 0) return null;

        // Ταξινόμηση βάσει προτεραιότητας
        structures.sort((a, b) => {
            const priorityA = this.getStructurePriority(a);
            const priorityB = this.getStructurePriority(b);
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }
            
            // Αν ίδια προτεραιότητα, επέλεξε το πιο κατεστραμμένο
            const damagePercentA = a.hits / a.hitsMax;
            const damagePercentB = b.hits / b.hitsMax;
            return damagePercentA - damagePercentB;
        });

        return structures[0];
    },

    /**
     * Επιστρέφει την προτεραιότητα μιας δομής (υψηλότερος αριθμός = υψηλότερη προτεραιότητα)
     */
    getStructurePriority: function(structure) {
        const priorities = {
            [STRUCTURE_SPAWN]: 100,
            [STRUCTURE_TOWER]: 90,
            [STRUCTURE_STORAGE]: 85,
            [STRUCTURE_TERMINAL]: 80,
            [STRUCTURE_EXTENSION]: 75,
            [STRUCTURE_LAB]: 70,
            [STRUCTURE_FACTORY]: 65,
            [STRUCTURE_POWER_SPAWN]: 60,
            [STRUCTURE_OBSERVER]: 55,
            [STRUCTURE_NUKER]: 50,
            [STRUCTURE_CONTAINER]: 40,
            [STRUCTURE_LINK]: 35,
            [STRUCTURE_ROAD]: 30,
            [STRUCTURE_RAMPART]: 20,
            [STRUCTURE_WALL]: 10
        };

        return priorities[structure.structureType] || 5;
    }
};

module.exports = towerController;
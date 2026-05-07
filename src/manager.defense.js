/**
 * @file manager.defense.js
 * @author svman4
 * @version 1.1.0
 * @description Διαχείριση αμυντικών συστημάτων (Towers) και επισκευών δομών.
 * Ενσωματώνει το Info system για αποδοτικότερη διαχείριση πόρων.
 * * @changelog
 * v1.0.0: Αρχική έκδοση.
 * v1.1.0: Υλοποίηση integration με το Info class και βελτιστοποίηση CPU.
 */

const { info, REPAIR_TOWER } = require("info.js");

var towerController = {

    /**
     * Η κύρια συνάρτηση ελέγχου των Towers σε ένα συγκεκριμένο δωμάτιο.
     * @param {string} roomName - Το όνομα του δωματίου που πρέπει να διαχειριστεί.
     */
    run: function (roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        // Ανανέωση ορίων τειχών κάθε 3000 ticks
        if (Game.time % 3000 === 0) {
            this.refreshWallThreshold(room);
        }

        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        if (towers.length === 0) return;

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const woundedCreeps = room.find(FIND_MY_CREEPS, {
            filter: creep => creep.hits < creep.hitsMax
        });

        let repairTowerCandidate = null;

        for (const tower of towers) {
            // Χρήση σύγχρονου API για energy
            if (tower.store[RESOURCE_ENERGY] === 0) continue;

            let isBusy = false;

            // 1. ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Επίθεση σε εχθρούς
            if (hostiles.length > 0) {
                const target = this.findBestAttackTarget(tower, hostiles, room);
                if (target) {
                    tower.attack(target);
                    isBusy = true;
                }
            }

            // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Θεραπεία τραυματισμένων creeps
            if (!isBusy && woundedCreeps.length > 0) {
                const mostInjured = this.findMostInjuredCreep(woundedCreeps);
                if (mostInjured) {
                    tower.heal(mostInjured);
                    isBusy = true;
                }
            }

            // Αν ο tower είναι διαθέσιμος, τον ορίζουμε ως υποψήφιο για επισκευές
            if (!isBusy && !repairTowerCandidate) {
                repairTowerCandidate = tower;
            }
        }

        // Αν βρέθηκε tower για επισκευές, τον καταχωρούμε στο info system
        if (repairTowerCandidate) {
            info.set(roomName, REPAIR_TOWER, repairTowerCandidate);
            this.repairStructures(roomName, hostiles);
        }
    },

    /**
     * Διαχειρίζεται τις επισκευές δομών μέσω του κεντρικού συστήματος Info.
     * @param {string} roomName 
     * @param {Array} hostiles 
     */
    repairStructures: function (roomName, hostiles) {
        const room = Game.rooms[roomName];
        const repairTower = info.get(roomName, REPAIR_TOWER);

        if (repairTower && this.shouldRepair(repairTower, hostiles)) {
            const repairTarget = this.findBestRepairTarget(repairTower, room);
            if (repairTarget) {
                repairTower.repair(repairTarget);
            }
        }
    },

    /**
     * Βρίσκει τον καλύτερο στόχο για επίθεση
     */
    findBestAttackTarget: function (tower, hostiles, room) {
        const dangerous = hostiles.filter(creep =>
            creep.getActiveBodyparts(ATTACK) > 0 ||
            creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
            creep.getActiveBodyparts(HEAL) > 0 ||
            creep.getActiveBodyparts(WORK) > 0
        );

        const targets = dangerous.length > 0 ? dangerous : hostiles;

        const criticalStructures = room.find(FIND_MY_STRUCTURES, {
            filter: s => [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL].includes(s.structureType)
        });

        const attackers = [];
        for (const hostile of targets) {
            for (const structure of criticalStructures) {
                if (hostile.pos.getRangeTo(structure) <= 5) {
                    attackers.push(hostile);
                    break;
                }
            }
        }

        if (attackers.length > 0) {
            return tower.pos.findClosestByRange(attackers);
        }

        return tower.pos.findClosestByRange(targets);
    },

    /**
     * Βρίσκει το πιο τραυματισμένο creep
     */
    findMostInjuredCreep: function (woundedCreeps) {
        return woundedCreeps.reduce((mostInjured, creep) => {
            if (!mostInjured) return creep;
            return (creep.hits / creep.hitsMax) < (mostInjured.hits / mostInjured.hitsMax) ? creep : mostInjured;
        }, null);
    },

    /**
     * Βρίσκει τον καλύτερο στόχο για επισκευή
     */
    findBestRepairTarget: function (tower, room) {
        const structures = room.find(FIND_STRUCTURES, {
            filter: structure => {
                if (structure.hits >= structure.hitsMax) return false;

                const criticalTypes = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL];
                if (criticalTypes.includes(structure.structureType)) return true;

                if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
                    const limit = this.calculateWallLimit(room);
                    return structure.hits < limit;
                }

                return structure.hits < structure.hitsMax * 0.8;
            }
        });

        if (structures.length === 0) return null;

        structures.sort((a, b) => {
            const priorityA = this.getStructurePriority(a);
            const priorityB = this.getStructurePriority(b);
            if (priorityA !== priorityB) return priorityB - priorityA;
            return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
        });

        return structures[0];
    },

    getStructurePriority: function (structure) {
        const priorities = {
            [STRUCTURE_SPAWN]: 100, [STRUCTURE_TOWER]: 90, [STRUCTURE_STORAGE]: 85,
            [STRUCTURE_TERMINAL]: 80, [STRUCTURE_EXTENSION]: 75, [STRUCTURE_RAMPART]: 20, [STRUCTURE_WALL]: 10
        };
        return priorities[structure.structureType] || 5;
    },

    refreshWallThreshold: function (room) {
        if (!room) return;
        const step = 1000;
        const walls = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });
        if (walls.length === 0) return;

        let hits_minimum_value = _.min(walls, 'hits').hits;
        hits_minimum_value = Math.max(room.controller.level * 10000, hits_minimum_value);
        hits_minimum_value = Math.floor(hits_minimum_value / step) * step + 1000;
        hits_minimum_value = Math.min(hits_minimum_value, 100000000);

        if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
        Memory.rooms[room.name].wallLimit = hits_minimum_value;
    },

    calculateWallLimit: function (room) {
        return (room.memory && room.memory.wallLimit) ? room.memory.wallLimit : 20000;
    },

    shouldRepair: function (tower, hostiles) {
        if (hostiles.length > 0) {
            return tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.7;
        }
        return tower.store[RESOURCE_ENERGY] > 0;
    }
};

module.exports = towerController;
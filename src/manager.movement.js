/*
 * File: manager.movement.js
 * Λειτουργία: Κεντρική διαχείριση κίνησης και Pathfinding (CostMatrix Cache).
 */

let matrixCache = {}; 
let lastMatrixUpdate = {};

const movementManager = {

    /**
     * Επιστρέφει το CostMatrix για ένα δωμάτιο (με Caching).
     */
    getRoomCostMatrix: function(roomName) {
        // Ανανέωση κάθε 50 ticks για να πιάνει νέα construction sites
        if (matrixCache[roomName] && lastMatrixUpdate[roomName] > Game.time - 50) {
            return matrixCache[roomName];
        }

        const room = Game.rooms[roomName];
        if (!room) return new PathFinder.CostMatrix;

        const costs = new PathFinder.CostMatrix;

        // 1. Δρόμοι και Δομές
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER && 
                       (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        // 2. Construction Sites (ώστε να μην κολλάνε τα creeps σε μελλοντικά κτίρια)
        room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(site) {
             if (site.structureType !== STRUCTURE_ROAD && 
                 site.structureType !== STRUCTURE_CONTAINER && 
                 site.structureType !== STRUCTURE_RAMPART) {
                 costs.set(site.pos.x, site.pos.y, 0xff);
             }
        });

        matrixCache[roomName] = costs;
        lastMatrixUpdate[roomName] = Game.time;

        return costs;
    },

    /**
     * Κεντρική συνάρτηση έξυπνης κίνησης.
     * @param {Creep} creep 
     * @param {Object|RoomPosition} targetObj 
     * @param {number} range 
     */
    smartMove: function(creep, targetObj, range = 1) {
        if (creep.fatigue > 0) return;

        // Διαχείριση target (είτε είναι Object με .pos είτε σκέτο RoomPosition)
        const targetPos = targetObj.pos || targetObj;

        if (creep.pos.inRangeTo(targetPos, range)) return;

        // --- Stuck Detection Logic ---
        if (!creep.memory._lastPos || creep.memory._lastPos.x !== creep.pos.x || creep.memory._lastPos.y !== creep.pos.y) {
            creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y };
            creep.memory._stuckCount = 0;
        } else {
            creep.memory._stuckCount = (creep.memory._stuckCount || 0) + 1;
        }

        // Αν το creep έχει κολλήσει για >= 2 ticks, ενεργοποιούμε την αποφυγή άλλων creeps
        const isStuck = creep.memory._stuckCount >= 2;

        const ret = PathFinder.search(
            creep.pos, 
            { pos: targetPos, range: range },
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: (roomName) => {
                    let costs = this.getRoomCostMatrix(roomName);

                    // Αν έχει κολλήσει, κλωνοποιούμε το matrix και προσθέτουμε τα creeps ως εμπόδια
                    if (isStuck) {
                        costs = costs.clone();
                        const room = Game.rooms[roomName];
                        if (room) {
                            room.find(FIND_CREEPS).forEach(c => {
                                if (c.id !== creep.id) {
                                    costs.set(c.pos.x, c.pos.y, 0xff);
                                }
                            });
                            room.find(FIND_POWER_CREEPS).forEach(c => {
                                costs.set(c.pos.x, c.pos.y, 0xff);
                            });
                        }
                    }
                    return costs;
                },
                maxOps: 2000
            }
        );

        if (ret.path.length > 0) {
            // Ανίχνευση κατεύθυνσης για την επόμενη κίνηση
            const direction = creep.pos.getDirectionTo(ret.path[0]);
            creep.move(direction);
        } else {
            // Fallback
            creep.moveTo(targetPos, { reusePath: 0 }); 
        }
    }
};

module.exports = movementManager;
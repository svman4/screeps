/*
 * File: manager.movement.js
 */

let matrixCache = {}; 
let lastMatrixUpdate = {};

const movementManager = {

    getRoomCostMatrix: function(roomName) {
        if (matrixCache[roomName] && lastMatrixUpdate[roomName] > Game.time - 50) {
            return matrixCache[roomName];
        }

        const room = Game.rooms[roomName];
        if (!room) return new PathFinder.CostMatrix;

        const costs = new PathFinder.CostMatrix;

        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER && 
                       (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        room.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
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

    smartMove: function(creep, target, range = 1) {
        if (!target) return ERR_INVALID_TARGET;
        const targetPos = target.pos || target;

        if (creep.pos.inRangeTo(targetPos, range)) return OK;

        // Stuck detection
        const lastPos = creep.memory._lastPos;
        if (lastPos && lastPos.x === creep.pos.x && lastPos.y === creep.pos.y && lastPos.roomName === creep.pos.roomName) {
            creep.memory._stuckCount = (creep.memory._stuckCount || 0) + 1;
        } else {
            creep.memory._stuckCount = 0;
            creep.memory._lastPos = { x: creep.pos.x, y: creep.pos.y, roomName: creep.pos.roomName };
        }

        const isStuck = creep.memory._stuckCount > 2;

        const ret = PathFinder.search(
            creep.pos, 
            { pos: targetPos, range: range },
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: (roomName) => {
                    let costs = this.getRoomCostMatrix(roomName);
                    if (isStuck) {
                        costs = costs.clone();
                        const room = Game.rooms[roomName];
                        if (room) {
                            room.find(FIND_CREEPS).forEach(c => {
                                if (c.id !== creep.id) costs.set(c.pos.x, c.pos.y, 0xff);
                            });
                        }
                    }
                    return costs;
                },
                maxOps: 2000
            }
        );

        if (ret.path.length > 0) {
            const nextStep = ret.path[0];
            // Καταγραφή επόμενου βήματος για το Yield logic
            creep.memory._nextStep = { x: nextStep.x, y: nextStep.y, t: Game.time };
            
            const direction = creep.pos.getDirectionTo(nextStep);
            return creep.move(direction);
        } else {
            return creep.moveTo(targetPos, { reusePath: 10, visualizePathStyle: {stroke: '#ffaa00'} });
        }
    },

    // Ελέγχει αν κάποιο άλλο creep θέλει να πατήσει εδώ που είμαστε
    isBlockingPath: function(creep) {
        const scanner = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: (c) => {
                return c.id !== creep.id && 
                       c.memory._nextStep && 
                       c.memory._nextStep.t === Game.time &&
                       c.memory._nextStep.x === creep.pos.x && 
                       c.memory._nextStep.y === creep.pos.y;
            }
        });
        return scanner.length > 0;
    }
};

module.exports = movementManager;
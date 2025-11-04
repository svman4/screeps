const logisticsManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'hauler') {
                this.runHauler(creep);
            }
        }
    },

    runHauler: function(creep) {
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🔍 finding energy');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 delivering');
        }

        if (creep.memory.working) {
            // Deliver energy
            const deliveryTarget = this.findDeliveryTarget(creep);
            if (deliveryTarget) {
                if (creep.transfer(deliveryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        } else {
            // Withdraw energy
            const withdrawTarget = this.findWithdrawTarget(creep);
            if (withdrawTarget) {
                if (creep.withdraw(withdrawTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(withdrawTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    },

    findDeliveryTarget: function(creep) {
        // Priority: Spawns/Extensions > Towers > Storage
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) return target;

        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200
        });
        if (target) return target;

        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        return target;
    },

    findWithdrawTarget: function(creep) {
        // Priority: Dropped Resources > Containers > Storage
        let target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: (r) => r.resourceType === RESOURCE_ENERGY
        });
        if (target) {
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
            return null; // Don't return a target for moveTo, pickup handles it
        }

        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 100
        });
        if (target) return target;

        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 10000
        });
        return target;
    }
};

module.exports = logisticsManager;

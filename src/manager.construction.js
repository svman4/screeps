const constructionManager = {
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'builder' || creep.memory.role === 'repairer') {
                this.runWorker(creep);
            }
        }
    },

    runWorker: function(creep) {
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚧 work');
        }

        if (creep.memory.working) {
            // Priority: Repair critical structures, then build
            const criticalStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax * 0.5 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });

            if (criticalStructure) {
                if (creep.repair(criticalStructure) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(criticalStructure);
                }
            } else {
                const constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
                if (constructionSite) {
                    if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(constructionSite);
                    }
                }
            }
        } else {
            // Harvest energy
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source);
            }
        }
    }
};

module.exports = constructionManager;

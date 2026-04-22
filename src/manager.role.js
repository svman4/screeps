const movementManager = require('manager.movement');
const minTickToLive = 30;

const roleManager = {
    // Lazy loading των κλάσεων για εξοικονόμηση CPU αν χρειαστεί
    roleClasses: {
        'harvester': require('role.harvester'),
        'simpleHarvester': require('role.simpleHarvester'),
        'upgrader': require('role.upgrader'),
        'staticHarvester': require('role.staticHarvester'),
        'builder': require('role.builder'),
        'claimer': require('role.claimer'),
        'scout': require('role.scout'),
        'supporter': require('role.supporter'),
        'LDHarvester': require('role.lDHarvester'),
        'miner': require('role.miner'),
		'to_be_recycled':require('role.recycleCreep')
    },

    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue;

            if (creep.ticksToLive < minTickToLive && creep.room.memory.recoveryContainerId) {
                creep.memory.role = "to_be_recycled";
            }

            const RoleClass = this.roleClasses[creep.memory.role];
            
            if (RoleClass) {
                const roleInstance = new RoleClass(creep);
                try {
                    roleInstance.run();
                } catch (e) {
                    console.log(`Error in role ${creep.memory.role} for ${creep.name}:`, e);
                }
            }
        }
    },
};

module.exports = roleManager;
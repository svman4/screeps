const movementManager = require('manager.movement');


const roleManager = {
    // Lazy loading των κλάσεων για εξοικονόμηση CPU αν χρειαστεί
    roleClasses: {
        'harvester': require('role/role.harvester'),
        'simpleHarvester': require('role/role.simpleHarvester'),
        'upgrader': require('role/role.upgrader'),
        'staticHarvester': require('role/role.staticHarvester'),
        'builder': require('role/role.builder'),
        'claimer': require('role/role.claimer'),
        'scout': require('role/role.scout'),
        'supporter': require('role/role.supporter'),
        'LDHarvester': require('role/role.lDHarvester'),
        'miner': require('role/role.miner'),
        'to_be_recycled': require('role/role.recycleCreep')
    },

    run: function () {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.spawning) continue;

            const RoleClass = this.roleClasses[creep.memory.role];

            if (RoleClass) {
                const roleInstance = new RoleClass(creep);
                try {
                    roleInstance.run();
                    roleInstance.manageLifecycle(creep.room.memory.recoveryContainerId);

                } catch (e) {
                    console.log(`Error in role ${creep.memory.role} for ${creep.name}:`, e);
                }
            }
        }
    } // end of run
};

module.exports = roleManager;
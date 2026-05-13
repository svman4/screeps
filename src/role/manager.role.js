import movementManager from 'manager.movement';
import harvester from "./role.harvester";
import simpleHarvester from "./role.simpleHarvester";
import upgrader from "./role.upgrader";
import staticHarvester from "./role.staticHarvester";
import builder from "./role.builder";
import claimer from "./role.claimer";
import scout from "./role.scout";
import supporter from "./role.supporter";
import LDHarvester from "./role.lDHarvester";
import miner from "./role.miner";
import recycleCreep from "./role.recycleCreep";

const roleManager = {
    roleClasses: {
        'harvester': harvester,
        'simpleHarvester': simpleHarvester,
        'upgrader': upgrader,
        'staticHarvester': staticHarvester,
        'builder': builder,
        'claimer': claimer,
        'scout': scout,
        'supporter': supporter,
        'LDHarvester': LDHarvester,
        'miner': miner,
        'recycleCreep': recycleCreep
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

export default roleManager;
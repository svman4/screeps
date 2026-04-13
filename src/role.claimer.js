const BaseRole = require('role.base');
const movementManager = require('manager.movement');

class Claimer extends BaseRole {
    run() {
        if (this.travelToTargetRoom()) return;
        const controller = this.creep.room.controller;
        if (!controller) return;

        if (controller.my) {
            this.creep.memory.homeRoom = this.creep.room.name;
            this.creep.memory.role = 'builder';
            return;
        }

        if (!controller.owner && !controller.upgradeBlocked) {
            if (this.creep.pos.inRangeTo(controller, 1)) {
                if (this.creep.claimController(controller) === OK) {
                    this.creep.room.memory = { type: "initial_setup"};
					this.crep.memory.homeRoom=this.creep.room.name;
                    this.creep.memory.role = "builder";
                }
            } else movementManager.smartMove(this.creep, controller, 1);
        } else {
            if (this.creep.pos.inRangeTo(controller, 1)) this.creep.attackController(controller);
            else movementManager.smartMove(this.creep, controller, 1);
        }
        this.destroyHostiles();
    }
}
module.exports = Claimer;
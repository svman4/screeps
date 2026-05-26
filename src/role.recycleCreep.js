const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const roomCache = require('utils.RoomCache');
class To_be_recycled extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        const container = roomCache.in(this.creep.room.name).recoveryContainer;
        const spawns = roomCache.in(this.creep.room.name).spawns;

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) {
                movementManager.smartMove(this.creep, container, 0);
            } else {
                const spawn = this.creep.pos.findClosestByRange(spawns);
                if (spawn) spawn.recycleCreep(this.creep);
            }
            return;
        }
        // Αν δεν υπάρχει container, πάμε κατευθείαν στο spawn
        const spawn = this.creep.pos.findClosestByRange(spawns);
        if (spawn) {
            if (!this.creep.pos.inRangeTo(spawn, 1)) {
                movementManager.smartMove(this.creep, container, 0);
            } else {
                spawn.recycleCreep(this.creep);
            }
        }
        // Αν δεν υπάρχει spawn, απλά αυτοκτονία για να μην σπαταλάμε πόρους
        this.creep.suicide();
    }
}
module.exports = To_be_recycled;
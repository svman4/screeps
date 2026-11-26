import BaseRole from './role.base';
import movementManager from './manager.movement';
import roomCacheClass = require('./utils.RoomCache');
// Ορισμός τύπου για να σταματήσει να διαμαρτύρεται ο compiler
const roomCache = roomCacheClass as any;

class To_be_recycled extends BaseRole {
    run() {
        if (this.travelToHomeRoom()) return;
        const container = roomCache.in(this.creep.room.name).recoveryContainer;

        const spawns = roomCache.in(this.creep.room.name).spawns;

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) {
                movementManager.smartMove(this.creep, container, 0);
            } else {
                const spawn = this.creep.pos.findClosestByRange(spawns) as StructureSpawn;
                if (spawn) spawn.recycleCreep(this.creep);
            }
            return;
        }
        // Αν δεν υπάρχει container, πάμε κατευθείαν στο spawn
        const spawn = this.creep.pos.findClosestByRange(spawns) as StructureSpawn;

        if (spawn) {

            if (!this.creep.pos.inRangeTo(spawn, 1)) {
                movementManager.smartMove(this.creep, spawn, 0);
            } else {
                spawn.recycleCreep(this.creep);

            }
            return;
        }
        // Αν δεν υπάρχει spawn, απλά αυτοκτονία για να μην σπαταλάμε πόρους
        this.creep.suicide();
    }
}
module.exports = To_be_recycled;
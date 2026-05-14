/**
 * @file manager.defense.ts
 * @description Σύστημα διαχείρισης των Towers (Πύργων) για την άμυνα και τη συντήρηση του δωματίου.
 */
import _ from 'lodash';
/**
 * Λίστα με τα κρίσιμα κτίρια που πρέπει να προστατεύονται κατά προτεραιότητα.
 */
const CRITICAL_STRUCTURES: StructureConstant[] = [
    STRUCTURE_SPAWN,
    STRUCTURE_TOWER,
    STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL
];

/**
 * Ρυθμίσεις προτεραιότητας επισκευής βάσει τύπου κτιρίου.
 * Υψηλότερος αριθμός σημαίνει υψηλότερη προτεραιότητα.
 */
const REPAIR_PRIORITIES: Partial<Record<StructureConstant, number>> = {
    [STRUCTURE_SPAWN]: 100,
    [STRUCTURE_TOWER]: 90,
    [STRUCTURE_STORAGE]: 85,
    [STRUCTURE_TERMINAL]: 80,
    [STRUCTURE_EXTENSION]: 75,
    [STRUCTURE_CONTAINER]: 40,
    [STRUCTURE_RAMPART]: 20,
    [STRUCTURE_WALL]: 10
};

/**
 * Γενικές ρυθμίσεις για τη λειτουργία των Towers.
 */
const TOWER_CONFIG = {
    WALL_REPAIR_STEP: 1000,
    DEFAULT_WALL_LIMIT: 20000,
    MAX_WALL_LIMIT: 100000000,
    REPAIR_ENERGY_THRESHOLD_UNDER_ATTACK: 0.7, // 70%
    GENERAL_REPAIR_THRESHOLD: 0.8, // 80% hitsMax
    WALL_THRESHOLD_REFRESH_RATE: 3000 // Κάθε πόσα ticks ανανεώνεται το όριο των τοιχών
};

export class TowerController {

    /**
     * Η κύρια συνάρτηση ελέγχου των Towers σε ένα συγκεκριμένο δωμάτιο.
     * @param roomName Το όνομα του δωματίου.
     */
    public static run(roomName: string): void {
        const room = Game.rooms[roomName];
        if (!room) return;

        // Περιοδική ανανέωση του ορίου των τοιχών βάσει του config
        if (Game.time % TOWER_CONFIG.WALL_THRESHOLD_REFRESH_RATE === 0) {
            this.refreshWallThreshold(room);
        }

        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: (s): s is StructureTower => s.structureType === STRUCTURE_TOWER
        });

        if (towers.length === 0) return;

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const woundedCreeps = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.hits < creep.hitsMax
        });

        for (const tower of towers) {
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) === 0) continue;

            // 1. ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Επίθεση σε εχθρούς
            if (hostiles.length > 0) {
                const target = this.findBestAttackTarget(tower, hostiles, room);
                if (target) {
                    tower.attack(target);
                    continue;
                }
            }

            // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Θεραπεία τραυματισμένων creeps
            if (woundedCreeps.length > 0) {
                const mostInjured = this.findMostInjuredCreep(woundedCreeps);
                if (mostInjured) {
                    tower.heal(mostInjured);
                    continue;
                }
            }

            // 3. Επισκευή υποδομών
            if (this.shouldRepair(tower, hostiles)) {
                const repairTarget = this.findBestRepairTarget(tower, room);
                if (repairTarget) {
                    tower.repair(repairTarget);
                }
            }
        }
    }

    /**
     * Βρίσκει τον καλύτερο στόχο για επίθεση με βάση την επικινδυνότητα
     */
    private static findBestAttackTarget(tower: StructureTower, hostiles: Creep[], room: Room): Creep | null {
        const dangerous = hostiles.filter(creep =>
            creep.getActiveBodyparts(ATTACK) > 0 ||
            creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
            creep.getActiveBodyparts(HEAL) > 0 ||
            creep.getActiveBodyparts(WORK) > 0
        );

        const targets = dangerous.length > 0 ? dangerous : hostiles;

        const criticalStructures = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => CRITICAL_STRUCTURES.includes(s.structureType)
        });

        // Εχθροί που βρίσκονται κοντά σε κρίσιμα κτίρια
        const attackers = targets.filter(hostile =>
            criticalStructures.some(struct => hostile.pos.getRangeTo(struct) <= 5)
        );

        if (attackers.length > 0) {
            return tower.pos.findClosestByRange(attackers);
        }

        return tower.pos.findClosestByRange(targets);
    }

    /**
     * Βρίσκει το πιο τραυματισμένο creep (ποσοστιαία)
     */
    private static findMostInjuredCreep(woundedCreeps: Creep[]): Creep | null {
        if (woundedCreeps.length === 0) return null;
        return woundedCreeps.reduce((prev, curr) =>
            (curr.hits / curr.hitsMax) < (prev.hits / prev.hitsMax) ? curr : prev
        );
    }

    /**
     * Βρίσκει τον επόμενο στόχο επισκευής βάσει προτεραιοτήτων
     */
    private static findBestRepairTarget(tower: StructureTower, room: Room): Structure | null {
        const structures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.hits >= structure.hitsMax) return false;

                // Χρήση του CRITICAL_STRUCTURES set και για τις επισκευές
                if (CRITICAL_STRUCTURES.includes(structure.structureType) || structure.structureType === STRUCTURE_EXTENSION) {
                    return true;
                }

                if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
                    const limit = this.calculateWallLimit(room);
                    return structure.hits < limit;
                }

                return structure.hits < structure.hitsMax * TOWER_CONFIG.GENERAL_REPAIR_THRESHOLD;
            }
        });

        if (structures.length === 0) return null;

        return structures.sort((a, b) => {
            const pA = this.getStructurePriority(a);
            const pB = this.getStructurePriority(b);
            if (pA !== pB) return pB - pA;
            return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
        })[0];
    }

    /**
     * Επιστρέφει την προτεραιότητα μιας δομής από το config mapping
     */
    private static getStructurePriority(structure: Structure): number {
        return REPAIR_PRIORITIES[structure.structureType] || 5;
    }

    /**
     * Ανανεώνει το wallLimit στη μνήμη του δωματίου
     */
    private static refreshWallThreshold(room: Room): void {
        const step = TOWER_CONFIG.WALL_REPAIR_STEP;
        // Αναζήτηση όλων των τοίχων και οχυρώσεων στο δωμάτιο
        const walls = room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureWall | StructureRampart => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });

        if (walls.length === 0) return;
        // Υπολογισμός του ελάχιστου hits μεταξύ των τοιχών
        let minHits: number = walls.reduce((min, w) => w.hits < min ? w.hits : min, walls[0].hits);
        // let minHits = _.min(walls is STRUCTURE_WALL|STRUCTURE_RAMPART , 'hits').hits;
        const level: number = room.controller?.level || 1;

        minHits = Math.max(level * 10000, minHits);
        let hitsValue = Math.floor(minHits / step) * step + 1000;

        // Έλεγχος βάσει του max limit από το config
        hitsValue = Math.min(hitsValue, TOWER_CONFIG.MAX_WALL_LIMIT);

        if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
        Memory.rooms[room.name].wallLimit = hitsValue;
    }

    /**
     * Ανακτά το τρέχον όριο επισκευής τοιχών
     */
    private static calculateWallLimit(room: Room): number {
        return Memory.rooms[room.name]?.wallLimit || TOWER_CONFIG.DEFAULT_WALL_LIMIT;
    }

    /**
     * Έλεγχος αν ο πύργος πρέπει να ξοδέψει ενέργεια για επισκευή
     */
    private static shouldRepair(tower: StructureTower, hostiles: Creep[]): boolean {
        const energyPct = tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY);
        if (hostiles.length > 0) {
            return energyPct > TOWER_CONFIG.REPAIR_ENERGY_THRESHOLD_UNDER_ATTACK;
        }
        return tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    }
}

export default TowerController;
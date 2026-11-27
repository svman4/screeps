import * as _ from "lodash";
import roomCache from './utils.RoomCache';
import { DEFENCE } from './constants';



class DefenceManager {

    /**
     * Η κύρια συνάρτηση ελέγχου των Towers σε ένα συγκεκριμένο δωμάτιο.
     * @param roomName Το όνομα του δωματίου που πρέπει να διαχειριστεί.
     */
    public run(roomName: string): void {
        const room: Room = Game.rooms[roomName];
        if (!room)
            return;
        if (Game.time % 3000 === 0) {
            this.refreshWallThreshold(room);
        }
        const cache = roomCache.in(roomName);
        const rawTowers = cache.groupedStructures ? cache.groupedStructures[STRUCTURE_TOWER] : null;
        const towers = rawTowers as StructureTower[];
        if (!towers || towers.length === 0)
            return;

        const hostiles = cache.hostileCreeps || room.find(FIND_HOSTILE_CREEPS);

        // Φιλτράρισμα και ταξινόμηση τραυματισμένων creeps (από τα πιο χτυπημένα στα λιγότερο)
        let woundedCreeps: Creep[] = cache.myCreeps ?
            cache.myCreeps
                .filter((creep: Creep) => creep.hits < creep.hitsMax)
                .sort((a: Creep, b: Creep) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax))
            : [];

        for (const tower of towers) {
            // Έξυπνος έλεγχος energy - αποφυγή σπατάλης
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
                continue;

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
                const mostInjured = woundedCreeps[0];
                if ((mostInjured.hitsMax - mostInjured.hits) < 5) {
                    woundedCreeps.shift();
                } else {
                    tower.heal(mostInjured);
                }
            }

            // 3. Έξυπνη επισκευή - μόνο όταν έχουμε αρκετή energy ή δεν υπάρχουν απειλές
            if (this.shouldRepair(tower, hostiles)) {
                const repairTarget = this.findBestRepairTarget(tower, room);
                if (repairTarget) {
                    tower.repair(repairTarget);
                }
            }
        }
    } // end of run



    /**
     * Refreshes the target hit threshold for walls and ramparts in a room
     * using quantized step increments based on current minimum structure hits,
     * controller level, and RCL 8 storage energy reserves.
     *
     * @param room - Target Screeps room to evaluate.
     */
    private refreshWallThreshold(room: Room): void {
        if (!room) {
            return;
        }

        if (!room.memory) {
            room.memory = {} as RoomMemory;
        }

        if (typeof room.memory.wallLimit !== "number") {
            room.memory.wallLimit = DEFENCE.DEFAULT_WALL_LIMIT_HITS;
        }

        const defenses = room.find(FIND_STRUCTURES, {
            filter: (s): s is StructureWall | StructureRampart =>
                (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
                typeof s.hits === "number"
        });

        if (defenses.length === 0) {
            return;
        }

        let minHits = Infinity;
        for (let i = 0; i < defenses.length; i++) {
            const hits = defenses[i].hits;
            if (hits < minHits) {
                minHits = hits;
            }
        }

        if (!Number.isFinite(minHits)) {
            return;
        }

        const rcl = room.controller ? room.controller.level : 0;
        let baselineHits = minHits;

        if (rcl > 0) {
            baselineHits = Math.max(rcl * DEFENCE.WALL_STEP_HITS, baselineHits);
        }

        const quantizedHits = Math.floor(baselineHits / DEFENCE.WALL_STEP_HITS) * DEFENCE.WALL_STEP_HITS;

        const isRichRcl8 =
            rcl === 8 &&
            room.storage != null &&
            room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > DEFENCE.RCL8_RICH_ENERGY_THRESHOLD;

        const increment = isRichRcl8 ? DEFENCE.RCL8_RICH_WALL_STEP_HITS : DEFENCE.WALL_STEP_HITS;
        const nextLimit = Math.min(quantizedHits + increment, DEFENCE.MAX_WALL_LIMIT_HITS);

        room.memory.wallLimit = nextLimit;
    }

    /**
     * Βρίσκει τον καλύτερο στόχο για επίθεση
     */
    private findBestAttackTarget(tower: StructureTower, hostiles: Creep[], room: Room): Creep | null {
        // Προτεραιότητα σε επικίνδυνους εχθρούς (με attack parts)
        const dangerous = hostiles.filter(creep =>
            creep.getActiveBodyparts(ATTACK) > 0 ||
            creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
            creep.getActiveBodyparts(HEAL) > 0 ||
            creep.getActiveBodyparts(WORK) > 0
        );

        const targets = dangerous.length > 0 ? dangerous : hostiles;
        const criticalTypes = DEFENCE.CRITICAL_STRUCTURE_TYPES;
        // Βελτιωμένη επιλογή: προτεραιότητα σε εχθρούς που επιτίθενται σε κρίσιμες δομές
        const criticalStructures = room.find(FIND_MY_STRUCTURES, {
            filter: structure => {
                return criticalStructures.includes(structure.structureType);
            }
        });

        // Βρες εχθρούς που απειλούν κρίσιμες δομές
        const attackers: Creep[] = [];
        for (const hostile of targets) {
            for (const structure of criticalStructures) {
                if (hostile.pos.getRangeTo(structure) <= 5) {
                    attackers.push(hostile);
                    break;
                }
            }
        }

        // Αν υπάρχουν εχθροί που απειλούν κρίσιμες δομές, επιλέγουμε από αυτούς
        if (attackers.length > 0) {
            return tower.pos.findClosestByRange(attackers);
        }

        // Αλλιώς, επιλέγουμε τον πιο κοντινό από τους targets
        return tower.pos.findClosestByRange(targets);
    }

    public isWarModeActive(room: Room): boolean {
        // TODO: Να ενημερώνει για την κατάσταση
        return false;
    } // end of isWarModeActive

    /**
     * Καθορίζει αν πρέπει να γίνει επισκευή βάσει energy και απειλών
     */
    private shouldRepair(tower: StructureTower, hostiles: Creep[]): boolean {
        // Αν υπάρχουν εχθροί, επισκευή μόνο με υψηλή energy
        if (hostiles.length > 0) {
            return tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * DEFENCE.HOSTILE_REPAIR_ENERGY_RATIO;
        }

        // Χωρίς εχθρούς, επισκευή με οποιαδήποτε energy
        return tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    }

    /**
     * Βρίσκει τον καλύτερο στόχο για επισκευή
     */
    private findBestRepairTarget(tower: StructureTower, room: Room): AnyStructure | null {
        const structures = room.find(FIND_STRUCTURES, {
            filter: structure => {
                if (structure.hits >= structure.hitsMax) return false;

                // Προτεραιότητα σε κρίσιμες δομές
                const criticalTypes = DEFENCE.CRITICAL_STRUCTURE_TYPES;

                if (criticalTypes.includes(structure.structureType)) {
                    return true;
                }

                // Προστατευμένες δομές (τείχη/ramparts) - δυναμικά όρια
                if (structure.structureType === STRUCTURE_WALL ||
                    structure.structureType === STRUCTURE_RAMPART) {
                    const limit = this.calculateWallLimit(room, room.controller ? room.controller.level : 1);
                    return structure.hits < limit;
                }

                // Άλλες δομές (roads, containers κλπ)
                return structure.hits < structure.hitsMax * DEFENCE.OTHER_REPAIR_HITS_RATIO;
            }
        });

        if (structures.length === 0) return null;

        // Ταξινόμηση βάσει προτεραιότητας
        structures.sort((a, b) => {
            const priorityA = this.getStructurePriority(a);
            const priorityB = this.getStructurePriority(b);

            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }

            // Αν ίδια προτεραιότητα, επέλεξε το πιο κατεστραμμένο
            const damagePercentA = a.hits / a.hitsMax;
            const damagePercentB = b.hits / b.hitsMax;
            return damagePercentA - damagePercentB;
        });

        return structures[0];
    }

    /**
     * Επιστρέφει την προτεραιότητα μιας δομής (υψηλότερος αριθμός = υψηλότερη προτεραιότητα)
     */
    private getStructurePriority(structure: AnyStructure): number {
        const priorities: { [key: string]: number } = {
            [STRUCTURE_SPAWN]: 100,
            [STRUCTURE_TOWER]: 90,
            [STRUCTURE_STORAGE]: 85,
            [STRUCTURE_TERMINAL]: 80,
            [STRUCTURE_EXTENSION]: 75,
            [STRUCTURE_LAB]: 70,
            [STRUCTURE_FACTORY]: 65,
            [STRUCTURE_POWER_SPAWN]: 60,
            [STRUCTURE_OBSERVER]: 55,
            [STRUCTURE_NUKER]: 50,
            [STRUCTURE_CONTAINER]: 40,
            [STRUCTURE_LINK]: 35,
            [STRUCTURE_ROAD]: 30,
            [STRUCTURE_RAMPART]: 20,
            [STRUCTURE_WALL]: 10
        };

        return priorities[structure.structureType] || 5;
    }

    /**
     * Υπολογίζει το όριο hits για τα τείχη/ramparts ανάλογα με το επίπεδο του controller
     */
    private calculateWallLimit(room: Room, controllerLevel: number): number {
        // Δυναμικό όριο που αυξάνεται με το επίπεδο
        let limit = 20000;
        if (room && room.memory && room.memory.wallLimit) {
            limit = room.memory.wallLimit;
        }

        return limit;
    } // end of calculateWallLimit
} // end of class

export = new DefenceManager();
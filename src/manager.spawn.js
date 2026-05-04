/**
 * @file manager.spawn.js
 * @author svman4
 * @version 3.5.0
 * * DESCRIPTION:
 * Κεντρικός Διαχειριστής Παραγωγής (Spawn Manager). 
 * Υπεύθυνος για την ανάλυση των αναγκών κάθε δωματίου, τον σχεδιασμό των σωμάτων (body design)
 * και την εκτέλεση της εντολής spawnCreep. 
 *
 * ΣΤΡΑΤΗΓΙΚΗ:
 * Χρησιμοποιεί το PopulationManager για να λάβει "Quotas" (ποσοστώσεις) σε επίπεδο Body Parts 
 * αντί για απλό αριθμό creeps, επιτρέποντας δυναμική κλιμάκωση (scaling) ανάλογα με την ενέργεια.
 *
 * CHANGELOG:
 * - v3.5.0: Πλήρης εξάλειψη Magic Numbers. Εισαγωγή SPAWN_SETTINGS config. Προσθήκη εκτενούς Documentation.
 * - v3.4.0: Βελτιστοποίηση σειράς μερών (Body Part Ordering) για ανθεκτικότητα σε ζημιές (damage mitigation).
 * - v3.3.0: Ενσωμάτωση Dynamic Body Scaling βάσει energyCapacityAvailable.
 * - v3.2.0: Recovery Mode integration - προτεραιότητα σε χαμηλού κόστους creeps σε περίπτωση οικονομικής κατάρρευσης.
 * - v3.0.0: Μετάβαση σε Class-based Singleton αρχιτεκτονική.
 * - v2.5.0: Εφαρμογή προτεραιότητας Local Spawning (προτίμηση στο home room).
 */

import { ROLES, PRIORITY } from './spawn.constants';
import populationManager from './spawn.populationManager';

/**
 * Κεντρικές Ρυθμίσεις Διαχειριστή
 * Εδώ ορίζονται όλες οι σταθερές για να αποφεύγονται οι "μαγικοί αριθμοί" στον κώδικα.
 */
const SPAWN_SETTINGS = {
    TICKS: {
        RUN_FREQUENCY: 5,        // Κάθε πόσα ticks τρέχει ο έλεγχος για spawn
        MEMORY_CLEANUP: 50       // Συχνότητα διαγραφής νεκρών creeps από τη Memory
    },
    LIMITS: {
        MAX_BODY_PARTS: 50,      // Το ανώτατο όριο της engine του παιχνιδιού
        MIN_RECOVERY_ENERGY: 300 // Ελάχιστη ενέργεια για να ξεκινήσει το recovery
    },
    // Body Templates: Ορίζουν πώς χτίζεται κάθε ρόλος
    // template: επαναλαμβανόμενο μοτίβο
    // maxUnits: μέγιστος αριθμός επαναλήψεων (όχι συνολικών μερών)
    BODY_TEMPLATES: {
        [ROLES.STATIC_HARVESTER]: {
            base: [MOVE],            // Ξεκινάει με 1 MOVE
            repeatable: [WORK],      // Προσθέτει WORK
            maxUnits: 6,             // 6 WORK max (βέλτιστο για 3000 source σε 300 ticks)
            useBaseOnlyIfEmpty: false
        },
        [ROLES.HAULER]: {
            template: [CARRY, CARRY, MOVE], // 2:1 ratio για κίνηση σε δρόμους (fatigue 0)
            maxUnits: 15                    // 30 Carry / 15 Move συνολικά
        },
        [ROLES.UPGRADER]: {
            template: [WORK, CARRY, MOVE], 
            maxUnits: 15
        },
        [ROLES.BUILDER]: {
            template: [WORK, CARRY, MOVE],
            maxUnits: 12
        },
        [ROLES.SIMPLE_HARVESTER]: {
            template: [WORK, CARRY, MOVE],
            maxUnits: 5
        }
    }
};

class SpawnManager {
    constructor() {
        this.settings = SPAWN_SETTINGS;
    }

    /**
     * Κύρια μέθοδος εκτέλεσης του Manager.
     * Τρέχει στο τέλος του loop ή όπου ορίζεται στο main.js.
     */
    run() {
        // Καθαρισμός μνήμης σε τακτά διαστήματα
        this.manageMemoryCleanup();
        
        // Έλεγχος συχνότητας εκτέλεσης για εξοικονόμηση CPU
        if (Game.time % this.settings.TICKS.RUN_FREQUENCY !== 0) return;

        // Έλεγχος κάθε δωματίου που μας ανήκει
        for (let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!this.isMyRoom(room)) continue;

            this.processRoom(room);
        }
    }

    /**
     * Επαληθεύει αν το δωμάτιο είναι υπό τον έλεγχό μας.
     */
    isMyRoom(room) {
        return room.controller && room.controller.my;
    }

    /**
     * Διαχειρίζεται την παραγωγή σε ένα συγκεκριμένο δωμάτιο.
     */
    processRoom(room) {
        // Βρίσκουμε διαθέσιμα spawns που δεν δουλεύουν ήδη
        const idleSpawns = room.find(FIND_MY_SPAWNS, { 
            filter: s => !s.spawning 
        });
        
        if (idleSpawns.length === 0) return;

        // Λήψη απαιτήσεων (Quotas) από τον Population Manager
        const quotas = populationManager.calculateQuotas(room);
        const currentActiveParts = this.countActivePartsInRoom(room);
        
        // Ταξινόμηση ρόλων βάσει προτεραιότητας (Priority)
        const rolesByPriority = Object.keys(ROLES).sort((a, b) => PRIORITY[a] - PRIORITY[b]);

        for (let roleKey of rolesByPriority) {
            const role = ROLES[roleKey];
            const target = quotas[role] || 0;
            const current = currentActiveParts[role] || 0;

            // Αν λείπουν μέρη για αυτόν τον ρόλο, ξεκινάμε spawn
            if (current < target) {
                this.executeSpawn(idleSpawns[0], role, room, quotas.isRecovery);
                return; // Παράγουμε ένα creep ανά spawn ανά tick
            }
        }
    }

    /**
     * Μετράει τα ενεργά Body Parts (WORK/CARRY) στο δωμάτιο ανά ρόλο.
     */
    countActivePartsInRoom(room) {
        const creeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name);
        const counts = {};

        for (let roleKey in ROLES) {
            const role = ROLES[roleKey];
            const roleCreeps = _.filter(creeps, c => c.memory.role === role);
            
            // Για Haulers μετράμε CARRY, για τους υπόλοιπους WORK
            const metric = (role === ROLES.HAULER) ? CARRY : WORK;
            counts[role] = _.sum(roleCreeps, c => c.getActiveBodyparts(metric));
        }
        return counts;
    }

    /**
     * Εκτελεί την εντολή spawnCreep με σωστό σώμα και μνήμη.
     */
    executeSpawn(spawn, role, room, isRecovery) {
        // Καθορισμός ορίου ενέργειας: 
        // Αν είμαστε σε Recovery, χρησιμοποιούμε ό,τι έχουμε τώρα.
        // Αλλιώς, περιμένουμε να γεμίσουν τα extensions (capacity).
        const energyLimit = isRecovery ? room.energyAvailable : room.energyCapacityAvailable;
        const body = this.prepareBody(role, energyLimit, isRecovery);
        
        if (!body || body.length === 0) return;
        
        // Έλεγχος αν έχουμε την απαιτούμενη ενέργεια ΤΩΡΑ (εκτός αν είμαστε σε recovery)
        if (this.calculateCost(body) > room.energyAvailable && !isRecovery) return;

        const name = `${role}_${room.name}_${Game.time % 1000}`;
        const memory = {
            role: role,
            homeRoom: room.name,
            spawnTick: Game.time,
            working: false
        };

        const result = spawn.spawnCreep(body, name, { memory: memory });

        if (result === OK) {
            console.log(`[SPAWN] ${room.name} -> ${name} | Cost: ${this.calculateCost(body)} | Recovery: ${isRecovery}`);
        }
    }

    /**
     * Δυναμικός σχεδιασμός του σώματος του Creep.
     */
    prepareBody(role, maxEnergy, isRecovery) {
        let body = [];
        const config = this.settings.BODY_TEMPLATES[role];

        if (!config) return [WORK, CARRY, MOVE];

        // Emergency Fallback: Αν το δωμάτιο είναι άδειο, φτιάξε το μικρότερο δυνατό
        if (isRecovery && maxEnergy < this.settings.LIMITS.MIN_RECOVERY_ENERGY) {
            return [WORK, CARRY, MOVE];
        }

        if (role === ROLES.STATIC_HARVESTER) {
            // Λογική: 1 MOVE και όσο το δυνατόν περισσότερα WORK
            body = [...config.base];
            let units = 0;
            while (this.calculateCost(body.concat(config.repeatable)) <= maxEnergy && units < config.maxUnits) {
                body = body.concat(config.repeatable);
                units++;
            }
        } else {
            // Λογική: Επανάληψη του template (π.χ. WORK, CARRY, MOVE)
            const template = config.template;
            const costPerUnit = this.calculateCost(template);
            
            let units = Math.floor(maxEnergy / costPerUnit);
            
            // Περιορισμός από τις ρυθμίσεις και το hard limit των 50 μερών
            const maxPossibleUnits = Math.floor(this.settings.LIMITS.MAX_BODY_PARTS / template.length);
            units = Math.min(units, config.maxUnits, maxPossibleUnits);

            for (let i = 0; i < units; i++) {
                body = body.concat(template);
            }
        }

        return this.sortBodyParts(body);
    }

    /**
     * Ταξινομεί τα μέρη του σώματος για βέλτιστη άμυνα.
     * Σειρά: TOUGH -> WORK -> CARRY -> MOVE.
     * Τα MOVE μπαίνουν τελευταία ώστε αν το creep φάει damage, 
     * να χάσει πρώτα την ικανότητα εργασίας αλλά να μπορεί ακόμα να κινηθεί.
     */
    sortBodyParts(body) {
        const partPriority = { [TOUGH]: 1, [WORK]: 2, [CARRY]: 3, [MOVE]: 4 };
        return _.sortBy(body, part => partPriority[part]);
    }

    /**
     * Υπολογίζει το συνολικό κόστος ενός array από body parts.
     */
    calculateCost(body) {
        return _.sum(body, part => BODYPART_COST[part]);
    }

    /**
     * Διαγράφει τη μνήμη των Creeps που πέθαναν.
     */
    manageMemoryCleanup() {
        if (Game.time % this.settings.TICKS.MEMORY_CLEANUP === 0) {
            for (const name in Memory.creeps) {
                if (!Game.creeps[name]) {
                    delete Memory.creeps[name];
                }
            }
        }
    }
}

// Εξαγωγή ως Singleton
const spawnManager = new SpawnManager();
export default spawnManager;
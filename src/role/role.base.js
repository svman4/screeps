/**
 * MODULE: Role Base Class
 * Version: 1.2.1
 * Author: Screeps Architect
 * Description: Η βασική κλάση από την οποία κληρονομούν όλοι οι ρόλοι των Creeps.
 * Περιλαμβάνει κοινές λειτουργίες κίνησης, συλλογής ενέργειας και διαχείρισης κύκλου ζωής.
 * * CHANGELOG:
 * 1.2.1: Σταθεροποίηση του upgrade range εντός της συνάρτησης upgradeController.
 * 1.2.0: Πλήρης αναδιάρθρωση JSDoc, βελτιστοποίηση CPU cycles και προσθήκη ασφαλειών.
 * 1.1.2: Εισαγωγή μεταβλητής CREEP_SPAWN_TIME αντί για hardcoded τιμή.
 * 1.1.1: Προσθήκη μεθόδου getSpawningDuration.
 * 1.1.0: Μετονομασία manageLifecycle & getRetirementThreshold.
 */

const movementManager = require('manager.movement');

class BaseRole {
    /**
     * Αρχικοποίηση της βασικής κλάσης.
     * @param {Creep} creep - Το αντικείμενο του creep από το Game.creeps.
     */
    constructor(creep) {
        /** @type {Creep} */
        this.creep = creep;
    }

    /**
     * Επιστρέφει το ελάχιστο όριο ζωής (Ticks to Live).
     * Αν το creep πέσει κάτω από αυτό, θεωρείται "προς απόσυρση".
     * @returns {number}
     */
    getRetirementThreshold() {
        return 30;
    }

    /**
     * Διαχειρίζεται τον κύκλο ζωής του creep (Recycling logic).
     * Αν το TTL είναι χαμηλό, το στέλνει για ανακύκλωση για να ανακτηθούν resources.
     * @param {string} [recycleContainerId] - Προαιρετικό ID του container δίπλα στο Spawn.
     * @returns {boolean} True αν το creep έχει μπει σε φάση ανακύκλωσης.
     */
    manageLifecycle(recycleContainerId) {
        // Αν το creep είναι ήδη σε κατάσταση ανακύκλωσης, δεν συνεχίζουμε το υπόλοιπο logic
        if (this.creep.memory.role === "to_be_recycled") {
            return true;
        }

        // Έλεγχος αν πλησιάζει το τέλος της ζωής του
        if (this.creep.ticksToLive < this.getRetirementThreshold()) {
            // Αν έχουμε ορίσει container ανακύκλωσης, ξεκινάμε τη διαδικασία
            if (recycleContainerId) {
                this.creep.memory.role = "to_be_recycled";
                this.creep.say('♻️ Retirement');
                return true;
            }
        }
        
        return false;
    }

    /**
     * Μεταφέρει το creep στο δωμάτιο "βάσης" (homeRoom).
     * Χρήσιμο για creeps που δραστηριοποιούνται σε remote rooms.
     * @returns {boolean} True αν το creep εκτελεί κίνηση προς το homeRoom.
     */
    travelToHomeRoom() {
        const homeRoom = this.creep.memory.homeRoom;
        if (!homeRoom) return false;

        if (this.creep.room.name !== homeRoom || this.isAtEdge()) {
            movementManager.smartMove(this.creep, new RoomPosition(25, 25, homeRoom), 20);
            return true;
        }
        return false;
    }

    /**
     * Μεταφέρει το creep στο δωμάτιο-στόχο (targetRoom).
     * @returns {boolean} True αν το creep εκτελεί κίνηση προς το targetRoom.
     */
    travelToTargetRoom() {
        const targetRoom = this.creep.memory.targetRoom;
        if (!targetRoom) return false;

        if (this.creep.room.name !== targetRoom || this.isAtEdge()) {
            movementManager.smartMove(this.creep, new RoomPosition(25, 25, targetRoom), 20);
            return true;
        }
        return false;
    }

    /**
     * Ελέγχει αν το creep βρίσκεται στα όρια του δωματίου (exit tiles).
     * @returns {boolean}
     */
    isAtEdge() {
        const { x, y } = this.creep.pos;
        return x === 0 || x === 49 || y === 0 || y === 49;
    }
 
    /**
     * Κεντρική μέθοδος συλλογής ενέργειας με σειρά προτεραιότητας:
     * 1. Links -> 2. Containers/Storage -> 3. Dropped -> 4. Ruins -> 5. Harvesting.
     * @returns {boolean} True αν το creep βρήκε πηγή και κινείται/συλλέγει.
     */
    getEnergy() {
        if (this.getEnergyFromLink()) return true;
        if (this.getEnergyFromContainersorStorage()) return true;
        if (this.getEnergyFromDroppedEnergy()) return true;
        if (this.getEnergyFromRuins()) return true;
        return this.gotoHarvesting();
    }

    /**
     * Συλλογή ενέργειας από κοντινά Links (εμβέλεια 3).
     * @param {ResourceConstant} [resource=RESOURCE_ENERGY]
     * @returns {boolean}
     */
    getEnergyFromLink(resource = RESOURCE_ENERGY) {
        const link = this.creep.pos.findInRange(FIND_MY_STRUCTURES, 3, {
            filter: (s) => s.structureType === STRUCTURE_LINK && s.store[resource] > 0
        })[0];

        if (link) {
            if (this.creep.pos.isNearTo(link)) {
                this.creep.withdraw(link, resource);
            } else {
                movementManager.smartMove(this.creep, link, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Ανάληψη ενέργειας από Containers ή το Storage του δωματίου.
     * @param {ResourceConstant} [resource=RESOURCE_ENERGY]
     * @returns {boolean}
     */
    getEnergyFromContainersorStorage(resource = RESOURCE_ENERGY) {
        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                         s.store[resource] > 0
        });

        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) {
                this.creep.withdraw(target, resource);
            } else {
                movementManager.smartMove(this.creep, target, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Αναζήτηση για Minerals (εκτός ενέργειας) σε Containers.
     * @returns {boolean}
     */
    getAnyMineralFromContainers() {
        const target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_CONTAINER) && 
                         Object.keys(s.store).some(res => res !== RESOURCE_ENERGY && s.store[res] > 0)
        });

        if (target) {
            const resourceType = Object.keys(target.store).find(res => res !== RESOURCE_ENERGY && target.store[res] > 0);
            if (resourceType) {
                if (this.creep.pos.inRangeTo(target, 1)) {
                    this.creep.withdraw(target, resourceType);
                } else {
                    movementManager.smartMove(this.creep, target, 1);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Συλλογή ενέργειας από το έδαφος (Dropped Energy).
     * @returns {boolean}
     */
    getEnergyFromDroppedEnergy() {
        const dropped = this.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 40
        });

        if (dropped) {
            if (this.creep.pos.inRangeTo(dropped, 1)) {
                this.creep.pickup(dropped);
            } else {
                movementManager.smartMove(this.creep, dropped, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Συλλογή ενέργειας από ερείπια (Ruins).
     * @returns {boolean}
     */
    getEnergyFromRuins() {
        const ruin = this.creep.pos.findClosestByPath(FIND_RUINS, { 
            filter: s => s.store[RESOURCE_ENERGY] > 40 
        });

        if (ruin) {
            if (this.creep.pos.inRangeTo(ruin, 1)) {
                this.creep.withdraw(ruin, RESOURCE_ENERGY);
            } else {
                movementManager.smartMove(this.creep, ruin, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Χειροκίνητη εξόρυξη από πηγή (Harvesting).
     * @returns {boolean}
     */
    gotoHarvesting() {
        const source = this.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (this.creep.pos.inRangeTo(source, 1)) {
                this.creep.harvest(source);
            } else {
                movementManager.smartMove(this.creep, source, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Γέμισμα των Spawns και των Extensions με ενέργεια.
     * @returns {boolean}
     */
    fillSpawnExtension() {
        const target = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                         s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (target) {
            if (this.creep.pos.inRangeTo(target, 1)) {
                this.creep.transfer(target, RESOURCE_ENERGY);
            } else {
                movementManager.smartMove(this.creep, target, 1);
            }
            return true;
        }
        return false;
    }

    /**
     * Κατασκευή κτιρίων (Construction Sites) με προτεραιότητα σε κρίσιμα κτίρια (όχι δρόμους).
     * @returns {boolean}
     */
    buildStructures() {
        // Πρώτα κτίζουμε τα πάντα εκτός από δρόμους
        let targets = this.creep.room.find(FIND_CONSTRUCTION_SITES, { 
            filter: s => s.structureType !== STRUCTURE_ROAD 
        });
        
        // Αν δεν υπάρχουν άλλα κτίρια, κτίζουμε τους δρόμους
        if (targets.length === 0) {
            targets = this.creep.room.find(FIND_CONSTRUCTION_SITES, { 
                filter: s => s.structureType === STRUCTURE_ROAD 
            });
        }

        if (targets.length > 0) {
            const target = this.creep.pos.findClosestByPath(targets);
            if (target) {
                if (this.creep.pos.inRangeTo(target, 3)) {
                    this.creep.build(target);
                } else {
                    movementManager.smartMove(this.creep, target, 3);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Αναβάθμιση του Controller του δωματίου.
     * @returns {boolean}
     */
    upgradeController() {
        const controller = this.creep.room.controller;
        if (controller) {
            const range = 3; 
            if (this.creep.pos.inRangeTo(controller, range)) {
                this.creep.upgradeController(controller);
            } else {
                movementManager.smartMove(this.creep, controller, range);
            }
            return true;
        }
        return false;
    }

    /**
     * Διαχείριση κυκλοφοριακού. Αν το creep εμποδίζει κάποιο σημαντικότερο creep, παραμερίζει.
     * @returns {boolean} True αν το creep έκανε κίνηση παραμερισμού.
     */
    checkYield() {
        const priorityRoles = ['LDHarvester', 'hauler', 'supporter'];
        
        // Εύρεση creep σε απόσταση 1 που ίσως εμποδίζεται
        const blocker = this.creep.pos.findInRange(FIND_MY_CREEPS, 1).find(
            c => c.id !== this.creep.id && priorityRoles.includes(c.memory.role) && c.fatigue === 0
        );
        
        if (!blocker) return false;
        
        // Αν όντως κλείνουμε το δρόμο, προσπαθούμε να βρούμε κενό tile γύρω μας
        if (movementManager.isBlockingPath(this.creep)) {
            const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            for (let dir of directions) {
                const nx = this.creep.pos.x + (dir === RIGHT || dir === TOP_RIGHT || dir === BOTTOM_RIGHT ? 1 : dir === LEFT || dir === TOP_LEFT || dir === BOTTOM_LEFT ? -1 : 0);
                const ny = this.creep.pos.y + (dir === BOTTOM || dir === BOTTOM_RIGHT || dir === BOTTOM_LEFT ? 1 : dir === TOP || dir === TOP_RIGHT || dir === TOP_LEFT ? -1 : 0);
                
                if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) {
                    const terrain = this.creep.room.getTerrain().get(nx, ny);
                    if (terrain !== TERRAIN_MASK_WALL) {
                        const isBlocked = this.creep.room.lookForAt(LOOK_STRUCTURES, nx, ny).some(s => 
                            OBSTACLE_OBJECT_TYPES.includes(s.structureType) && (s.structureType !== STRUCTURE_RAMPART || !s.my)
                        );
                        if (!isBlocked) {
                            this.creep.move(dir);
                            this.creep.say('🚧 Yield');
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Υπολογίζει πόσα ticks χρειάστηκαν για την κατασκευή του Creep.
     * @returns {number} Ο συνολικός χρόνος σε ticks (body length * 3).
     */
    getSpawningDuration() {
        if (!this.creep || !this.creep.body) return 0;
        // Το CREEP_SPAWN_TIME είναι συνήθως 3, αλλά καλό είναι να το έχουμε ως global constant
        const spawnTimeConstant = (typeof CREEP_SPAWN_TIME !== 'undefined') ? CREEP_SPAWN_TIME : 3;
        return this.creep.body.length * spawnTimeConstant;
    }
}

module.exports = BaseRole;
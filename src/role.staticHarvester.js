/**
 * ROLE: Static Harvester
 * VERSION: 2.2.0
 */
const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const { NEED_REPLACEMENT_FLAG } = require('spawn.constants');

class StaticHarvester extends BaseRole {
    run() {
        // 1. Προκαταρκτικοί έλεγχοι για Source και IDs
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        const source = Game.getObjectById(this.creep.memory.sourceId);
        if (!source) return;

        // 2. Εντοπισμός Container (αν δεν υπάρχει στη μνήμη)
        let container = Game.getObjectById(this.creep.memory.containerId);
        if (!container && this.creep.ticksToLive % 10 === 0) { // Έλεγχος ανά 10 ticks για οικονομία CPU
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { 
                filter: s => s.structureType === STRUCTURE_CONTAINER 
            });
            if (containers.length > 0) {
                container = containers[0];
                this.creep.memory.containerId = container.id;
            }
        }

        // 3. Κίνηση προς τη θέση εργασίας
        // Ιδανικά θέλουμε το creep ΠΑΝΩ στο container
        const targetPos = container ? container : source;
        const range = container ? 0 : 1;

        if (!this.creep.pos.inRangeTo(targetPos, range)) {
            movementManager.smartMove(this.creep, targetPos, range);
            return; // Μην προχωράς σε εργασία αν δεν έφτασες
        }

        // 4. Υπολογισμός Lead Time (μόνο όταν φτάσει και μόνο μία φορά)
        if (this.creep.memory.init === true) { 
            this.calculateReplacementLeadTime();
        }

        // 5. Διαχείριση Αντικατάστασης (Replacement Signal)
        if (this.creep.memory.leadTime && (this.creep.ticksToLive < this.creep.memory.leadTime)) {
            console.log(`[${this.creep.room.name}] ${this.creep.name}: Requesting replacement. Lead: ${this.creep.memory.leadTime}`);
            this.creep.memory[NEED_REPLACEMENT_FLAG] = true; 
            delete this.creep.memory.leadTime;
        }

        // 6. Διαχείριση Link (Μεταφορά ενέργειας)
        this.manageLink(container);

        // 7. Κύρια εργασία: Harvest
        if (source.energy > 0) {
            this.creep.harvest(source);
        }
    }

    /**
     * Εντοπίζει και διαχειρίζεται τη μεταφορά ενέργειας σε κοντινά Links
     */
    manageLink(container) {
        // Αν δεν έχουμε ψάξει για link ή αν έχουμε βρει παλαιότερα
        if (this.creep.memory.linkId === undefined) {
            const searchPos = container ? container.pos : this.creep.pos;
            const links = searchPos.findInRange(FIND_STRUCTURES, 1, { 
                filter: s => s.structureType === STRUCTURE_LINK 
            });
            this.creep.memory.linkId = links.length > 0 ? links[0].id : null;
        }

        if (this.creep.memory.linkId) {
            const link = Game.getObjectById(this.creep.memory.linkId);
            if (link && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // Μεταφορά στο link αν το creep έχει ενέργεια
                this.creep.transfer(link, RESOURCE_ENERGY);
            }
        }
    }

    /**
     * Υπολογίζει το Lead Time για το επόμενο creep.
     */
    calculateReplacementLeadTime() { 
        // Lead Time = Travel Time + Spawning Time + Buffer
        const travelTime = CREEP_LIFE_TIME - this.creep.ticksToLive;
        const spawnTime = this.getSpawningDuration();
        const buffer = 15; // Μικρό περιθώριο ασφαλείας
        
        this.creep.memory.leadTime = travelTime + spawnTime + buffer;
        delete this.creep.memory.init;
    }

    /**
     * Επιστρέφει το χρόνο που χρειάζεται για να γίνει spawn το creep (3 ticks ανά body part)
     */
    getSpawningDuration() {
        return this.creep.body.length * 3;
    }

    getRetirementThreshold() {
        return 0;
    }
}

module.exports = StaticHarvester;
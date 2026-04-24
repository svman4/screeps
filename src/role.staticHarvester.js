/**
 * ROLE: Static Harvester
 * VERSION: 2.1.1
 * DESCRIPTION: Εξειδικευμένος ρόλος για μόνιμη εγκατάσταση πάνω από πηγές (Sources).
 * Διαχειρίζεται αυτόματα τον χρόνο αντικατάστασής του (Lead Time) υπολογίζοντας 
 * το Spawning και το Travel time.
 * * CHANGELOG:
 * 2.1.1: Εισαγωγή μεταβλητών CREEP_LIFE_TIME αντί hardcoded τιμής 1500.
 * 2.1.0: Μετονομασία recordTravelTime σε calculateReplacementLeadTime.
 * 2.1.0: Εισαγωγή manageReplacementSignal για αυτοματοποιημένο spawning request.
 * 2.0.0: Μετατροπή σε Class-based ρόλο (κληρονομικότητα από BaseRole).
 */
const BaseRole = require('role.base');
const movementManager = require('manager.movement');
const {NEED_REPLACEMENT_FLAG}=require('spawn.constants');
class StaticHarvester extends BaseRole {
    run() {
        if (!this.creep.memory.sourceId) {
            const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
            if (closest) this.creep.memory.sourceId = closest.id;
        }
        const source = Game.getObjectById(this.creep.memory.sourceId);
        if (!source) return;

        let container = Game.getObjectById(this.creep.memory.containerId);
        if (!container) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            if (containers.length > 0) {
                container = containers[0];
                this.creep.memory.containerId = container.id;
            }
        }

        if (container) {
            if (!this.creep.pos.inRangeTo(container, 0)) {
				movementManager.smartMove(this.creep, container, 0);
				return;
			}
			
        } else if (!this.creep.pos.inRangeTo(source, 1)) {
            movementManager.smartMove(this.creep, source, 1);
            return;
        }
		if (this.creep.memory.init===true) { 
			this.calculateReplacementLeadTime();
		}
		// Έλεγχος αν πρέπει να δοθεί σήμα για παραγωγή αντικαταστάτη
        if (this.creep.memory.leadTime && (this.creep.ticksToLive < this.creep.memory.leadTime)) {
            
			console.log(`TODO ${this.creep.name}: Requesting replacement. Lead time was ${this.creep.memory.leadTime} ticks.`);
			// Διαγράφουμε το travelTime ώστε να μην ξαναστείλει το σήμα στο επόμενο tick
            
			delete this.creep.memory.leadTime;
            
            // TODO: Προσθήκη logic στο Spawn Manager για να διαβάζει αυτό το flag
            this.creep.memory[NEED_REPLACEMENT_FLAG] = true; 
            
        }
        this.creep.harvest(source);
    } // end of run()
	/**
     * Υπολογίζει πόσα ticks χρειάστηκε το creep για να φτάσει από το Spawn στην πηγή.
     * Θεωρεί ότι το Creep γεννήθηκε με 1500(CREEP_LIFE_TIME) ticks ζωής.
     */
    calculateReplacementLeadTime() { 
        const travelTime = CREEP_LIFE_TIME - this.creep.ticksToLive;
		//console.log(this.creep.name+" travel time "+travelTime);
        this.creep.memory.leadTime = travelTime+this.getSpawningDuration();
        delete this.creep.memory.init;
    }

    /**
     * Απενεργοποίηση αυτόματης ανακύκλωσης για στατικούς harvesters.
     */
    getRetirementThreshold() {
        return 0;
    }
} //end of class
module.exports = StaticHarvester;
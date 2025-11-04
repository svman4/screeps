
/**
 * role.staticHarvester.js
 * * Ο ρόλος του Static Harvester είναι να κάθεται μόνιμα σε ένα τετράγωνο (πάνω από Container)
 * και να συλλέγει συνεχώς ενέργεια από την Source, μεταφέροντάς την αμέσως στο Container.
 * Αναλαμβάνει επίσης την αυτό-επιδιόρθωση του Container.
 *
 * ΣΗΜΕΙΩΣΗ: Όλες οι άλλες ενέργειες (Transfer σε Extensions, Build, Upgrade)
 * ανατίθενται στον ρόλο "Hauler" ή "Builder".
 */
var staticHarvester = {
    
    /** @param {Creep} creep **/
    run: function(creep) {
        // --- 1. ΑΝΑΖΗΤΗΣΗ ΣΤΟΧΩΝ (Cache Targets) ---
        
        // Ο Static Harvester πρέπει να ξέρει ποια Source και ποιο Container εξυπηρετεί.
        // Εδώ υποθέτουμε ότι η Source ID είναι αποθηκευμένη στη μνήμη.
        // Αν δεν υπάρχει, βρίσκουμε την κοντινότερη ως προεπιλογή.
        
        if (!creep.memory.sourceId) {
            const closestSource = creep.pos.findClosestByPath(FIND_SOURCES);
            if (closestSource) {
                creep.memory.sourceId = closestSource.id;
            } else {
                return; // Δεν βρέθηκε Source
            }
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        
        let containerId=creep.memory.containerId;
         if(!containerId) { 
             creep.say("No containerFound");
             const containers=source.pos.findInRange(FIND_STRUCTURES,3,{ 
                 filter: (s)=>(s.structureType===STRUCTURE_CONTAINER)
                 });
             if (containers && containers.length>0) {
                 containerId=containers[0].id;
                 creep.memory.containerId=containerId;
                 creep.say("Found container");
             }
         }
        const container=Game.getObjectById(containerId);
        // --- 2. ΤΟΠΟΘΕΤΗΣΗ (Initial Move) ---
            
        // Αν ο Creep δεν βρίσκεται σε απόσταση harvest, κινείται προς τη Source.
        if (container) {
            if (creep.pos.inRangeTo(container,0)===false) {
                creep.moveTo(container, {
                    visualizePathStyle: {stroke: '#ffaa00'}, // Πορτοκαλί διαδρομή
                 reusePath: 10
                });
            } 
        } else {
        
                
            if (creep.pos.inRangeTo(source,1)===false) {
                        creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffaa00'}, // Πορτοκαλί διαδρομή
                // reusePath: 50
                });
                // Σημαντικό: Μόλις φτάσει, δεν πρέπει να ξανα-τρέξει αυτό το μπλοκ.
                return; 
            }
        }
        
        // Ο Creep είναι πλέον στη θέση εξόρυξης. Εκτελείται η κύρια λογική.

        // --- 3. ΚΥΡΙΑ ΔΡΑΣΗ: HARVEST ---
        // Κάνει harvest. Αυτή η εντολή πρέπει να εκτελείται συνεχώς.
        creep.harvest(source);

        // --- 4. ΔΕΥΤΕΡΕΥΟΥΣΑ ΔΡΑΣΗ: REPAIR (Αυτο-Συντήρηση του Container) ---

        // Βρίσκει το Container/Link στο τετράγωνο του Harvester (ή δίπλα).
        const structuresToMaintain = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK) && 
                            s.hits < s.hitsMax * 0.8 // Επιδιορθώνουμε όταν φτάσει το 80%
        });
        for (var struct in structuresToMaintain) { 
            if(struct && creep.store.getUsedCapacity(RESOURCE_ENERGY)>0) {
                creep.repair(struct);
            }
        }
        

        // // Αν βρεθεί κτίριο για επιδιόρθωση και ο Creep έχει ενέργεια για Repair
        // if (structuresToMaintain && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        //     creep.repair(structuresToMaintain);
        //     // Σημείωση: Ο repair cost είναι 1 ενέργεια ανά 100 hits.
        // }

        // --- 5. ΤΡΙΤΕΥΟΥΣΑ ΔΡΑΣΗ: TRANSFER (Μεταφορά Ενέργειας) ---

        // Βρίσκουμε το Container ή Link για μεταφορά.
        // Τοποθετούμε το Container στην μνήμη για καλύτερη απόδοση.
        if (!creep.memory.containerId) {
             const nearbyContainer = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK
            })[0];
            if (nearbyContainer) {
                creep.memory.containerId = nearbyContainer.id;
            }
        }
        
        const targetContainer = Game.getObjectById(creep.memory.containerId);

        // Αν ο Creep έχει ενέργεια (από το harvest) και υπάρχει Container
        // Μεταφέρει την ενέργεια στο Container/Link.
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && targetContainer) {
            // Αν ο Harvester κάθεται ακριβώς πάνω στο Container, η ενέργεια μεταφέρεται
            // αυτόματα αν το store του creep είναι γεμάτο. Ωστόσο, το transfer() είναι πιο clean.
            creep.transfer(targetContainer, RESOURCE_ENERGY);
        } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            // Αν δεν βρέθηκε Container (πρέπει να χτιστεί) απλώς πετάμε την ενέργεια.
            // Η ενέργεια θα πέσει στο τετράγωνο και θα συλλεχθεί από το Container μόλις χτιστεί
            // ή από Haulers.
            creep.drop(RESOURCE_ENERGY);
        }

        // ΤΕΛΟΣ: Η λογική επιστρέφει και ξαναρχίζει το Harvest στον επόμενο tick.
    }
};

module.exports = staticHarvester;

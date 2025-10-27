var roleHarvester = {
    
    /** * @param {Creep} creep 
     * Ο ρόλος του Harvester είναι να συλλέγει ενέργεια και να τροφοδοτεί 
     * τα Extensions, Spawns και Towers.
     **/
    run: function(creep) {
        
        // --- ΕΝΑΛΛΑΓΗ ΚΑΤΑΣΤΑΣΗΣ (State Switching) ---
        // Σημείωση: Χρησιμοποιούμε 'working' αντί για 'harvesting' για μεγαλύτερη σαφήνεια.
        // 'working' = true όταν μεταφέρει/χτίζει/κάνει upgrade (ξοδεύει ενέργεια).
        // 'working' = false όταν συλλέγει (γεμίζει).
        
        // Αν ήταν σε λειτουργία 'εργασίας' και άδειασε, πρέπει να επιστρέψει στη συλλογή.
        if(creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false; // Ξεκινάει η συλλογή
            //creep.say('⛏️ harvest');
        }
        // Αν ήταν σε λειτουργία 'συλλογής' και γέμισε, αρχίζει την εργασία.
        if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true; // Ξεκινάει η μεταφορά/εργασία
            //creep.say('🚚 transfer');
        }

        // ----------------------------------
        // 1. ΣΥΛΛΟΓΗ ΕΝΕΡΓΕΙΑΣ (HARVEST)
        // ----------------------------------
        if(creep.memory.working === false) { 
            // Βρίσκει ΟΛΕΣ τις πηγές ενέργειας στο δωμάτιο.
            var sources = creep.room.find(FIND_SOURCES);
             
            // Επιλέγουμε την πρώτη Source ως σταθερή
            const source = sources[0]; 
            
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                // Κίνηση προς την πηγή
                creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffaa00'}, // Πορτοκαλί διαδρομή
                    reusePath: 50 // Αποθήκευση διαδρομής
                }); 
            }
            return; 
        }
        
        // ----------------------------------
        // 2. ΜΕΤΑΦΟΡΑ ΕΝΕΡΓΕΙΑΣ (TRANSFER)
        // ----------------------------------
        
        // 2.1. ΥΨΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Spawns, Extensions)
        // Εξασφαλίζει ότι το σύστημα παραγωγής Creeps λειτουργεί.
        var highPriorityTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (highPriorityTargets.length > 0) {
            const closestTarget = creep.pos.findClosestByPath(highPriorityTargets);
            if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(closestTarget, {
                    visualizePathStyle: {stroke: '#ffffff'}, 
                    reusePath: 10
                });
            }
            return;
        }

        // 2.2. ΜΕΣΑΙΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Towers, Links)
        // Τροφοδοσία Towers για άμυνα (με ελάχιστο όριο)
        var mediumPriorityTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                // Τροφοδοτούμε Towers μέχρι το 80% (αφήνουμε τα τελευταία 20% για τους Towers να το κάνουν)
                const isTower = structure.structureType == STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) < structure.store.getCapacity(RESOURCE_ENERGY) * 0.8;
                // Τροφοδοτούμε Links αν δεν είναι ο Harvester Link (π.χ. Storage Link ή Upgrader Link)
                // Εδώ επιλέγουμε μόνο Towers για απλότητα
                return isTower;
            }
        });
        
        if (mediumPriorityTargets.length > 0) {
            const closestTarget = creep.pos.findClosestByPath(mediumPriorityTargets);
            if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(closestTarget, {
                    visualizePathStyle: {stroke: '#ffff00'}, // Κίτρινη διαδρομή
                    reusePath: 10
                });
            }
            return;
        }

        // 2.3. ΧΑΜΗΛΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ (Storage, Terminal)
        // Αποθήκευση της περίσσειας ενέργειας
        var lowPriorityTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_STORAGE ||
                        structure.structureType == STRUCTURE_TERMINAL) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (lowPriorityTargets.length > 0) {
            const closestTarget = creep.pos.findClosestByPath(lowPriorityTargets);
            if (creep.transfer(closestTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(closestTarget, {
                    visualizePathStyle: {stroke: '#00ff00'}, // Πράσινη διαδρομή
                    reusePath: 10
                });
            }
            return;
        }

        // ----------------------------------
        // 3. ΕΦΕΔΡΙΚΗ ΛΕΙΤΟΥΡΓΙΑ: BUILD (ΧΤΙΣΙΜΟ)
        // ----------------------------------
        // Αν όλα τα βασικά κτίρια είναι γεμάτα, χτίζουμε Construction Sites.
        const constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        if (constructionSites.length > 0) {
            const closestSite = creep.pos.findClosestByPath(constructionSites);

            if (creep.build(closestSite) == ERR_NOT_IN_RANGE) {
                creep.moveTo(closestSite, {
                    visualizePathStyle: {stroke: '#00ffff'}, // Κυανή διαδρομή για Build
                    reusePath: 10
                }); 
            }
            return;
        }
            
        // ----------------------------------
        // 4. ΤΕΛΕΥΤΑΙΑ ΕΦΕΔΡΕΙΑ: UPGRADE
        // ----------------------------------
        // Αν δεν υπάρχει τίποτα για χτίσιμο, αναβαθμίζουμε.
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {
                visualizePathStyle: {stroke: '#cc66cc'},
                reusePath: 10
            });
        }
    }
};

module.exports = roleHarvester;

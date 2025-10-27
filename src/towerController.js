/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 */

// Ορισμός του αντικειμένου towerController
var towerController = {
    /**
     * Η κύρια συνάρτηση ελέγχου των Towers σε ένα συγκεκριμένο δωμάτιο.
     * @param {string} roomName - Το όνομα του δωματίου που πρέπει να διαχειριστεί.
     */
    run: function(roomName) {
        // Παίρνουμε το αντικείμενο του δωματίου.
        const room = Game.rooms[roomName];

        // Ελέγχουμε αν έχουμε ορατότητα στο δωμάτιο. Αν όχι, σταματάμε.
        if (!room) {
            return;
        }

        // Βρίσκουμε όλες τις δικές μας Towers στο δωμάτιο.
        const allTowers = room.find(FIND_MY_STRUCTURES, {
            filter: {
                structureType: STRUCTURE_TOWER
            }
        });

        // Βρίσκουμε όλους τους εχθρούς (creeps) στο δωμάτιο ΜΙΑ ΦΟΡΑ.
        // Αυτό εξοικονομεί CPU, καθώς η αναζήτηση (find) είναι "ακριβή".
        const hostiles = room.find(FIND_HOSTILE_CREEPS);

        // Επαναλαμβάνουμε για κάθε Tower που βρέθηκε.
        // Χρησιμοποιούμε 'for...of' για να πάρουμε το ίδιο το αντικείμενο Tower.
        for (const tower of allTowers) {

            // 1. ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Επίθεση σε εχθρούς
            if (hostiles.length > 0) {
                // Βρίσκουμε τον πιο κοντινό εχθρό για βέλτιστη ζημιά (damage falloff).
                const closestHostile = tower.pos.findClosestByRange(hostiles);
                if (closestHostile) {
                    tower.attack(closestHostile);
                    // Συνεχίζουμε στην επόμενη tower, καθώς η επίθεση καταναλώνει ενέργεια.
                    continue; 
                }
            }

            // 2. ΔΕΥΤΕΡΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Επισκευή δομών
            // Βρίσκουμε την πιο κοντινή κατεστραμμένη δομή.
            const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax && 
                                       // Εξαιρούμε τα τείχη και τα ramparts από την αυτόματη επισκευή
                                       // για να μην ξοδεύεται όλη η ενέργεια σε αυτά.
                                       structure.structureType !== STRUCTURE_WALL && 
                                       structure.structureType !== STRUCTURE_RAMPART
            });

            if (closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }
            
            // ΣΗΜΕΙΩΣΗ: Θα μπορούσατε να προσθέσετε εδώ τη λογική για το γέμισμα (refilling) των Towers, 
            // αν χρειάζεται (π.χ., αν θέλετε να το κάνουν οι ίδιες οι Towers).
        }
    }
};

// Εξαγωγή του module για να μπορεί να χρησιμοποιηθεί σε άλλα αρχεία (π.χ., στο main.js)
module.exports = towerController;
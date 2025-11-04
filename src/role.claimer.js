/**
 * role.claimer.js
 * Ο ρόλος του Claimer (Διεκδικητής) είναι να ταξιδεύει σε ένα συγκεκριμένο δωμάτιο
 * και να προσπαθεί να κάνει claim τον Controller. Αν δεν μπορεί, κάνει reserve.
 */
var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        
        // 1. Βρίσκουμε τη σημαία στόχο (Χρησιμοποιήστε το όνομα της σημαίας που θα βάλετε στο χάρτη)
        const targetFlag = Game.flags.ClaimFlag; // <--- Αλλάξτε το 'ClaimFlag' στο όνομα της σημαίας σας

        if (!targetFlag) {
            creep.say('No Flag!');
            console.log('Claimer: Δεν βρέθηκε σημαία με όνομα ClaimFlag.');
            return; 
        }

        // 2. Αν ο creep δεν είναι στο δωμάτιο στόχο, κινείται προς αυτό
        if (creep.room.name !== targetFlag.pos.roomName) {
            creep.say('🗺️ Travel');
            creep.moveTo(targetFlag, {
                visualizePathStyle: {
                    stroke: '#ff00ff'
                },
                reusePath: 50
            });
            return;
        }

        // 3. Ο creep είναι στο δωμάτιο στόχο - Διεκδίκηση
        const controller = creep.room.controller;

        if (controller) {
            
            // Πρώτη προσπάθεια: CLAIM
            const claimResult = creep.claimController(controller);
            
            if (claimResult === ERR_NOT_IN_RANGE) {
                // Κινούμαστε προς τον Controller
                creep.say('🎯 Move');
                creep.moveTo(controller, {
                    visualizePathStyle: {
                        stroke: '#00ccff'
                    },
                    reusePath: 50
                });
            } else if (claimResult === ERR_GCL_NOT_ENOUGH) {
                // Αν δεν έχουμε αρκετό GCL, κάνουμε RESERVE
                creep.say('🔐 Reserve');
                const reserveResult = creep.reserveController(controller);
                
                if (reserveResult === ERR_NOT_IN_RANGE) {
                    // Κινούμαστε προς τον Controller για Reserve
                    creep.moveTo(controller, {
                        visualizePathStyle: {
                            stroke: '#ffff00'
                        },
                        reusePath: 50
                    });
                } else if (reserveResult === OK) {
                    // Επιτυχής Reserve
                    creep.say('Reserved');
                } else {
                    // Άλλο σφάλμα στο Reserve (π.χ. είναι ήδη δικό μας)
                    creep.say('ResErr: ' + reserveResult);
                }

            } else if (claimResult === OK) {
                // Επιτυχής CLAIM!
                creep.say('🎉 Claimed!');
                creep.memory.role="simpleHarvester";
                // Προσοχή: Εφόσον το claim είναι επιτυχημένο, θα χρειαστείτε κώδικα για να χτίσετε το spawn!
            } else {
                // Άλλο σφάλμα στο Claim (π.χ. είναι ήδη δικό μας ή του εχθρού)
                creep.say('ClmErr: ' + claimResult);
            }
        }
    }
};

module.exports = roleClaimer;
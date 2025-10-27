/**
 * MASTER_BLUEPRINT_SORTED_SPAWN_ANCHOR: Ολοκληρωμένο σχέδιο βάσης RCL 8.
 * Ταξινομημένο κατά RCL Level (1-8).
 * Η Άγκυρα είναι το STRUCTURE_SPAWN (το πρώτο που χτίζεται) στη θέση (0, 0).
 */
const MASTER_BLUEPRINT_SPAWN_ANCHOR = [
    // ------------------------------------------------------------------
    // RCL 1: 1 Spawn
    // ------------------------------------------------------------------
    { rcl: 1, offsetX: 0, offsetY: 0, structureType: STRUCTURE_SPAWN }, // Η Άγκυρα

    // ------------------------------------------------------------------
    // RCL 2: 5 Extensions
    // ------------------------------------------------------------------
    { rcl: 2, offsetX: 0, offsetY: 2, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 2, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 0, offsetY: -2, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: -2, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 1, offsetY: 1, structureType: STRUCTURE_EXTENSION },

    // ------------------------------------------------------------------
    // RCL 3: 5 Extensions, 1 Tower, Roads
    // ------------------------------------------------------------------
    { rcl: 3, offsetX: 5, offsetY: 0, structureType: STRUCTURE_TOWER }, // 1ος Tower (Λίγο μακριά για κάλυψη)
    
    // Extensions (5/10)
    { rcl: 3, offsetX: 3, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 3, offsetX: 4, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 3, offsetX: 3, offsetY: -1, structureType: STRUCTURE_EXTENSION },
    { rcl: 3, offsetX: 4, offsetY: -1, structureType: STRUCTURE_EXTENSION },
    { rcl: 3, offsetX: 5, offsetY: 1, structureType: STRUCTURE_EXTENSION },

    // Roads (Δείγμα σύνδεσης Extensions/Core)
    { rcl: 3, offsetX: 0, offsetY: 1, structureType: STRUCTURE_ROAD },
    { rcl: 3, offsetX: 1, offsetY: 0, structureType: STRUCTURE_ROAD },
    { rcl: 3, offsetX: 1, offsetY: 2, structureType: STRUCTURE_ROAD },
    { rcl: 3, offsetX: 2, offsetY: 1, structureType: STRUCTURE_ROAD },
    { rcl: 3, offsetX: 3, offsetY: 0, structureType: STRUCTURE_ROAD },
    // ... (Περισσότεροι δρόμοι RCL 3) ...

    // ------------------------------------------------------------------
    // RCL 4: 1 Storage, 10 Extensions
    // ------------------------------------------------------------------
    { rcl: 4, offsetX: -1, offsetY: -1, structureType: STRUCTURE_STORAGE }, // Storage: Κοντά στο Spawn για τροφοδοσία
    
    // Extensions (10/20)
    { rcl: 4, offsetX: 6, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: 6, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: 6, offsetY: -1, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: 5, offsetY: -1, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: 5, offsetY: -2, structureType: STRUCTURE_EXTENSION },

    { rcl: 4, offsetX: -3, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: -3, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: -4, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: -4, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 4, offsetX: -4, offsetY: 2, structureType: STRUCTURE_EXTENSION },

    // ------------------------------------------------------------------
    // RCL 5: 1 Link, 1 Tower, 10 Extensions
    // ------------------------------------------------------------------
    { rcl: 5, offsetX: 0, offsetY: -1, structureType: STRUCTURE_LINK }, // Fast Filler Link (δίπλα στο Spawn)
    { rcl: 5, offsetX: -5, offsetY: 0, structureType: STRUCTURE_TOWER }, // 2ος Tower
    
    // Extensions (10/30)
    { rcl: 5, offsetX: 7, offsetY: 0, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: 7, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: 7, offsetY: 2, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: 7, offsetY: -1, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: 7, offsetY: -2, structureType: STRUCTURE_EXTENSION },

    { rcl: 5, offsetX: -5, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: -5, offsetY: 2, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: -5, offsetY: 3, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: -6, offsetY: 1, structureType: STRUCTURE_EXTENSION },
    { rcl: 5, offsetX: -6, offsetY: 2, structureType: STRUCTURE_EXTENSION },

    // ------------------------------------------------------------------
    // RCL 6: 1 Terminal, 1 Link, 1 Tower, 5 Labs, 10 Extensions
    // ------------------------------------------------------------------
    { rcl: 6, offsetX: -2, offsetY: -1, structureType: STRUCTURE_TERMINAL }, // Δίπλα στο Storage
    { rcl: 6, offsetX: -2, offsetY: 0, structureType: STRUCTURE_LINK }, // Terminal Link
    { rcl: 6, offsetX: 0, offsetY: 5, structureType: STRUCTURE_TOWER }, // 3ος Tower
    
    // Labs (5/10) - Στο Lab Cluster (π.χ. anchor Lab στο (4, 4) σχετικό με το Spawn)
    { rcl: 6, offsetX: 4, offsetY: 4, structureType: STRUCTURE_LAB },
    { rcl: 6, offsetX: 5, offsetY: 4, structureType: STRUCTURE_LAB },
    { rcl: 6, offsetX: 4, offsetY: 5, structureType: STRUCTURE_LAB },
    { rcl: 6, offsetX: 5, offsetY: 5, structureType: STRUCTURE_LAB },
    { rcl: 6, offsetX: 3, offsetY: 4, structureType: STRUCTURE_LAB },
    
    // Extensions (10/40)
    // ...

    // ------------------------------------------------------------------
    // RCL 7: 1 Spawn, 1 Factory, 1 Link, 5 Labs, 1 Tower, 10 Extensions
    // ------------------------------------------------------------------
    { rcl: 7, offsetX: 1, offsetY: -1, structureType: STRUCTURE_SPAWN }, // 2ο Spawn (Κοντά στο Core)
    { rcl: 7, offsetX: -1, offsetY: -2, structureType: STRUCTURE_FACTORY }, // Δίπλα στο Storage/Terminal
    { rcl: 7, offsetX: 2, offsetY: -2, structureType: STRUCTURE_LINK }, // Upgrader Link (πιο μακριά)
    { rcl: 7, offsetX: 0, offsetY: -5, structureType: STRUCTURE_TOWER }, // 4ος Tower

    // Labs (3/10)
    { rcl: 7, offsetX: 6, offsetY: 4, structureType: STRUCTURE_LAB },
    { rcl: 7, offsetX: 3, offsetY: 5, structureType: STRUCTURE_LAB },
    { rcl: 7, offsetX: 6, offsetY: 5, structureType: STRUCTURE_LAB },
    
    // Extensions (10/50)
    // ...

    // ------------------------------------------------------------------
    // RCL 8: 1 Spawn, Power Spawn, Nuker, Observer, 2 Towers, 10 Extensions, 2 Labs
    // ------------------------------------------------------------------
    { rcl: 8, offsetX: -1, offsetY: 1, structureType: STRUCTURE_SPAWN }, // 3ο Spawn
    { rcl: 8, offsetX: 2, offsetY: 2, structureType: STRUCTURE_POWER_SPAWN },
    { rcl: 8, offsetX: 0, offsetY: 3, structureType: STRUCTURE_OBSERVER },
    { rcl: 8, offsetX: -4, offsetY: -4, structureType: STRUCTURE_NUKER },
    
    { rcl: 8, offsetX: 8, offsetY: 8, structureType: STRUCTURE_TOWER }, // 5ος Tower
    { rcl: 8, offsetX: -8, offsetY: -8, structureType: STRUCTURE_TOWER }, // 6ος Tower
    
    // Labs (2/10)
    { rcl: 8, offsetX: 4, offsetY: 3, structureType: STRUCTURE_LAB },
    { rcl: 8, offsetX: 5, offsetY: 3, structureType: STRUCTURE_LAB },
    
    // Extensions (10/60)
    // ...
];


/**
 * Βοηθητική συνάρτηση: Μετράει τις υπάρχουσες δομές ΚΑΙ τα Construction Sites 
 * ενός συγκεκριμένου τύπου στο δωμάτιο.
 * @param {Room} room Το αντικείμενο του δωματίου.
 * @param {string} structureType Ο τύπος της δομής.
 * @returns {number} Ο συνολικός αριθμός (Structures + Construction Sites).
 * * ΣΗΜΕΙΩΣΗ: ΑΥΤΗ Η ΣΥΝΑΡΤΗΣΗ ΕΛΕΙΠΕ ΚΑΙ ΠΡΟΚΑΛΟΥΣΕ ΤΟ ΠΡΩΤΟ ΣΦΑΛΜΑ!
 */
function countStructuresAndSites(room, structureType) {
    const structures = room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: structureType }
    }).length;
    
    const sites = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: structureType }
    }).length;
    
    return structures + sites;
}
const MAX_CONSTRUCTION_SITE=10;
var roomPlanner={
    
    run:function(roomName){ 
    
        const room=Game.rooms[roomName];
        // Πάντα προσπαθεί να αρχικοποιήσει (αλλά τρέχει μόνο μία φορά)
        if(!room) {
            console.log("Δε βρέθηκε το dωμάτιο "+roomName);
            return;
        }
      
        // 2. Οπτικοποίηση (σε κάθε tick)
        //this.visualizeBlueprint(room);
        if(Game.time%100!=0) {
                  // 1. Εξοικονόμηση CPU: Τρέχουμε τον planner μόνο κάθε 100 ticks.
            return;
        }
        this.lookForNewConstructionSite(room);
        this.lookForDefenceConstuctionSite(room);
        
    },
    lookForDefenceConstuctionSite:function(room) {
      return;  
    },
    lookForNewConstructionSite:function(room) {
        // Βρίσκουμε το κεντρικό Spawn. Αυτό είναι το σημείο αναφοράς (άγκυρα).
         const spawn = room.find(FIND_MY_SPAWNS)[0];

        if (!spawn) {
           console.log("Δεν βρέθηκε Spawn στο δωμάτιο.");
            return;
        }
    
        const totalConstructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        if (totalConstructionSites >= MAX_CONSTRUCTION_SITE) {
             // Το όριο των 10 είναι το μέγιστο που μπορείτε να έχετε ανά δωμάτιο.
             return; 
        }
        
        if(room.controller.level===2) {
            var x=1;
            for (let x=0 ; x<MASTER_BLUEPRINT_SPAWN_ANCHOR.length ; x++ )  {
                const site=MASTER_BLUEPRINT_SPAWN_ANCHOR[x];
                if(site.rcl!=2) {
                    return;
                }
                const targetX=spawn.pos.x+site.offsetX;
                const targetY=spawn.pos.y+site.offsetY;
                const existingStructures = room.lookAt(targetX, targetY);
                const isOccupied = existingStructures.some(item => 
                    item.structure || 
                    item.constructionSite || 
                    (item.terrain && item.terrain === 'wall')
                );
                
                const structureType=site.structureType;
                this.createNewConstructionSite(room,targetX,targetY,structureType);
                return;
                
            }
             
        }
    },
    initializeBlueprint : function(room) {
    // 1. Έλεγχος: Αν το Blueprint υπάρχει, σταματάμε.
    if (Memory.rooms[room.name].blueprint) {
        return; 
    }

    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
        console.log("Δεν βρέθηκε Spawn για να οριστεί Άγκυρα.");
        return; 
    }
    
    const anchorX = spawn.pos.x;
    const anchorY = spawn.pos.y;
    
    const blueprint = [];
    
    // 2. Υπολογισμός Απόλυτων Θέσεων
    MASTER_BLUEPRINT_SPAWN_ANCHOR.forEach(item => {
        blueprint.push({
            x: anchorX + item.offsetX,
            y: anchorY + item.offsetY,
            type: item.structureType,
            rcl: item.rcl // Κρατάμε το RCL για έλεγχο
        });
    });

    // 3. Αποθήκευση
    Memory.rooms[room.name].blueprint = blueprint;
    console.log(`[Planner] Blueprint δημιουργήθηκε για το ${room.name}.`);
},
    /**
     * Δημιουργεί Construction Site σε συγκεκριμένες συντεταγμένες.
     * @param {Room} room - Το αντικείμενο του δωματίου.
     * @param {number} x - Συντεταγμένη X.
     * @param {number} y - Συντεταγμένη Y.
     * @param {string} type - Ο τύπος της δομής.
     */
    createNewConstructionSite: function(room, x, y, structureT) {
        
        // Έλεγχος 1: Υπάρχει ήδη Construction Site ή δομή σε αυτή τη θέση;
        const existingStructures = room.lookAt(x, y);
        const isOccupied = existingStructures.some(item => 
            item.structure || 
            item.constructionSite || 
            (item.terrain && item.terrain === 'wall')
        );

        if (isOccupied) {
            // Μπορεί να αγνοήσουμε αυτό το κελί αν είναι κατειλημμένο
            return ERR_FULL;
        }
        
        // Δίνουμε την εντολή για τη δημιουργία του ConstructionSite
        const result = room.createConstructionSite(x, y, structureT);

        if (result === OK) {
            console.log(`[Planner] Το Construction Site για ${structureT} δημιουργήθηκε επιτυχώς στις (${x}, ${y}).`);
        } else {
            console.log(`[Planner] Αποτυχία δημιουργίας Construction Site. Κωδικός: ${result} (ίσως λόγω ERR_RCL_NOT_ENOUGH ή ERR_INVALID_TARGET).`);
        }
        return result;
    }

};
// Χρωματικοί κώδικες για τις δομές
const STRUCTURE_COLORS = {
    [STRUCTURE_SPAWN]: '#00ff00',      // Πράσινο
    [STRUCTURE_EXTENSION]: '#00ffff',  // Κυανό
    [STRUCTURE_TOWER]: '#ff0000',      // Κόκκινο
    [STRUCTURE_STORAGE]: '#ffff00',    // Κίτρινο
    [STRUCTURE_ROAD]: '#555555',       // Γκρι
    [STRUCTURE_RAMPART]: '#0000ff',    // Μπλε
    [STRUCTURE_TERMINAL]: '#ff8800',   // Πορτοκαλί
    // ... Προσθέστε κι άλλα κτίρια όπως Link, Nuker, κλπ.
};

roomPlanner.visualizeBlueprint = function(room) {
    // 1. Έλεγχος αν υπάρχει το Blueprint στο Memory
    const blueprint = Memory.rooms[room.name].blueprint;
    if (!blueprint) {
        return; 
    }
    
    // Δημιουργία ενός νέου αντικειμένου RoomVisual
    const visual = new RoomVisual(room.name);
    
    // 2. Loop στο Blueprint και σχεδίαση κάθε κτιρίου
    blueprint.forEach(item => {
        const color = STRUCTURE_COLORS[item.type] || '#ffffff';
        const rcl = room.controller.level;
        
        // Σχεδιάζουμε μόνο τα κτίρια που έχουν ξεκλειδωθεί (για να δείχνουμε την πρόοδο)
        if (true || rcl >= item.rcl) {
            
            // Σχεδιάζουμε έναν κύκλο στο κέντρο της θέσης του κτιρίου
            visual.circle(item.x, item.y, {
                radius: 0.45, // Μέγεθος
                fill: color,
                opacity: 0.7,
                stroke: 'transparent'
            });

            // Εναλλακτικά, μπορούμε να χρησιμοποιήσουμε τετράγωνο:
            /*
            visual.rect(item.x - 0.45, item.y - 0.45, 0.9, 0.9, {
                fill: color,
                opacity: 0.5,
                stroke: 'transparent'
            });
            */
            
            // Προαιρετικό: Βάζουμε κείμενο για το RCL αν είναι σημαντικό κτίριο
            if (item.type === STRUCTURE_TOWER || item.type === STRUCTURE_STORAGE) {
                 visual.text(item.type.charAt(0) + item.rcl, item.x, item.y + 0.2, { 
                     color: '#000000', 
                     font: 0.4 
                 });
            }
        }
    });
};
module.exports = roomPlanner;
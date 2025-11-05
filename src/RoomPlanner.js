/**
 * MASTER_BLUEPRINT_SORTED_SPAWN_ANCHOR: Ολοκληρωμένο σχέδιο βάσης RCL 8.
 * Ταξινομημένο κατά RCL Level (1-8).
 * Η Άγκυρα είναι το STRUCTURE_SPAWN (το πρώτο που χτίζεται) στη θέση (0, 0).
 */
const MASTER_BLUEPRINT_SPAWN_ANCHOR = {"Ε25S7":
[
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
  //  { rcl: 5, offsetX: -5, offsetY: 0, structureType: STRUCTURE_TOWER }, // 2ος Tower
    // TODO να τοποθετηθει κοντα ή αναμεσα σγα δυο source
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
    { rcl: 6, offsetX: 14, offsetY: 2, structureType: STRUCTURE_TOWER }, // 3ος Tower
    
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
    //{ rcl: 8, offsetX: -4, offsetY: -4, structureType: STRUCTURE_NUKER },
    { rcl: 8, offsetX: -4, offsetY: -2, structureType: STRUCTURE_NUKER },
    { rcl: 8, offsetX: 8, offsetY: -2, structureType: STRUCTURE_TOWER }, // 5ος Tower
    { rcl: 8, offsetX: 0, offsetY: 5, structureType: STRUCTURE_TOWER }, // 6ος Tower
    { rcl: 8, offsetX: 14, offsetY: 3, structureType: STRUCTURE_TOWER }, // 6ος Tower
    // Labs (2/10)
    { rcl: 8, offsetX: 4, offsetY: 3, structureType: STRUCTURE_LAB },
    { rcl: 8, offsetX: 5, offsetY: 3, structureType: STRUCTURE_LAB },
    
    // Extensions (10/60)
    // ...
    ],
    "E25S8":
    [
    // ------------------------------------------------------------------
    // RCL 1: 1 Spawn
    // ------------------------------------------------------------------
    { rcl: 1, offsetX: 0, offsetY: 0, structureType: STRUCTURE_SPAWN }, // Η Άγκυρα

    // ------------------------------------------------------------------
    // RCL 2: 5 Extensions
    // ------------------------------------------------------------------
    { rcl: 2, offsetX: 24, offsetY: 22, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 24, offsetY: 21, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 25, offsetY: 21, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 25, offsetY: 20, structureType: STRUCTURE_EXTENSION },
    { rcl: 2, offsetX: 26, offsetY: 20, structureType: STRUCTURE_EXTENSION },

    // ------------------------------------------------------------------
    // RCL 3: 5 Extensions, 1 Tower, Roads
    // ------------------------------------------------------------------
    //{ rcl: 3, offsetX: 5, offsetY: 0, structureType: STRUCTURE_TOWER }, // 1ος Tower (Λίγο μακριά για κάλυψη)
    
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
    { rcl: 4, offsetX: 7, offsetY: 16, structureType: STRUCTURE_STORAGE }, // Storage: Κοντά στο Spawn για τροφοδοσία
    
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
  //  { rcl: 5, offsetX: -5, offsetY: 0, structureType: STRUCTURE_TOWER }, // 2ος Tower
    // TODO να τοποθετηθει κοντα ή αναμεσα σγα δυο source
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
    { rcl: 6, offsetX: 14, offsetY: 2, structureType: STRUCTURE_TOWER }, // 3ος Tower
    
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
    //{ rcl: 8, offsetX: -4, offsetY: -4, structureType: STRUCTURE_NUKER },
    { rcl: 8, offsetX: -4, offsetY: -2, structureType: STRUCTURE_NUKER },
    { rcl: 8, offsetX: 8, offsetY: -2, structureType: STRUCTURE_TOWER }, // 5ος Tower
    { rcl: 8, offsetX: 0, offsetY: 5, structureType: STRUCTURE_TOWER }, // 6ος Tower
    { rcl: 8, offsetX: 14, offsetY: 3, structureType: STRUCTURE_TOWER }, // 6ος Tower
    // Labs (2/10)
    { rcl: 8, offsetX: 4, offsetY: 3, structureType: STRUCTURE_LAB },
    { rcl: 8, offsetX: 5, offsetY: 3, structureType: STRUCTURE_LAB },
    
    // Extensions (10/60)
    // ...
    ]
    };


/**
 * Βοηθητική συνάρτηση: Μετράει τις υπάρχουσες δομές ΚΑΙ τα Construction Sites 
 * ενός συγκεκριμένου τύπου στο δωμάτιο.
 * @param {Room} room Το αντικείμενο του δωματίου.
 * @param {string} structureType Ο τύπος της δομής.
 * @returns {number} Ο συνολικός αριθμός (Structures + Construction Sites).
 * 
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
const MAX_CONSTRUCTION_SITE=1;
var roomPlanner={
    
    run:function(roomName){ 
    
        if(Game.time%100!=0) {
                  // 1. Εξοικονόμηση CPU: Τρέχουμε τον planner μόνο κάθε 100 ticks.
            return;
        }
        
        const room=Game.rooms[roomName];
         if(roomName==="E25S8") {
            // this.initializeBlueprint(room,false);
            // this.visualizeBlueprint(room);
            return;
         }
         
        // Πάντα προσπαθεί να αρχικοποιήσει (αλλά τρέχει μόνο μία φορά)
        if(!room) {
            console.log("Δε βρέθηκε το dωμάτιο "+roomName);
            return;
        }
        
        
        // 2. Οπτικοποίηση (σε κάθε tick)
        this.lookForNewConstructionSite(room);
        this.lookForDefenceConstuctionSite(room);
    },
    lookForDefenceConstuctionSite:function(room) {
      return;  
    },
    getAnchor:function () {
        const flag=Game.flags['centerFlag'];
        if(!flag){
            return {x:55/2,y:55/2};
        }
        const anchorX = flag.pos.x;//spawn.pos.x;
        const anchorY = flag.pos.y; //spawn.pos.y;
        return {x:anchorX,y:anchorY};
    },
    lookForNewConstructionSite:function(room) {
        const blueprint = Memory.rooms[room.name].blueprint;
        const currentRCL = room.controller.level;
        //console.log(currentRCL);
        // 1. Έλεγχος Ορίων Construction Sites
        const totalConstructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        
        if (totalConstructionSites >= MAX_CONSTRUCTION_SITE) {
            return; // Έχουμε φτάσει το μέγιστο όριο.
        }
    
        if (!blueprint) {
            console.log(`[Planner] Δε βρέθηκε Blueprint στο Memory για το ${room.name}.`);
            return;
        }

        // 2. Εύρεση του Επόμενου Site
        for (let i = 0; i < blueprint.length; i++) {
            const site = blueprint[i];
            
            // α) Έλεγχος RCL: Κατασκευάζουμε μόνο ό,τι έχει ξεκλειδωθεί
            if (currentRCL < site.rcl) {
                // Επειδή το MASTER_BLUEPRINT_SPAWN_ANCHOR είναι ταξινομημένο,
                // μπορούμε να σταματήσουμε εδώ για βελτιστοποίηση.
                break; 
            }
            
            // β) Έλεγχος Μέγιστου Αριθμού: Ελέγχουμε αν έχουμε ήδη τον μέγιστο αριθμό (Structures + Sites)
            const maxStructuresForRCL = CONTROLLER_STRUCTURES[site.type][currentRCL];
            const currentCount = countStructuresAndSites(room, site.type);
            
            // Αν ο αριθμός των δομών είναι ίσος ή μεγαλύτερος από το όριο του RCL, το παραβλέπουμε.
            if (currentCount >= maxStructuresForRCL) {
                 continue;
            }

            // γ) Έλεγχος Θέσης: Δημιουργία Construction Site
            const targetX = site.x;
            const targetY = site.y;
            const structureType = site.type;
            
            // Δημιουργία του site. Η createNewConstructionSite() θα κάνει τους τελικούς ελέγχους (wall/occupied)
            const result = this.createNewConstructionSite(room, targetX, targetY, structureType);

            // Αν η δημιουργία ήταν επιτυχής (OK) ή απέτυχε λόγω πληρότητας (ERR_FULL, κλπ.),
            // σταματάμε εδώ για να μη δημιουργήσουμε πάνω από ένα site ανά tick
            // (ή για να σεβαστούμε το όριο των 10).
            if (result === OK) {
                // Σταματάμε μετά τη δημιουργία ενός site για να επιτρέψουμε στους builders να ξεκινήσουν.
                return; 
            }
        }
    },
    initializeBlueprint : function(room,reRun=true) {
    // 1. Έλεγχος: Αν το Blueprint υπάρχει, σταματάμε.
    if (reRun===false && Memory.rooms[room.name].blueprint) {
       return; 
    }
    
    console.log("HE");
    const anchorX = this.getAnchor().x;
    const anchorY = this.getAnchor().y;
    if(anchorX<=0 ) {
        console.log("δεν υπάρχει άγκιστρο για τη δημιουργια του blueprint. Χρειάζεται να μπει σημαία με όνομα \"centerFlag");
    }
    const blueprint = [];
        
    // 2. Υπολογισμός Απόλυτων Θέσεων
    MASTER_BLUEPRINT_SPAWN_ANCHOR[room.name].forEach(item => {
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
        const rcl = room.controller.level+10;
        
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
},

roomPlanner.exportRoomLayout=function(room) {
    // Εξασφαλίζουμε ότι έχουμε ορατότητα στο δωμάτιο
    
    if (!room) {
        return `Δεν υπάρχει ορατότητα στο δωμάτιο ${roomName}.`;
    }

    const roomData = [];

    // 1. Συλλογή μόνιμων αντικειμένων (Sources, Controller, Mineral)
    const permanentObjects = room.find(FIND_SOURCES).map(s => ({
        structureType: "SOURCE",
        x: s.pos.x,
        y: s.pos.y
    }));
    roomData.push(...permanentObjects);

    const controller = room.controller;
    if (controller) {
        roomData.push({
            structureType: "CONTROLLER",
            x: controller.pos.x,
            y: controller.pos.y
        });
    }

    const mineral = room.find(FIND_MINERALS)[0];
    if (mineral) {
        roomData.push({
            structureType: "MINERAL",
            x: mineral.pos.x,
            y: mineral.pos.y,
            resourceType: mineral.mineralType // Προαιρετικό, αλλά χρήσιμο
        });
    }

    // 2. Συλλογή δεδομένων εδάφους (Walls, Swamps)
    // Χρησιμοποιούμε το lookForAtArea για να πάρουμε όλο το terrain 50x50
    const terrain = room.lookForAtArea(LOOK_TERRAIN, 0, 0, 49, 49, true);

    for (const tile of terrain) {
        // Οι φυσικοί τοίχοι (Walls) και οι βάλτοι (Swamps) πρέπει να προστεθούν
        if (tile.terrain === 'wall' || tile.terrain === 'swamp') {
            // Τα SOURCES/CONTROLLERS/MINERALS βρίσκονται ήδη σε tiles τύπου 'wall',
            // αλλά ο planner πρέπει να ξέρει τη θέση τους ξεχωριστά.
            // Για το απλό Import αρκεί μόνο το terrain.
            
            // Για το Screeps Room Planner, πολλές φορές, το μόνο που χρειάζεται να περάσεις
            // είναι τα μόνιμα αντικείμενα (όπως παραπάνω), καθώς ο planner
            // έχει τη δυνατότητα να φορτώσει το terrain του δωματίου από το API
            // του Screeps. Ωστόσο, για να είμαστε σίγουροι ότι όλα είναι εκεί:

            if (tile.terrain === 'wall') {
                // Προσθήκη τοίχων (εκτός από εκεί που ήδη έχουμε μόνιμα αντικείμενα)
                const isPermanentObjectTile = roomData.some(obj => obj.x === tile.x && obj.y === tile.y);
                if (!isPermanentObjectTile) {
                    roomData.push({
                        structureType: "NATURAL_WALL", // ή απλά STRUCTURE_WALL
                        x: tile.x,
                        y: tile.y
                    });
                }
            } else if (tile.terrain === 'swamp') {
                // Οι βάλτοι συνήθως δεν χρειάζονται στον JSON, αλλά βοηθάει για πλήρη εικόνα
                // Πολλοί planners τους αγνοούν, αλλά ας τους κρατήσουμε στη μνήμη
                // για ενδεχόμενη χρήση.
                // Αν ο planner υποστηρίζει custom terrain, θα χρειαζόταν διαφορετική μορφή.
            }
        }
    }

    // Τελική μορφοποίηση JSON για αντιγραφή
    return JSON.stringify(roomData, null, 2);
} // end of exportRoomLayout

module.exports = roomPlanner;
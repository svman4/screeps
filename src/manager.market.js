const INTERVALS = {
    // Κάθε πόσους ticks θα εκτελείται η λογική της αγοράς (π.χ., κάθε 100 ticks)
    RUN: 100 
};
const STORE_LIMITS = {
    // Το ποσοστό πληρότητας του Storage (αποθήκη) που πρέπει να ξεπερνάει η ενέργεια
    // για να θεωρηθεί διαθέσιμη προς πώληση (π.χ. > 60% πλήρες)
    STORAGE: 0.6, 
    // Το ποσοστό πληρότητας του Terminal που πρέπει να ξεπερνάει η ενέργεια
    // για να θεωρηθεί διαθέσιμη προς πώληση
    TERMINAL: 0.5 
};

const market = {
    /**
     * Η κύρια λειτουργία που ελέγχει τις προϋποθέσεις και εκκινεί την πώληση.
     * @param {string} roomName Το όνομα του δωματίου για διαχείριση.
     */
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return; // Έλεγχος αν το δωμάτιο υπάρχει (αν το έχουμε claimάρει).
        
        // Ανεξάρτητα από το σχόλιο στον αρχικό κώδικα, η αγορά είναι κρίσιμη, 
        // οπότε η εκτέλεση κάθε tick είναι συνήθως ασφαλής.
        if (Game.time % INTERVALS.RUN !== 0) return; 

        // Έλεγχος αν υπάρχουν τα απαραίτητα κτίρια (Storage και Terminal).
        if ((room.storage && room.terminal) === false) { 
            return;
        }

        // --- 1. Έλεγχος Αποθεμάτων Storage ---
        const storageCapacity = room.storage.store.getCapacity();
        const energyAmount = room.storage.store.getUsedCapacity(RESOURCE_ENERGY); // Προσθήκη RESOURCE_ENERGY για ακρίβεια
        
        // Αν η ενέργεια είναι κάτω από το 60% της συνολικής χωρητικότητας του Storage,
        // θεωρούμε ότι δεν υπάρχει πλεόνασμα για πώληση.
        if (energyAmount < STORE_LIMITS.STORAGE * storageCapacity) { 
            //console.log(roomName+" Το storage δεν έχει αρκετή διαθέσιμη ενέργεια " +energyAmount );
            return; 
        }

        // --- 2. Έλεγχος Αποθεμάτων Terminal ---
        const terminalEnergy = room.terminal.store.getUsedCapacity(RESOURCE_ENERGY); // Ποσότητα Energy στο Terminal
        const terminalTotalCapacity = room.terminal.store.getCapacity(); // Συνολική χωρητικότητα Terminal

        // Αν η ενέργεια στο Terminal είναι κάτω από το 60% της συνολικής χωρητικότητας, 
        // θεωρούμε ότι δεν υπάρχει πλεόνασμα για πώληση (ή ότι πρέπει να το γεμίσει πρώτα).
        if (terminalEnergy < (STORE_LIMITS.TERMINAL * terminalTotalCapacity)) {
            //console.log(roomName + " To terminal δεν έχει αρκετή διαθέσιμη ενέργεια " +terminalEnergy);
            return; 
        }

        // console.log(roomName + " gotoMArket");
        
        // Αν οι έλεγχοι αποθεμάτων περάσουν, εκκινούμε την αναζήτηση πώλησης.
        // Πουλάμε το μισό της ενέργειας που υπάρχει στο Terminal.
        this.searchAndSellEnergy(roomName, terminalEnergy / 2);
    },

    /**
     * Αναζητά την καλύτερη παραγγελία αγοράς ενέργειας και εκτελεί την πώληση (deal).
     * @param {string} roomName Το όνομα του δωματίου όπου βρίσκεται το Terminal.
     * @param {number} sellAmount Η ποσότητα ενέργειας που θέλουμε να πουλήσουμε (max).
     * @param {number} minPrice Η ελάχιστη αποδεκτή τιμή (π.χ., 0.005 credits).
     */
    searchAndSellEnergy(roomName, sellAmount, minPrice = 0.005) {
        console.log(`--- Αναζήτηση αγοραστών Energy για ${roomName} ---`);

        const terminal = Game.rooms[roomName] && Game.rooms[roomName].terminal;
        // Το terminal είναι ήδη ελεγμένο στο run, αλλά το αφήνουμε για ασφάλεια.

        // --- 2. Αναζήτηση Παραγγελιών Αγοράς (ORDER_BUY) ---
        const buyOrders = Game.market.getAllOrders(order => 
            order.resourceType === RESOURCE_ENERGY &&
            order.type === ORDER_BUY &&
            order.price >= minPrice // Φιλτράρισμα βάσει ελάχιστης αποδεκτής τιμής
        );

        if (buyOrders.length === 0) {
            console.log(`❌ Δεν βρέθηκαν παραγγελίες Buy πάνω από ${minPrice} credits.`);
            return;
        }

        // --- 3. Ταξινόμηση (Sort) βάσει Τιμής (Price - φθίνουσα) ---
        // Αυτό μας δίνει την πιο ακριβή παραγγελία στην αρχή του πίνακα.
        buyOrders.sort((a, b) => b.price - a.price);
        
        // --- 4. Εύρεση της Καλύτερης/Πιο Αποδοτικής Παραγγελίας ---
        // (Λαμβάνοντας υπόψη το κόστος μεταφοράς)
        let bestOrder = null;
        let maxProfit = 0;

        for (const order of buyOrders) {
            // Ποσότητα προς πώληση: το μικρότερο μεταξύ του τι θέλουμε να πουλήσουμε (sellAmount)
            // και του τι ζητάει ο αγοραστής (order.remainingAmount).
            const amountToSell = Math.min(sellAmount, order.remainingAmount);

            // Υπολογισμός Κόστους Μεταφοράς (Energy cost)
            // Αυτό το κόστος αφαιρείται από το Terminal μας.
            const transactionCost = Game.market.calcTransactionCost(amountToSell, roomName, order.roomName);

            // Έλεγχος αν το Terminal έχει αρκετή ενέργεια για την ποσότητα ΠΡΟΣ ΠΩΛΗΣΗ + το ΚΟΣΤΟΣ ΜΕΤΑΦΟΡΑΣ.
            if (terminal.store.energy < transactionCost + amountToSell) {
                 // Η ενέργεια που έχουμε δεν επαρκεί για αυτήν τη συναλλαγή. Προχωράμε στην επόμενη παραγγελία.
                 continue; 
            }

            // Υπολογισμός Καθαρού Κέρδους (Credits)
            const potentialProfit = amountToSell * order.price;

            // Εύρεση της παραγγελίας που μας δίνει το μεγαλύτερο κέρδος.
            if (potentialProfit > maxProfit) {
                maxProfit = potentialProfit;
                bestOrder = order;
                // Αποθηκεύουμε τις παραμέτρους για την εκτέλεση:
                bestOrder.amountToDeal = amountToSell; 
                bestOrder.cost = transactionCost;
            }
        }

        // --- 5. Εκτέλεση της Συναλλαγής (Deal) ---
        if (bestOrder) {
            const result = Game.market.deal(
                bestOrder.id, // ID της παραγγελίας
                bestOrder.amountToDeal, // Ποσότητα που πουλάμε
                roomName // Το Terminal μας
            );

            if (result === OK) {
                // 1. Λάβε το τρέχον υπόλοιπο credits.
            const currentCredits = Game.market.credits.toFixed(3); 
            
            // 2. Δημιουργία του μηνύματος με όλες τις πληροφορίες.
            const successMsg = 
                `ΠΩΛΗΣΗ ΕΝΕΡΓΕΙΑΣ στο ${roomName}: ` +
                `Ποσότητα: ${bestOrder.amountToDeal} μονάδες. ` +
                `Κέρδος: ${maxProfit.toFixed(3)} credits. ` +
                `ΣΥΝΟΛΙΚΑ CREDITS: ${currentCredits}.`;

            // 3. Αποστολή ειδοποίησης (groupInterval: 10 ticks).
            console.log(successMsg);
            Game.notify(successMsg, 10);
            } else {
               // console.log(`❌ Αποτυχία πώλησης (ID: ${bestOrder.id}). Αποτέλεσμα: ${result}`);
            }
        } else {
            //console.log(`⚠️ Δεν βρέθηκε παραγγελία που να μεγιστοποιεί το κέρδος, λαμβάνοντας υπόψη το κόστος μεταφοράς.`);
        }
    }
};

module.exports = market;
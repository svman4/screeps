const INTERVALS = {
    RUN: 100 // Κάθε πόσους ticks θα εκτελείται
};

const STORE_LIMITS = {
    STORAGE: 0.8, // Όριο πώλησης ενέργειας (Storage)
    TERMINAL: 0.5 // Όριο πώλησης ενέργειας (Terminal)
};

const POWER_CONFIG = {
    TARGET_AMOUNT: 3000,   // Στόχος: 3000 Power στο Terminal
    MAX_PRICE: 25.0,       // Μέγιστη τιμή ανά Power
    BATCH_SIZE: 500        // Αγορά ανά 500
};

const NUKER_CONFIG = {
    TARGET_AMOUNT: 5000,   // Στόχος: 5000 Ghodium (όσο χωράει ο Nuker + λίγο buffer)
    MAX_PRICE: 1.5,        // Μέγιστη τιμή ανά Ghodium (ΠΡΟΣΟΧΗ: Ρύθμισέ το ανάλογα την αγορά)
    BATCH_SIZE: 1000       // Αγορά ανά 1000
};

// Κοινό όριο ασφαλείας χρημάτων και για τα δύο
const GLOBAL_MIN_CREDITS = 50000; 

const market = {
    run: function(roomName) {
        if (Game.time % INTERVALS.RUN !== 0) return; 
        
        
        const room = Game.rooms[roomName];
        if (!room) return;
        
        if (!room.storage || !room.terminal) return;
        
        // 1. Πώληση Ενέργειας
        this.handleEnergySelling(room, roomName);
        this.handleMineralSelling(room,roomName);
        // 2. Αγορά Power (αν υπάρχει Power Spawn)
        this.handlePowerBuying(room, roomName);

        // 3. Αγορά Ghodium (αν υπάρχει Nuker)
        this.handleNukerBuying(room, roomName);
        
    },
    // --- Διαχείριση Πώλησης Minerals (Liquidation) ---
    handleMineralSelling: function(room, roomName) {
        const terminal = room.terminal;
        
        // Λίστα με RESOURCES που ΔΕΝ θέλουμε να πουλήσουμε
        // 1. ENERGY: Το καύσιμο για τις μεταφορές
        // 2. POWER: Το αγοράζουμε εμείς (βλ. handlePowerBuying)
        // 3. GHODIUM: Το αγοράζουμε εμείς (βλ. handleNukerBuying)
        const RESOURCES_TO_KEEP = [RESOURCE_ENERGY, RESOURCE_POWER, RESOURCE_GHODIUM];

        // Iteration σε όλα τα resources που έχει το terminal
        for (const resourceType in terminal.store) {
            
            // Αν είναι στη λίστα εξαίρεσης, προχώρα στο επόμενο
            if (RESOURCES_TO_KEEP.includes(resourceType)) continue;

            const amountInTerminal = terminal.store[resourceType];
            
            // Αν είναι άδειο ή πολύ λίγο (π.χ. < 100), ίσως δεν αξίζει το CPU, 
            // αλλά αφού θες "μηδενισμό" το αφήνουμε > 0
            if (amountInTerminal <= 0) continue;

            // 1. Βρες Αγοραστές
            const buyOrders = Game.market.getAllOrders(order => 
                order.resourceType === resourceType &&
                order.type === ORDER_BUY &&
                order.remainingAmount > 0
            );

            // Αν δεν υπάρχει κανείς να αγοράσει, προχώρα στο επόμενο resource
            if (buyOrders.length === 0) continue;

            // 2. Ταξινόμηση για την καλύτερη τιμή (High to Low)
            buyOrders.sort((a, b) => b.price - a.price);
            const bestOrder = buyOrders[0];

            // 3. Υπολογισμός Ποσότητας Deal
            // Ξεκινάμε με το ελάχιστο μεταξύ: του τι έχουμε εμείς VS τι θέλει ο αγοραστής
            let amountToDeal = Math.min(amountInTerminal, bestOrder.remainingAmount);

            // 4. Έλεγχος Κόστους Ενέργειας (Transaction Cost)
            const transactionCost = Game.market.calcTransactionCost(amountToDeal, roomName, bestOrder.roomName);
            const energyAvailable = terminal.store[RESOURCE_ENERGY];

            // Αν δεν φτάνει η ενέργεια, μειώνουμε την ποσότητα αποστολής
            if (transactionCost > energyAvailable) {
                // Τύπος: (EnergyAvailable / CostPerUnit)
                // Υπολογίζουμε κατά προσέγγιση το ratio κόστους
                const costRatio = transactionCost / amountToDeal;
                // Νέα ποσότητα = Διαθέσιμη Ενέργεια / Κόστος ανά μονάδα
                amountToDeal = Math.floor(energyAvailable / costRatio);
            }

            // Αν η ποσότητα κατέληξε 0 ή αρνητική, σταματάμε
            if (amountToDeal <= 0) continue;

            // 5. Εκτέλεση Deal
            const result = Game.market.deal(bestOrder.id, amountToDeal, roomName);

            if (result === OK) {
                const msg = `💰 LIQUIDATION ${resourceType} από ${roomName}: ` +
                            `Πουλήθηκαν ${amountToDeal} με τιμή ${bestOrder.price}. ` +
                            `Έμειναν: ${amountInTerminal - amountToDeal}`;
                console.log(msg);
                
                // Επιστρέφουμε (return) για να μην κάνουμε πολλά deals στο ίδιο tick 
                // και "μπουκώσουμε" το CPU ή τα όρια του Market. 
                // Θα πουλήσει το επόμενο resource στο επόμενο run (σε 100 ticks).
                return; 
            }
        }
    },
    // --- Διαχείριση Πώλησης Ενέργειας ---
    handleEnergySelling: function(room, roomName) {
        const storageCapacity = room.storage.store.getCapacity();
        const energyAmount = room.storage.store.getUsedCapacity(RESOURCE_ENERGY);
        
        if (energyAmount < STORE_LIMITS.STORAGE * storageCapacity) return;

        const terminalEnergy = room.terminal.store.getUsedCapacity(RESOURCE_ENERGY);
        const terminalTotalCapacity = room.terminal.store.getCapacity();

        if (terminalEnergy < (STORE_LIMITS.TERMINAL * terminalTotalCapacity)) return;

        this.searchAndSellEnergy(roomName, terminalEnergy / 2);
    },

    // --- Διαχείριση Αγοράς Power ---
    handlePowerBuying: function(room, roomName) {
        const powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_POWER_SPAWN }
        })[0];

        if (!powerSpawn) return;

        // Έλεγχος υπάρχοντος Power στο Terminal
        const currentPower = room.terminal.store.getUsedCapacity(RESOURCE_POWER);
        if (currentPower >= POWER_CONFIG.TARGET_AMOUNT) return;

        // Υπολογισμός ανάγκης
        let amountNeeded = POWER_CONFIG.TARGET_AMOUNT - currentPower;
        amountNeeded = Math.min(amountNeeded, POWER_CONFIG.BATCH_SIZE);

        // Κλήση της γενικής συνάρτησης αγοράς
        this.searchAndBuyResource(roomName, RESOURCE_POWER, amountNeeded, POWER_CONFIG.MAX_PRICE);
    },

    // --- Διαχείριση Αγοράς Ghodium (Nuker) ---
    handleNukerBuying: function(room, roomName) {
        // Έλεγχος αν υπάρχει Nuker
        const nuker = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_NUKER }
        })[0];

        if (!nuker) return; // Δεν υπάρχει Nuker, τέλος.

        // Έλεγχος υπάρχοντος Ghodium στο Terminal
        const currentGhodium = room.terminal.store.getUsedCapacity(RESOURCE_GHODIUM);
        
        // Αν έχουμε ήδη το στόχο, σταματάμε
        if (currentGhodium >= NUKER_CONFIG.TARGET_AMOUNT) return;

        // Υπολογισμός ανάγκης
        let amountNeeded = NUKER_CONFIG.TARGET_AMOUNT - currentGhodium;
        amountNeeded = Math.min(amountNeeded, NUKER_CONFIG.BATCH_SIZE);

        // Κλήση της γενικής συνάρτησης αγοράς
        this.searchAndBuyResource(roomName, RESOURCE_GHODIUM, amountNeeded, NUKER_CONFIG.MAX_PRICE);
    },

    // --- Generic Συνάρτηση Αγοράς (Δουλεύει για όλα τα Resources) ---
    searchAndBuyResource(roomName, resourceType, amountToBuy, maxPrice) {
        // Έλεγχος Credits πριν μπούμε στη διαδικασία
        if (Game.market.credits < GLOBAL_MIN_CREDITS) return;

        console.log(`--- Αναζήτηση πωλητών ${resourceType} για ${roomName} (Ζήτηση: ${amountToBuy}) ---`);
        const terminal = Game.rooms[roomName].terminal;

        // 1. Αναζήτηση Sell Orders
        const sellOrders = Game.market.getAllOrders(order => 
            order.resourceType === resourceType &&
            order.type === ORDER_SELL &&
            order.price <= maxPrice &&
            order.amount > 0
        );

        if (sellOrders.length === 0) return;

        // 2. Ταξινόμηση (Φθηνότερο πρώτα)
        sellOrders.sort((a, b) => a.price - b.price);

        let bestOrder = null;

        for (const order of sellOrders) {
            const dealAmount = Math.min(amountToBuy, order.amount);
            const transactionCost = Game.market.calcTransactionCost(dealAmount, roomName, order.roomName);

            // Έλεγχος ενέργειας μεταφοράς
            if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < transactionCost) {
                continue;
            }

            bestOrder = order;
            bestOrder.amountToDeal = dealAmount;
            bestOrder.txCost = transactionCost;
            break; 
        }

        // 3. Εκτέλεση Deal
        if (bestOrder) {
            const costInCredits = bestOrder.amountToDeal * bestOrder.price;
            
            // Τελικός έλεγχος credits
            if (Game.market.credits - costInCredits < GLOBAL_MIN_CREDITS) {
                console.log(`⚠️ Ακύρωση αγοράς ${resourceType}: Χαμηλό υπόλοιπο credits.`);
                return;
            }

            const result = Game.market.deal(bestOrder.id, bestOrder.amountToDeal, roomName);

            if (result === OK) {
                const msg = `ΑΓΟΡΑ ${resourceType} στο ${roomName}: ` +
                            `Ποσότητα: ${bestOrder.amountToDeal}. ` +
                            `Τιμή: ${bestOrder.price}. ` +
                            `Κόστος Μεταφοράς: ${bestOrder.txCost} Energy.`;
                console.log(msg);
                Game.notify(msg, 60);
            }
        }
    },

    searchAndSellEnergy(roomName, sellAmount, minPrice = 0.005) {
        console.log(`--- Αναζήτηση αγοραστών Energy για ${roomName} ---`);
        const terminal = Game.rooms[roomName].terminal;

        const buyOrders = Game.market.getAllOrders(order => 
            order.resourceType === RESOURCE_ENERGY &&
            order.type === ORDER_BUY &&
            order.price >= minPrice
        );

        if (buyOrders.length === 0) return;

        buyOrders.sort((a, b) => b.price - a.price);
        
        let bestOrder = null;
        let maxProfit = 0;

        for (const order of buyOrders) {
            const amountToSell = Math.min(sellAmount, order.remainingAmount);
            const transactionCost = Game.market.calcTransactionCost(amountToSell, roomName, order.roomName);

            if (terminal.store.energy < transactionCost + amountToSell) continue; 

            const potentialProfit = amountToSell * order.price;

            if (potentialProfit > maxProfit) {
                maxProfit = potentialProfit;
                bestOrder = order;
                bestOrder.amountToDeal = amountToSell; 
            }
        }

        if (bestOrder) {
            const result = Game.market.deal(bestOrder.id, bestOrder.amountToDeal, roomName);
            if (result === OK) {
                const currentCredits = Game.market.credits.toFixed(3); 
                const msg = `ΠΩΛΗΣΗ ΕΝΕΡΓΕΙΑΣ στο ${roomName}: ${bestOrder.amountToDeal} @ ${bestOrder.price}. Total: ${currentCredits}`;
                console.log(msg);
                Game.notify(msg, 60);
            }
        }
    }
};

module.exports = market;
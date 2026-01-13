// --- ΡΥΘΜΙΣΕΙΣ (CONFIG) ---

const INTERVALS = {
    RUN: 100 // Κάθε πόσους ticks θα εκτελείται
};

const STORE_LIMITS = {
    STORAGE: 0.8, // Όριο πώλησης ενέργειας (Storage)
    TERMINAL: 0.5 // Όριο πώλησης ενέργειας (Terminal)
};

const MARKET_CONFIG = {
    // Ελάχιστη ποσότητα για να κάνουμε deal (αποφεύγει το bug της 1 μονάδας)
    MIN_DEAL_AMOUNT: 40,
    
    // Μέγιστο Ratio Κόστους Μεταφοράς (Energy / Amount).
    // 0.6 σημαίνει: Για να στείλω 1000 items, δέχομαι να πληρώσω μέχρι 600 Energy.
    // Αν το κόστος είναι μεγαλύτερο, ο αγοραστής θεωρείται πολύ μακριά.
    MAX_ENERGY_RATIO: 0.6 
};

const POWER_CONFIG = {
    TARGET_AMOUNT: 3000,   // Στόχος: 3000 Power στο Terminal
    MAX_PRICE: 25.0,       // Μέγιστη τιμή ανά Power
    BATCH_SIZE: 500        // Αγορά ανά 500
};

const NUKER_CONFIG = {
    TARGET_AMOUNT: 5000,   // Στόχος: 5000 Ghodium
    MAX_PRICE: 1.5,        // Μέγιστη τιμή ανά Ghodium
    BATCH_SIZE: 1000       // Αγορά ανά 1000
};

// Κοινό όριο ασφαλείας χρημάτων
const GLOBAL_MIN_CREDITS = 50000; 

const market = {
    run: function(roomName) {
        if (Game.time % INTERVALS.RUN !== 0) return; 
        
        const room = Game.rooms[roomName];
        if (!room || !room.storage || !room.terminal) return;
        
        // 1. Πώληση Minerals (Liquidation)
        this.handleMineralSelling(room, roomName);

        // 2. Πώληση Ενέργειας (αν ξεχειλίζει)
        this.handleEnergySelling(room, roomName);
        
        // 3. Αγορά Power (αν υπάρχει Power Spawn)
        this.handlePowerBuying(room, roomName);

        // 4. Αγορά Ghodium (αν υπάρχει Nuker)
        this.handleNukerBuying(room, roomName);
    },

    // --- Διαχείριση Πώλησης Minerals (Liquidation) ---
    handleMineralSelling: function(room, roomName) {
        const terminal = room.terminal;
        
        // Λίστα με RESOURCES που ΔΕΝ θέλουμε να πουλήσουμε
        const RESOURCES_TO_KEEP = [RESOURCE_ENERGY, RESOURCE_POWER, RESOURCE_GHODIUM];

        for (const resourceType in terminal.store) {
            
            if (RESOURCES_TO_KEEP.includes(resourceType)) continue;

            const amountInTerminal = terminal.store[resourceType];
            
            // Αν έχουμε λιγότερα από το ελάχιστο όριο, δεν ασχολούμαστε
            if (amountInTerminal < MARKET_CONFIG.MIN_DEAL_AMOUNT) continue;

            // 1. Βρες Αγοραστές
            const buyOrders = Game.market.getAllOrders(order => 
                order.resourceType === resourceType &&
                order.type === ORDER_BUY &&
                order.remainingAmount >= MARKET_CONFIG.MIN_DEAL_AMOUNT // Να θέλει μια σεβαστή ποσότητα
            );

            if (buyOrders.length === 0) continue;

            // 2. Ταξινόμηση για την καλύτερη τιμή (High to Low)
            buyOrders.sort((a, b) => b.price - a.price);

            // 3. Εύρεση κατάλληλου αγοραστή (Loop για έλεγχο απόστασης)
            let bestOrder = null;
            let finalDealAmount = 0;

            for (let order of buyOrders) {
                let amountToDeal = Math.min(amountInTerminal, order.remainingAmount);

                // Υπολογισμός κόστους μεταφοράς
                let transactionCost = Game.market.calcTransactionCost(amountToDeal, roomName, order.roomName);
                
                // ΦΙΛΤΡΟ 1: Είναι πολύ μακριά; (Ratio Check)
                // Αν το κόστος είναι π.χ. 800 ενέργεια για 1000 items (0.8), το προσπερνάμε.
                if (transactionCost > amountToDeal * MARKET_CONFIG.MAX_ENERGY_RATIO) {
                    continue; // Πάμε στον επόμενο αγοραστή
                }

                // ΦΙΛΤΡΟ 2: Έχουμε αρκετή ενέργεια στο Terminal;
                const energyAvailable = terminal.store[RESOURCE_ENERGY];
                
                if (transactionCost > energyAvailable) {
                    // Μειώνουμε την ποσότητα ώστε να ταιριάζει με την υπάρχουσα ενέργεια
                    // Τύπος: Νέα Ποσότητα = Αρχική * (Διαθέσιμη Ενέργεια / Απαιτούμενη)
                    amountToDeal = Math.floor(amountToDeal * (energyAvailable / transactionCost));
                    
                    // Ξανα-υπολογίζουμε το κόστος για σιγουριά
                    transactionCost = Game.market.calcTransactionCost(amountToDeal, roomName, order.roomName);
                }

                // ΦΙΛΤΡΟ 3: Μετά τις μειώσεις, αξίζει τον κόπο;
                if (amountToDeal < MARKET_CONFIG.MIN_DEAL_AMOUNT) {
                    continue; // Πολύ μικρή ποσότητα, δεν αξίζει, πάμε στον επόμενο
                }

                // Βρήκαμε τον νικητή!
                bestOrder = order;
                finalDealAmount = amountToDeal;
                break; // Σταματάμε το loop
            }

            // 4. Εκτέλεση Deal (αν βρέθηκε valid order)
            if (bestOrder) {
                const result = Game.market.deal(bestOrder.id, finalDealAmount, roomName);
            
                if (result === OK) {
                    const buyerName = bestOrder.owner ? bestOrder.owner.username : "NPC/Unknown";
                    const msg = `💰 LIQUIDATION -- ${resourceType} -- από ${roomName}: ` +
                                `Πουλήθηκαν ${finalDealAmount} με τιμή ${bestOrder.price}. ` +
                                `Buyer: ${buyerName} (${bestOrder.roomName})`;
                    console.log(msg);
                    return; 
                }
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
        const powerSpawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } })[0];
        if (!powerSpawn) return;

        const currentPower = room.terminal.store.getUsedCapacity(RESOURCE_POWER);
        if (currentPower >= POWER_CONFIG.TARGET_AMOUNT) return;

        let amountNeeded = POWER_CONFIG.TARGET_AMOUNT - currentPower;
        amountNeeded = Math.min(amountNeeded, POWER_CONFIG.BATCH_SIZE);

        this.searchAndBuyResource(roomName, RESOURCE_POWER, amountNeeded, POWER_CONFIG.MAX_PRICE);
    },

    // --- Διαχείριση Αγοράς Ghodium (Nuker) ---
    handleNukerBuying: function(room, roomName) {
        const nuker = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0];
        if (!nuker) return; 

        const currentGhodium = room.terminal.store.getUsedCapacity(RESOURCE_GHODIUM);
        if (currentGhodium >= NUKER_CONFIG.TARGET_AMOUNT) return;

        let amountNeeded = NUKER_CONFIG.TARGET_AMOUNT - currentGhodium;
        amountNeeded = Math.min(amountNeeded, NUKER_CONFIG.BATCH_SIZE);

        this.searchAndBuyResource(roomName, RESOURCE_GHODIUM, amountNeeded, NUKER_CONFIG.MAX_PRICE);
    },

    // --- Generic Συνάρτηση Αγοράς ---
    searchAndBuyResource(roomName, resourceType, amountToBuy, maxPrice) {
        if (Game.market.credits < GLOBAL_MIN_CREDITS) return;

        const terminal = Game.rooms[roomName].terminal;

        // 1. Αναζήτηση Sell Orders
        const sellOrders = Game.market.getAllOrders(order => 
            order.resourceType === resourceType &&
            order.type === ORDER_SELL &&
            order.price <= maxPrice &&
            order.amount >= MARKET_CONFIG.MIN_DEAL_AMOUNT // Να έχει ποσότητα ο πωλητής
        );

        if (sellOrders.length === 0) return;

        // 2. Ταξινόμηση (Φθηνότερο πρώτα)
        sellOrders.sort((a, b) => a.price - b.price);

        let bestOrder = null;

        for (const order of sellOrders) {
            let dealAmount = Math.min(amountToBuy, order.amount);
            let transactionCost = Game.market.calcTransactionCost(dealAmount, roomName, order.roomName);

            // Έλεγχος ενέργειας μεταφοράς
            if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < transactionCost) {
                 // Προαιρετικά: Θα μπορούσαμε να μειώσουμε το dealAmount, 
                 // αλλά στην Αγορά (Import) συνήθως θέλουμε συγκεκριμένη ποσότητα.
                 // Απλά δοκιμάζουμε τον επόμενο ή ακυρώνουμε.
                 continue;
            }
            
            // Check Ratio και στην αγορά για να μην αδειάσουμε το τερματικό από ενέργεια
            if (transactionCost > dealAmount * MARKET_CONFIG.MAX_ENERGY_RATIO) {
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
            
            if (Game.market.credits - costInCredits < GLOBAL_MIN_CREDITS) {
                console.log(`⚠️ Ακύρωση αγοράς ${resourceType}: Χαμηλό υπόλοιπο credits.`);
                return;
            }

            const result = Game.market.deal(bestOrder.id, bestOrder.amountToDeal, roomName);

            if (result === OK) {
                const sellerName = bestOrder.owner ? bestOrder.owner.username : "NPC/Unknown";
                const msg = `🛒 ΑΓΟΡΑ ${resourceType} στο ${roomName}: ` +
                            `Ποσότητα: ${bestOrder.amountToDeal}. ` +
                            `Τιμή: ${bestOrder.price}. ` +
                            `Seller: ${sellerName} (${bestOrder.roomName}). ` +
                            `Κόστος Μεταφοράς: ${bestOrder.txCost} Energy.`;
                console.log(msg);
                Game.notify(msg, 60);
            }
        }
    },

    // --- Συνάρτηση Πώλησης Ενέργειας ---
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

            // Εδώ το transaction cost είναι και το "προϊόν" που πουλάμε, οπότε ο έλεγχος είναι πιο απλός
            // Θέλουμε να βγάλουμε κέρδος, άρα η τιμή πρέπει να καλύπτει την "απώλεια" της ενέργειας μεταφοράς

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
                const buyerName = bestOrder.owner ? bestOrder.owner.username : "NPC/Unknown";
                const currentCredits = Game.market.credits.toFixed(2); 
                const msg = `⚡ ΠΩΛΗΣΗ ΕΝΕΡΓΕΙΑΣ στο ${roomName}: ` +
                            `${bestOrder.amountToDeal} units @ ${bestOrder.price} στον ${buyerName}. ` +
                            `Total Credits: ${currentCredits}`;
                console.log(msg);
                Game.notify(msg, 60);
            }
        }
    }
};

module.exports = market;
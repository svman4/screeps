/*
 * File: manager.pixels.js
 * Λειτουργία: Διαχείριση της παραγωγής Pixels μέσω της μεθόδου Game.cpu.generatePixel().
 * Αυτή η μέθοδος απαιτεί το CPU Bucket να είναι γεμάτο (10000) για συγκεκριμένο αριθμό ticks.
 */

const INTERVALS = {
    // Καθορίζει το διάστημα (σε ticks) μεταξύ των ελέγχων.
    // ΠΡΟΣΟΧΗ: Αυτός ο έλεγχος (Game.time % INTERVALS.RUN !== 0) θα κάνει τη λογική
    // του counter να λειτουργεί με άλματα (skipping ticks), κάτι που μπορεί να μην είναι επιθυμητό
    // για το CPU Bucket. Συνήθως, η λογική του Bucket τρέχει κάθε tick.
    RUN: 20 
}

const LIMITS = {
    // Το πόσες φορές συνεχόμενα (ή πόσες φορές ανά το διάστημα RUN)
    // πρέπει να είναι γεμάτο το CPU Bucket (10000) πριν επιτρέψουμε την παραγωγή Pixel.
    COUNTER_LIMIT: 5, 
    // Το όριο του CPU Bucket που το θεωρούμε "γεμάτο" (το μέγιστο όριο).
    BUCKET_LIMIT: 10000 
}

const pixels = {
    /**
     * Η κύρια λειτουργία που ελέγχει το CPU Bucket και παράγει Pixels.
     * Χρησιμοποιεί το Memory.pixels.counter για να μετρήσει συνεχόμενα ticks με γεμάτο Bucket.
     */
    run: function() {
        
        // --- 1. Έλεγχος Συχνότητας Εκτέλεσης ---
        // Αν η συνάρτηση καλείται από τη main.js κάθε tick, ο έλεγχος αυτός περιορίζει
        // την εκτέλεση της λογικής του Pixel σε μία φορά κάθε 50 ticks.
        if (!Game.cpu.generatePixel) {  return; }
        if (Game.time % INTERVALS.RUN !== 0) return; 

        // --- 2. Αρχικοποίηση Μνήμης (Memory) ---
        // Διασφαλίζει ότι υπάρχει το αντικείμενο Memory.pixels.
        if(!Memory.pixels) {
            Memory.pixels = {
                counter: 0
            }
        }
        
        // Έλεγχος ασφαλείας: Διασφαλίζει ότι ο μετρητής έχει αριθμητική τιμή.
        if (!Memory.pixels.counter) {
            Memory.pixels.counter = 0;
        }
        
        // --- 3. Λογική Μετρητή (Counter) ---
        
        let counter = Memory.pixels.counter; // Λήψη της τρέχουσας τιμής του counter.
        //console.log("pixels - counter is "+counter);
        // Έλεγχος: Είναι το CPU Bucket γεμάτο (10000);
        if (Game.cpu.bucket >= LIMITS.BUCKET_LIMIT) {
            // Αν είναι γεμάτο, αυξάνουμε τον μετρητή συνεχόμενης πλήρωσης.
            counter++;
            
        } else {
            // Αν το Bucket δεν είναι γεμάτο, σημαίνει ότι χρησιμοποιήθηκε CPU
            // και πρέπει να ξαναρχίσει η μέτρηση για το επόμενο Pixel.
            counter = 0;
        }

        // --- 4. Παραγωγή Pixel ---
        
        // Εάν ο μετρητής ξεπέρασε το όριο (π.χ. 10 συνεχόμενες φορές), 
        // είναι ώρα να παράγουμε το Pixel.
        if (counter > LIMITS.COUNTER_LIMIT) {
            
            // Κρίσιμη εντολή: Παράγει 1 Pixel και μηδενίζει το CPU Bucket (Game.cpu.bucket = 0).
            Game.cpu.generatePixel();
            
            // Αποστολή ειδοποίησης με το τρέχον σύνολο Pixels.
            // Game.market.pixels: Επιστρέφει το τρέχον σύνολο Pixels του παίκτη.
            const message=`🎉 Παρήχθη νέο Pixel! Το CPU Bucket μηδενίστηκε. Έχετε συνολικά: ${Game.resources["pixel"]+1} Pixels.`;
            console.log(message);
            Game.notify(message, 3000);
            
            // Μετά την επιτυχημένη παραγωγή, μηδενίζουμε τον μετρητή για να ξαναρχίσει η διαδικασία.
            counter = 0; 
        }

        // --- 5. Αποθήκευση ---
        
        // Αποθηκεύουμε την τελική τιμή του counter στη μνήμη για τον επόμενο tick.
        Memory.pixels.counter = counter;
    }
};

module.exports = pixels;
/**
 * @module construction.baseLayout
 * @description Περιέχει την αφηρημένη/βασική κλάση BaseLayout που λειτουργεί ως Orchestrator 
 * για τη φόρτωση, αξιολόγηση (scoring) και αποθήκευση (caching) των αρχιτεκτονικών πλάνων (blueprints).
 * 
 * CHANGELOG:
 * version 1.1.0
 * - Αναβάθμιση σε Orchestrator κλάση.
 * - Προσθήκη template method init() για τη διαχείριση της ροής (loading -> scoring -> caching).
 * - Ενσωμάτωση κεντρικού μηχανισμού caching στη Memory.
 * 
 * version 1.0.0
 * - Αρχική δομή BaseLayout.
 */

import LayoutScorer = require("./construction.layout.Scorer");
import CONSTANTS from "./construction.constants";



/**
 * Βασική κλάση Orchestrator για τη διαχείριση των αρχιτεκτονικών πλάνων ενός δωματίου.
 * Υλοποιεί το Template Method pattern μέσω της μεθόδου {@link init}, επιτρέποντας στις 
 * υποκλάσεις να ορίζουν μόνο τον τρόπο φόρτωσης των αρχικών δεδομένων ({@link loadRawData}).
 * 
 * @class BaseLayout
 */
class BaseLayout {
    /** Το όνομα του δωματίου για το οποίο διαχειριζόμαστε το πλάνο */
    protected roomName: string;

    /** Η τελική, ταξινομημένη λίστα των κτιρίων προς κατασκευή */
    protected blueprint: BlueprintStructure[] = [];

    /**
     * Δημιουργεί ένα νέο instance της BaseLayout για το συγκεκριμένο δωμάτιο.
     * 
     * @param {string} roomName - Το όνομα του δωματίου (π.χ. "W1N1").
     */
    constructor(roomName: string) {
        this.roomName = roomName;
    }

    /**
     * Κεντρική μέθοδος αρχικοποίησης (Template Method).
     * Ελέγχει πρώτα αν υπάρχει αποθηκευμένο blueprint στη `Memory`. Αν δεν υπάρχει,
     * φορτώνει τα ακατέργαστα δεδομένα, τα επεξεργάζεται μέσω του {@link LayoutScorer}
     * και τα αποθηκεύει στην cache.
     * 
     * @public
     * @returns {void}
     */
    public init(): void {
        const roomMem = Memory.rooms[this.roomName] as any;
        const rootMem = roomMem && roomMem[CONSTANTS.MEMORY_KEYS.ROOT];

        // Έλεγχος για υπάρχον blueprint στην cache (Memory)
        if (rootMem && rootMem[CONSTANTS.MEMORY_KEYS.BLUE_PRINT]) {
            this.blueprint = rootMem[CONSTANTS.MEMORY_KEYS.BLUE_PRINT];
            return;
        }

        // Φόρτωση, αξιολόγηση και αποθήκευση νέου πλάνου
        const rawData: RawBlueprintData = this.loadRawData();
        if (rawData) {
            console.log(`[BaseLayout] Processing new layout for ${this.roomName}...`);
            this.blueprint = LayoutScorer.process(rawData, this.roomName);
            this.saveToCache();
        } else {
            this.blueprint = [];
        }
    }

    /**
     * Αποθηκεύει το επεξεργασμένο {@link blueprint} στη `Memory` του δωματίου
     * για αποφυγή περιττών υπολογισμών στα επόμενα ticks.
     * 
     * @protected
     * @returns {void}
     */
    protected saveToCache(): void {
        if (!Memory.rooms[this.roomName]) {
            Memory.rooms[this.roomName] = {};
        }
        const roomMem = Memory.rooms[this.roomName] as any;
        if (!roomMem[CONSTANTS.MEMORY_KEYS.ROOT]) {
            roomMem[CONSTANTS.MEMORY_KEYS.ROOT] = {};
        }
        roomMem[CONSTANTS.MEMORY_KEYS.ROOT][CONSTANTS.MEMORY_KEYS.BLUE_PRINT] = this.blueprint;
    }

    /**
     * Επιστρέφει τα κτίρια που πρέπει να χτιστούν για το τρέχον RCL και δεν υπάρχουν ήδη.
     * 
     * @public
     * @param {number} rcl - Το τρέχον επίπεδο του Room Controller (1-8).
     * @param {Record<string, boolean>} builtMap - Αντικείμενο με κλειδιά `"x,y"` που δείχνει ποια σημεία έχουν ήδη χτιστεί.
     * @returns {BlueprintStructure[]} Η λίστα με τα υπολειπόμενα κτίρια προς κατασκευή.
     */
    public getPlanForRCL(rcl: number, builtMap: Record<string, boolean>): BlueprintStructure[] {
        if (!this.blueprint) {
            return [];
        }
        return this.blueprint.filter(s => s.rcl <= rcl && !builtMap[`${s.x},${s.y}`]);
    }

    /**
     * Αφηρημένη/εικονική μέθοδος που πρέπει να υλοποιηθεί από τις υποκλάσεις (π.χ. BunkerLayout, AutoPlanner).
     * Επιστρέφει τα ακατέργαστα δεδομένα του πλάνου πριν την επεξεργασία από τον Scorer.
     * 
     * @protected
     * @throws {Error} Εάν κληθεί απευθείας χωρίς να έχει γίνει override από την υποκλάση.
     * @returns {RawBlueprintData|null} Τα ακατέργαστα δεδομένα του layout.
     */
    protected loadRawData(): RawBlueprintData | null {
        throw new Error(`[BaseLayout] loadRawData not implemented for ${this.constructor.name}`);
    }
}

export = BaseLayout;
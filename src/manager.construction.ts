/*
    CHANGELOG:
    version 1.4.2
    - Διόρθωση λογικής στην updateSpecialContainer: Έλεγχος εγκυρότητας των IDs μέσω Game.getObjectById().
    - Αυτόματη επαναφορά αναζήτησης αν ένα ειδικό container καταστραφεί.
    - Καθαρισμός κώδικα και διόρθωση σειράς ορισμού μεταβλητών.
    
    version 1.4.1
    - Μεταφορά του κεντρικού κλειδιού μνήμης "construction" στα constants (MEMORY_KEYS.ROOT).
    
    version 1.4.0
    - Ολοκλήρωση της μεθόδου updateSpecialContainer για εντοπισμό Recovery & Controller Containers.
    - Πλήρης ενσωμάτωση των MEMORY_KEYS από το αρχείο constants.
    - Κατάργηση hardcoded strings στη διαχείριση μνήμης.
*/
import defenceManager from './manager.defense';
import { ConstructionVisualizer } from './construction.visualizer';
import BaseLayout from './construction.layout.BaseLayout';
import debugConsole from './utils.debugConsole';
import roomCache from './utils.RoomCache';
import { CONSTRUCTION_CONSTANT } from "./constants";
import { FSM } from './utils.fsm';
import _ from "lodash";
import FileLayout from './construction.layout.FileLayout';

export const CONSTANT = {
    // Επίπεδα RCL ανά ποσότητα κτιρίων
    STRUCTURE_RCL_STEPS: {
        'spawn': [1, 7, 8],
        'tower': [3, 5, 7, 8, 8, 8],
        'extension': { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
        'link': { 5: 2, 6: 3, 7: 4, 8: 6 },
        'lab': [6, 6, 6, 7, 7, 8, 8, 8, 8, 8],
        'container': { 1: 5 },
    },

    // Προεπιλεγμένα RCL ξεκλειδώματος αν δεν ορίζεται στα steps
    DEFAULTS_RCL: {
        road: 3,
        container: 2,
        spawn: 1,
        extension: 2,
        rampart: 5,
        constructedWall: 4,
        tower: 3,
        storage: 4,
        link: 5,
        terminal: 6,
        extractor: 6,
        factory: 7
    },

}
/**
 * Περιγράφει τα ήδη χτισμένα κτίρια.
 */
export interface buildedStructure {
    "Pos": Coordination;
    "type": Structure;
}
/**
     * Αντιπροσωπεύει ένα μεμονωμένο κτίριο μέσα στο αρχιτεκτονικό πλάνο (Blueprint).
     */
export interface BlueprintStructure extends Coordination {

    /** Τύπος κτιρίου (π.χ. STRUCTURE_SPAWN, STRUCTURE_EXTENSION) */
    type: StructureConstant;
    /** Το ελάχιστο Room Controller Level (RCL) που απαιτείται για την κατασκευή */
    rcl: number;
    category?: 'critical' | 'logistics' | 'industrial' | string;
    score?: number;
    isConstructed?: boolean;
}
export const MEMORY_KEYS = {
    ROOT: 'construction',
    STRUCTURES: 'builtStructures',
    RECOVERY: 'recoveryContainerId',
    CONTROLLER: 'controllerContainerId',
    ROAD_PLAN: 'roadPlannerData',
    BLUE_PRINT: 'blueprint'

}; // end of MEMORY_KEYS
interface RoomInfoData {
    level?: number;
    [MEMORY_KEYS.STRUCTURES]?: BlueprintStructure[];
} // end of RoomInfoData

const constructionFSM = new FSM({
    'earlyEra': function () {

        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (!this.checkIfMemoryIsOk(this.room)) {
            // εφόσον δεν υπάρχει αρχικοποιημένη μνήμη, ξεκινάμε την ανάλυση του δωματίου.
            this.initRoom(this.room);

        }
        if (this.room.controller.level === 1) {
            return;
        }

        if (
            this.room.controller.level > 1
        ) {
            // ο controller είναι πάνω από level 2
            constructionFSM.transition(this, 'basicEra', this.room.memory);
            return constructionFSM.states['basicEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }

    },
    'basicEra': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (this.room.controller.level !== this.info[this.room.name].level) {
            // construction of criticalRoads
            this.info[this.room.name].constructionRemain.push(...this.getCriticalRoads(this.room));
            this.info[this.room.name].constructionRemain.push(...this.getUnlockedStructuresToBuild(this.room));
            this.info[this.room.name].level = this.room.controller.level;
        }
        this.processConstruction(this.room);


        debugConsole.debugText("ConstructionMAnager,basicEra", "constructionRemain length is " + this.info[this.room.name].constructionRemain.length);

        if (
            this.room.controller.level > CONSTRUCTION_CONSTANT.CONTROLLER_LEVEL_FOR_INDUSTRIAL_ERA &&
            this.info[this.room.name].constructionRemain.length === 0
            && this.room.storage &&
            this.room.storage.store.getUsedCapacity() < CONSTRUCTION_CONSTANT.STORAGE_LIMIT_FOR_INDUSTRIAL_ERA
        ) {
            // ο controller είναι πάνω από level 2
            constructionFSM.transition(this, 'basicEra', this.room.memory);
            return constructionFSM.states['basicEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        constructionFSM.transition(this, 'industrialEra', this.room.memory);
        return constructionFSM.states['industrialEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής


    },
    'industrialEra': function () {
        if (!this.checkIfMemoryIsOk()) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        if (defenceManager.isWarModeActive(this.room)) {
            // βρισκόμαστε σε κατάσταση πολέμου.
            constructionFSM.transition(this, 'warTime', this.room.memory);
            return constructionFSM.states['warTime'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
        //χτίσιμο lab και factory.

    },

    'warTime': function () {
        //Σε κατάσταση πολέμου δε προσπαθούμε να χτίσουμε κάτι.
        // Απλά αναμονή για λήξη πολέμου.
        if (!defenceManager.isWarModeActive(this.room)) {
            //εφόσον έληξε η πολεμική λειτουργία. Επανερχόμαστε.
            constructionFSM.transition(this, 'earlyEra', this.room.memory);
            return constructionFSM.states['earlyEra'].call(this); // Αμέσως εκτέλεση της νέας εποχής
        }
    } // end of warTime
}); // end of constructionFSM
/**
 * CONSTRUCTION MANAGER CLASS
 */
class ConstructionManager {
    public roomName!: string;
    public visualizer = new ConstructionVisualizer();
    public layout: BaseLayout;
    public info: { [roomName: string]: RoomInfoData };

    constructor() {
        this.info = {};
        this.layout = new FileLayout();
    }
    protected checkIfMemoryIsOk(room: Room): boolean {
        if (this.info[room.name]) {
            return true;
        } else {
            return false;
        }
    } // end of checkIfMemory
    protected initRoom(room: Room): void {
        if (!this.info[room.name]) {
            this.info[room.name] = {};
        }
        let blueprint: BlueprintStructure[] = this.layout.getBlueprint();
        this.info[room.name].level = room.controller ? room.controller.level : 0;
        this.info[room.name][MEMORY_KEYS.STRUCTURES] = blueprint;


    } // end of initinitRoom(room)
    private initMemory(): void {
        if (!Memory.rooms[this.roomName])
            Memory.rooms[this.roomName] = {};
        if (!Memory.debug)
            Memory.debug = {};
        if (!Memory.debug[MEMORY_KEYS.ROOT])
            Memory.debug[MEMORY_KEYS.ROOT] = false;
    } // end of initMemory

    run(room: Room): void {

        if (!room.memory) {
            return;
        }
        if (room.controller || room.controller.my) {
            return;
        }
        this.roomName = room.name;
        constructionFSM.run(this, "earlyEra", Memory.
            rooms[room.name]);
        if (this.visualizer)
            this.drawVisuals(room);
        if (Game.time % CONSTRUCTION_CONSTANT.SCAN_INTERVALS.UPDATE_BUILT_CACHE === 0) {
            this.updateBuiltCache(room);
        }

        this.drawVisuals(room);
    }

    updateBuiltCache(room: Room): void {
        const cache: { [coords: string]: string } = {};
        const structures: Structure[] = roomCache.in(room.name).structures;


        structures.forEach((s: Structure) => {
            cache[`${s.pos.x},${s.pos.y}`] = s.structureType;
        });

        const constructionMem = Memory.rooms[room.name][MEMORY_KEYS.ROOT];
        constructionMem[MEMORY_KEYS.STRUCTURES] = cache;
    } // end of updateBuiildCache
    processConstruction(room: Room): void {
        const cache = roomCache.in(room.name);
        let sites = cache.constructionSites;

        const maxSites = CONSTRUCTION_CONSTANT.MAX_CONSTRUCTION_SITE || 2;

        if (sites.length >= maxSites) {
            // Εφόσον τα buildingSite είναι περισσότερα ή όσα επιτρέπονται 
            return;
        }

        const constructionInfo = this.info[room.name];
        const builtMap = (constructionInfo[MEMORY_KEYS.STRUCTURES] || {}) as BlueprintStructure[];
        const constructionRemain = _.filter(builtMap, str => str.isConstructed === false);
        const rcl = room.controller.level;


        if (!constructionRemain || constructionRemain.length === 0)
            return;

        let remainingQuota = maxSites - sites.length;
        let startingRemainingQuota = remainingQuota;
        remainingQuota = this.buildStructures(room, constructionRemain, remainingQuota);
        //console.log("start "+ remainingQuota + " "+startingRemainingQuota);
        if (startingRemainingQuota === remainingQuota) {
            const remainQuotaForDefence = 100;
            // Θέλουμε να χτίζει μονομιάς όλα τα αμυντικά κτίρια.
            remainingQuota = this.buildDefenses(room, constructionRemain, remainQuotaForDefence);
            if (remainingQuota != remainQuotaForDefence) {
                remainingQuota = 0;
            } else {
                remainingQuota = startingRemainingQuota;
            }
            //  console.log("roads "+ remainingQuota + " "+startingRemainingQuota);
        }
        if (startingRemainingQuota === remainingQuota) {
            const remainQuotaForRoads = 100;
            //console.log("Defence " +remainingQuota + " "+startingRemainingQuota);
            // Θέλουμε να χτίζει μονομιάς όλους τους δρόμους στο τρέχον rcl.
            this.buildRoads(room, constructionRemain, remainQuotaForRoads);
        }
    } // end of processConstruction
    /**
     * Αναζητεί από το blueprint του δωματίου τα critical roads.
     * @param {room} room 
     */
    private getCriticalRoads(room: Room): BlueprintStructure[] {

        const blueprint = this.info[room.name][MEMORY_KEYS.STRUCTURES] as BlueprintStructure[];// room.memory[MEMORY_KEYS.ROOT][MEMORY_KEYS.BLUE_PRINT];
        const roads = blueprint.filter((s: { type: string; }) => s.type === 'road');
        debugConsole.debugText("Construction,getCriticalRoads", "found " + roads.length + " roads");

        const storagePlace = blueprint.find((s: BlueprintStructure) => s.type === STRUCTURE_STORAGE) as Coordination;
        const placeOfstorage: Coordination = storagePlace ? storagePlace : { x: 25, y: 25 }; // Ο χώρος που θα μπει το storage

        const firstSpawnPlace = blueprint.find((s: BlueprintStructure) => s.type === STRUCTURE_SPAWN) as Coordination;

        const placeOfFirstSpawn: Coordination = firstSpawnPlace ? firstSpawnPlace : { x: 25, y: 25 }; // Ο χώρος που θα μπει το spawn
        const containersPlace = blueprint.filter((s: BlueprintStructure) => s.type === STRUCTURE_CONTAINER) as Coordination[];
        const placeOfContainers: Coordination[] = containersPlace ? containersPlace : []; // ο χώρος που θα βρίσκονται τα containers (Πηγών και controller)

        const criticalRoads = this.findCriticalPath(roads, placeOfstorage, placeOfFirstSpawn, placeOfContainers);

        debugConsole.debugText("Construction,getCriticalRoads", "found " + criticalRoads.length + " critical roads");



        return criticalRoads;

    } // end of getCriticalRoads
    findCriticalPath(roads: BlueprintStructure[], placeOfStorage: Coordination, placeOfSpawn: Coordination, placeOfContainers: Coordination[]): BlueprintStructure[] {
        throw new Error(`[BaseLayout] loadRawData not implemented for ${this.constructor.name}`);
    }
    /**
     * 
     * @param room 
     * @param fullPlan 
     * @param quota  Πόσα sites έχουμε τη δυνατότητα να τοποθετήσουμε.
     * @returns επιστρέφει πόσα sites μπορούμε να τοποθετήσουμε ακόμα.
     */
    private buildStructures(room: Room, fullPlan: BlueprintStructure[], quota: number): number {
        const structures = fullPlan.filter(s => !['road', 'rampart', 'constructedWall'].includes(s.type));

        for (const s of structures) {
            if (quota <= 0) {
                break;
            }
            if (this.createSite(room, s.x, s.y, s.type)) quota--;
        }
        return quota;
    } // end of buildStructures

    private buildDefenses(room: Room, fullPlan: BlueprintStructure[], quota: number): number {
        const defenses = fullPlan.filter(s => ['rampart', 'constructedWall'].includes(s.type));
        let placed = 0;
        for (const s of defenses) {
            if (placed >= quota) break;
            if (this.createSite(room, s.x, s.y, s.type)) placed++;
        }
        return quota - placed;
    } // end of buildDefences

    private buildRoads(room: Room, fullPlan: BlueprintStructure[], quota: number): number {
        const roads = fullPlan.filter(s => s.type === 'road');
        let placed = 0;
        for (const s of roads) {
            if (placed >= quota) break;

            if (this.createSite(room, s.x, s.y, "road")) placed++;

        }
        return quota - placed;
    }

    private createSite(room: Room, x: number, y: number, type: string): boolean {
        const structureType = this.mapType(type);
        const res = room.createConstructionSite(x, y, structureType);
        if (res === OK) {
            console.log(`[Construction] ${this.roomName}: Placed ${type} at ${x},${y}`);
            return true;
        }
        return false;
    }

    mapType(type: string): BuildableStructureConstant {
        const types = {
            'spawn': STRUCTURE_SPAWN,
            'extension': STRUCTURE_EXTENSION,
            'road': STRUCTURE_ROAD,
            'tower': STRUCTURE_TOWER,
            'storage': STRUCTURE_STORAGE,
            'container': STRUCTURE_CONTAINER,
            'link': STRUCTURE_LINK,
            'terminal': STRUCTURE_TERMINAL,
            'lab': STRUCTURE_LAB,
            'rampart': STRUCTURE_RAMPART,
            'constructedWall': STRUCTURE_WALL,
            'controller': STRUCTURE_CONTROLLER
        };
        return types[type] || type;
    }

    drawVisuals(room: Room): void {
        if (Memory.debug && Memory.debug.construction === false) {
            return;
        }
        if (!this.layout) {
            return;
        }
        const blueprint = this.layout.getBlueprint();
        if (!blueprint) {
            return;
        }

        const currentRCL = room.controller ? room.controller.level : 0;

        // Ανάκτηση του builtMap από τη μνήμη (όπως γίνεται και στην processConstruction)
        const constructionMem = Memory.rooms[this.roomName][MEMORY_KEYS.ROOT] || {};
        const builtMap = constructionMem[MEMORY_KEYS.STRUCTURES] || {};


        this.visualizer.drawBlueprint(room.name, blueprint, builtMap, currentRCL);


    }
} // end of class ConstructionManager
export default new ConstructionManager();
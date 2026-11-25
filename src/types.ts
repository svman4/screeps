

import { constant } from "lodash";
import { EXPANSION } from "./constants";
import { RoomCacheData, World } from "./utils.RoomCache";
declare global {
    interface Memory {
        expansionCheckTime?: number;
        obsTarget?: string;
        observerQueue?: string[];
        world?: World;
        debug?: {
            construction?: boolean;
        };
        pixels?: {
            counter?: number
        }
    }
    // Δημιουργία τύπου από τα values του ROOM_TYPE

    interface RoomMemory {
        type?: typeof EXPANSION.ROOM_TYPE[keyof typeof EXPANSION.ROOM_TYPE];
        city?: string;
        lastScouted?: number;
        scoutNeeded?: boolean;
        sources?: Array<{ id: string; x: number; y: number }>;
        controllerPos?: Coordination;
        cache?: RoomCacheData;
        lastEnergyStore?: number;
        energyNetFlow?: number;
        wallLimit?: number;
        enemyInfo?: {
            owner: string;
            level: number;
            towers: number;
        };
    }
    interface CreepMemory {
        role?: string;
        init?: boolean;
        leadTime?: number;
        homeRoom?: string;
        targetRoom?: string;
        sourceId?: Id<Source>;
        mineralId?: Id<Mineral>;
        _lastPos?: {
            x: number;
            y: number;
            roomName: string;
        };
        _stuckCount?: number;
        _nextStep?: {
            x: number;
            y: number;
            t: number;
        };
    }

    interface EnemyInfo {
        owner: string;
        level: number;
        towers: number;
    }

    interface RoomMemoryData {
        type?: string;
        sources?: Array<{ id: Id<Source>, x: number, y: number }>;
        controllerPos?: { x: number; y: number };
        enemyInfo?: EnemyInfo;
        lastScouted?: number;
        scoutNeeded?: boolean;
        city?: string;
    }
    interface BestBuyOrder extends Order {
        amountToDeal: number;
        txCost: number;
    }

    interface BestSellOrder extends Order {
        amountToDeal: number;
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
    }
    /**
     * Αντιπροσωπεύει ένα ζεύγος συντεταγμένων (X, Y) μέσα στο δωμάτιο.
     */
    export interface Coordination {
        /** Συντεταγμένη X (0 - 49) */
        x: number;
        /** Συντεταγμένη Y (0 - 49) */
        y: number;
    }

    /**
     * Αντιπροσωπεύει την ακατέργαστη δομή (Raw JSON) ενός αρχείου blueprint δωματίου,
     * όπως επιστρέφεται από τη μέθοδο {@link BaseLayout.loadRawData}.
     */
    export interface RawBlueprintData {
        /** Το μέγιστο Room Controller Level (RCL) για το οποίο έχει σχεδιαστεί το πλάνο */
        rcl?: number;

        /** 
         * Λεξικό που αντιστοιχίζει κάθε τύπο κτιρίου του Screeps (π.χ. "spawn", "road", "extension")
         * σε μια λίστα με τις συντεταγμένες τοποθέτησής του.
         * Χρησιμοποιεί `Partial` επειδή ένα δωμάτιο μπορεί να μην περιέχει όλους τους τύπους κτιρίων.
         */
        buildings: Partial<Record<BuildableStructureConstant, Coordination[]>>;

        /** Το όνομα του δωματίου στο οποίο ανήκει το blueprint (π.χ. "W1N3") */
        name?: string;

        /** Προαιρετικό αναγνωριστικό του shard (π.χ. "05d12231a3fd" ή "shard3") */
        shard?: string;
    } // end of interface RawBlueprintData
    export interface SpawnRequest {
        priority: number;
        role: string;
        targetRoom: string;
        homeRoom: string;
        memory: {
            sourceId: Id<Source>;
        }
        addedAt: number;
    }  // end of interface SpawnRequest
    export interface RoomInfoData {
        level?: number;
        constructionRemain?: BlueprintStructure[],
    } // end of RoomInfoData
} // end of globalDeclaration

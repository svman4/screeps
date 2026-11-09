// Ορισμός της δομής ενός στοιχείου στο blueprint
export interface BlueprintStructure {
    x: number;
    y: number;
    type: string;
    rcl: number;
    category?: 'critical' | 'logistics' | 'industrial' | string;
}


import { ROOM_TYPE } from "./expansion.constants";
import { RoomCacheData, World } from "./utils.RoomCache";
declare global {
    interface Memory {
        expansionCheckTime?: number;
        obsTarget?: string;
        observerQueue?: string[];
        world?: World;
        pixels?:{
            counter?:number
        
        }
    }
    // Δημιουργία τύπου από τα values του ROOM_TYPE

    interface RoomMemory {
        type?: typeof ROOM_TYPE[keyof typeof ROOM_TYPE];
        city?: string;
        lastScouted?: number;
        scoutNeeded?: boolean;
        storageLinkId?: string;
        sources?: Array<{ id: string; x: number; y: number }>;
        controllerPos?: { x: number; y: number };
        cache?: RoomCacheData;
        lastEnergyStore?: number;
        energyNetFlow?: number;
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
        sourceId?: string;
    }

    interface EnemyInfo {
        owner: string;
        level: number;
        towers: number;
    }

    interface RoomMemoryData {
        type?: string;
        sources?: Array<{ id: string, x: number, y: number }>;
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
}

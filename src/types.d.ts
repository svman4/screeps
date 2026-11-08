class nothing {

}
export = new nothing();
declare global {
    interface Memory {
        expansionCheckTime?: number;
        obsTarget?: string;
        observerQueue?: string[];
        world?: World
    };

    interface RoomMemory {
        type?: string;
        city?: string;
        lastScouted?: number;
        scoutNeeded?: boolean;
        sources?: Array<{ id: string; x: number; y: number }>;
        controllerPos?: { x: number; y: number };
        cache?: RoomCacheData;
        enemyInfo?: {
            owner: string;
            level: number;
            towers: number;
        };
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

}

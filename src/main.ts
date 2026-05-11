import { ErrorMapper } from "./utils/ErrorMapper";
import spawnManager from "./spawn/manager.spawn";
import defenceManager from "./manager.defense";
import constructionManager from "./construction/manager.construction";
import expansionManager from "./manager.expansion";
import logisticsManager from "./manager.logistics";
import militaryController from "./manager.military";
import roleManager from "./role/manager.role";
import market from "./manager.market";
import pixels from "./manager.pixels";
import linkManager from "./manager.link";

// Δήλωση των Global συναρτήσεων για το TypeScript
declare global {
    interface Memory {
        debug: { status: boolean };
        energyQueue: { [roomName: string]: any };

    }
    interface CreepMemory {
        role: string;
        // Add other memory variables you use, e.g.:
        // room?: string;
        // working?: boolean;
    }
    namespace NodeJS {
        interface Global {
            RoomInfo: () => string;
            exportRoom: (roomName: string) => string;
        }
    }
}

/**
 * Βοηθητική συνάρτηση για οπτική πληροφόρηση στην κονσόλα
 */
(global as any).RoomInfo = function (): string {
    let answer = "\n--- 🏰 Controller Progress Report ---\n";

    const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);

    if (myRooms.length === 0) return "No rooms with active visibility found.";

    for (const room of myRooms) {
        const controller = room.controller!;

        if (controller.level === 8) {
            answer += `Room ${room.name}: [Lvl ${controller.level}] - Max Level ✨\n`;
            continue;
        }

        const remaining = controller.progressTotal - controller.progress;
        const progressPercent = (controller.progress / controller.progressTotal) * 100;
        const formattedRemaining = remaining.toLocaleString('el-GR');

        answer += `Room ${room.name}: [Lvl ${controller.level}] -> ${formattedRemaining} left (${progressPercent.toFixed(2)}% done)\n`;
    }

    return answer;
};

/**
 * Screeps Room Data Exporter
 */
(global as any).exportRoom = function (roomName: string): string {
    const room = Game.rooms[roomName];
    if (!room) {
        return "Error: Δεν έχω visibility στο δωμάτιο " + roomName;
    }

    const output: any = {
        name: room.name,
        shard: Game.shard.name,
        rcl: room.controller ? room.controller.level : 0,
        buildings: {},
        controller: room.controller ? { x: room.controller.pos.x, y: room.controller.pos.y } : null,
        terrain: {
            wall: [] as { x: number, y: number }[],
            swamp: [] as { x: number, y: number }[]
        },
        sources: [] as { x: number, y: number }[],
        mineral: null as any
    };

    const terrain = room.getTerrain();
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const t = terrain.get(x, y);
            if (t === TERRAIN_MASK_WALL) {
                output.terrain.wall.push({ x, y });
            } else if (t === TERRAIN_MASK_SWAMP) {
                output.terrain.swamp.push({ x, y });
            }
        }
    }

    const structures = room.find(FIND_STRUCTURES);
    structures.forEach(s => {
        if (s.structureType === STRUCTURE_CONTROLLER) return;

        if (!output.buildings[s.structureType]) {
            output.buildings[s.structureType] = [];
        }
        output.buildings[s.structureType].push({ x: s.pos.x, y: s.pos.y });
    });

    const sources = room.find(FIND_SOURCES);
    sources.forEach(s => {
        output.sources.push({ x: s.pos.x, y: s.pos.y });
    });

    const minerals = room.find(FIND_MINERALS);
    if (minerals.length > 0) {
        output.mineral = {
            x: minerals[0].pos.x,
            y: minerals[0].pos.y,
            mineralType: minerals[0].mineralType
        };
    }

    console.log("--- ROOM EXPORT DATA: " + roomName + " ---");
    console.log(JSON.stringify(output));
    return "Done! Ελέγξτε το console log για το JSON.";
};

/**
 * Main Loop
 */
export const loop = ErrorMapper.wrapLoop(() => {
    const startCpu = Game.cpu.getUsed();

    if (!Memory.rooms) {
        Memory.rooms = {};
    }

    // Εκτέλεση ανά δωμάτιο
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {

            runAndCatch((name: string) => defenceManager.run(name), `Error on defenceManager (${roomName})`, roomName);
            runAndCatch((name: string) => militaryController.run(name), `Error on militaryController (${roomName})`, roomName);
            runAndCatch((name: string) => logisticsManager.run(name), `Error on logisticsManager (${roomName})`, roomName);
            runAndCatch((name: string) => linkManager.run(name), `Error on linkManager (${roomName})`, roomName);
            runAndCatch((name: string) => constructionManager.run(name), `Error on constructionManager (${roomName})`, roomName);
            runAndCatch((name: string) => market.run(name), `Error on market (${roomName})`, roomName);

            if (Memory.debug && Memory.debug.status) {
                showRoomInfo(room);
            }
        }
    }

    runAndCatch(() => roleManager.run(), "Error on roleManager");
    runAndCatch(() => spawnManager.run(), "Error on spawnManager");
    runAndCatch(() => expansionManager.run(), "Error on expansionManager");
    runAndCatch(() => pixels.run(), "Error on pixels");

    if (Game.time % 10 === 0) {
        const endCpu = Game.cpu.getUsed();
        const cpuUsed = (endCpu - startCpu).toFixed(3);
        if (parseFloat(cpuUsed) > 10) {
            console.log(`CPU Bucket: ${Game.cpu.bucket} | Creeps: ${Object.keys(Game.creeps).length} | cpuUsed: ${cpuUsed} | ${Game.time}`);
        }
    }
});

/**
 * Helper για try-catch blocks
 */
function runAndCatch(action: (...args: any[]) => void, message: string, ...args: any[]): void {
    try {
        action(...args);
    } catch (error: any) {
        console.log(`${message}: ${error.message}`);
        console.log(error.stack);
    }
}

/**
 * Visuals Info
 */
function showRoomInfo(room: Room): void {
    const visual = new RoomVisual(room.name);
    const creeps = room.find(FIND_MY_CREEPS);

    const roles: { [key: string]: number } = {};
    creeps.forEach(creep => {
        const role = creep.memory.role || 'unknown';
        roles[role] = (roles[role] || 0) + 1;
    });

    let infoText = `Pop: ${creeps.length}`;
    for (const role in roles) {
        infoText += ` ${role}:${roles[role]}`;
    }

    const energyInfo = `Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`;
    visual.text(infoText, 1, 1, { align: 'left', color: '#ffffff' });
    visual.text(energyInfo, 1, 2, { align: 'left', color: '#ffff00' });

    if (room.controller) {
        const controllerInfo = `RCL: ${room.controller.level} Progress: ${room.controller.progress}/${room.controller.progressTotal}`;
        visual.text(controllerInfo, 1, 3, { align: 'left', color: '#00ff00' });
    }

    const constructionText = `Construction sites: ${room.find(FIND_CONSTRUCTION_SITES).length}`;
    visual.text(constructionText, 1, 4, { align: 'left', color: '#ffffff' });

    if (Memory.energyQueue && Memory.energyQueue[room.name]) {
        // Υποθέτοντας ότι το logisticsManager έχει μετατραπεί επίσης
        (logisticsManager as any).showQueueInfo?.(room);
    }
}
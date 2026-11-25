import roomCacheClass = require("./utils.RoomCache");
const roomCache = roomCacheClass as any;
import { MOVEMENT_CONSTANTS } from "./constants";
type MoveTarget = RoomPosition | { pos: RoomPosition };


export class MovementManager {
    private readonly matrixCache: Record<string, CostMatrix> = {};
    private readonly lastMatrixUpdate: Record<string, number> = {};


    /**
     * Επιστρέφει (ή δημιουργεί με cache) το CostMatrix ενός room.
     */
    public getRoomCostMatrix = (roomName: string): CostMatrix => {
        if (
            this.matrixCache[roomName] &&
            this.lastMatrixUpdate[roomName] > Game.time - MOVEMENT_CONSTANTS.MATRIX_TTL
        ) {
            return this.matrixCache[roomName];
        }

        const room = Game.rooms[roomName];
        if (!room) {
            return new PathFinder.CostMatrix();
        }

        const costs = new PathFinder.CostMatrix();
        const cachedRoom = roomCache.in(roomName);

        cachedRoom.structures.forEach((struct: AnyStructure) => {
            if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (
                struct.structureType !== STRUCTURE_CONTAINER &&
                (struct.structureType !== STRUCTURE_RAMPART || !(struct as StructureRampart).my)
            ) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        this.matrixCache[roomName] = costs;
        this.lastMatrixUpdate[roomName] = Game.time;
        return costs;
    };

    /**
     * Μετακινεί το creep προς τον στόχο χρησιμοποιώντας PathFinder,
     * stuck detection και καταγραφή επόμενου βήματος.
     */
    public smartMove = (
        creep: Creep,
        target: MoveTarget | null | undefined,
        range = 1
    ): ScreepsReturnCode => {
        if (!target) {
            return ERR_INVALID_TARGET;
        }

        const targetPos: RoomPosition = "pos" in target ? target.pos : target;

        if (creep.pos.inRangeTo(targetPos, range)) {
            return OK;
        }

        // Ανίχνευση κολλήματος (stuck detection)
        const lastPos = creep.memory._lastPos;
        if (
            lastPos &&
            lastPos.x === creep.pos.x &&
            lastPos.y === creep.pos.y &&
            lastPos.roomName === creep.pos.roomName
        ) {
            creep.memory._stuckCount = (creep.memory._stuckCount || 0) + 1;
        } else {
            creep.memory._stuckCount = 0;
            creep.memory._lastPos = {
                x: creep.pos.x,
                y: creep.pos.y,
                roomName: creep.pos.roomName
            };
        }

        const isStuck = (creep.memory._stuckCount || 0) > MOVEMENT_CONSTANTS.STUCK_THRESHOLD;

        const ret = PathFinder.search(
            creep.pos,
            { pos: targetPos, range },
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: (roomName: string) => {
                    let costs = this.getRoomCostMatrix(roomName);

                    if (isStuck) {
                        costs = costs.clone();
                        const room = Game.rooms[roomName];
                        if (room) {
                            roomCache.in(roomName).myCreeps.forEach((otherCreep: Creep) => {
                                if (otherCreep.id !== creep.id) {
                                    costs.set(otherCreep.pos.x, otherCreep.pos.y, 0xff);
                                }
                            });
                        }
                    }

                    return costs;
                },
                maxOps: 2000
            }
        );

        if (ret.path.length > 0) {
            const nextStep = ret.path[0];
            creep.memory._nextStep = {
                x: nextStep.x,
                y: nextStep.y,
                t: Game.time
            };

            const direction = creep.pos.getDirectionTo(nextStep);
            return creep.move(direction);
        }

        return creep.moveTo(targetPos, {
            reusePath: 10,
            //visualizePathStyle: { stroke: "#ffaa00" }
        });
    };

    /**
     * Ελέγχει αν κάποιο γειτονικό creep σκοπεύει να κινηθεί στο τρέχον πλακάκι του creep.
     */
    public isBlockingPath = (creep: Creep): boolean => {
        const scanner = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: (otherCreep: Creep) => {
                return (
                    otherCreep.id !== creep.id &&
                    !!otherCreep.memory._nextStep &&
                    otherCreep.memory._nextStep.t === Game.time &&
                    otherCreep.memory._nextStep.x === creep.pos.x &&
                    otherCreep.memory._nextStep.y === creep.pos.y
                );
            }
        });

        return scanner.length > 0;
    };
} // end of class MovementManager
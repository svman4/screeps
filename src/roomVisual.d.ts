export { };

declare global {
    interface RoomVisual {
        structure(x: number, y: number, type: string, cfg?: any): RoomVisual;
        connectRoads(cfg?: any): RoomVisual;
    }
}
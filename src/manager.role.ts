import simpleHarvester = require("./role.simpleHarvester");
import Upgrader from "./role.upgrader";
import staticHarvester = require("./role.staticHarvester");
import builder = require("./role.builder");
import claimer = require("./role.claimer");
import scout = require("./role.scout");
import supporter = require("./role.supporter");
import lDHarvester = require("./role.lDHarvester");
import miner = require("./role.miner");
import recycleCreep = require("./role.recycleCreep");

/**
 * Βασικό συμβόλαιο που πρέπει να υλοποιεί κάθε κλάση ρόλου creep.
 */
export interface ICreepRole {
    run(): void;
    manageLifecycle(recoveryContainerId?: string): void;
}

/**
 * Κατασκευαστής κλάσης ρόλου που δέχεται το `Creep` στο constructor.
 */
export type RoleConstructor = new (creep: Creep) => ICreepRole;

/**
 * Υποστηριζόμενοι ρόλοι creeps στο σύστημα.
 */
export type CreepRoleName =
    | "simpleHarvester"
    | "upgrader"
    | "staticHarvester"
    | "builder"
    | "claimer"
    | "scout"
    | "supporter"
    | "LDHarvester"
    | "miner"
    | "to_be_recycled";

/**
 * Διαχειρίζεται την εκτέλεση της λογικής και του κύκλου ζωής για κάθε ενεργό creep.
 */
export class RoleManager {
    /** Χάρτης αντιστοίχισης ονόματος ρόλου στην αντίστοιχη κλάση υλοποίησης */
    private readonly roleClasses: Record<CreepRoleName, RoleConstructor> = {
        simpleHarvester: simpleHarvester as RoleConstructor,
        upgrader: Upgrader as RoleConstructor,
        staticHarvester: staticHarvester as RoleConstructor,
        builder: builder as RoleConstructor,
        claimer: claimer as RoleConstructor,
        scout: scout as RoleConstructor,
        supporter: supporter as RoleConstructor,
        LDHarvester: lDHarvester as RoleConstructor,
        miner: miner as RoleConstructor,
        to_be_recycled: recycleCreep as RoleConstructor
    };

    /**
     * Εκτελεί τη λογική ρόλου και τη διαχείριση κύκλου ζωής για όλα τα creeps που δεν κάνουν spawn.
     */
    public run = (): void => {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (!creep || creep.spawning) {
                continue;
            }

            const role = creep.memory.role as CreepRoleName | undefined;
            if (!role) {
                continue;
            }

            const RoleClass = this.roleClasses[role];
            if (!RoleClass) {
                continue;
            }

            try {
                const roleInstance = new RoleClass(creep);
                roleInstance.run();
                roleInstance.manageLifecycle(roomCache.in(creep.room.name).recoveryContainer);//memory.recoveryContainerId);
            } catch (error) {
                console.log(`Error in role ${role} for ${creep.name}:`, error);
            }
        }
    };
}
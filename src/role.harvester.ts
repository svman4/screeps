import BaseRole from './role.base';
export class Harvester extends BaseRole {
   /**
     * Εντοπίζει ή ανακτά την πηγή ενέργειας από τη μνήμη.
     */
   resolveSource(): Source | null {
      if (!this.creep.memory.sourceId) {
         const closest = this.creep.pos.findClosestByPath(FIND_SOURCES);
         if (closest) this.creep.memory.sourceId = closest.id;
      }
      return this.creep.memory.sourceId ? Game.getObjectById(this.creep.memory.sourceId) : null;
   }

   /**
    * Εκτελεί το harvest στην πηγή.
    */
   performHarvest(source: Source): void {
      if (source.energy > 0) {
         this.creep.harvest(source);
      }
   } // end of performHarvest

} // end of class Harvester
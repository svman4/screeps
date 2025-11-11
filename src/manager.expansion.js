
const expansionManager = {
    run:function() {
        //This manager is CPU-intensive, so run it less frequently.
        if (Game.time % 100 !== 0) {
            return; 
        }

        // Simple logic: if we have no claimers, and CPU is high, consider expanding.
        const claimers = _.filter(Game.creeps, (creep) => creep.memory.role === 'claimer');
        if (claimers.length === 0 && Game.cpu.bucket > 9000) {
            // In a real scenario, you'd have logic to find a suitable room to claim.
            // For now, we'll just log a message.
            console.log("Expansion Manager: Conditions are right to expand. A real implementation would now find a room and spawn a claimer.");
            
         //   Example of how you might request a claimer from the spawn manager:
            //This requires coordination with the spawn manager to handle a 'claimer' request.
           // Game.spawns['Spawn1'].memory.spawnQueue.push('claimer');
        }        
    } // end of run
}; // end of expasionManager

module.exports = expansionManager;

const debugConsole = require("utils.debugConsole");

const DYNAMIC_ENERGY_FLOW_CONSTANT = {
   REFRESH_RATE: 100,
   EMA_SMOOTHING_PERIODS: 13, // How many cycles back the EMA remembers
};

class DynamicEnergyFlow {
   refresh(room) {
      if (!room.memory) {
         return;
      }

      // Optional: If you want this to strictly run only on your refresh interval ticks:
      // if (Game.time % DYNAMIC_ENERGY_FLOW_CONSTANT.REFRESH_RATE !== 0) return;

      let currentScore = 0;

      if (room.storage) {
         currentScore += room.storage.store[RESOURCE_ENERGY];
      }
      if (room.terminal) {
         currentScore += room.terminal.store[RESOURCE_ENERGY];
      }

      const containers = roomCache.getContainers(room.name);
      if (containers) {
         for (const container of containers) {
            currentScore += container.store[RESOURCE_ENERGY];
         }
      }

      if (room.memory.lastEnergyStore !== undefined) {
         const delta = currentScore - room.memory.lastEnergyStore;

         // NOTE: Ensure this divisor matches your actual calling frequency.
         // If called every tick, do not divide by REFRESH_RATE. 
         // If called every REFRESH_RATE ticks, this division is correct.
         const netPerTickThisInterval = delta / DYNAMIC_ENERGY_FLOW_CONSTANT.REFRESH_RATE;

         const alpha = 2 / (DYNAMIC_ENERGY_FLOW_CONSTANT.EMA_SMOOTHING_PERIODS + 1);
         room.memory.energyNetFlow = ((room.memory.energyNetFlow || 0) * (1 - alpha)) + (netPerTickThisInterval * alpha);

         debugConsole.debugText("DynamicEnergyFlow", "energyNetFlow=" + room.memory.energyNetFlow);
      }

      room.memory.lastEnergyStore = currentScore;
   }
}

module.exports = new DynamicEnergyFlow();
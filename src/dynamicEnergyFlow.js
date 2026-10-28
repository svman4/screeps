const debugConsole = require("utils.debugConsole");
var roomCache = require('utils.RoomCache');

const DYNAMIC_ENERGY_FLOW_CONSTANT = {
   REFRESH_RATE: 100,
   EMA_SMOOTHING_PERIODS: 30, // How many cycles back the EMA remembers
};
const MEMORY_KEY = {
   LAST_ENERGY_SCORE_KEY: "lastEnergyStore",
   ENERGY_NET_FLOW_KEY: "energyNetFlow",
}
class DynamicEnergyFlow {
   refresh(room) {
      if (!room.memory) {
         return;
      }

      // Optional: If you want this to strictly run only on your refresh interval ticks:
      if (Game.time % DYNAMIC_ENERGY_FLOW_CONSTANT.REFRESH_RATE !== 0) return;

      let currentScore = 0;

      if (room.storage) {
         currentScore += room.storage.store[RESOURCE_ENERGY];
      }
      //console.log("1 "+currentScore);
      if (room.terminal) {
         currentScore += room.terminal.store[RESOURCE_ENERGY];
      }
      //console.log("2 "+currentScore);  
      const containers = roomCache.getContainers(room.name);
      if (containers) {
         for (const container of containers) {
            currentScore += container.store[RESOURCE_ENERGY];
         }
      }
      //console.log("3 " + currentScore);
      if (room.memory[MEMORY_KEY.LAST_ENERGY_SCORE_KEY] !== undefined) {
         const delta = currentScore - room.memory[MEMORY_KEY.LAST_ENERGY_SCORE_KEY]

         const netPerTickThisInterval = delta / DYNAMIC_ENERGY_FLOW_CONSTANT.REFRESH_RATE;

         const alpha = 2 / (DYNAMIC_ENERGY_FLOW_CONSTANT.EMA_SMOOTHING_PERIODS + 1);
         const lastNetFlow = (room.memory[MEMORY_KEY.ENERGY_NET_FLOW_KEY] || 0);
         //console.log(alpha);
         room.memory[MEMORY_KEY.ENERGY_NET_FLOW_KEY] =
            lastNetFlow * (1 - alpha) +
            (netPerTickThisInterval * alpha);

         debugConsole.debugText("DynamicEnergyFlow",
            "energyNetFlow=" + room.memory[MEMORY_KEY.ENERGY_NET_FLOW_KEY] +
            ", lastNetFlow " + lastNetFlow);
      }

      room.memory[MEMORY_KEY.LAST_ENERGY_SCORE_KEY] = currentScore;
   } // end of refresh(room)
} // end of class DynamicEnergyFlow

module.exports = new DynamicEnergyFlow();
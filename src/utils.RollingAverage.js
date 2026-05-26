const CPU_ROLLING_AVERAGE_LENGTH = 20;
const consoleDebug = require('utils.debugConsole');
class RollingAverage {

   constructor(size = CPU_ROLLING_AVERAGE_LENGTH) {
      this.size = size;
      this.values = [];
      this.sum = 0;

   }

   add(value) {
      this.values.push(value);
      this.sum += parseFloat(value);
      if (this.values.length > this.size) {
         this.sum -= parseFloat(this.values.shift());
      }
      // consoleDebug.debugText(`RollingAverage`, `Added value: ${value}, New average: ${this.get()} sum is ${this.sum} values: ${this.values.join(",")}`);
   }

   get() {
      if (this.values.length === 0) return 0;
      const sum = this.sum;
      return (sum / this.values.length).toFixed(3);
   }
} // end of class
module.exports = RollingAverage;
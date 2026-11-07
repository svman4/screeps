const CPU_ROLLING_AVERAGE_LENGTH = 20;
//const consoleDebug = require('utils.debugConsole');
export class RollingAverage {
   private size: number;
   private values: number[];
   private sum: number;
   constructor(size: number = CPU_ROLLING_AVERAGE_LENGTH) {
      this.size = size;
      this.values = [];
      this.sum = 0;

   }

   public add(value: number): void {
      this.values.push(value);
      this.sum += value;
      if (this.values.length > this.size) {

         this.sum -= this.values.shift();
      }

   }

   public get(): number {
      if (this.values.length === 0) return 0;
      const sum = this.sum;
      return (sum / this.values.length);
   }
} // end of class
const DEBUG_STATE = true;

class debug {
   textToPrint(member: string, text: string) {
      if (DEBUG_STATE) {

         console.log(`[${member}] ${text}`);
      }
   } // end of textToPrint()
   objectToPrint(member: string, text: string, obj: any) {
      if (!DEBUG_STATE)
         return;
      console.log(`[${member}] ${text}` + "\n" + JSON.stringify(obj, null, 2));
   } // end of objectToPrint
} // end of debug
export default new debug();
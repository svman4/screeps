
const DEBUG_STATE = true;
class debugConsole {
	debugText(manager, message) {
		if (!DEBUG_STATE) return;
		console.log(`[${manager}] ${message}`);


	} // end of debugText
	debugObject(manager, message, obj) {
		if (!DEBUG_STATE) return;
		console.log(`[${manager}] ${message}` + "\n" + JSON.stringify(obj, null, 2));
	}
} // end of class
module.exports = new debugConsole();
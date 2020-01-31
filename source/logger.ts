import constants from "./config/constants";

class Logger {
    private _debug_enabled:boolean;
    private _error_enabled:boolean;

    constructor() {
        this._debug_enabled = constants.log_debug;
        this._error_enabled = constants.log_error;
    }

    /** Write debugging message to console, if debug_enabled is set. */
    debug(message:string, data:object):void {
        if(!this._debug_enabled) { return; }
        console.debug("========================================");
        console.debug(`DEGUB ${message}`);
        console.log(data);
    }

    /** Write error message to console.stderr, if error_enabled is set. */
    error(message:string, data:object):void {
        if(!this._error_enabled) { return; }
        console.debug("========================================");
        console.log(`ERROR: ${message}`);
        console.log(data);
    }
}

const logger = new Logger();
export default logger;

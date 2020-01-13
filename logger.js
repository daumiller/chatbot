class Logger {
    constructor(debug) {
        this.debug_enabled = debug;
        this.error_enabled = true;
    }

    error(message, data) {
        if(!this.error_enabled) { return; }
        console.log('========================================');
        console.log(`ERROR: ${message}`);
        console.log(data);
    }

    debug(message, data) {
        if(!this.debug_enabled) { return; }
        console.log('========================================');
        console.log(`DEBUG: ${message}`);
        console.log(data);
    }
}

module.exports = Logger;

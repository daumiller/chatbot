const constants = require('./constants.js');

function permission_allowed(data) {
    // "data" is formatted as passed between chatbot and commands
    const db_command = data.db_command;

    // mode check
    if(data.is_chat    && !db_command.chat_enabled   ) { return false; }
    if(data.is_whisper && !db_command.whisper_enabled) { return false; }

    // permissions check
    let permission = false;
    if((db_command.permission & constants.PERMISSION_USER    )                    ) { permission = true; }
    if((db_command.permission & constants.PERMISSION_SUB     ) && data.is_sub     ) { permission = true; }
    if((db_command.permission & constants.PERMISSION_MOD     ) && data.is_mod     ) { permission = true; }
    if((db_command.permission & constants.PERMISSION_STREAMER) && data.is_streamer) { permission = true; }
    if(!permission) { return false; }

    // TODO: cooldown check

    return true;
}

function safe_parse_int(value) {
    value = value.toString();
    const parsed = parseInt(value);
    
    if(isNaN(parsed)) { return null; }
    if(parsed.toString() !== value) { return null; } // reject partial parses ("1something", ...)
    return parsed;
}

module.exports = {
    permission_allowed: permission_allowed,
    safe_parse_int    : safe_parse_int,
};

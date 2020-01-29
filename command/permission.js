const constants = require('../constants');
const common    = require('../common');

// validate integer permission value
function integerPermission(value) {
    value = common.safe_parse_int(value);
    if(value === null) { return null; }

    if((parsed < 0) || (parsed > constants.PERMISSION_MAX)) { return null; } // bounds check
    return parsed;
}

// return permission integer from (pipe-separated) permission strings
function stringPermission(value) {
    let total_permission_value = 0;

    let modes = value.toString().split('|');
    for(let index=0; index<modes.length; ++index) {
        const curr_mode_string  = modes[index].toLowerCase();
        const curr_mode_integer = constants.PERMISSION_STRING_LOOKUP[curr_mode_string] || 0;
        if(!curr_mode_integer) { return null; } // at least one invalid mode passed
        total_permission_value |= curr_mode_integer;
    }

    return total_permission_value;
}

function db_command_update(chatbot, username, db_command, update_object) {
    chatbot.db_client.collection("commands").updateOne({ _id:db_command._id }, { $set: update_object }, (error, result) => {
        if(error !== null) {
            chatbot.twitch_client.say(chatbot.secrets.twitch.channel, `@${username} : Command "${db_command.name}" not updated.`);
            chatbot.logger.debug("Failed updating DB command", { error:error });
            return;
        }
        if(result.matchedCount !== 1) {
            chatbot.twitch_client.say(chatbot.secrets.twitch.channel, `@${username} : Command "${db_command.name}" not found.`);
            chatbot.logger.debug("DB command lookup failed", { result:result });
            return; // may just be a typo
        }
        chatbot.twitch_client.say(chatbot.secrets.twitch.channel, `@${username} : Command "${db_command.name}" updated.`);
    });
}

// - !command !quote enable|disable [chat|whisper] # global if not chat/whisper specified
function command_enable(chatbot, data, db_command) {
    if((data.words.length < 3) || (data.words.length > 4)) { return; } // invalid call

    let enable_flag   = null;
    const enable_string = data.words[2].toLowerCase();
    if(enable_string === "enable") { enable_flag = true; }
    if(enable_string === "disable") { enable_flag = false; }
    if(enable_flag === null) { return; } // invalid enable

    let mode_chat    = true;
    let mode_whisper = true;
    if(data.words.length === 4) {
        const mode_string = data.words[3].toLowerCase();
        if(mode_string === "chat") {
            mode_whisper = false;
        } else if(mode_string === "whisper") {
            mode_chat = false;
        } else if(mode_string === "all") {
            // already defaulted
        } else {
            return; // invalid mode specified
        }
    }

    let update_object = {};
    if(mode_chat   ) { update_object.chat_enabled    = enable_flag; }
    if(mode_whisper) { update_object.whisper_enabled = enable_flag; }

    db_command_update(chatbot, data.tags.username, db_command, update_object);
}

/*
    - !command !quote permission integerPermissionValue
    - !command !quote permission grant|deny|set user|sub|mod|streamer
*/
function command_permission(chatbot, data, db_command) {
    let permission_value = null;

    if((data.words.length < 4) || (data.words.length > 5)) { return; } // invalid call
    
    if(data.words.length === 4) {
        permission_value = integerPermission(data.words[3]);
    } else {
        permission_value = stringPermission(data.words[4]);
        if(permission_value !== null) {
            let permission_option = data.words[3].toLowerCase();
            if(permission_option === "grant") {
                permission_value |= db_command.permission;
            } else if(permission_option === "deny") {
                permission_value = db_command.permission ^ permission_value;
            } else if(permission_option === "set") {
                // do nothing, explicitly setting flags (also, default if none specified)
            } else {
                return; // invalid grant|deny|set option
            }
        }
    }
    if(permission_value === null) { return; } // invalid mode specified

    db_command_update(chatbot, data.tags.username, db_command, { permission:permission_value });
}

function command_command(chatbot, data) {
    if(data.words.length < 3) { return; } // invalid command

    chatbot.db_client.collection("commands").findOne({ name:data.words[1] }, (error, db_command) => {
        if(error !== null) {
            chatbot.logger.debug("Errored Command DB Lookup", { error:error });
            return;
        }

        if(data.words[2].toLowerCase() === "permission") {
            command_permission(chatbot, data, db_command);
        } else {
            command_enable(chatbot, data, db_command);
        }
    });
}

module.exports = {
    register: function(commands) {
        commands['!command'] = command_command;
        return commands;
    },
};

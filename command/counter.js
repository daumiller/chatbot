const common = require("../common");
const constants = require("../constants.js");

function command_handler(chatbot, data) {
    if(data.words.length === 1) {
        chatbot.twitch_client.say(data.channel, data.db_command.template.replace(/%%/g, data.db_command.counter_value.toString()));
        return;
    }

    if(data.words.length < 2) { return; }
    data.db_command.permission = data.db_command.permission_edit;
    if(!common.permission_allowed(data)) { return; }

    let updated = false;
    const mode = data.words[1].toLowerCase();
    if(mode === "inc") {
        if(data.words.length !== 2) { return; }
        ++data.db_command.counter_value;
        updated = true;
    }
    if(mode === "dec") {
        if(data.words.length !== 2) { return; }
        --data.db_command.counter_value;
        updated = true;
    }
    if(mode === "set") {
        if(data.words.length !== 3) { return; }
        const value = common.safe_parse_int(data.words[2]);
        if(value === null) { return; }
        data.db_command.counter_value = value;
        updated = true;
    }

    if(updated) {
        chatbot.db_client.collection("commands").updateOne({ name:data.db_command.name }, {$set: { counter_value:data.db_command.counter_value }}, function(error) {
            if(error !== null) {
                chatbot.logger.error("Failed updating counter", { error:error, db_command:data.db_command });
                chatbot.twitch_client.say(data.channel, `Unable to update counter "${name}".`);
                return;
            } else {
                chatbot.twitch_client.say(data.channel, data.db_command.template.replace(/%%/g, data.db_command.counter_value.toString()));
            }
        });
    }
}

function _counter_maintain_add(chatbot, data) {
    if(data.words.length !== 4) { return; }
    const name = data.words[2].toLowerCase();
    if(!name.length || (name[0] !== '!')) { return; } // TODO: error notification?

    const template = data.words[3];
    if(template.indexOf("%%") < 0) {
        if(data.is_chat) {
            chatbot.twich_client.say(data.channel, "Counter template must include a \"%%\".");
        }
        return;
    }

    let db_counter = {
        name            : name,
        template        : template,
        handled_by      : '!counter-handler',
        permission      : constants.PERMISSION_MAX,
        permission_edit : constants.PERMISSION_STREAMER | constants.PERMISSION_MOD,
        chat_enabled    : true,
        whisper_enabled : null,
        cooldown_seconds: null,
        cooldown_expires: null, // TODO: update with whatever we default these to,
        counter_value   : 0,
    };

    chatbot.db_client.collection("commands").insertOne(db_counter, function(error, result) {
        if(error !== null) {
            // TODO: maybe say error if it fails...?
            chatbot.logger.error("Failed creating counter", { error:error, counter:db_counter });
            return;
        }

        chatbot.twitch_client.say(data.channel, `!counter "${name}" created`);
    });
}

function _counter_maintain_edit(chatbot, data) {
    if(data.words.length !== 4) { return; }
    const name = data.words[2].toLowerCase();
    if(!name.length || (name[0] !== '!')) { return; } // TODO: error notification?

    const template = data.words[3];
    if(template.indexOf("%%") < 0) {
        if(data.is_chat) {
            chatbot.twich_client.say(data.channel, "Counter template must include a \"%%\".");
        }
        return;
    }

    chatbot.db_client.collection("commands").updateOne({ name:name }, {$set: { template:template }}, function(error) {
        if(error !== null) {
            chatbot.logger.debug("Failed deleting counter", { error:error, counter:name });
            chatbot.twitch_client.say(data.channel, `Unable to delete counter "${name}".`);
            return;
        }
    });
}

function _counter_maintain_delete(chatbot, data) {
    if(data.words.length !== 3) { return; }
    const name = data.words[2].toLowerCase();
    if(!name.length || (name[0] !== '!')) { return; } // TODO: error notification?

    chatbot.db_client.collection("commands").deleteOne({ name:name }, function(error, result) {
        if(error !== null) {
            // TODO: maybe say error if it fails...?
            chatbot.logger.error("Failed deleting counter", { error:error, counter:name });
            return;
        }

        chatbot.twitch_client.say(data.channel, `!counter "${name}" deleted`);
    });
}

function command_counter(chatbot, data) {
    const name = data.db_command.name;

    if(data.words.length < 3) { return; }
    const mode = data.words[1].toLowerCase();
    if(mode === "add"   ) { return _counter_maintain_add   (chatbot, data); }
    if(mode === "edit"  ) { return _counter_maintain_edit  (chatbot, data); }
    if(mode === "delete") { return _counter_maintain_delete(chatbot, data); }
}

module.exports = {
    register: function(commands) {
        commands['!counter']         = command_counter;
        commands['!counter-handler'] = command_handler;
        return commands;
    },
};

const constants = require('../constants.js');

function command_handle(chatbot, data) {
    if(!data.db_command.template) {
        chatbot.logger.error("Macro command missing template", { db_command:data.db_command });
        return;
    }
    chatbot.twitch_client.say(data.channel, data.db_command.template);
}

function macro_add(chatbot, data, name, template) {
    let db_macro = {
        name            : name,
        template        : template,
        handled_by      : '!macro-handler',
        permission      : constants.PERMISSION_MAX,
        chat_enabled    : true,
        whisper_enabled : false,
        cooldown_seconds: null,
        cooldown_expires: null, // TODO: update with whatever we default these to
    };

    chatbot.db_client.collection("commands").insertOne(db_macro, function(error, result) {
        if(error !== null) {
            // TODO: maybe say error if it fails...?
            chatbot.logger.error("Failed creating macro", { error:error, macro:db_macro });
            return;
        }

        chatbot.twitch_client.say(data.channel, `!macro "${name}" created`);
    });
}

function macro_delete(chatbot, data, name) {
    chatbot.db_client.collection("commands").deleteOne({ name:name }, function(error, result) {
        if(error !== null) {
            // TODO: maybe say error if it fails...?
            chatbot.logger.error("Failed deleting macro", { error:error, macro:db_macro });
            return;
        }

        chatbot.twitch_client.say(data.channel, `!macro "${name}" deleted`);
    });
}

function command_macro(chatbot, data) {
    if(data.words.length < 3) { return; }
    if(!data.words[2].length || (data.words[2][0] !== '!')) {
        chatbot.twitch_client.say(data.channel, `!macro: macro name must begin with "!" (${data.words[2]})`);
        return;
    }

    const mode = data.words[1].toLowerCase();
    if(mode === 'add'   ) { return macro_add(chatbot, data, data.words[2], data.words[3]); }
    if(mode === 'delete') { return macro_delete(chatbot, data, data.words[2]); }
    chatbot.twitch_client.say(data.channel, `!macro: bad mode "${data.words[1]}"`);
}

module.exports = {
    register: function(commands) {
        commands['!macro'       ]  = command_macro;
        commands['!macro-handler'] = command_handle;
        return commands;
    },
};

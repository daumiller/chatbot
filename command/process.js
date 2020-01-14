function command_shutdown(chatbot, data) {
    chatbot.shutdown(true, 0);
}

function command_ping(chatbot, data) {
    if(!data.is_chat) { return; } // can't whisper back
    chatbot.twitch_client.say(data.channel, 'PONG');
}

module.exports = {
    register: function(commands) {
        commands['!shutdown'] = command_shutdown;
        commands['!ping'    ] = command_ping;
        return commands;
    },
};

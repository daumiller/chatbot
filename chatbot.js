const twitch = require('tmi.js');
const mongo  = require('mongodb');
const constants = require('./constants.js');

class ChatBot {
    disconnecting = false;
    mongo_client  = null;
    db_client     = null;
    twitch_client = null;

    constructor(secrets, commands, logger) {
        this.secrets  = secrets  || {};
        this.commands = commands || {};
        this.logger   = logger   || { debug:false, error:function(){}, debug:function(){} };

        // validate needed secrets
        this._validate(this.secrets,        "SECRETS",        ["twitch", "mongo"]);
        this._validate(this.secrets.twitch, "SECRETS.twitch", ["username", "channel", "token", "streamer"]);
        this._validate(this.secrets.mongo,  "SECRETS.mongo",  ["url", "dbname"]);
    }

    get debug() { return this.logger.debug_enabled; }
    set debug(value) { this.logger.debug_enabled = value; }

    startup() {
        this._startup_mongo();
    }
    shutdown(exit, exit_code) {
        this.disconnecting = true;
        this._shutdown_twitch();
        this._shutdown_mongo();
        if(exit) { process.exit(exit_code || 0); }
    }

    _startup_mongo() {
        this.mongo_client = new mongo.MongoClient(this.secrets.mongo.url);

        this.mongo_client.connect((error) => {
            if(error) {
                this.logger.error("Mongo connection failed", { error:error });
                throw "Mongo connection failed";
            }
            this.db_client = this.mongo_client.db(this.secrets.mongo.dbname);

            this._startup_twitch();
        });
    }
    _shutdown_mongo() {
        this.mongo_client.close();
        this.mongo_client = this.db_client = null;
    }

    _startup_twitch() {
        this.twitch_client = new twitch.Client({
            options: { debug:this.debug },
            connection: { reconnect:true, secure:true },
            identity: { username:this.secrets.twitch.username, password:this.secrets.twitch.token },
            channels: [ this.secrets.twitch.channel ],
        });

        this.twitch_client.connect().
            then(() => {
                this.twitch_client.on('join', this._twitch_event_join.bind(this));
                this.twitch_client.on('message', this._twitch_event_message.bind(this));
            }).catch((error) => {
                this._shutdown_mongo();
                this.logger.error("Twitch connection failed", { error:error });
                throw "Twitch connection failed";
            });
    }
    _shutdown_twitch() {
        this.twitch_client.disconnect().then(() => {
            this.twitch_client = null;
        });
    }

    _twitch_event_join(channel, username, self) {
        if((!this.twitch_client.readyState === "OPEN") || this.disconnecting || self) { return; }
        this.logger.debug("EVENT JOIN", { channel:channel, username:username });

        if(this.commands["!join"]) {
            this.commands["!join"](this, channel, username);
        }
        if(this.commands["!shoutout"]) {
            this.commands["!shoutout"](this, channel, username);
        }
    }

    _twitch_event_message(channel, tags, message, self) {
        if((!this.twitch_client.readyState === "OPEN") || this.disconnecting || self) { return; }
        if(!message.length || (message[0] !== '!')) { return; }
    
        this.logger.debug("EVENT MESSAGE", { channel:channel, tags:tags, message:message });
    
        if(this.commands["!filter"]) {
            if(this.commands["!filter"](this, channel, tags, message)) {
                // message was filtered
                return;
            }
        }
    
        let words = message.match(/"[^"]+"|\S+/g);
        if(!words.length) { return; }

        // strip enclosing quotes
        words = words.map((word) => {
            return word.replace(/^"([^"]*)"$/, "$1");
        });
    
        const db_commands = this.db_client.collection('commands');
        db_commands.findOne({ name:words[0] }, (error, result) => {
            if(!error && result) {
                this._twitch_event_message_continue(channel, tags, message, words, result);
            }
        });
    }
    
    _twitch_event_message_continue(channel, tags, message, words, db_command) {
        const is_chat     = tags && (tags['message-type'] === 'chat');
        const is_whisper  = tags && (tags['message-type'] === 'whisper');
        const is_sub      = tags && (tags['subscriber']   === 'true'); // NOTE: is_sub only valid for is_chat messages
        const is_mod      = tags && (tags['mod'] === true);            // NOTE: is_mod only valid for is_chat messages
        const is_streamer = tags && (tags['username'] === this.secrets.twitch.streamer);
    
        // mode check
        if(is_chat    && !db_command.chat_enabled) { return; }
        if(is_whisper && !db_command.whisper_enabled) { return; }

        // permissions check
        let permission = false;
        if((db_command.permission & constants.PERMISSION_USER    )               ) { permission = true; }
        if((db_command.permission & constants.PERMISSION_SUB     ) && is_sub     ) { permission = true; }
        if((db_command.permission & constants.PERMISSION_MOD     ) && is_mod     ) { permission = true; }
        if((db_command.permission & constants.PERMISSION_STREAMER) && is_streamer) { permission = true; }
        if(!permission) { return; }

        // TODO: cooldown check
    
        const data = {
            channel    : channel,
            tags       : tags,
            message    : message,
            db_command : db_command, // TODO: maybe (db_command.handled_by ? db_command : null) ?
    
            words      : words,
            is_chat    : is_chat,
            is_whisper : is_whisper,
            is_sub     : is_sub,
            is_mod     : is_mod,
            is_streamer: is_streamer
        };
    
        this.logger.debug("EXECUTING COMMAND", data);
        
        let command_name = db_command.handled_by || db_command.name;
        if(this.commands[command_name]) {
            this.commands[command_name](this, data);
        }
        // TODO: maybe?
        // else { chatbot.twitch_client.say(unknown command ...) }
    }

    _validate(object, object_name, keys) {
        for(let index=0; index<keys.length; ++index) {
            if(!object[keys[index]]) {
                const description = `Missing ${object_name}.${keys[index]}`;
                this.logger.error(description, {});
                throw description;
            }
        }
    }
}

module.exports = ChatBot;

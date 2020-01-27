const fs        = require('fs');
const http      = require('http');
const twitch    = require('tmi.js');
const mongo     = require('mongodb');
const socketio  = require('socket.io');
const graphemes = require('grapheme-splitter')();
const constants = require('./constants.js');

class ChatBot {
    disconnecting    = false;
    mongo_client     = null;
    db_client        = null;
    twitch_client    = null;
    websocket_server = null;

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
        this._shutdown_websocket();
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
            this._startup_websocket();
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

    _startup_websocket() {
        this._websocket_http_server = http.createServer(this._websocket_event_http.bind(this));
        this.websocket_server = socketio(this._websocket_http_server);
        this._websocket_http_server.on('error', (error) => {
            this.logger.error('Websocket Server Error', { error:error });
            throw "Websocket server error";
        });
        this._websocket_http_server.listen(this.secrets.websocket.port || 8080);
        if(this.debug) {
            this.websocket_server.on('connection', (client) => {
                this.logger.debug("Websocket connection established.", {});
            });
        }
    }
    _shutdown_websocket() {
        this.websocket_server.close();
        this._websocket_http_server.close();
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
        if((!this.twitch_client.readyState === "OPEN") || this.disconnecting) { return; }

        if(this.commands["!filter"] && !self) {
            if(this.commands["!filter"](this, channel, tags, message)) {
                // message was filtered
                return;
            }
        }

        if(tags['message-type'] && (tags['message-type'] === 'chat')) {
            this._websocket_event_chatlog(tags, message);
        }

        if(self) { return; }
        if(!message.length || (message[0] !== '!')) { return; }

        this.logger.debug("EVENT MESSAGE", { channel:channel, tags:tags, message:message });
    
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

    _websocket_event_http(request, response) {
        const filename = `${__dirname}/websocket/${request.url}`;
        fs.readFile(filename, (error, content) => {
            if(error) {
                response.writeHead(500);
                return response.end('Error loading page');
            }
            response.writeHead(200);
            return response.end(content);
        });
    }

    websocket_emit_event(name, data) {
        this.websocket_server.emit(name, data);
    }

    _websocket_event_chatlog(tags, message) {
        let emotes = tags.emotes;
        if(emotes) {
            let characters = graphemes.splitGraphemes(message);
            let sorted_emotes = [];
            for(var emote_id in emotes) {
                if(!emotes.hasOwnProperty(emote_id)) { continue; }
                for(let occurence=0; occurence<emotes[emote_id].length; ++occurence) {
                    let positions = emotes[emote_id][occurence].split('-');
                    if(positions.length === 2) {
                        let index_begin = parseInt(positions[0]);
                        let index_end   = parseInt(positions[1]);
                        // twitch appears to index actual graphemes, instead of JS string length
                        // maybe U32 vs U16? revisit if needed...
                        let offset     = characters.slice(0, index_begin).join('').length - index_begin;
                        index_begin    += offset;
                        index_end      += offset;
                        sorted_emotes.push({ id:emote_id, begin:index_begin, end:index_end });
                    }
                }
            }
            emotes = sorted_emotes.sort(function(a,b) { return a.begin - b.begin; });
        }
        const data = {
            username: tags["display-name"] || tags.username,
            color   : tags.color           || "#0000FF",
            emotes  : emotes               || [],
            message : message              || "",
        };
        this.websocket_server.emit('chatlog', data);
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

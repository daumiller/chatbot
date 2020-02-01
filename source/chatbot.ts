import fs   from "fs";
import http from "http";
import twitch   from "tmi.js";
import socketio from "socket.io";
import mongoose from "mongoose";

import Command, { DBCommand } from "./data/command";
import { permissionAllowed, graphemeSplit } from "./helpers";
import logger from "./logger";
import constants from "./config/constants";
import commands from "./config/commands";
import secrets from "./config/secrets";

export interface ChatCommandData {
    message:string;
    channel:string;
    is_chat:boolean;
    is_whisper:boolean;
    is_sub:boolean;
    is_mod:boolean;
    is_streamer:boolean;
    state:twitch.ChatUserstate;
    words:Array<string>;
    db_command:DBCommand;
}

function createJoinData(channel:string, username:string):ChatCommandData {
    return {
        message:null,
        channel:channel,
        is_chat:false,
        is_whisper:false,
        is_sub:null,
        is_mod:null,
        is_streamer:null,
        state: { username:username },
        words:[ "", username ],
        db_command:null
    };
}

function createCommandData(channel:string, state:twitch.ChatUserstate, message:string):ChatCommandData {
    const is_chat     = state["message-type"] === "chat";
    const is_whisper  = state["message-type"] === "whisper";
    const is_sub      = state["subscriber"]   === true; // NOTE: not valid during is_whisper
    const is_mod      = state["mod"]          === true; // NOTE: not valid during is_whisper
    const is_streamer = state["username"]     === secrets.twitch.streamer;

    // tokenize message
    let words = message.match(/"[^"]+"|\S+/g);
    // strip any enclosing quotes
    words = words.map((word) => {
        return word.replace(/^"([^"]*)"$/, "$1");
    });
    
    return {
        channel    : channel,
        state      : state,
        message    : message,
        db_command : null,
        words      : words,
        is_chat    : is_chat,
        is_whisper : is_whisper,
        is_sub     : is_sub,
        is_mod     : is_mod,
        is_streamer: is_streamer
    };
}

class ChatBot {
    disconnecting:boolean = false;
    private _twitch_client:twitch.Client = null;
    private _websocket_server:socketio.Server = null;
    private _websocket_http_server:http.Server = null;
    private _cooldown_timers:{[command_name:string]:number} = {};

    //=============================================================================
    // Public
    /**
     * Emit a WebSocket event to any connected clients.
     * @param name Name/type of the event.
     * @param data Object holding any needed data.
     */
    emitWebsocketEvent(name:string, data:object):void {
        if(this.disconnecting) { return; }
        if(!this._websocket_server) { return; }
        this._websocket_server.emit(name, data);
    }
    /**
     * Send a chat message in the connected Twitch channel.
     * @param message message
     */
    say(message:string):void {
        if(this.disconnecting) { return; }
        if(!this._twitch_client) { return; }
        this._twitch_client.say(secrets.twitch.channel, message);
    }
    /**
     * Send a whisper message to the specified user.
     * 
     * NOTE: Currently throws, because ChatBot is unable to whisper ATM.
     * @param username user to whisper to
     * @param message message
     */
    whipser(username:string, message:string):void {
        // https://github.com/tmijs/tmi.js/issues/333
        throw new Error("ChatBot currently unable to whisper (twitch limitation).");
        this._twitch_client.whisper(username, message);
    }

    //=============================================================================
    // Startup
    /**
     * Start ChatBot and required services.
     */
    startup():void {
        this._mongoStartup();
    }
    /**
     * Shutdown ChatBot and services.
     * @param exit_process end node process after shutdown completes
     * @param exit_code if exiting process, return code to use
     */
    shutdown(exit_process:boolean, exit_code?:number):void {
        if(this.disconnecting) { return; }
        this.disconnecting = true;
        this._websocketShutdown();
        this._twitchShutdown();
        this._mongoShutdown();
        if(exit_process) { process.exit(exit_code || 0); }
    }

    //=============================================================================
    // Mongo
    private _mongoStartup():void {
        // NOTE: We actually need to buffer, because we setup models before DB connection...
        // mongoose.set("bufferCommands", false);
        mongoose.connect(secrets.mongo.url, { useUnifiedTopology:true, useNewUrlParser:true }, (error) => {
            if(error) {
                logger.error("Mongo connection failed", { error:error });
                throw new Error("Mongo connection failed");
            }
            this._twitchStartup();
            this._websocketStartup();
        });
    }

    private _mongoShutdown():void {
        mongoose.disconnect();
    }

    //=============================================================================
    // Twitch
    private _twitchStartup():void {
        this._twitch_client = twitch.Client({
            options: { debug:constants.log_debug },
            connection: { reconnect:true, secure:true },
            identity: { username:secrets.twitch.username, password:secrets.twitch.token },
            channels: [ secrets.twitch.channel ],
        });

        this._twitch_client.connect().
            then(() => {
                this._twitch_client.on("join", this._twitchEventJoin.bind(this));
                this._twitch_client.on("message", this._twitchEventMessage.bind(this));
            }).catch((error) => {
                logger.error("Twitch connection failed", { error:error });
                throw new Error("Twitch connection failed");
            });
    }

    private _twitchShutdown():void {
        this._twitch_client.disconnect().then(() => {
            this._twitch_client = null;
        });
    }

    private _twitchEventJoin(channel:string, username:string, self:boolean):void {
        if(!(this._twitch_client.readyState() === "OPEN") || this.disconnecting || self) { return; }
        logger.debug("TWITCH EVENT JOIN", { channel:channel, username:username });

        const data = createJoinData(channel, username);

        if(commands["!join"]) {
            data.words[0] = "!join";
            commands["!join"](this, data);
        }
        if(commands["!greet"]) {
            data.words[0] = "!greet";
            commands["!greet"](this, data);
        }
    }

    private _twitchEventMessage(channel:string, state:twitch.ChatUserstate, message:string, self:boolean):void {
        if(!(this._twitch_client.readyState() === "OPEN") || this.disconnecting) { return; }
        const data = createCommandData(channel, state, message);

        if(commands["!filter"] && !self) {
            if(commands["!filter"](this, data)) {
                // message was filtered out
                return;
            }
        }

        if(state["message-type"] && (state["message-type"] === "chat")) {
            this._websocketEventChatlog(data);
        }

        if(self) { return; }
        if(!message.length || (message[0] !== "!")) { return; }
        logger.debug("EVENT MESSAGE", data);

        Command.findOne({ name:data.words[0] }, (error, result) => {
            if(!error && result) {
                this._twitchEventMessageContinue(data, result);
            }
        });
    }

    private _twitchEventMessageContinue(data:ChatCommandData, db_command:DBCommand):void {
        data.db_command = db_command;
        if(!permissionAllowed(data)) { return; }

        const now:Date = new Date();
        if(db_command.cooldown_seconds) {
            if(this._cooldown_timers[db_command.name]) {
                if(now.getTime() < this._cooldown_timers[db_command.name]) { return; } // cooldown not expired
            }
            now.setSeconds(now.getSeconds() + db_command.cooldown_seconds);
            this._cooldown_timers[db_command.name] = now.getTime();
        }

        logger.debug("EXECUTING COMMAND", data);

        const command_name = db_command.handled_by || db_command.name;
        if(commands[command_name]) {
            commands[command_name](this, data);
        }
    }

    //=============================================================================
    // Websocket
    private _websocketStartup():void {
        this._websocket_http_server = http.createServer(this._websocketEventHttp.bind(this));
        this._websocket_server = socketio(this._websocket_http_server);
        this._websocket_http_server.on("error", (error) => {
            logger.error("Websocket HTTP server startup failed", { error:error });
            throw new Error("Websocket HTTP server startup failed");
        });
        this._websocket_http_server.listen(secrets.websocket.port, secrets.websocket.binding);
        if(constants.log_debug) {
            this._websocket_server.on("connection", (client) => {
                logger.debug("Websocket connection established", {});
            });
        }
    }

    private _websocketShutdown():void {
        this._websocket_server.close();
        this._websocket_http_server.close();
    }

    private _websocketEventHttp(request:http.IncomingMessage, response:http.ServerResponse):void {
        const filename = `${__dirname}/../websocket/${request.url}`;
        fs.readFile(filename, (error, content) => {
            if(error) {
                response.writeHead(500);
                return response.end("Error loading page.");
            }
            response.writeHead(200);
            return response.end(content);
        });
    }

    private _websocketEventChatlog(data:ChatCommandData):void {
        // twitch provides message string, and object set of emotes.
        // each emote value is an array of arrays,
        // each specifying a beginning and ending offset (grapheme or U32?) within the message.
        // convert this to a single array of emotes with beginning/ending offsets we can work with
        const emotes = data.state.emotes;
        let sorted_emotes:Array<{ id:string; begin:number; end:number }> = [];
        if(emotes) {
            const characters = graphemeSplit(data.message);
            for(const emote_id in emotes) {
                if(!emotes.hasOwnProperty(emote_id)) { continue; }
                for(let occurence=0; occurence<emotes[emote_id].length; ++occurence) {
                    const positions = emotes[emote_id][occurence].split("-");
                    if(positions.length !== 2) { continue; }

                    let index_begin = parseInt(positions[0]);
                    let index_end   = parseInt(positions[1]);
                    const offset      = characters.slice(0, index_begin).join("").length - index_begin;

                    index_begin += offset;
                    index_end   += offset;
                    sorted_emotes.push({ id:emote_id, begin:index_begin, end:index_end });
                }
            }
            sorted_emotes = sorted_emotes.sort(function(a,b) { return a.begin - b.begin; });
        }

        const client_data = {
            username: data.state["display-name"] || data.state.username,
            color   : data.state.color           || "#0000FF",
            message : data.message               || "",
            emotes  : sorted_emotes,
        };
        this.emitWebsocketEvent("chatlog", client_data);
    }
}

export default ChatBot;

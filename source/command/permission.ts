import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Command, { DBCommand } from "../data/command";
import { permissionParseInt, permissionParseString } from "../helpers";
import logger from "../logger";

function _updateCommandAndNotify(chatbot:ChatBot, data:ChatCommandData, subcommand:DBCommand, update_object:object):void {
    subcommand.update(update_object, (error, result) => {
        if((error !== null) || (result.matchedCount !== 1)) {
            chatbot.say(`@${data.state.username} : unable to update command "${subcommand.name}".`);
            logger.debug("Failed updating DB command.", { error:error }); // subcommand was already found, so this update shouldn't fail
            return;
        }
        chatbot.say(`@${data.state.username} : updated "${subcommand.name}".`);
    });
}

// "!command ${command.name} enable|disable [chat|whisper]
//     enable or disable a command for chat, whisper, or globally if not specified
function commandCommand_Enable(chatbot:ChatBot, data:ChatCommandData, subcommand:DBCommand):void {
    if((data.words.length < 3) || (data.words.length > 4)) { return; } // invalid call; bad argument length

    let enable_flag:boolean = null;
    const enable_string:string = data.words[2].toLowerCase();
    if(enable_string === "enable" ) { enable_flag = true;  }
    if(enable_string === "disable") { enable_flag = false; }
    if(enable_flag === null) { return; } // invalid enable argument

    let mode_chat:boolean    = true;
    let mode_whisper:boolean = true;
    if(data.words.length === 4) {
        const mode_string:string = data.words[3].toLowerCase();
        if(mode_string === "chat") {
            mode_whisper = false;
        } else if(mode_string === "whisper") {
            mode_chat = false;
        } else {
            return; // invalid mode argument
        }
    }

    const update_object:any = {};
    if(mode_chat   ) { update_object.chat_enabled    = enable_flag; }
    if(mode_whisper) { update_object.whisper_enabled = enable_flag; }

    _updateCommandAndNotify(chatbot, data, subcommand, update_object);
}

// "!command ${command.name} permission integerPermissionValue"
//     set permission value for command
//
// "!command ${command.name} permission grant|deny|set stringPermissionValue"
//     set or modify command permissions for given groups
function commandCommand_Permission(chatbot:ChatBot, data:ChatCommandData, subcommand:DBCommand):void {
    let permission_value:number = null;

    if((data.words.length < 4) || (data.words.length > 5)) { return; } // invalid call; bad argument length
    
    if(data.words.length === 4) {
        permission_value = permissionParseInt(data.words[3]);
    } else {
        permission_value = permissionParseString(data.words[4]);

        const permission_option:string = data.words[3].toLowerCase();
        switch(permission_option) {
            case "grant":
                permission_value |= subcommand.permission; // adding flags
                break;
            case "deny":
                permission_value ^= subcommand.permission; // removing flags;
                break;
            case "set":
                // already set
                break;
            default:
                return; // invalid mode argument
        }
    }
    if(permission_value === null) { return; } // invalid permission_value argument

    _updateCommandAndNotify(chatbot, data, subcommand, { permission:permission_value });
}

function commandCommand(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length < 3) { return; } // invalid command; at least 3 arguments required

    Command.findOne({ name:data.words[1] }, (error, subcommand) => {
        if(error !== null) { return; } // given ${command.name} was invalid/missing
        
        if(data.words[2].toLowerCase() === "permission") {
            commandCommand_Enable(chatbot, data, subcommand);
        } else {
            commandCommand_Permission(chatbot, data, subcommand);
        }
    });
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!command"] = commandCommand;
    return commands;
}

export default register;

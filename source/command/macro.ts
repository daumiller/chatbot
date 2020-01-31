import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Command, { DBCommand } from "../data/command";
import constants from "../config/constants";
import logger from "../logger";

// !${command.name}
//     send reply with macro template
function commandMacro_Handler(chatbot:ChatBot, data:ChatCommandData):void {
    if(!data.db_command.template) {
        logger.error("Macro command missing template.", data);
        return;
    }
    chatbot.say(data.db_command.template);
}

// !macro add ${command.name} templateString
//     create a new macro, with given name and template
function commandMacro_Add(chatbot:ChatBot, data:ChatCommandData, macro_name:string, macro_template:string):void {
    const db_macro:DBCommand = new Command({
        name            : macro_name,
        template        : macro_template,
        handled_by      : "!macro-handler",
        permission      : constants.permissions["all"].value,
        chat_enabled    : true,
        whisper_enabled : false,
        cooldown_seconds: null,
        cooldown_expires: null, // TODO: update with whatever we default these to
    });

    db_macro.save((error, db_command) => {
        if(error !== null) {
            logger.error("Failed creating macro.", { data:data, db_macro:db_macro, error:error });
            chatbot.say(`@${data.state.username} : failed creating macro "${macro_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : created macro "${macro_name}".`);
    });
}

// !macro delete ${command.name}
//     delete given macro
function commandMacro_Delete(chatbot:ChatBot, data:ChatCommandData, macro_name:string):void {
    Command.deleteOne({ name:macro_name }, (error) => {
        if(error !== null) {
            logger.error("Failed deleting macro.", { data:data, macro_name:macro_name, error:error });
            chatbot.say(`@${data.state.username} : failed deleting macro "${macro_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : deleted macro "${macro_name}".`);
    });
}

function commandMacro(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length < 3) { return; } // invalid arguments; requires at least 3
    if(!data.words[2].length || (data.words[2][0] !== "!")) {
        chatbot.say(`@${data.state.username} : macro name must begin with "!" (${data.words[2]}).`);
        return;
    }

    const mode = data.words[1].toLowerCase();
    switch(mode) {
        case "add":
            commandMacro_Add(chatbot, data, data.words[2], data.words[3]);
            break;
        case "delete":
            commandMacro_Delete(chatbot, data, data.words[2]);
            break;
        default:
            chatbot.say(`@${data.state.username} : bad macro mode "${data.words[1]}".`);
    }    
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!macro"        ] = commandMacro;
    commands["!macro-handler"] = commandMacro_Handler;
    return commands;
}

export default register;

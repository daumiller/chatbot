import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Command from "../data/command";
import constants from "../config/constants";
import { permissionAllowed, safeParseInt } from "../helpers";
import logger from "../logger";

// ${counter_name}
//     display template
//
// ${counter_name} inc
//     increment counter and display result (uses permission_edit)
//
// ${counter_name} dec
//     decrement counter and display result (uses permission_edit)
//
// ${counter_name} set value
//     set counter value and display result (uses permission_edit)
function commandCounter_Handler(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length === 1) {
        chatbot.say(data.db_command.template.replace(/%%/g, data.db_command.counter.toString()));
        return;
    }

    if(data.words.length < 2) { return; }
    data.db_command.permission = data.db_command.permission_edit;
    if(!permissionAllowed(data)) { return; }

    const mode:string = data.words[1].toLowerCase();
    switch(mode) {
        case "inc":
            if(data.words.length !== 2) { return; }
            ++(data.db_command.counter);
            break;
        case "dec":
            if(data.words.length !== 2) { return; }
            --(data.db_command.counter);
            break;
        case "set":
            if(data.words.length !== 3) { return; }
            {
                const value = safeParseInt(data.words[2]);
                if(value === null) { return; }
                data.db_command.counter = value;
            }
            break;
        default:
            chatbot.say(`@${data.state.username} : invalid counter command "${data.words[1]}".`);
            return;
    }

    data.db_command.save((error, result) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : failed updating counter "${data.db_command.name}".`);
            logger.error("Failed updating counter.", { data:data, error:error });
            return;
        }
        chatbot.say(data.db_command.template.replace(/%%/g, data.db_command.counter.toString()));
    });
}

// !counter add ${counter_name} template
function commandCounter_Add(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length !== 4) { return; } // extraneous/missing arguments

    const counter_name = data.words[2].toLowerCase();
    if(!counter_name.length || (counter_name[0] !== "!")) {
        chatbot.say(`@${data.state.username} : invalid counter name "${counter_name}".`);
        return;
    }

    const template = data.words[3];
    if(template.indexOf("%%") < 0) {
        chatbot.say(`@${data.state.username} : counter template must include a "%%".`);
        return;
    }

    const db_counter = new Command({
        name            : counter_name,
        template        : template,
        handled_by      : "!counter-handler",
        permission      : constants.permissions["all"].value,
        permission_edit : constants.permissions["mod"].value | constants.permissions["streamer"].value,
        chat_enabled    : true,
        whisper_enabled : false,
        cooldown_seconds: null,
        counter         : 0,
    });

    db_counter.save((error, db_command) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : failed creating counter "${counter_name}".`);
            logger.error("Failed creating counter.", { data:data, db_counter:db_counter, error:error });
            return;
        }
        chatbot.say(template.replace(/%%/g, "0"));
    });
}

// !counter edit ${counter_name} template
function commandCounter_Edit(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length !== 4) { return; } // extraneous/missing arguments

    const counter_name = data.words[2].toLowerCase();
    const template = data.words[3];
    if(template.indexOf("%%") < 0) {
        chatbot.say(`@${data.state.username} : counter template must include a "%%".`);
        return;
    }

    Command.updateOne({ name:counter_name }, { template:template }, (error, result) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : unable to edit counter "${counter_name}".`);
            return;
        }
        Command.findOne({ name:counter_name }, (error, db_counter) => {
            if(db_counter) {
                chatbot.say(db_counter.template.replace(/%%/g, db_counter.counter.toString()));
            } else {
                // how TF we get here?
                chatbot.say(`@${data.state.username} : edited counter "${counter_name}".`);
            }
        });
    });
}

// !counter delete ${counter_name}
function commandCounter_Delete(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length !== 3) { return; } // extraneous/missing arguments

    const counter_name = data.words[2].toLowerCase();
    if(!counter_name.length || (counter_name[0] !== "!")) {
        chatbot.say(`@${data.state.username} : invalid counter name "${counter_name}".`);
        return;
    }

    Command.deleteOne({ name:counter_name }, (error) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : unable to delete counter "${counter_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : counter "${counter_name}" deleted.`);
    });
}

function commandCounter(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length < 3) { return; } // missing arguments; at least 3 required

    const mode = data.words[1].toLowerCase();
    switch(mode) {
        case "add":
            commandCounter_Add(chatbot, data);
            break;
        case "edit":
            commandCounter_Edit(chatbot, data);
            break;
        case "delete":
            commandCounter_Delete(chatbot, data);
            break;
        default:
            chatbot.say(`@${data.state.username} : bad counter command "${data.words[1]}", options are add|edit|delete.`);
    }
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!counter"        ] = commandCounter;
    commands["!counter-handler"] = commandCounter_Handler;
    return commands;
}

export default register;

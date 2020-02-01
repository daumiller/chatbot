import { spawn } from "child_process";
import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Command, { DBCommand } from "../data/command";
import constants from "../config/constants";
import secrets from "../config/secrets";
import logger from "../logger";

function playSound(filename:string, callback?:(success:boolean)=>void):void {
    const child = spawn(secrets.soundplayer.command, [ filename ]);
    child.on("exit", (code, signal) => {
        if((code === null) || (signal !== null) || (code !== 0)) {
            logger.error(`Failed playing sound file "${filename}".`, { filename:filename, code:code, signal:signal });
            if(callback) { callback(false); }
        } else {
            if(callback) { callback(true); }
        }
    });
}

function commandSound_Handler(chatbot:ChatBot, data:ChatCommandData):void {
    if(!data.db_command.filename) {
        logger.error("Sound missing filename.", data);
        return;
    }
    playSound(data.db_command.filename);
}

// !sound add ${sound.name} filename
//     create a new sound, with given name and filename
function commandSound_Add(chatbot:ChatBot, data:ChatCommandData, sound_name:string, sound_filename:string):void {
    const db_sound:DBCommand = new Command({
        name            : sound_name,
        handled_by      : "!sound-handler",
        permission      : constants.permissions["all"].value,
        chat_enabled    : true,
        whisper_enabled : false,
        cooldown_seconds: 5,
        filename        : sound_filename,
    });

    db_sound.save((error, db_command) => {
        if(error !== null) {
            logger.error("Failed creating sound.", { data:data, db_sound:db_sound, error:error });
            chatbot.say(`@${data.state.username} : failed creating sound "${sound_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : created sound "${sound_name}".`);
    });
}

// !sound edit ${sound.name} filename
//     edit existing sound
function commandSound_Edit(chatbot:ChatBot, data:ChatCommandData, sound_name:string, sound_filename:string):void {
    if(!sound_filename) { chatbot.say(`@${data.state.username} : no sound filename provided.`); return; }

    Command.updateOne({ name:sound_name }, { filename:sound_filename }, (error, result) => {
        if((error !== null) || (result.nModified !== 1)) {
            chatbot.say(`@${data.state.username} : unable to update sound "${sound_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : updated sound "${sound_name}".`);
    });
}

// !sound delete ${sound.name}
//     delete given sound
function commandSound_Delete(chatbot:ChatBot, data:ChatCommandData, sound_name:string):void {
    Command.deleteOne({ name:sound_name }, (error) => {
        if(error !== null) {
            logger.error("Failed deleting sound.", { data:data, sound_name:sound_name, error:error });
            chatbot.say(`@${data.state.username} : failed deleting sound "${sound_name}".`);
            return;
        }
        chatbot.say(`@${data.state.username} : deleted sound "${sound_name}".`);
    });
}

function commandSound(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length < 3) { return; } // invalid arguments; requires at least 3
    if(!data.words[2].length || (data.words[2][0] !== "!")) {
        chatbot.say(`@${data.state.username} : sound name must begin with "!" (${data.words[2]}).`);
        return;
    }

    const command        = data.words[1].toLowerCase();
    const sound_name     = data.words[2].toLowerCase();
    const sound_filename = (data.words.length > 3) ? data.words[3] : null;
    switch(command) {
        case "add":
            commandSound_Add(chatbot, data, sound_name, sound_filename);
            break;
        case "edit":
            commandSound_Edit(chatbot, data, sound_name, sound_filename);
            break;
        case "delete":
            commandSound_Delete(chatbot, data, sound_name);
            break;
        default:
            chatbot.say(`@${data.state.username} : bad sound command "${command}".`);
    }    
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!sound"        ] = commandSound;
    commands["!sound-handler"] = commandSound_Handler;
    return commands;
}

export default register;

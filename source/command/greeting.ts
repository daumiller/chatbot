import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Greeting, { DBGreeting } from "../data/greeting";
import logger from "../logger";

let _greeting_cache:{[username:string]:string} = null;
function _greetingCachePopulate():void {
    Greeting.find((error, greetings) => {
        if(error !== null) {
            logger.error("Failed Greeting load", { error:error });
            return;
        }
        const greeting_cache_tmp:{[username:string]:string} = {};
        for(let index:number=0; index<greetings.length; ++index) {
            greeting_cache_tmp[greetings[index].username] = greetings[index].template;
        }
        _greeting_cache = greeting_cache_tmp;
    });
}

// !greeting add username template
function commandGreeting_Add(chatbot:ChatBot, data:ChatCommandData, username:string, template:string):void {
    if(!template) { chatbot.say(`@${data.state.username} : no greeting template provided.`); return; }
    
    const db_greeting:DBGreeting = new Greeting({ username:username, template:template });
    db_greeting.save((error, db_greeting_saved) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : failed adding greeting for ${username}.`);
            return;
        }
        _greeting_cache[db_greeting_saved.username] = db_greeting_saved.template;
        chatbot.say(`@${data.state.username} : greeting added for ${db_greeting_saved.username}.`);
    });
}

// !greeting edit username template
function commandGreeting_Edit(chatbot:ChatBot, data:ChatCommandData, username:string, template:string):void {
    if(!template) { chatbot.say(`@${data.state.username} : no greeting template provided.`); return; }
    if(!_greeting_cache[username]) { chatbot.say(`@${data.state.username} : no greeting found for ${username}.`); return; }

    Greeting.updateOne({ username:username }, { template:template }, (error, result) => {
        if((error !== null) || (result.nModified !== 1)) {
            chatbot.say(`@${data.state.username} : unable to update greeting for ${username}.`);
            return;
        }
        _greeting_cache[username] = template;
        chatbot.say(`@${data.state.username} : updated greeting for ${username}.`);
    });
}

// !greeting delete username
function commandGreeting_Delete(chatbot:ChatBot, data:ChatCommandData, username:string):void {
    Greeting.deleteOne({ username:username }, (error) => {
        if(error !== null) {
            chatbot.say(`@${data.state.username} : failed deleting greeting for ${username}.`);
        } else {
            if(_greeting_cache[username]) { delete _greeting_cache[username]; }
            chatbot.say(`@${data.state.username} : deleted greeting for ${username}.`);
        }
    });
}

function commandGreeting(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length < 3) { return; } // invalid arguments; requires at least 3

    const command  = data.words[1].toLowerCase();
    const username = data.words[2].toLowerCase();
    const template = (data.words.length > 3) ? data.words[3] : null;

    switch(command) {
        case "add":
            commandGreeting_Add(chatbot, data, username, template);
            break;
        case "edit":
            commandGreeting_Edit(chatbot, data, username, template);
            break;
        case "delete":
            commandGreeting_Delete(chatbot, data, username);
            break;
        default:
            chatbot.say(`@${data.state.username} : bad greeting command "${command}".`);
    }    
}

// !greet username
function commandGreet(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length !== 2) { return; } // extra/missing arguments

    const username = data.words[1].toLowerCase();
    const template = _greeting_cache[username] || null;
    if(template) {
        chatbot.say(template);
    } else if(data.is_chat){
        chatbot.say(`@${data.state.username} : no greeting found for "${username}".`);
    }
}

function register(commands:CommandRegistration):CommandRegistration {
    _greetingCachePopulate();
    commands["!greeting"] = commandGreeting;
    commands["!greet"   ] = commandGreet;
    return commands;
}

export default register;

import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";

// "!shutdown" - shutdown chatbot
function commandShutdown(chatbot:ChatBot, data:ChatCommandData):void {
    chatbot.shutdown(true, 0);
}

// "!ping" - test for chatbot functionality
//     responds with "PONG"
function commandPing(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.is_whisper) { chatbot.whipser(data.state.username, "PONG"); }
    if(data.is_chat   ) { chatbot.say("PONG");                          }
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!shutdown"] = commandShutdown;
    commands["!ping"    ] = commandPing;
    return commands;
}

export default register;

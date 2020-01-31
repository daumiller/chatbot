/*
const secrets  = require('./secrets');
const commands = require('./commands');
const Logger   = require('./logger');
const ChatBot  = require('./chatbot');

const DEBUG = true;
const bot = new ChatBot(secrets, commands, new Logger(DEBUG));
bot.startup();
*/

/*
import secrets   from "./config/secrets";
import constants from "./config/constants";
import commands  from "./config/commands";
import Logger    from "./logger";
import ChatBot   from "./chatbot";

// import mongoose from 'mongoose';

const logger  = new Logger(true);
const chatbot = new ChatBot(secrets, commands, logger);

function writeStr(str:string):void {
    logger.debug(str, {});
}

writeStr(`Channel is "${secrets.twitch.channel}".`);
*/

import ChatBot from "./chatbot";

(new ChatBot()).startup();

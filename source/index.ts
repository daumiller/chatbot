const secrets  = require('./secrets');
const commands = require('./commands');
const Logger   = require('./logger');
const ChatBot  = require('./chatbot');

const DEBUG = true;
const bot = new ChatBot(secrets, commands, new Logger(DEBUG));
bot.startup();

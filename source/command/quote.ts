import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import Quote, { DBQuote } from "../data/quote";
import logger from "../logger";
import { safeParseInt, YYYY_MM_DD, permissionAllowed } from "../helpers";

let _count_cache:number = null;
function _getQuoteCount(callback:(count:number)=>void):void {
    if(_count_cache !== null) {
        callback(_count_cache);
        return;
    }
    Quote.countDocuments((error, count) => {
        if(error !== null) {
            logger.error("Error counting quotes.", { error:error });
            callback(null);
            return;
        }
        _count_cache = count;
        callback(count);
    });
}

function _composeQuote(db_quote:DBQuote, show_index:boolean):string {
    const quote_index = show_index ? `Quote ${db_quote.number}: ` : "";
    const quote_date  = YYYY_MM_DD(db_quote.date);
    return `${quote_index}${quote_date} "${db_quote.quote}"`;
}

// !quote add string
//     quote ${quote_number}: ${quote_date} "${quote_string}"
function _commandQuote_Add(chatbot:ChatBot, data:ChatCommandData):void {
    data.db_command.permission = data.db_command.permission_edit;
    if(!permissionAllowed(data)) { return; }

    if(data.words.length !== 3) {
        chatbot.say(`@${data.state.username}: missing quote string.`);
        return;
    }
    const quote_string = data.words[2];

    _getQuoteCount((count) => {
        if(count === null) { return; }

        const db_quote:DBQuote = new Quote({
            date:(new Date).getTime(),
            number:count + 1,
            quote:quote_string,
        });

        db_quote.save((error, db_quote) => {
            if(error !== null) {
                logger.error("Failed creating quote.", { data:data, db_quote:db_quote, error:error });
                chatbot.say(`@${data.state.username}: failed creating quote.`);
                return;
            }
            chatbot.say(_composeQuote(db_quote, true));
        });
    });
}

// !quote edit ${quote_number} ${quote_string}
//     ${quote_date} "${quote_string}"
function _commandQuote_Edit(chatbot:ChatBot, data:ChatCommandData):void {
    data.db_command.permission = data.db_command.permission_edit;
    if(!permissionAllowed(data)) { return; }

    if(data.words.length !== 4) {
        chatbot.say(`@${data.state.username}: missing quote number or string to edit.`);
        return;
    }

    const quote_number = safeParseInt(data.words[2]);
    const quote_string = data.words[3];
    if(quote_number === null) {
        chatbot.say(`@${data.state.username}: Bad quote index "${data.words[2]}".`);
        return;
    }

    const now = (new Date).getTime();
    // NOTE: maybe restrict editing quotes that are older than X?

    Quote.updateOne({ number:quote_number }, { quote:quote_string, date:now }, (error, result) => {
        if((error !== null) || (result.nModified !== 1)) {
            chatbot.say(`@${data.state.username} : unable to update quote ${quote_number}.`);
            return;
        }
        const db_quote = new Quote({ date:now, number:-1, quote:quote_string });
        chatbot.say(_composeQuote(db_quote, false));
    });
}

// !quote count
//    ${quote_count} saved quote(s)
function _commandQuote_Count(chatbot:ChatBot, data:ChatCommandData):void {
    _getQuoteCount((count) => {
        if(count === null) { return; }
        chatbot.say(`${count} saved quote(s)`);
    });
}

// !quote ${quote_number}
//     ${quote_date} "${quote_string}"
function _commandQuote_Index(chatbot:ChatBot, data:ChatCommandData, show_index:boolean=false):void {
    if(data.words.length !== 2) { return; }
    const number = safeParseInt(data.words[1]);
    if(number === null) {
        chatbot.say(`@${data.state.username}: Unknown quote command "${data.words[1]}".`);
        return;
    }

    Quote.findOne({ number:number }, (error, db_quote) => {
        if((error !== null) || (db_quote === null)) {
            chatbot.say(`@${data.state.username}: quote ${number} not found.`);
            logger.debug(`Missing Quote #${number}.`, { data:data, error:error });
            return;
        }
        chatbot.say(_composeQuote(db_quote, show_index));
    });
}

// !quote
//     quote ${quote_number}: ${quote_date} "${quote_string}"
function _commandQuote_Random(chatbot:ChatBot, data:ChatCommandData):void {
    _getQuoteCount((count) => {
        if((count === null) || (count < 1)) { return; }
        const random = Math.ceil(Math.random() * count);
        data.words.push(random.toString());
        _commandQuote_Index(chatbot, data, true);
    })
}

function commandQuote(chatbot:ChatBot, data:ChatCommandData):void {
    if(data.words.length === 1) {
        _commandQuote_Random(chatbot, data);
        return;
    }
    
    const command = data.words[1].toLowerCase();
    switch(command) {
        case "add":
            _commandQuote_Add(chatbot, data);
            break;
        case "edit":
            _commandQuote_Edit(chatbot, data);
            break;
        case "count":
            _commandQuote_Count(chatbot, data);
            break;
        default:
            _commandQuote_Index(chatbot, data);
            break;
    }
}

function register(commands:CommandRegistration):CommandRegistration {
    commands["!quote"] = commandQuote;
    return commands;
}

export default register;

import constants from "./config/constants";
import { ChatCommandData } from "./chatbot"

/**
 * Safely parse an integer. Verify parsed value matches full string. Return null on error.
 * @param value 
 */
export function safeParseInt(value:any):number {
    value = value.toString();
    const parsed = parseInt(value);
    
    if(isNaN(parsed)) { return null; }
    if(parsed.toString() !== value) { return null; } // reject partial parses ("1something", ...)
    return parsed;
}

/**
 * Return "YYYY-mm-dd" string from date, given in ms.
 */
export function YYYY_MM_DD(unix_time:number):string {
    const date = new Date(unix_time);

    const year_string = date.getFullYear().toString();

    const month_number = date.getMonth() + 1;
    const month_string = ((month_number < 10) ? "0" : "") + month_number.toString();

    const date_number = date.getDate();
    const date_string = ((date_number < 10) ? "0" : "") + date_number.toString();

    return `${year_string}-${month_string}-${date_string}`;
}

/**
 * Test if message sender has permission to use command.
 * @param data data packet
 */
export function permissionAllowed(data:ChatCommandData):boolean {
    const db_command = data.db_command;

    // mode check
    if(data.is_chat    && !db_command.chat_enabled   ) { return false; }
    if(data.is_whisper && !db_command.whisper_enabled) { return false; }

    // permissions check
    let permission = false;
    if((db_command.permission & constants.permissions.user.value    )                    ) { permission = true; }
    if((db_command.permission & constants.permissions.sub.value     ) && data.is_sub     ) { permission = true; }
    if((db_command.permission & constants.permissions.mod.value     ) && data.is_mod     ) { permission = true; }
    if((db_command.permission & constants.permissions.streamer.value) && data.is_streamer) { permission = true; }
    if(!permission) { return false; }

    return true;
}

/**
 * Safely parse a given integer permission value. Returns null on error.
 * @param value 
 */
export function permissionParseInt(value:any):number {
    const parsed:number = safeParseInt(value);
    if(parsed === null) { return null; }

    if((parsed < 0) || (parsed > constants.permissions["all"].value)) { return null; } // range check
    return parsed;
}

/**
 * Safely parse a given permission string. Returns null on error, or number permission value on success.
 * 
 * Valid permission string examples: "user", "all", "sub|mod", "sub|mod|streamer".
 * @param value 
 */
export function permissionParseString(value:string):number {
    let total_permission_value:number = 0;

    const modes = value.toString().split("|");
    for(let index:number=0; index<modes.length; ++index) {
        const curr_mode_string  = modes[index].toLowerCase();
        const curr_mode_integer = (constants.permissions[curr_mode_string] || {value:null}).value;
        if(!curr_mode_integer) { return null; } // at least one invalid mode string was passed
        total_permission_value |= curr_mode_integer;
    }

    return total_permission_value;
}



import GraphemeSplitter from "grapheme-splitter";
const grapheme_splitter = new GraphemeSplitter();
/**
 * Split a string into a sequence of graphemes/unicode 'characters'.
 * @param string 
 */
export function graphemeSplit(string:string):Array<string> {
    return grapheme_splitter.splitGraphemes(string);
}

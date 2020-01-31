import ChatBot, { ChatCommandData } from "../chatbot";
import { CommandRegistration } from "../config/commands";
import { safeParseInt } from "../helpers";

//=============================================================================
// Poll
class Poll {
    name:string;
    options:Array<string>;

    private _chatbot:ChatBot;
    private _votes:{ [username:string]:number };
    private _vote_totals:Array<{ index:number; count:number }>;
    
    constructor(chatbot:ChatBot, poll_name:string, poll_options:Array<string>) {
        this.name         = poll_name;
        this.options      = poll_options;
        this._chatbot     = chatbot;
        this._votes       = {};
        this._vote_totals = [];
    }

    castVote(username:string, option_index:number):void {
        this._votes[username] = option_index;
    }

    announceOptions():void {
        this._chatbot.say(`Poll: ${this.name}`);
        for(let index:number=0; index<this.options.length; ++index) {
            this._chatbot.say(`--- "!vote ${index+1}" for ${this.options[index]}`);
        }
    }

    announceResults():string {
        if(!this._vote_totals.length) { this._calculateResults(); }

        this._chatbot.say(`Poll: ${this.name}`);
        for(let index:number=0; index<this._vote_totals.length; ++index) {
            const option_name  = this.options[this._vote_totals[index].index];
            const option_count = this._vote_totals[index].count;
            this._chatbot.say(`--- ${option_count} vote(s) for ${option_name}`);
        }

        if(this._vote_totals.length === 0) {
            return "No votes were cast."
        } else if(this._vote_totals[0].count === this._vote_totals[1].count) {
            return "Poll ended in a tie!";
        } else {
            const option_name  = this.options[this._vote_totals[0].index];
            const option_count = this._vote_totals[0].count;
            return `Poll winner was "${option_name}", with ${option_count} vote(s)!`;
        }
    }

    private _calculateResults():void {
        this._vote_totals = [];
        for(let index:number=0; index<this.options.length; ++index) {
            this._vote_totals.push({ index:index, count:0 });
        }

        for(const username in this._votes) {
            if(!this._votes.hasOwnProperty(username)) { continue; }
            ++(this._vote_totals[this._votes[username]]).count;
        }

        this._vote_totals = this._vote_totals.sort(function(a,b) { return b.count - a.count; });
    }
}

//=============================================================================
// Commands
let active_poll:Poll = null;

// !poll
//     if active poll, re-announce options
// !poll ${pollname} option1 option2 [option...]
//     create a new active poll with given name and options
//     also sends a "poll-start" notification event to WebSocket clients
function commandPoll(chatbot:ChatBot, data:ChatCommandData):void {
    if((data.words.length === 1) && active_poll) {
        active_poll.announceOptions();
        return;
    }

    if(active_poll) { active_poll = null; }
    if(data.words.length < 4) {
        chatbot.say(`@${data.state.username} : invalid poll command; usage is "!poll pollname option1 option2 [option...]".`);
        return;
    }

    active_poll = new Poll(chatbot, data.words[1], data.words.splice(2));
    active_poll.announceOptions();
    chatbot.emitWebsocketEvent("notification", { type:"poll-start", message:data.words[1] });
}

// !vote choice:number
//     vote for given choice in active poll
function commandVote(chatbot:ChatBot, data:ChatCommandData):void {
    if(!active_poll           ) { return; } // ignore; no active poll
    if(data.words.length !== 2) { return; } // ignore; extraneous/missing argument(s)

    let vote_choice = safeParseInt(data.words[1]);
    if(vote_choice === null) { return; } // ignore; not a valid number

    --vote_choice; // adjust for zero indexing
    if((vote_choice < 0) || (vote_choice >= active_poll.options.length)) { return; } // ignore; out of bounds

    active_poll.castVote(data.state.username, vote_choice);
}

// !endpoll
//     end active poll and display results
//     also sends a "pollend" notification event to WebSocket clients
function commandEndPoll(chatbot:ChatBot, data:ChatCommandData):void {
    if(!active_poll) { return; } // ignore; no active poll

    const ended_poll = active_poll;
    active_poll = null;

    const winner = ended_poll.announceResults();
    chatbot.emitWebsocketEvent("notification", { type:"poll-end", message:winner });
}


function register(commands:CommandRegistration):CommandRegistration {
    commands["!poll"   ] = commandPoll;
    commands["!vote"   ] = commandVote;
    commands["!endpoll"] = commandEndPoll;

    return commands;
}

export default register;

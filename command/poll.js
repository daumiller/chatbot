class Poll {
    constructor(channel, description, options, logger) {
        this.channel     = channel;
        this.description = description;
        this.options     = options;
        this.votes       = {};
        this.logger      = logger;
    }

    cast_vote(username, option_index) {
        this.votes[username] = option_index;
    }

    announce_options(fn_say) {
        fn_say(this.channel, `Poll "${this.description}"`);
        for(let index=0; index<this.options.length; ++index) {
            fn_say(this.channel, `--- vote "${index+1}" for "${this.options[index]}"`);
        }
    }

    calculate_results() {
        let vote_totals = [];
        for(let index=0; index<this.options.length; ++index) {
            vote_totals[index] = { index:index, count:0 };
        }
    
        for(let user in this.votes) {
            if(this.votes.hasOwnProperty(user)) {
                ++vote_totals[this.votes[user]].count;
            }
        }
    
        vote_totals.sort((a, b) => { return b.count - a.count; });
        this.vote_totals = vote_totals;
    }

    announce_results(fn_say, all_results=true) {
        if(!this.vote_totals) { this.calculate_results(); }

        if(all_results) {
            for(let index=0; index<this.vote_totals.length; ++index) {
                const option_name  = this.options[this.vote_totals[index].index];
                const option_count = this.vote_totals[index].count;

                fn_say(this.channel,`--- option "${option_name}" had ${option_count} votes`);
            }
        } else {
            const is_tie = this.vote_totals[0].count === this.vote_totals[1].count;
            if(is_tie) {
                fn_say(this.channel, `--- poll ended in a tie`);
            } else {
                fn_say(this.channel,`--- "${option_name}" won the poll, with ${option_count} votes`);
            }
        }                
    }
}

function command_poll(polldata, chatbot, data) {
    if(polldata.poll) { polldata.poll = null; }

    if(data.words.length < 4) {
        // TODO: show usage info? (if(data.is_chat) only)
        return;
    }

    // use chatbot.secrets.twitch.channel reference; may be initiated through a whisper
    // data.words [command, description, options...]
    polldata.poll = new Poll(chatbot.secrets.twitch.channel, data.words[1], data.words.splice(2), chatbot.logger);

    polldata.poll.announce_options(chatbot.twitch_client.say.bind(chatbot.twitch_client));
}

function command_vote(polldata, chatbot, data) {
    if(!polldata.poll)        { return; } // ignore, no active poll
    if(data.words.length < 2) { return; } // ignore, incomplete
    
    let vote_choice = parseInt(data.words[1]);
    if(isNaN(vote_choice)) { return; } // ignore, invalid

    --vote_choice;
    if((vote_choice < 0) || (vote_choice >= polldata.poll.options.length)) { return; } // ignore, out of bounds  

    polldata.poll.cast_vote(data.tags.username, vote_choice);
}

function command_endpoll(polldata, chatbot, data) {
    if(!polldata.poll) { return; } // ignore, no active poll

    const ended_poll = polldata.poll;
    polldata.poll = null;

    ended_poll.announce_results(chatbot.twitch_client.say.bind(chatbot.twitch_client));
}

module.exports = {
    register: function(commands) {
        commands._polldata = {};
        commands['!poll'   ] = command_poll   .bind(null, commands._polldata);
        commands['!vote'   ] = command_vote   .bind(null, commands._polldata);
        commands['!endpoll'] = command_endpoll.bind(null, commands._polldata);
        return commands;
    },
};

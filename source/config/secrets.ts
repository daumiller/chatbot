interface MongoSecrets {
    /**
     * MongoDB server connection string.
     *
     * ex: mongodb://user:pass@10.0.0.1:27017/dbname?authSource=admin
     */
    url:string;
}

interface TwitchSecrets {
    /** Twitch bot username. */
    username:string;

    /** Twitch bot login token. */
    token:string;

    /** Twitch channel name. */
    channel:string;

    /** Twitch streamer name (should be same as channel). */
    streamer:string;
}

interface WebsocketSecrets {
    /**
     * Local interface to bind to (omit for default).
     * 
     * ex: 'localhost', '0.0.0.0', ...
     */
    binding?:string;

    /**
     * Local port to bind to.
     * 
     * ex: 8080
     */
    port:number;
}

interface SoundPlayer {
    /**
     * Console command to use for playing sounds.
     */
    command:string;
}

interface Secrets {
    mongo:MongoSecrets;
    twitch:TwitchSecrets;
    websocket:WebsocketSecrets;
    soundplayer:SoundPlayer;
}

const secrets:Secrets = {
    mongo: {
        url   : "mongodb://",
    },
    twitch: {
        username: "",
        token   : "oauth:",
        channel : "",
        streamer: "",
    },
    websocket: {
        port: 4331,
    },
    soundplayer: {
        command: "afplay"
    }
}
export default secrets;

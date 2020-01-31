export type CommandHandler = (chatbot:any, data:any)=>any;
export type CommandRegistration = {[command_name:string]:CommandHandler};
let commands:CommandRegistration = {};

// Enable/Disable any commands here (that you don't want loaded at all).
// Commands can also be disabled by database, but those will still be loaded into ChatBot memory.
const command_path:Array<string> = [
    "../command/counter",
    "../command/macro",
    "../command/permission",
    "../command/poll",
    "../command/process",
];

async function registerCommands():Promise<void> {
    for(let index:number=0; index<command_path.length; ++index) {
        const command_registrar = (await import(command_path[index])).default;
        commands = command_registrar(commands);
    }
}
registerCommands();

export default commands;

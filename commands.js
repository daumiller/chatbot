let commands = {};

// TODO: read dir
const command_paths = [
    "./command/filter",
    "./command/join",
    "./command/poll",
    "./command/process",
    "./command/shoutout",
    "./command/permission",
    "./command/macro",
];

for(let index=0; index<command_paths.length; ++index) {
    commands = require(command_paths[index]).register(commands);
}

module.exports = commands;


var el_root = document.querySelector("#chatlog") || document.body;

function chatlog_append(username, message) {
    var el_user = document.createElement("span");
    el_user.className = "username";
    el_user.innerText = username;
    
    var el_message = document.createElement("span");
    el_message.className = "message";
    el_message.innerText = message;

    var el_container = document.createElement("div");
    el_container.className = "entry";
    el_container.appendChild(el_user);
    el_container.appendChild(el_message);

    el_root.appendChild(el_container);
    while(el_root.childNodes.length > 32) {
        el_root.removeChild(el_root.childNodes[0]);
    }
}

var websocket = io();
websocket.on('chatlog', function(data){ chatlog_append(data.username, data.message); });

/*
// TESTING CODE...
var messageIndex = 0;
chatlog_append("DarcyJane", "trying out a kind of log message string here... let's see what it looks like on-screen");
setInterval(function() {
    chatlog_append("TestUser", "testing message" + messageIndex.toString());
    ++messageIndex;
}, 1000);
*/

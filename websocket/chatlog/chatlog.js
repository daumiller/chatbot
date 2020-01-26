var websocket = io();

websocket.on('chatlog', function(data){
    var el_user = document.createElement("span");
    el_user.className = "username";
    el_user.innerText = data.username;
    
    var el_message = document.createElement("span");
    el_message.className = "message";
    el_message.innerText = data.message;

    var el_container = document.createElement("div");
    el_container.className = "chatlog-message";
    el_container.appendChild(el_user);
    el_container.appendChild(el_message);

    document.body.appendChild(el_container);
});

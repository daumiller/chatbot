var el_root = document.querySelector("#chatlog") || document.body;
var username_style_template = "text-shadow: 0px 0px 48px @COLOR@," +
                                           "0px 0px 40px @COLOR@," +
                                           "0px 0px 32px @COLOR@," +
                                           "0px 0px 24px @COLOR@," +
                                           "0px 0px 12px @COLOR@," +
                                           "0px 0px  9px @COLOR@," +
                                           "0px 0px  6px @COLOR@," +
                                           "0px 0px  3px @COLOR@;" ;
var message_emoticon_template = "https://static-cdn.jtvnw.net/emoticons/v1/@EMOTE@/2.0";

function chatlog_parse_message(message, emotes) {
    var components    = [];
    var parsing_index = 0;

    for(let index=0; index<emotes.length; ++index) {
        var emote = emotes[index];
        if(emote.begin > parsing_index) {
            components.push({ text:true, content:message.substring(parsing_index, emote.begin) });
        }
        components.push({ text:false, content:message_emoticon_template.replace(/@EMOTE@/g, emote.id) });
        parsing_index = emote.end + 1;
    }
    if(parsing_index < message.length) {
        components.push({ text:true, content:message.substring(parsing_index) });
    }

    return components;
}

function chatlog_append(data) {
    var el_user = document.createElement("span");
    el_user.className = "username";
    el_user.innerText = data.username;
    el_user.style     = username_style_template.replace(/@COLOR@/g, data.color);;
    
    var el_message = document.createElement("span");
    el_message.className = "message";
    var message_components = chatlog_parse_message(data.message, data.emotes);

    for(let index=0; index<message_components.length; ++index) {
        var component = message_components[index];
        if(component.text) {
            var el_text = document.createTextNode(component.content);
            el_message.appendChild(el_text);
        } else {
            var el_image = document.createElement("img");
            el_image.className = "emoticon";
            el_image.src = component.content;
            el_message.appendChild(el_image);
        }
    }

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
websocket.on('chatlog', function(data){ chatlog_append(data); });

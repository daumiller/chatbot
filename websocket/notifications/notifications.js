var NOTIFICATION_MAX_COUNT       = 5;
var NOTIFICATION_DEFAULT_TIMEOUT = 5;

var timeouts = []; // { handle:setTimeout.result, element:domElement, data:originalNotificationData }
var el_root = document.querySelector("#notifications") || document.body;

function simple_span(className, innerText) {
    var element = document.createElement("span");
    element.className = className;
    element.innerText = innerText;
    return element;
}

function compose_poll(data) {
    var el_title   = simple_span("notification-title", "POLL");
    var el_message = simple_span("notification-message", data.message);

    var el_container = document.createElement("div");
    el_container.className = "notification poll " + data.type;
    el_container.appendChild(el_title);
    el_container.appendChild(el_message);

    if(data.type === "poll-end") {
        for(let index=0; index<timeouts.length; ++index) {
            if(timeouts[index].data.type === "poll-start") {
                window.clearTimeout(timeouts[index].handle);
                timeout_notification(timeouts[index].element);
                timeouts = timeouts.splice(index, 1);
            }
        }
    }
    
    return el_container;
}

function timeout_notification(element) {
    if(el_root.contains(element)) { el_root.removeChild(element); }
}

function append_notification(element, data, timeout) {
    while(el_root.childNodes.length >= NOTIFICATION_MAX_COUNT) {
        el_root.removeChild(el_root.childNodes[0]);
        window.clearTimeout(timeouts[0].handle);
        timeouts = timeouts.slice(1);
    }

    el_root.appendChild(element);

    const timeout_ms = (timeout || NOTIFICATION_DEFAULT_TIMEOUT) * 1000;
    timeouts[el_root.childNodes.length-1] = {
        data: data,
        element: element,
        handle: window.setTimeout(timeout_notification.bind(null, element), timeout_ms),
    };
}

var notification_types = {
    "poll-start": { compose:compose_poll, timeout:60 },
    "poll-end"  : { compose:compose_poll, timeout:10 },
};

var websocket = io();
websocket.on('notification', function(data){
    console.log(data);
    if(data && data.type && notification_types[data.type]) {
        var notification_type = notification_types[data.type];
        var el_notification = notification_type.compose(data);
        append_notification(el_notification, data, data.timeout || notification_type.timeout);
    }
});

function testNotify(data) {
    var notification_type = notification_types[data.type];
    var el_notification = notification_type.compose(data);
    append_notification(el_notification, data, notification_type.timeout);
}

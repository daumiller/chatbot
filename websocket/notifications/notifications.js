var el_root = document.querySelector("#notifications") || document.body;
var NOTIFICATION_MAX_COUNT = 3;
var NOTIFICATION_TIMEOUT   = 5000;
var timeouts               = [];

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
    
    return el_container;
}

function timeout_notification(element) {
    el_root.removeChild(element);
}

function append_notification(element) {
    while(el_root.childNodes.length >= NOTIFICATION_MAX_COUNT) {
        el_root.removeChild(el_root.childNodes[0]);
        window.clearTimeout(timeouts[0]);
        timeouts = timeouts.slice(1);
    }

    el_root.appendChild(element);
    timeouts[el_root.childNodes.length-1] = window.setTimeout(timeout_notification.bind(null, element), NOTIFICATION_TIMEOUT);
}

var notification_types = {
    "poll-start": compose_poll,
    "poll-end"  : compose_poll,
};

var websocket = io();
websocket.on('notification', function(data){
    console.log("NOTIFICATION RECEIVED");
    console.log(data);
    if(data && data.type && notification_types[data.type]) {
        var el_notification = notification_types[data.type](data);
        append_notification(el_notification);
    }
});

var _test_notification_count = 0;
window.test_notification = function() {
    var element = document.createElement("div");
    element.innerText = "Test Notification #" + this._test_notification_count.toString();
    ++this._test_notification_count;
    append_notification(element);
};

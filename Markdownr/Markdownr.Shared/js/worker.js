/// <reference group="Dedicated Worker" />
importScripts("/lib/marked.min.js");

onmessage = function (event) {
    if (event.data.content) {
        marked(event.data.content, function (err, content) {
            if (err) {
                throw err;
            } else {
                postMessage({ html: content });
            }
        });        
    }
}

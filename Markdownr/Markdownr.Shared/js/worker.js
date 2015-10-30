/// <reference group="Dedicated Worker" />
importScripts("/lib/marked.min.js");

onmessage = function (event) {
    if (event.data.content) {
        var renderer = new marked.Renderer();
        renderer.heading = function (text, level, raw) {
            var name = text.toLowerCase().replace(/[^\w]+/g, '-');
            return '<h'
                + level
                + '><a name="'
                + name
                + '" class="anchor" aria-hidden="true" href="#'
                + name
                + '"><span class="octicon octicon-link"></span></a>'
                + text
                + '</h'
                + level
                + '>';
        }
        var options = {
            renderer: renderer
        };
        marked(event.data.content, options, function (err, content) {
            if (err) {
                throw err;
            } else {
                postMessage({ html: content });
            }
        });
    }
}

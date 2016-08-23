/// <reference group="Dedicated Worker" />
importScripts("/lib/marked.min.js", "/lib/textile.js");

onmessage = function (event) {
    if (event.data.content) {
        if (event.data.contentType === "text/textile") {
            try {
                postMessage({html: textile(event.data.content)});
            } catch (e) {
                throw e;
            }
        } else /* Default is to assume markdown */ {
            var options = {
                renderer: new marked.Renderer()
            };
            options.renderer.heading = function (text, level, raw) {
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
            marked(event.data.content, options, function (err, content) {
                if (err) {
                    throw err;
                } else {
                    postMessage({ html: content });
                }
            });
        }
    }
}

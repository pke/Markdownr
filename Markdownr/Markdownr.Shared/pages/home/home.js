(function () {
    "use strict";

    var renderAsync = function (content) {
        return new WinJS.Promise(function (c, e, p) {
            var worker = new Worker("/js/worker.js");
            worker.onerror = function (err) {
                e(err);
            }
            worker.onmessage = function (message) {
                c(message.data.html);
            }
            worker.postMessage({ content: content });
        });
    }

    WinJS.UI.Pages.define("/pages/home/home.html", {
        init: function (element, options) {
            if (!options) {
                options = {};
            }
            if (options.file) {
                options.file = WinJS.Promise.as(options.file);
            } else {
                options.file = Windows.Storage.StorageFile.getFileFromApplicationUriAsync(new Windows.Foundation.Uri("ms-appx:///test/README.md"));
            }            
            this.renderContentAsync = options.file.then(Windows.Storage.FileIO.readTextAsync)
                .then(function (content) {
                    return renderAsync(content);
                    //marked('I am using __markdown__.');
                });
        },

        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            this.renderContentAsync.then(function (html) {
                WinJS.Utilities.setInnerHTMLUnsafe(element.querySelector("section[role=main]"), html);
                msSetImmediate(function () {
                    Prism.highlightAll(true);
                });
            });            
            // TODO: Initialize the page here.
        }
    });
})();

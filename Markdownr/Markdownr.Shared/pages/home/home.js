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
                var options = {};
            }
            var content;
            if (options.text) {
                content = WinJS.Promise.as({ text: options.text });
            } else if (options.uri) {
                content = WinJS.xhr({ url: options.uri.absoluteUri }).then(function (request) {
                    var contentType = request.getResponseHeader("Content-Type");
                    contentType = (contentType.split(";")[0]).toLowerCase().trim();
                    // todo: Read from manifest!
                    var supportedContentTypes = ["text/plain", "text/markdown"];
                    if (supportedContentTypes.indexOf(contentType) != -1) {
                        return { text: request.responseText };
                    } else {
                        return WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr", "Display of " + contentType + " not supported.")); //i18n
                    }
                });
            } else if (options.file) {
                content = WinJS.Promise.as(options.file).then(Windows.Storage.FileIO.readTextAsync)
                .then(function (text) {
                    return { text: text };
                });
            } else {
                content = Windows.Storage.StorageFile.getFileFromApplicationUriAsync(new Windows.Foundation.Uri("ms-appx:///README.md"))
                .then(Windows.Storage.FileIO.readTextAsync)
                .then(function (text) {
                    return {
                        text: text,
                        callback: function (element) {
                            var toggler = element.querySelector("a[href='#toggleAppBar']");
                            if (toggler) {
                                toggler.addEventListener("click", function (event) {
                                    event.stopPropagation();
                                    var appbar = window.appbar.winControl;
                                    if (appbar.opened) {
                                        // WinJS 4.x uses different methods :/
                                        if (typeof appbar.close === "function") {
                                            appbar.close();
                                        } else {
                                            appbar.hide();
                                        }
                                    } else {
                                        if (typeof appbar.open === "function") {
                                            appbar.open();
                                        } else {
                                            appbar.show();
                                        }
                                    }
                                    return false;
                                });                                
                            }
                        }
                    }
                });
            }
            this.renderContentAsync = content.then(function (content) {
                return renderAsync(content.text).then(function (html) {
                    return {
                        html: html,
                        callback: content.callback
                    };
                });
            });
        },

        ready: function (element, options) {
            var markdownBody = element.querySelector(".markdown-body");
            this.renderContentAsync.then(function (content) {
                WinJS.Utilities.setInnerHTMLUnsafe(markdownBody, content.html);
                if (content.callback) {
                    try {
                        content.callback(markdownBody);
                    } catch (error) {
                    }
                }
                return WinJS.Promise.timeout();
            }).then(function () {
                Prism.highlightAll(true);
            }).then(null, function (error) {
                App.notify("error", "Display error.<br>" + error.message);
            });
        }
    });
})();
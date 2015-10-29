(function () {
    "use strict";

    var CryptographicBuffer = Windows.Security.Cryptography.CryptographicBuffer;
    var BinaryStringEncoding = Windows.Security.Cryptography.BinaryStringEncoding;
    var HashAlgorithmProvider = Windows.Security.Cryptography.Core.HashAlgorithmProvider;

    function hashString(string, method) {
        var hashData, provider;
        provider = HashAlgorithmProvider.openAlgorithm(method.toUpperCase());
        hashData = provider.hashData(CryptographicBuffer.convertStringToBinary(string, BinaryStringEncoding.utf8));
        if (hashData.length !== provider.hashLength) {
            throw new WinJS.ErrorFromName('InvalidArgumentException', "Generated hash length is different that algorithm hash length");
        }
        return CryptographicBuffer.encodeToHexString(hashData);
    };

    function shortSha1(string) {
        return hashString(string, "SHA1").substring(0, 6);
    }

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

    WinJS.UI.Pages.define("/pages/homePage.html", {
        tileId: {
            get: function () {
                if (this._tileId !== undefined) {
                    return this._tileId;
                }
                if (this.options.file) {
                    this._tileId = "file_" + shortSha1(this.options.file.path);
                } else if (this.options.uri) {
                    this._tileId = "uri_" + shortSha1(this.options.uri.absoluteUri);
                } else {
                    this._tileId = null;
                }
                return this._tileId;
            }
        },

        init: function (element, options) {
            var self = this;
            if (!options) {
                options = {};
            }
            this.options = options;
            this.element = element;
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
                .then(function (file) {
                    options.file = file;
                    return Windows.Storage.FileIO.readTextAsync(file);
                }).then(function (text) {
                    return {
                        text: text,
                        callback: function (element) {
                            WinJS.Utilities.query("a[href='#toggleAppBar']", element).listen("click", function (event) {
                                event.stopPropagation();
                                App.toggleAppBar()
                                return false;
                            });
                        }
                    }
                });
            }
            this.renderContentAsync = content.then(function (content) {
                var commands = ["openFile", "find"];
                if (self.tileId) {
                    if (Windows.UI.StartScreen.SecondaryTile.exists(self.tileId)) {
                        commands.push("unpin");
                    } else {
                        commands.push("pin");
                    }
                }
                App.model.commands = commands;
                return renderAsync(content.text).then(function (html) {
                    return {
                        html: html,
                        callback: content.callback
                    };
                });
            });
        },

        unpinAsync: function(event) {
            if (!Windows.UI.StartScreen.SecondaryTile.exists(this.tileId)) {
                // In case the app was running and the tile was deleted we at least now update the commands to reflect that it can no longer be unpinned
                // FIXME: this should be replaced by an app activation listener, that checks if the current file/uri is still pinned
                App.model.commands = ["openFile", "find", "pin"];
                return WinJS.Promise.as();
            }
            var tile = new Windows.UI.StartScreen.SecondaryTile(this.tileId);
            return tile.requestDeleteAsync().then(function () {
                App.model.commands = ["openFile", "find", "pin"];
                if (tile.tileId.indexOf("file_") === 0) {
                    Windows.UI.StartScreen.SecondaryTile.findAllAsync().done(function (tiles) {
                        var it = tiles.first();
                        while (it.hasCurrent) {
                            if (tile.tileId == it.current.tileId) {
                                var futureAccessList = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
                                futureAccessList.remove(it.current.arguments);
                                break;
                            }
                            it.moveNext();
                        }
                    });
                }
            });
        },

        markdownElement: {
            get: function() {
                return this.markdownBody || (this.markdownBody = this.element.querySelector(".markdown-body"));
            }
        },

        generateTableOfContentsAsync: function () {
            var level = 0;
            var html = "";
            Array.prototype.forEach.call(this.markdownElement.querySelectorAll("h1,h2,h3,h4,h5,h6"), function (header, index) {
                var anchor = "toc" + index;
                var anchorElement = header.querySelector("a[name]");
                if (anchorElement) {
                    anchor = anchorElement.name;
                } else {
                    header.innerHTML += "<a name='" + anchor + "'/>";
                }
                if (header.nodeName[1] > level) {
                    html += "<ol>";
                    level = Number(header.nodeName[1]);
                } else if (header.nodeName[1] < level) {
                    while (header.nodeName[1] < level--) {
                        html += "</li></ol>";
                    }
                    level = Number(header.nodeName[1]);
                } else {
                    html += "</li>";
                }
                html += "<li><a href='#" + anchor + "'>" + header.textContent + "</a>";
            });
            while (level--) {
                html += "</li></ol>";
            }
            var toc = document.createElement("div");
            toc.innerHTML = html;
            toc.setAttribute("role", "tree");
            this.markdownElement.insertBefore(toc, this.markdownElement.firstChild);
        },

        pinAsync: function(event) {
            if (!this.tileId) {
                return WinJS.Promise.as();
            }
            var tile = new Windows.UI.StartScreen.SecondaryTile(this.tileId);
            var file = this.options.file;
            if (file) {
                var futureAccessList = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
                tile.displayName = file.name;
                tile.arguments = futureAccessList.add(file);
                tile.roamingEnabled = false;
            } else {
                var uri = this.options.uri;
                tile.arguments = uri.absoluteUri;
                tile.displayName = uri.absoluteUri;
            }
            tile.visualElements.square150x150Logo = new Windows.Foundation.Uri("ms-appx:///images/square150x150Logo.png");
            tile.visualElements.square310x310Logo = new Windows.Foundation.Uri("ms-appx:///images/Square310x310Logo.png");
            tile.visualElements.wide310x150Logo = new Windows.Foundation.Uri("ms-appx:///images/Wide310x150Logo.png");
            tile.visualElements.square71x71Logo = new Windows.Foundation.Uri("ms-appx:///images/Square71x71Logo.png");
            tile.visualElements.square70x70Logo = new Windows.Foundation.Uri("ms-appx:///images/StoreLogo.png");
            tile.visualElements.square30x30Logo = new Windows.Foundation.Uri("ms-appx:///images/SmallLogo.png");
            tile.visualElements.showNameOnSquare150x150Logo = true;
            tile.visualElements.showNameOnSquare310x310Logo = true;
            tile.visualElements.showNameOnWide310x150Logo = true;
            var markdownBody = this.element.querySelector(".markdown-body");
            var title = markdownBody.querySelectorAll("h1,h2,h3,h4,h5,h6")
            var notification;
            if (title.length) {
                //Windows.UI.Notifications.TileTemplateType.tileSquare150x150Text01
                notification = TileNotification.createFromTemplate(tile.tileId, "TileWide310x150Text09", title[0].innerText, title[1].innerText);
            }
            var listener;
            if (notification) {
                WinJS.Application.addEventListener("checkpoint", listener = function (event) {
                    WinJS.Application.removeEventListener("checkpoint", listener);
                    notification.updateSecondaryTile();
                    notification = null;
                });
            }
            return tile.requestCreateAsync().then(function (created) {
                if (notification) {
                    WinJS.Application.removeEventListener("checkpoint", listener);
                }
                if (created) {
                    App.model.commands = ["openFile", "find", "unpin"];
                    notification && notification.updateSecondaryTile();
                }
            })
        },

        ready: function (element, options) {
            var self = this;
            var markdownBody = element.querySelector(".markdown-body");
            markdownBody.addEventListener("dblclick", function (event) {
                event.preventDefault();
                markdownBody.msContentZoomFactor = 1;
                return false;
            });
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
                App.notify("error", error.message);
            });
        }
    });
})();
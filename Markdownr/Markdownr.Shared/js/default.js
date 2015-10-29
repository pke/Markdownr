(function () {
    "use strict";

    var model = WinJS.Binding.as({
        notification: WinJS.Binding.as({
            type: null,
            text: "",
            actionAsync: null
        }),
        pasteAvailable: false,
        recentFindTerms: new WinJS.Binding.List(),
        commands: []
    });

    // Clipboard module
    if (Windows.ApplicationModel.DataTransfer.Clipboard) {
        var pendingClipboardChange = false;
        var hasClipboardAccess = false;

        window.addEventListener("focus", function (event) {
            hasClipboardAccess = true;
            if (pendingClipboardChange) {
                clipboardChanged();
            }
        });

        window.addEventListener("blur", function (event) {
            hasClipboardAccess = false;
        });

        function clipboardChanged() {
            try {
                var dataPackageView = Windows.ApplicationModel.DataTransfer.Clipboard.getContent();
                if (dataPackageView && dataPackageView.availableFormats.size) {
                    WinJS.Application.queueEvent({ type: "clipboardchanged", dataPackageView: dataPackageView });
                    pendingClipboardChange = false;
                }
            } catch (e) {
                console.error("Could not access clipboard");
            }
        }

        function watchClipboard() {
            Windows.ApplicationModel.DataTransfer.Clipboard.addEventListener("contentchanged", function () {
                pendingClipboardChange = true;
                if (hasClipboardAccess) {
                    clipboardChanged();
                }
            });
            if (hasClipboardAccess) {
                clipboardChanged();
            }
        }

        WinJS.Application.addEventListener("activated", function (args) {
            args.detail.splashScreen.addEventListener("dismissed", function () {
                watchClipboard();
            });
        });
    }

    WinJS.Application.addEventListener("clipboardchanged", function (event) {
        model.pasteAvailable = true;
        probeDataPackageAsync(event.dataPackageView).then(function (probe) {
            if (!probe) {
                return;
            }
            App.notify("paste", probe.text, function () {
                return showAsync(probe.data).then(function () {
                    event.dataPackageView.reportOperationCompleted(event.dataPackageView.requestedOperation);
                    model.pasteAvailable = false;
                });
            });
        }, function (error) {
            App.notify("error", error.message);
        });
    });

    function showAsync(what) {
        if (!what) {
            // Can happen when opening a file on Windows Phone 8.1
            return WinJS.Promise.as();
        }
        var options = {};
        if (what instanceof Windows.Storage.StorageFile) {
            options.file = what;
        } else if (typeof what === "string") {
            options.text = what;
        } else if (what instanceof Windows.Foundation.Uri) {
            options.uri = what;
        } else {
            //i18n
            return WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr", "Unknown content to display"));
        }
        return WinJS.Navigation.navigate("/pages/homePage.html", options);
    }

    function probeDataPackageAsync(data) {
        if (data.requestedOperation === Windows.ApplicationModel.DataTransfer.DataPackageOperation.move) {
            // Cut operations are not supported. Silently fail
            return WinJS.Promise.as();
        } else if (data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.text)) {
            return data.getTextAsync().then(function (text) {
                var data, text;
                try {
                    var uri = new Windows.Foundation.Uri(text);
                    return {
                        data: uri,
                        text: "Download & display Markdown from URL in Clipboard<br>" + uri.rawUri //i18n
                    };
                } catch (e) {
                    return {
                        data: text,
                        //i18n
                        text: "Text found in Clipboard. Paste it now."
                    };
                }
            });
        } else if (data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.webLink)) {
            return data.getWebLinkAsync().then(function(uri){
                return {
                    data: uri,
                    text: "Download & display Markdown from URL in Clipboard<br>" + uri.rawUri //i18n
                };
            });
        } else if (data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
            return data.getStorageItemsAsync().then(function (items) {
                return {
                    data: items[0],
                    text: "Display file from clipboard<br>"+items[0].path //i18n
                };
            });
        } else {
            // Fail when format is anything else
            return WinJS.Promise.as();
        }
    }

    function showShareOperationAsync(shareOperation) {
        return probeDataPackageAsync(shareOperation.data).then(function (probe) {
            //shareOperation.reportDataRetrieved();
            return showAsync(probe.data);
        }).then(function () {
            //shareOperation.reportCompleted();
            //shareOperation.data.reportOperationCompleted(shareOperation.data.requestedOperation);
        }).then(null, function (error) {
            shareOperation.reportError(error.message);
        });
    }

    function safeCallAsync(object, type, asyncMethod, phoneMethod) {
        var func;
        if (!Windows.Foundation.Metadata.ApiInformation) { // Windows (Phone) 8.x
            if (typeof object[phoneMethod] === "function") { // Only defined on Windows Phone 8.x
                func = object[phoneMethod];
            } else {
                func = object[asyncMethod];
            }
        } else {// if (Windows.Foundation.Metadata.ApiInformation.isMethodPresent(type, asyncMethod) || !object[phoneMethod]) {
            func = object[asyncMethod];
        }/* else {
            return WinJS.Promise.wrapError(new TypeError(asyncMethod + " not found on " + type));
        }*/
        return WinJS.Promise.as(func.apply(object, Array.prototype.slice.call(arguments, 4)));
    }

    var previousFindText;
    WinJS.Namespace.define("App", {
        model: model,
        toggleAppBar: function (visible) {
            var appbar = window.appbar.winControl;
            if (visible === undefined) {
                if (appbar.opened) {
                    visible = false;
                } else {
                    visible = true;
                }
            }
            if (visible) {
                // WinJS 4.x uses different methods :/
                typeof appbar.open === "function" ? appbar.open() : appbar.show();
            } else {
                // WinJS 4.x uses different methods :/
                typeof appbar.close === "function" ? appbar.close() : appbar.hide();
            }
        },
        openFile: function (event) {
            var picker = new Windows.Storage.Pickers.FileOpenPicker();
            picker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.documentsLibrary;
            picker.viewMode = Windows.Storage.Pickers.PickerViewMode.list;
            picker.fileTypeFilter.replaceAll([".md", ".markdown"]);
            safeCallAsync(picker, "Windows.Storage.Pickers.FileOpenPicker", "pickSingleFileAsync", "pickSingleFileAndContinue")
            .then(showAsync);
        },
        Binding: {
            disbled: WinJS.Binding.converter(function (value) {
                return !value;
            })
        },
        showFind: function (text) {
            WinJS.UI.Pages.render("/pages/findPage.html", Application.navigator.pageElement, { text: text });
        },
        findText: function (text) {
            var textRange = document.body.createTextRange();
            // record the current position in a bookmark
            var rangeBookmark = textRange.getBookmark();
            if (previousFindText) {
                while (textRange.findText(previousFindText)) {
                    textRange.execCommand("RemoveFormat", false);
                    textRange.collapse(false);
                }
                previousFindText = undefined;
            }
            if (!text) {
                return;
            }
            if (-1 === App.model.recentFindTerms.indexOf(text)) {
                App.model.recentFindTerms.push(text);
            }
            while (textRange.findText(text)) {
                textRange.execCommand("BackColor", false, "yellow");
                textRange.collapse(false);
            }
            textRange.moveToBookmark(rangeBookmark);
            textRange.collapse();
            previousFindText = text;
        },
        notify: function (type, text, action) {
            model.notification.text = text;
            model.notification.type = type;
            if (action) {
                model.notification.actionAsync = function () {
                    // Clear the notify
                    App.notify();
                    var result;
                    try {
                        result = WinJS.Promise.as(action());
                    } catch (e) {
                        result = WinJS.Promise.wrapError(e);
                    }
                    return result;
                };
            } else {
                model.notification.actionAsync = null;
            }
        }
    });

    if (window.Mousetrap) {
        Mousetrap.bind("esc", function () {
            App.notify();
        });
        Mousetrap.bind("mod+f", function () {
            App.showFind();
        });
    }

    var appBarButtons = {
        openFile: {
            onclick: App.openFile
        },
        find: {
            onclick: App.showFind
        },
        pin: {
            onclick: function () {
                WinJS.Promise.as(Application.navigator.pageControl.pinAsync()).then(function () {
                });
            }
        },
        unpin: {
            onclick: function() {
                WinJS.Promise.as(Application.navigator.pageControl.unpinAsync()).then(function () {
                });
            }
        }
    };

    WinJS.Binding.bind(model, {
        commands: function (commands, oldValue) {
            if (oldValue === undefined) {
                return;
            }
            appbar.showOnlyCommands(commands);
        }
    });

    var appbar;
    function createAppBarButtons() {
        var commands = Object.keys(appBarButtons).map(function (buttonId) {
            var buttonElement = document.createElement("button");
            var buttonInfo = appBarButtons[buttonId];
            buttonInfo.id = buttonId;
            var labelText = WinJS.Resources.getString("appButton." + buttonId);
            if (labelText.empty) {
                buttonInfo.label = "!" + buttonId;
            } else {
                buttonInfo.label = labelText.value;
            }
            if (!buttonInfo.section) {
                buttonInfo.section = "global";
            }
            if (!buttonInfo.icon) {
                buttonInfo.icon = buttonId.toLowerCase();
            }
            return new WinJS.UI.AppBarCommand(buttonElement, buttonInfo);
        });
        appbar = new WinJS.UI.AppBar(document.body.appendChild(document.createElement("div")), {
            closedDisplayMode: 'minimal',
            commands: commands
        });
        appbar.element.id = "appbar";
    }

    function createBanner() {
        var banner = document.createElement("div");
        banner.id = "banner";
        //i18n
        banner.innerHTML = "<span></span><button class='close'>Close</button>";
        WinJS.Binding.bind(model, {
            notification: {
                type: function (value) {
                    banner.setAttribute("type", value);
                },
                text: function (value) {
                    banner.querySelector("span").innerHTML = value;
                }
            }
        });
        document.body.appendChild(banner);
        banner.addEventListener("click", function () {
            if (model.notification.actionAsync) {
                model.notification.actionAsync().done();
            }
        });
        banner.querySelector("button.close").addEventListener("click", function () {
            App.notify();
        });
    }

    function createNavigator(home) {
        if (!home) {
            home = "/pages/homePage.html";
        }
        new Application.PageControlNavigator(document.body.appendChild(document.createElement("div")), { home: home });
    }

    function createApp(home) {
        if (window.appbar) {
            return;
        }
        createNavigator();
        createAppBarButtons();
        createBanner();
    }

    WinJS.Application.addEventListener("activated", function (args) {
        WinJS.UI.disableAnimations();
        WinJS.Navigation.history = WinJS.Application.sessionState.history || {};
        WinJS.Navigation.history.current.initialPlaceholder = true;

        createApp();

        var p = WinJS.UI.processAll().then(function () {
            WinJS.Binding.processAll(document.body, model);
            if (WinJS.Navigation.location) {
                return WinJS.Navigation.navigate(WinJS.Navigation.location, WinJS.Navigation.state);
            } else {
                var promise;
                if (args.detail.tileId && args.detail.tileId != "App") {
                    if (args.detail.tileId.indexOf("file_") === 0) {
                        var futureAccessList = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
                        promise = futureAccessList.getFileAsync(args.detail.arguments).then(showAsync);
                    } else {
                        promise = showAsync(new Windows.Foundation.Uri(args.detail.arguments));
                    }
                } else if (args.detail.files) {
                    promise = showAsync(args.detail.files[0]);
                } else if (args.detail.shareOperation) {
                    promise = showShareOperationAsync(args.detail.shareOperation);
                } else {
                    promise = WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr.FreshStart"));
                }
                promise.then(null, function (error) {
                    if (error.name === "Markdownr.FreshStart") {
                        WinJS.Navigation.navigate(Application.navigator.home);
                    } else {
                        // Display Error
                    }
                })
            }
        }).then(function () {
            return WinJS.Utilities.Scheduler.requestDrain(WinJS.Utilities.Scheduler.Priority.aboveNormal + 1);
        }).then(function () {
            WinJS.UI.enableAnimations();
        });
        args.setPromise(p);
    });

    WinJS.Application.oncheckpoint = function (args) {
        //WinJS.Application.sessionState.history = WinJS.Navigation.history;
    };

    WinJS.Application.start();
})();

// For an introduction to the Navigation template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=392287
(function () {
    "use strict";

    var activation = Windows.ApplicationModel.Activation;
    var app = WinJS.Application;
    var nav = WinJS.Navigation;
    var sched = WinJS.Utilities.Scheduler;
    var ui = WinJS.UI;

    var model = WinJS.Binding.as({
        notification: WinJS.Binding.as({
            type: null,
            text: "",
            actionAsync: null
        }),
        pasteAvailable: false
    });

    // Clipboard module
    var watchClipboard;
    if (Windows.ApplicationModel.DataTransfer.Clipboard) {
        var pendingClipboardChange = false;
        var hasClipboardAccess = false;

        window.addEventListener("focus", function (event) {
            hasClipboardAccess = true;
            if (pendingClipboardChange) {
                updateFromClipboard();
            }
        });

        window.addEventListener("blur", function (event) {
            hasClipboardAccess = false;
        });

        function updateFromClipboard() {
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

        watchClipboard = function() {
            Windows.ApplicationModel.DataTransfer.Clipboard.addEventListener("contentchanged", function () {
                pendingClipboardChange = true;
                if (hasClipboardAccess) {
                    updateFromClipboard();
                }
            });
            if (hasClipboardAccess) {
                updateFromClipboard();
            }
        }
    }

    WinJS.Application.addEventListener("clipboardchanged", function (event) {
        model.pasteAvailable = true;
        probeDataPackageAsync(event.dataPackageView).then(function (probe) {
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
        return nav.navigate("/pages/home/home.html", options);
    }

    function probeDataPackageAsync(data) {
        if (data.requestedOperation === Windows.ApplicationModel.DataTransfer.DataPackageOperation.move) {
            //i18n
            return WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr", "Cut clipboard operations not supported"));
        } else if (data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.text)) {
            return data.getTextAsync().then(function (text) {
                var data, text;
                try {
                    var uri = new Windows.Foundation.Uri(text);
                    return {
                        data: uri,
                        text: "Download & display Markdown from URL in Clipboard<br>" + uri.rawUri
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
                    text: "Display file from clipboard<br>"+items[0].path//i18n
                };
            });
        } else {
            //i18n
            return WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr", "Unknown content to display"));
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

    WinJS.Namespace.define("App", {
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

    app.addEventListener("activated", function (args) {
        ui.disableAnimations();
        nav.history = app.sessionState.history || {};
        nav.history.current.initialPlaceholder = true;

        var p = ui.processAll().then(function () {
            WinJS.Binding.processAll(document.body, model);
            var banner = document.getElementById("banner");
            banner.addEventListener("click", function () {
                if (model.notification.actionAsync) {
                    model.notification.actionAsync().done();
                }
            });
            banner.querySelector("button.close").addEventListener("click", function() {
                App.notify();
            });
            document.getElementById("openFile").addEventListener("click", App.openFile, false);
            if (nav.location) {
                return nav.navigate(nav.location, nav.state);
            } else {
                var promise;
                if (args.detail.files) {
                    promise = showAsync(args.detail.files[0]);
                } else if (args.detail.shareOperation) {
                    promise = showShareOperationAsync(args.detail.shareOperation);
                } else {
                    promise = WinJS.Promise.wrapError(new WinJS.ErrorFromName("Markdownr.FreshStart"));
                }
                promise.then(null, function (error) {
                    if (error.name === "Markdownr.FreshStart") {
                        nav.navigate(Application.navigator.home);
                    } else {
                        // Display Error
                    }
                })
            }
        }).then(function () {
            return sched.requestDrain(sched.Priority.aboveNormal + 1);
        }).then(function () {
            ui.enableAnimations();
        });
        args.setPromise(p);

        args.detail.splashScreen.addEventListener("dismissed", function () {
            if (watchClipboard) {
                watchClipboard();
            }
        });
        if (args.detail.kind === activation.ActivationKind.launch || args.detail.kind === activation.ActivationKind.file || args.detail.kind == activation.ActivationKind.pickFileContinuation) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
            } else {
                // TODO: This application was suspended and then terminated.
                // To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
            }
        }
    });

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. If you need to
        // complete an asynchronous operation before your application is
        // suspended, call args.setPromise().
        //app.sessionState.history = nav.history;
    };

    app.start();
})();

(function () {
    "use strict";

    var state = WinJS.Binding.as({
        notification: WinJS.Binding.as({
            type: null,
            text: "",
            actionAsync: null
        }),
        pasteAvailable: false,
        recentFindTerms: new WinJS.Binding.List(),
        commands: [],
        onPrint: null,
        onShare: null
    });

    var printListener;
    function initPrinting() {
        if (!printListener && Windows.Graphics.Printing && (MSApp.getHtmlPrintDocumentSource || MSApp.getHtmlPrintDocumentSourceAsync)) {
            var printManager = Windows.Graphics.Printing.PrintManager.getForCurrentView();

            WinJS.Namespace.define("App.commands", {
                print: {
                    icon: "page",
                    section: "selection",
                    onclick: function () {
                        // WTF Microsoft. You design an ASYNC API and fail to return a error promise and instead throws?
                        // Thanks for making our dev lifes harder by forcing us to wrap this call
                        var printAsync;
                        try {
                            printAsync = Windows.Graphics.Printing.PrintManager.showPrintUIAsync();
                        } catch (ex) {
                            printAsync = WinJS.Promise.wrapError(ex);
                        };
                        printAsync.done(null, function (error) {
                            console.error(error.message);
                            return;
                        });
                    }
                }
            });

            state.bind("onPrint", function (value) {
                if (value && !printListener) {
                    printManager.addEventListener("printtaskrequested", printListener = function (event) {
                        state.onPrint(event);
                    });
                } else if (!value && printListener) {
                    printManager.removeEventListener("printtaskrequested", printListener);
                    printListener = null;
                }
            });
        }
    }

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
                //clipboardChanged();
            }
        }

        WinJS.Application.addEventListener("activated", function (args) {
            args.detail.splashScreen.addEventListener("dismissed", function () {
                watchClipboard();
            });
        });
    }

    WinJS.Application.addEventListener("clipboardchanged", function (event) {
        state.pasteAvailable = true;
        probeDataPackageAsync(event.dataPackageView).then(function (probe) {
            if (!probe) {
                return;
            }
            App.notify("paste", probe.text, function () {
                return showAsync(probe.data).then(function () {
                    event.dataPackageView.reportOperationCompleted(event.dataPackageView.requestedOperation);
                    state.pasteAvailable = false;
                });
            });
        }, function (error) {
            console.error(error.message);
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
        state: state,
        getShareTempFolderAsync: function() {
            return Windows.Storage.ApplicationData.current.temporaryFolder.createFolderAsync("share", Windows.Storage.CreationCollisionOption.openIfExists);
        },
        createShareTempFileAsync: function (fileName, getContent) {
            return App.getShareTempFolderAsync()
            .then(function (folder) {
                return WinJS.Promise.as(getContent())
                .then(function (content) {
                    return folder.createFileAsync(fileName, Windows.Storage.CreationCollisionOption.replaceExisting)
                    .then(function (file) {
                        // Fucking WinRT does not return the file here
                        return Windows.Storage.FileIO.writeTextAsync(file, content, Windows.Storage.Streams.UnicodeEncoding.utf8)
                        .then(function () {
                            return file;
                        })
                    });
                });
            });
        },

        cleanShareTempFolderAsync: function () {
            return App.getShareTempFolderAsync()
            .then(function (folder) {
                return folder.getFilesAsync()
            }).then(function (files) {
                return files.reduce(function (promise, file) {
                    return promise.then(function () {
                        return file.deleteAsync();
                    });
                }, WinJS.Promise.as());
            });
        },
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
            picker.fileTypeFilter.replaceAll([".md", ".markdown", ".textile"]);
            safeCallAsync(picker, "Windows.Storage.Pickers.FileOpenPicker", "pickSingleFileAsync", "pickSingleFileAndContinue")
            .then(showAsync).then(null, function (error) {
                console.error(error.asyncOpSource ? error.message + error.asyncOpSource.stack : error.message);
            });
        },
        Binding: {
            disbled: WinJS.Binding.converter(function (value) {
                return !value;
            }),

            date: WinJS.Binding.converter(function (value) {
                App.Binding.date.formatter = App.Binding.date.formatter || new Windows.Globalization.DateTimeFormatting.DateTimeFormatter("shortdate shorttime")
                return App.Binding.date.formatter.format(new Date(value))
            }),

            size: WinJS.Binding.converter(function (value) {
                return value + " bytes";//i18n
            })
        },
        showFind: function (text) {
            WinJS.UI.Pages.render("/pages/findPage.html", document.body, { text: text });
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
            if (-1 === App.state.recentFindTerms.indexOf(text)) {
                App.state.recentFindTerms.push(text);
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
            state.notification.text = text;
            state.notification.type = type;
            if (action) {
                state.notification.actionAsync = function () {
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
                state.notification.actionAsync = null;
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
        Mousetrap.bind("mod+p", function () {
            var printCommand = appbar.getCommandById("print");
            if (printCommand && !printCommand.disabled) {
                printCommand.element.click();
            }
        });
    }

    WinJS.Namespace.define("App.commands", {
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
        },
        toc: {
            icon: "bookmarks",
            onclick: function () {
                return;
            },
            section: "selection"
        }
    });
    WinJS.Binding.bind(state, {
        commands: function (commands, oldValue) {
            if (oldValue === undefined || !appbar) {
                return;
            }
            appbar.showOnlyCommands(commands);
        }
    });

    var shareListener;
    function initSharing() {
        if (shareListener) {
            return;
        }
        var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();

        if (WinJS.Utilities.isPhone) {
            App.cleanShareTempFolderAsync();
            WinJS.Namespace.define("App.commands", {
                share: {
                    icon: "share",
                    section: "selection",
                    onclick: function () {
                        Windows.ApplicationModel.DataTransfer.DataTransferManager.showShareUI();
                    }
                }
            });
        }

        state.bind("onShare", function (value) {
            if (value && !shareListener) {
                dataTransferManager.addEventListener("datarequested", shareListener = function (event) {
                    state.onShare(event);
                })
            } else if (!value && shareListener) {
                dataTransferManager.removeEventListener("datarequested", shareListener);
                shareListener = null;
            }
        });
    }

    var appbar;
    function createAppBarButtons() {
        var commands = Object.keys(App.commands).map(function (buttonId) {
            var buttonElement = document.createElement("button");
            var buttonInfo = App.commands[buttonId];
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
        var appBarElement = document.createElement("div");
        //appBarElement.style.backgroundColor = "rgba(255,255,255,255)";
        //appBarElement.style.color = "black";
        appBarElement.id = "appbar";
        var applicationView = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
        if (applicationView) {
            //applicationView.setDesiredBoundsMode && applicationView.setDesiredBoundsMode(Windows.UI.ViewManagement.ApplicationViewBoundsMode.useCoreWindow);
        }
        appbar = new WinJS.UI.AppBar(document.body.appendChild(appBarElement), {
            closedDisplayMode: 'minimal',
            commands: commands, // WinJS < 4.0
            data: new WinJS.Binding.List(commands) // WinJS 4.x
        });
        var nativeAppBar;
        if (Windows.UI.WebUI.Core) {
            nativeAppBar = Windows.UI.WebUI.Core.WebUICommandBar.getForCurrentView();
        } else {
            appBarElement.style.backgroundColor = "rgb(255,255,255)";
        }

        var setOpacity = function (opacity) {
            if (nativeAppBar) {
                nativeAppBar.opacity = opacity;
            } else {
                appBarElement.style.opacity = opacity;
            }
        }
        //appbar.addEventListener("beforeshow", setOpacity.bind(null, 1));
        //appbar.addEventListener("afterhide", setOpacity.bind(null, 0));
    }

    function createBanner() {
        var banner = document.createElement("div");
        banner.id = "banner";
        //i18n
        banner.innerHTML = "<span></span><button class='close'>Close</button>";
        WinJS.Binding.bind(state, {
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
            if (state.notification.actionAsync) {
                state.notification.actionAsync().done();
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
        var navigatorElement = document.createElement("div");
        navigatorElement.className = "navigator";
        new Application.PageControlNavigator(document.body.appendChild(navigatorElement), { home: home });
    }

    function createApp(activationKind) {
        if (window.appbar) {
            return;
        }
        createNavigator();
        if (activationKind != Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
            createAppBarButtons();
            createBanner();
        }
    }

    WinJS.Application.addEventListener("activated", function (args) {
        WinJS.UI.disableAnimations();
        WinJS.Navigation.history = WinJS.Application.sessionState.history || {};
        WinJS.Navigation.history.current.initialPlaceholder = true;
        var kind = args.detail.kind;
        //kind = Windows.ApplicationModel.Activation.ActivationKind.fileOpenPicker

        if (kind === Windows.ApplicationModel.Activation.ActivationKind.fileOpenPicker) {
            createNavigator();
        } else {
            if (kind !== Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
                initPrinting();
                initSharing();
            }
            createApp(kind);
        }

        var p = WinJS.UI.processAll().then(function () {
            if (kind === Windows.ApplicationModel.Activation.ActivationKind.fileOpenPicker) {
                return WinJS.Navigation.navigate("/pages/filePickerPage.html", { filePickerUI: args.detail.fileOpenPickerUI })
            }
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
                return promise.then(null, function (error) {
                    if (error.name === "Markdownr.FreshStart") {
                        return WinJS.Navigation.navigate(Application.navigator.home);
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

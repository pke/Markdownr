// For an introduction to the Navigation template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=392287
(function () {
    "use strict";

    var activation = Windows.ApplicationModel.Activation;
    var app = WinJS.Application;
    var nav = WinJS.Navigation;
    var sched = WinJS.Utilities.Scheduler;
    var ui = WinJS.UI;

    WinJS.Namespace.define("App", {
        openFile: function (event) {
            var picker = new Windows.Storage.Pickers.FileOpenPicker();
            picker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.documentsLibrary;
            picker.viewMode = Windows.Storage.Pickers.PickerViewMode.list;
            picker.fileTypeFilter.replaceAll([".md", ".markdown"]);
            if (picker.continuationData) {
                picker.continuationData.insert("page", "/pages/home/home.html");
            }
            if (picker.pickSingleFileAndContinue) {
                picker.pickSingleFileAndContinue();
            } else {
                picker.pickSingleFileAsync()
                .then(function (file) {
                    if (file) {
                        nav.navigate("/pages/home/home.html", {
                            file: file
                        });
                    }
                });
            }
        }
    });

    app.addEventListener("activated", function (args) {
        if (args.detail.kind === activation.ActivationKind.launch || args.detail.kind === activation.ActivationKind.file || args.detail.kind == activation.ActivationKind.pickFileContinuation) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
            } else {
                // TODO: This application was suspended and then terminated.
                // To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
            }

            nav.history = app.sessionState.history || {};
            nav.history.current.initialPlaceholder = true;

            if (args.detail.files) {
                nav.state = {
                    file: args.detail.files[0]
                };
            }

            // Optimize the load of the application and while the splash screen is shown, execute high priority scheduled work.
            ui.disableAnimations();
            var p = ui.processAll().then(function () {
                document.getElementById("openFile").addEventListener("click", App.openFile, false);
                return nav.navigate(nav.location || Application.navigator.home, nav.state);
            }).then(function () {
                return sched.requestDrain(sched.Priority.aboveNormal + 1);
            }).then(function () {
                ui.enableAnimations();
            });

            args.setPromise(p);
        }
    });

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. If you need to 
        // complete an asynchronous operation before your application is 
        // suspended, call args.setPromise().
        app.sessionState.history = nav.history;
    };

    app.start();
})();

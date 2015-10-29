WinJS.UI.Pages.define("/pages/findPage.html", {
    processed: function (element, options) {
        window.appbar.winControl.disabled = true;
        var form = element.querySelector("form");
        form.onsubmit = function (event) {
            event.preventDefault();
            App.findText(form.term.value);
            var pageElement = element.querySelector("div.findpage")
            WinJS.UI.Animation.fadeOut(pageElement).then(function () {
                window.appbar.winControl.disabled = false;
                pageElement.parentElement.removeChild(pageElement);
            });
        }
    },

    ready: function (element, options) {
        var input = element.querySelector("form input");
        input.click();
    }
});
WinJS.UI.Pages.define("/pages/findPage.html", {
    processed: function (element, options) {
        this.element = element;
        var self = this;
        window.appbar.winControl.disabled = true;
        var form = element.querySelector("form");
        form.onsubmit = function (event) {
            event.preventDefault();
            App.findText(form.term.value);
            self.close();
        }
    },

    close: function () {
        window.appbar.winControl.disabled = false;
        WinJS.Application.removeEventListener("backclick", this._backListener);
        var pageElement = this.element.querySelector("div.findpage")
        WinJS.UI.Animation.fadeOut(pageElement).then(function () {
            pageElement.parentElement.removeChild(pageElement);
        });
    },

    onBack: function (event) {
        var handled = event.handled;
        if (!handled) {
            this.close();
            handled = true;
        }
        return handled;
    },

    ready: function (element, options) {
        WinJS.Application.addEventListener("backclick", this._backListener = this.onBack.bind(this));
        var input = element.querySelector("form input");
        input.click();
    }
});
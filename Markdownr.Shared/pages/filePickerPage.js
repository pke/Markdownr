
WinJS.UI.Pages.define("/pages/filePickerPage.html", {
    init: function(element, options) {
        this.files = []
        var self = this
        return this.getFilesAsync = Windows.Storage.AccessCache.StorageApplicationPermissions.mostRecentlyUsedList.entries.reduce(function (promise, item, index) {
            return promise.then(function () {
                return Windows.Storage.AccessCache.StorageApplicationPermissions.mostRecentlyUsedList.getFileAsync(item.token)
            }).then(function (file) {
                var meta = {}
                try {
                    meta = JSON.parse(item.metadata)
                } catch (error) {
                }
                self.files.push({
                    id: index,
                    path: file.path,
                    name: file.name,
                    size: meta.size,
                    date: new Date(meta.openedAt),
                    file: file
                })
                return self.files
            })
        }, WinJS.Promise.as())
    },

    processed: function(element, options) {
      var listView = element.querySelector("div[data-win-control='WinJS.UI.ListView']").winControl
      var self = this;
      this.getFilesAsync.then(function (files) {
          self.files = files
          listView.itemDataSource = (new WinJS.Binding.List(files)).dataSource
      })
      var filePickerUI = options.filePickerUI
      if (filePickerUI) {
          listView.selectionMode = filePickerUI.selectionModen === Windows.Storage.Pickers.Provider.FileSelectionMode.single ? "single" : "multi"
          filePickerUI.addEventListener("fileremoved", function (event) {
              listView.selection.remove(Number(event.id))
          })
          /*listView.addEventListener("selectionchanged", function () {
              listView.selection.getIndices().forEach(function (index) {
                  if (!filePickerUI.containsFile(index)) {
                      filePickerUI.addFile(index, self.files[index].file)
                  } else {
                      filePickerUI.removeFile(index)
                  }
              })
          })*/
          listView.addEventListener("iteminvoked", function (event) {
              var item = self.files[event.detail.itemIndex]
              if (filePickerUI.containsFile(item.id)) {
                  filePickerUI.removeFile(item.id)
              } else {
                  filePickerUI.addFile(item.id, item.file)
              }
          })
      }
    }
})
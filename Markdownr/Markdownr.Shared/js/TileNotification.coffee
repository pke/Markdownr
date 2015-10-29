TileUpdateManager = Windows.UI.Notifications.TileUpdateManager
TileTemplateType = Windows.UI.Notifications.TileTemplateType
TileNotification = Windows.UI.Notifications.TileNotification

###
Can be called with createWithTemplate(templateName, text1: "First Text element", image1: "src")
- or -
createWithTemplate(templateName,
text1: "First Text element"
image1:
    src: "src"
    alt: "alt text")
###
createFromTemplate = (id, templateName) ->
    # Lowercase the first letter in the template, as TileTemplateType expects JS like keys with first
    # lowercase letters. Otherwise requesting "TileSquare150x150Text02" would result in
    # TileTemplateType[TileSquare150x150Text02] returning "null" which would be accepted by
    # getTemplateContent as "0" and return the template for "TileSquare150x150Image" (which is id=0)
    templateName = templateName.charAt(0).toLowerCase() + templateName.slice(1)
    unless templateType = TileTemplateType[templateName]
      throw new WinJS.ErrorFromName("TileNotificationError", "The template #{templateName} was not found")
    tileXml = TileUpdateManager.getTemplateContent(templateType)
    tileId = id
    if arguments.length > 2
      bindings = tileXml.selectSingleNode("tile/visual/binding").childNodes
      if typeof arguments[2] is "string"
        for binding,index in bindings when index < arguments.length-2
          if binding.nodeName is "text"
            binding.innerText = arguments[2+index]
          else if binding.nodeName is "image"
            binding.setAttribute("src", arguments[2+index])
            binding.setAttribute("alt", "Image")

    branding: (type) ->
      tileXml.selectSingleNode("tile/visual").setAttribute("branding", type)
      @

    text: (index, text) ->
      tileXml.selectSingleNode("text[#{index}]")?.innerText = text
      @

    updateSecondaryTile: () ->
      tileNotification = new TileNotification(tileXml)
      updater = TileUpdateManager.createTileUpdaterForSecondaryTile(tileId)
      updater.update(tileNotification)

WinJS.Namespace.define("TileNotification", createFromTemplate: createFromTemplate)
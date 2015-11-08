# Markdownr

> A full-featured markdown viewer for Windows and Windows Phone.
>
> Built for speed with the help of great Open-Source libraries.

## Features

* [GitHub Flavoured Markdown](https://help.github.com/articles/github-flavored-markdown/) including tables
* Extensive & fast [syntax highlighting](#syntax)
* .md and .markdown (and .txt) [files](#file) from any location
* [Find](#find) & <mark>Highlight</mark> of text
* [Pin](#pin) a markdown file or URL to your Start Screen
* Print
* Share markdown files via E-Mail or other apps
* And of course images!
  ![alt](ms-appx-web:///images/kitten.png)
<span style="display:none">* Automatically generates table of contents (TOC) for easier navigation</span>

## Guides

### How to view a file<a name="file"></a>

1. Open the appbar [`...`](#toggleAppBar) and select `Open File`
2. __or__ open a .md/.markdown file from the filesystem
3. __or__ copy a text, URL, file to the clipboard and switch back to Markdownr
4. __or__ Share a text, URL or file from any other app with Markdownr

### How to find & highlight text<a name="find"></a>

1. Open the appbar  [`...`](#toggleAppBar) and select `Find`
2. On the next page type the text to find and press enter

### Pin a file or URL to Start<a name="pin"></a>

1. Open the appbar  [`...`](#toggleAppBar) and select `Pin`
2. Choose a name and size for the tile
3. Press `Pin To Start`
4. Switch to the Start Screen and set your tile to wide to see your markdown files Heading and some text as preview.<br />
In the next version all tile sizes will be supported and contain useful information to give you a glance at your markdown file right from your Start Screen

### Syntax highlighting<a name="syntax"></a>

CoffeeScript

```coffeescript
loadFileAsync(file)
.then (content) ->
    marked(content)
.then (html) ->
  document.body.innerHTML = html
.then null, (error) ->
  console.error(error);
```

## Coming Soon

* Table Of Contents auto generation
* Better live tiles
* Dark/Light Themes
* Support for YAML [Front-Matter](http://jekyllrb.com/docs/frontmatter/)

## Known Issues

### Windows 10

* Pinch zoom does not work
* Find backbutton broken (closes the app)

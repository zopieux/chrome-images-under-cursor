# Images Under Cursor

Chrome extension to find all images and background images laying under the
cursor, whatever their depth or nesting in the DOM tree. This extension also
supports extracting the current frame of
[canvas elements](https://en.wikipedia.org/wiki/Canvas_element).

This is useful to circumvent the HTML, Javascript and CSS tricks some websites
use to prevent the user from accessing the page assets — which is plain
ridiculous, as there are accessible anyway.

## Install from Chrome Web Store

[![Install from Store](/meta/store-button.png?raw=true)](https://chrome.google.com/webstore/detail/images-under-cursor/kjfcpinmimcpiabejchhneahpajgklcj)

## Screenshots

![Screenshot](/meta/sc-1.png?raw=true "Screenshot of context menu")

![Screenshot](/meta/sc-2.png?raw=true "Screenshot with normal image")

![Screenshot](/meta/sc-3.png?raw=true "Screenshot with background images")

## Usage

1. Install the extension;
    - There is *no* icon added to the browser user interface.
1. On any web page, right-click on the image or canvas you want to extract;
1. Choose *Images under cursor* in the contextual menu;
1. All images will be displayed in a pop-over listing along with their URL.
    - If no image is found, a quick animation will be displayed instead.

## Development

### Building

Dependencies: chrome or chromium, sass, inkscape, optipng, make, tar, zip

```shell
$ make
```

### Installing

In [`chrome://extensions/`](chrome://extensions/), open  *Load unpacked
extension* and chose the `build/` folder generated during the  build.

## License

MIT. See `LICENSE`.

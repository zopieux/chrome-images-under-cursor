# Images Under Cursor

Chrome extension to find all images, background images and background videos laying under the
cursor, whatever their depth or nesting in the DOM tree. This extension also
supports extracting the current frame of
[canvas elements](https://en.wikipedia.org/wiki/Canvas_element).

This is useful to circumvent the HTML, Javascript and CSS tricks some websites
use to prevent the user from accessing the page assets — which is plain
ridiculous, as there are accessible anyway.

## Install from Chrome Web Store or Firefox addons

[![Install on Chrome](/.github/store-button.png?raw=true)](https://chrome.google.com/webstore/detail/images-under-cursor/kjfcpinmimcpiabejchhneahpajgklcj)
[![Install on Firefox](/.github/get-the-addon.png?raw=true)](https://addons.mozilla.org/firefox/addon/images-under-cursor/)

## Screenshots

| Step 1: aim | Step 2: download |
| --- | --- |
| ![Screenshot](/.github/sc-1.png?raw=true "Context menu")  | ![Screenshot](/.github/sc-2.png?raw=true "Result list") |

## Usage

1. Install the extension;
    - There is *no* icon added to the browser user interface.
1. On any web page, aim with your cursor the element (image, video) you want.
1. Right-click or press Ctrl+Shift+F (customizable) to trigger *Images Under Cursor*.
1. All found images & videos will be displayed in a pop-over.

## Development

### Building

```shell
$ nix develop
$ yarn install
$ yarn run build
```

### Local installation

* Chrome: In `chrome://extensions/`, click *Load unpacked extension* and pick the `dist/` folder.
* Firefox: In `about:debugging#/runtime/this-firefox`, open *Load Temporary Add-on…* and pick the `dist/manifest.json` file.

## License

MIT. See `LICENSE`.

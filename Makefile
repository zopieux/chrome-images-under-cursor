EXTNAME := images-under-cursor
KEYFILE := $(EXTNAME).pem
ZIPNAME := $(EXTNAME).zip
SHELL := /usr/bin/env bash
CHROME := chromium
CHROMEBIN := $(CHROME) -n --args
OUTDIR := build
SASS := sass --style=compressed
SVGRASTER := inkscape --export-area-page
SVGRASTERDRAWING := inkscape --export-area-drawing
PNGOPTIMIZE := optipng -quiet -clobber -preserve

OBJS := src/css/content.css $(addprefix src/img/icon-,$(addsuffix .png,48 128)) src/img/icon-nope-26.png
COPIED := src/manifest.json $(wildcard src/js/*.js) src/_locales src/img/menu-icon.png

all: build

%.css: %.scss
	$(SASS) $<:$@

src/img/icon-%.png: src/img/icon.svg
	$(SVGRASTER) -w $* --export-png $@ $<
	$(PNGOPTIMIZE) $@

package-icon.png: src/img/icon.svg
	$(SVGRASTER) -w 96 --export-png nb-$@ $<
	convert nb-$@ -bordercolor transparent -border 16 $@
	$(RM) nb-$@
	$(PNGOPTIMIZE) $@

src/img/icon-nope-%.png: src/img/icon-nope.svg
	$(SVGRASTERDRAWING) -w $* --export-png $@ $<
	$(PNGOPTIMIZE) $@

build: $(OBJS) $(COPIED)
	mkdir -p $(OUTDIR)
	tar -cf - $^ | tar -xv --strip-components=1 -C $(OUTDIR)

zip: build
	$(RM) $(ZIPNAME)
	cd $(OUTDIR) && zip -r ../$(ZIPNAME) .

crx: build
	$(CHROMEBIN) --pack-extension=$(OUTDIR) --pack-extension-key=$(KEYFILE)
	mv $(basename $(OUTDIR)).crx $(EXTNAME)-latest.crx

clean:
	$(RM) -r *.crx $(OUTDIR) $(OBJS) $(ZIPNAME)

.PHONY: clean

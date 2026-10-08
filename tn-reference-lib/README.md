# TN reference asset library (TN_REFERENCE_ASSET_LIBRARY_V1)

Source-preserving extraction and validation for the two posters and the 11-page `pop(2).pdf`.
Needs Python 3 with Pillow, numpy, pypdf and poppler (`pdfimages`, `pdftoppm`). No source files are in this repo.

    # posters (bounds are the brief's approximate guides; verify, then rerun)
    python3 tn-reference-lib/tn_ref.py poster "4F10E44C-24C5-4560-9FC8-21DFBE966CED(2).jpeg" out/poster_black_red --name POSTER_BLACK_RED --bounds 325 310 889 1281
    python3 tn-reference-lib/tn_ref.py poster "IMG_0700(3).jpeg" out/poster_orange --name POSTER_ORANGE --bounds 209 230 653 987
    python3 tn-reference-lib/tn_ref.py detect-bounds "IMG_0700(3).jpeg"      # suggests bounds from the pixels

    # PDF: inventory, untouched embedded images, 300 dpi page rasters
    python3 tn-reference-lib/tn_ref.py pdf "pop(2).pdf" out/pop

    # panel sheets (POP_07 six panels = 2x3 guess, POP_10 nine panels = 3x3 guess; confirm against the page)
    python3 tn-reference-lib/tn_ref.py grid out/pop/01_ORIGINALS/page-7.png out/pop/panels_07 --name POP_07 --rows 2 --cols 3

Done exactly: archival composite, four perspective planes + media as registered full-canvas RGBA layers with tight crops and
offsets, media mask, transparent frame overlay (opening checked for zero alpha), manifest, reassembly diff / 50% overlay / changed-pixel
count. Not done here (needs real files and judgement): per-glyph lettering, texture separation, traced SVG, font identity,
editable masters, Arabic adaptation, video. Hidden regions are never recovered.

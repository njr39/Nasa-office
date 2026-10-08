#!/usr/bin/env python3
"""TN reference asset library: source-preserving extraction + validation.

Implements the TN_REFERENCE_ASSET_LIBRARY_V1 brief for the parts that can be done exactly:

  poster  - split a perspective-frame poster into registered full-canvas layers (4 planes, media, frame overlay)
            using the brief's plane geometry, tight crops with offsets, and a pixel-level reassembly check.
  pdf     - inventory every page, extract embedded images untouched (pdfimages) and rasterize each page.
  grid    - cut a panel sheet (e.g. POP_07 / POP_10) into individual panel files.

Everything here is source-preserving: pixels are copied from the decoded source, never resampled, sharpened or
recoloured. Anything that is NOT done here (per-glyph lettering, texture separation, font identity, hidden-region
recovery) is left out on purpose and reported as such in the manifest "notes". Nothing is called pixel-identical
unless the comparison below measured zero difference.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image

LAYER_ORDER = ["TOP_PLANE", "RIGHT_PLANE", "BOTTOM_PLANE", "LEFT_PLANE", "MEDIA_IMAGE"]


def load_rgb(path):
    """Decode to RGB pixels (decoded pixels are what the brief compares, not file bytes)."""
    im = Image.open(path)
    im.load()
    if im.mode != "RGB":
        im = im.convert("RGB")
    return im


def edge_ok(poly, px, py):
    """Interior test for a convex polygon, winding-independent (>= 0 on the interior side)."""
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    ok = np.ones(px.shape, bool)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
        ref = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        ok &= (cross * np.sign(ref)) >= 0
    return ok


def plane_masks(W, H, L, T, R, B):
    """Partition of everything outside the media rectangle into four planes (brief geometry), plus the media rect.
    Sequential ownership guarantees no overlaps; the caller checks there are no uncovered pixels."""
    ys, xs = np.mgrid[0:H, 0:W]
    px, py = xs + 0.5, ys + 0.5
    polys = {
        "TOP_PLANE": [(0, 0), (W, 0), (R, T), (L, T)],
        "RIGHT_PLANE": [(W, 0), (W, H), (R, B), (R, T)],
        "BOTTOM_PLANE": [(W, H), (0, H), (L, B), (R, B)],
        "LEFT_PLANE": [(0, H), (0, 0), (L, T), (L, B)],
    }
    media = (xs >= L) & (xs < R) & (ys >= T) & (ys < B)
    taken = media.copy()
    masks = {}
    for name, poly in polys.items():
        m = edge_ok(poly, px, py) & ~taken
        masks[name] = m
        taken |= m
    masks["MEDIA_IMAGE"] = media
    return masks, int((~taken).sum())


def rgba_from(rgb, mask):
    a = np.zeros(mask.shape + (4,), np.uint8)
    a[..., :3] = np.asarray(rgb)
    a[..., 3] = np.where(mask, 255, 0)
    return a


def save_png(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr, "RGBA" if arr.shape[-1] == 4 else "RGB").save(path, "PNG", compress_level=6)


def tight_bbox(mask):
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def cmd_poster(a):
    out = a.out
    for d in ["01_ORIGINALS", "02_REGISTERED_LAYERS", "03_CROPPED_ASSETS", "04_TRANSPARENT_FRAMES", "08_VALIDATION"]:
        os.makedirs(os.path.join(out, d), exist_ok=True)
    src = load_rgb(a.source)
    W, H = src.size
    arr = np.asarray(src)
    L, T, R, B = a.bounds
    if not (0 <= L < R <= W and 0 <= T < B <= H):
        sys.exit(f"bounds {a.bounds} do not fit canvas {W}x{H}")
    name = a.name
    base = os.path.basename(a.source)
    manifest, notes = [], []

    # archival composite: decoded pixels written losslessly, untouched
    save_png(arr, os.path.join(out, "01_ORIGINALS", f"{name}_ARCHIVAL.png"))
    manifest.append(dict(asset_id=f"{name}_ARCHIVAL", source_filename=base, source_page=None, layer_name="REFERENCE_ORIGINAL",
                         canvas_width=W, canvas_height=H, crop_x=0, crop_y=0, crop_width=W, crop_height=H, stack_order=0,
                         blend_mode="normal", opacity=1.0, extracted_or_reconstructed="extracted", font_status="n/a",
                         export_filename=f"01_ORIGINALS/{name}_ARCHIVAL.png"))

    masks, uncovered = plane_masks(W, H, L, T, R, B)
    outside = ~masks["MEDIA_IMAGE"]
    overlap = sum(m.astype(np.int32) for m in masks.values()).max()
    if uncovered or overlap > 1:
        sys.exit(f"plane partition failed: uncovered={uncovered} max_overlap={overlap}")

    for i, lname in enumerate(LAYER_ORDER, start=1):
        m = masks[lname]
        full = rgba_from(arr, m)
        fn_full = f"02_REGISTERED_LAYERS/{name}_{i:02d}_{lname}.png"
        save_png(full, os.path.join(out, fn_full))
        bb = tight_bbox(m)
        cx, cy, cx2, cy2 = bb
        fn_crop = f"03_CROPPED_ASSETS/{name}_{i:02d}_{lname}_crop.png"
        save_png(full[cy:cy2, cx:cx2], os.path.join(out, fn_crop))
        for fn, (x, y, w, h) in [(fn_full, (0, 0, W, H)), (fn_crop, (cx, cy, cx2 - cx, cy2 - cy))]:
            manifest.append(dict(asset_id=os.path.splitext(os.path.basename(fn))[0], source_filename=base, source_page=None,
                                 layer_name=lname, canvas_width=W, canvas_height=H, crop_x=x, crop_y=y, crop_width=w,
                                 crop_height=h, stack_order=i, blend_mode="normal", opacity=1.0,
                                 extracted_or_reconstructed="extracted", font_status="not_applicable_to_pixel_layer",
                                 export_filename=fn))

    # MEDIA_MASK as a real alpha asset
    mm = np.zeros((H, W, 4), np.uint8)
    mm[..., :3] = 255
    mm[..., 3] = np.where(masks["MEDIA_IMAGE"], 255, 0)
    save_png(mm, os.path.join(out, "02_REGISTERED_LAYERS", f"{name}_MEDIA_MASK.png"))

    # frame overlay: surrounding artwork preserved, media opening fully transparent, no placeholder
    frame = rgba_from(arr, outside)
    fn_frame = f"04_TRANSPARENT_FRAMES/{name}_FRAME_OVERLAY.png"
    save_png(frame, os.path.join(out, fn_frame))
    opening_alpha = frame[T:B, L:R, 3]
    zero_ok = bool((opening_alpha == 0).all())
    manifest.append(dict(asset_id=f"{name}_FRAME_OVERLAY", source_filename=base, source_page=None, layer_name="FRAME_OVERLAY",
                         canvas_width=W, canvas_height=H, crop_x=0, crop_y=0, crop_width=W, crop_height=H, stack_order=9,
                         blend_mode="normal", opacity=1.0, extracted_or_reconstructed="extracted", font_status="n/a",
                         export_filename=fn_frame))

    # validation: reassemble registered layers bottom-to-top and compare with decoded source
    canvas = np.zeros((H, W, 3), np.int32)
    covered = np.zeros((H, W), bool)
    for lname in LAYER_ORDER:
        lay = np.asarray(Image.open(os.path.join(out, "02_REGISTERED_LAYERS", f"{name}_{LAYER_ORDER.index(lname)+1:02d}_{lname}.png")))
        m = lay[..., 3] > 0
        canvas[m] = lay[..., :3][m]
        covered |= m
    diff = np.abs(canvas - arr.astype(np.int32))
    changed = int((diff.max(axis=2) > 0).sum())
    maxdiff = int(diff.max())
    vis = np.clip(diff * 40, 0, 255).astype(np.uint8)
    Image.fromarray(vis, "RGB").save(os.path.join(out, "08_VALIDATION", f"{name}_DIFF_x40.png"))
    over = (0.5 * canvas + 0.5 * arr).astype(np.uint8)
    Image.fromarray(over, "RGB").save(os.path.join(out, "08_VALIDATION", f"{name}_OVERLAY_50.png"))
    # transparency check of the frame over black / white / colour
    for tag, col in [("black", (0, 0, 0)), ("white", (255, 255, 255)), ("magenta", (255, 0, 255))]:
        bg = Image.new("RGBA", (W, H), col + (255,))
        bg.alpha_composite(Image.fromarray(frame, "RGBA"))
        bg.convert("RGB").save(os.path.join(out, "08_VALIDATION", f"{name}_FRAME_over_{tag}.png"))
    report = dict(reference=name, source=base, canvas=[W, H], bounds_LTRB=[L, T, R, B],
                  bounds_note="Supplied bounds are approximate guides unless verified against source pixels (see --detect-bounds).",
                  partition=dict(uncovered_pixels=uncovered, max_overlap=int(overlap), covers_full_canvas=bool(covered.all())),
                  reassembly=dict(changed_pixels=changed, max_channel_difference=maxdiff,
                                  pixel_identical_over_full_canvas=(changed == 0 and bool(covered.all()))),
                  frame_opening=dict(pixels=int(opening_alpha.size), nonzero_alpha_pixels=int((opening_alpha > 0).sum()),
                                     all_zero_alpha=zero_ok))
    with open(os.path.join(out, "08_VALIDATION", f"{name}_validation.json"), "w") as f:
        json.dump(report, f, indent=2)
    notes += ["Layers are geometric pixel partitions (planes + media), not separated lettering or texture.",
              "Hidden regions behind overlapping elements are NOT recovered.",
              "Pixel-identical statement applies to decoded pixels of this source only."]
    with open(os.path.join(out, f"{name}_manifest.json"), "w") as f:
        json.dump(dict(assets=manifest, notes=notes), f, indent=2)
    print(json.dumps(report, indent=2))
    return 0 if (changed == 0 and zero_ok) else 1


def detect_bounds(path, tol=18):
    """Suggest media bounds: the bounding box of pixels that differ from the four corner-adjacent frame colours.
    A guide only - verify visually."""
    a = np.asarray(load_rgb(path)).astype(int)
    H, W = a.shape[:2]
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(edge, axis=0)
    m = np.abs(a - ref).max(axis=2) > tol
    m[:3], m[-3:], m[:, :3], m[:, -3:] = False, False, False, False
    bb = tight_bbox(m)
    print("suggested media bounds L,T,R,B:", bb, "(guide only; frame colour varies across planes)")


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw).stdout


def cmd_pdf(a):
    out = a.out
    for d in ["01_ORIGINALS", "02_REGISTERED_LAYERS", "03_CROPPED_ASSETS", "08_VALIDATION"]:
        os.makedirs(os.path.join(out, d), exist_ok=True)
    from pypdf import PdfReader
    rd = PdfReader(a.source)
    n = len(rd.pages)
    base = os.path.basename(a.source)
    listing = run(["pdfimages", "-list", a.source])
    open(os.path.join(out, "08_VALIDATION", "pdf_embedded_image_inventory.txt"), "w").write(listing)
    img_dir = os.path.join(out, "03_CROPPED_ASSETS", "embedded")
    os.makedirs(img_dir, exist_ok=True)
    run(["pdfimages", "-png", "-p", a.source, os.path.join(img_dir, "p")])  # untouched embedded images
    run(["pdftoppm", "-r", str(a.dpi), "-png", a.source, os.path.join(out, "01_ORIGINALS", "page")])
    pages = []
    for i, p in enumerate(rd.pages, start=1):
        mb = [float(x) for x in p.mediabox]
        emb = sorted(f for f in os.listdir(img_dir) if f.startswith(f"p-{i:03d}-"))
        txt = (p.extract_text() or "").strip()
        pages.append(dict(page=i, mediabox_pt=mb, embedded_images=emb, extractable_text_chars=len(txt),
                          text_sample=txt[:120]))
    rep = dict(source=base, page_count=n, raster_dpi=a.dpi, pages=pages,
               notes=["Embedded images were extracted without re-encoding where pdfimages allows (PNG container).",
                      "Pages with zero embedded images are vector or text only: rasterized page is the only pixel source.",
                      "Browser/search interface artifacts (e.g. page 4) must be excluded by hand from reusable art."])
    json.dump(rep, open(os.path.join(out, "pdf_inventory.json"), "w"), indent=2, ensure_ascii=False)
    print(json.dumps(dict(page_count=n, per_page_embedded={p["page"]: len(p["embedded_images"]) for p in pages}), indent=2))
    return 0


def cmd_grid(a):
    os.makedirs(a.out, exist_ok=True)
    im = load_rgb(a.source)
    W, H = im.size
    xs = [0] + (a.cols_at or [round(W * k / a.cols) for k in range(1, a.cols)]) + [W]
    ys = [0] + (a.rows_at or [round(H * k / a.rows) for k in range(1, a.rows)]) + [H]
    k = 0
    cells = []
    for r in range(len(ys) - 1):
        for c in range(len(xs) - 1):
            k += 1
            box = (xs[c], ys[r], xs[c + 1], ys[r + 1])
            fn = os.path.join(a.out, f"{a.name}_panel_{k:02d}.png")
            im.crop(box).save(fn, "PNG")
            cells.append(dict(panel=k, crop_x=box[0], crop_y=box[1], crop_width=box[2] - box[0], crop_height=box[3] - box[1], file=os.path.basename(fn)))
    json.dump(dict(source=os.path.basename(a.source), canvas=[W, H], panels=cells,
                   note="Equal or user-given cut lines; panel dividers are included in crops unless cut lines are tightened."),
              open(os.path.join(a.out, f"{a.name}_panels.json"), "w"), indent=2)
    print(f"{k} panels written")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("poster")
    p.add_argument("source"); p.add_argument("out"); p.add_argument("--name", required=True)
    p.add_argument("--bounds", type=int, nargs=4, metavar=("L", "T", "R", "B"), required=True)
    p.set_defaults(fn=cmd_poster)
    d = sp.add_parser("detect-bounds"); d.add_argument("source"); d.set_defaults(fn=lambda a: detect_bounds(a.source) or 0)
    q = sp.add_parser("pdf"); q.add_argument("source"); q.add_argument("out"); q.add_argument("--dpi", type=int, default=300)
    q.set_defaults(fn=cmd_pdf)
    g = sp.add_parser("grid"); g.add_argument("source"); g.add_argument("out"); g.add_argument("--name", required=True)
    g.add_argument("--rows", type=int, default=1); g.add_argument("--cols", type=int, default=1)
    g.add_argument("--rows-at", type=int, nargs="*", dest="rows_at"); g.add_argument("--cols-at", type=int, nargs="*", dest="cols_at")
    g.set_defaults(fn=cmd_grid)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()

# Final transfer status — unzipped sources
9 November 2026. Five GitHub sources are now uploaded as usable unzipped directory structures, with path/count/byte-size readback verification. Original ZIPs retained. No source code executed, dependencies installed, existing files deleted or sharing changed.

- Moodle 19-room pack, kitchen excluded:52 files; https://drive.google.com/drive/folders/1FwCHieOxsPkfT6JSAWEwxzENtw48CDwf
- Virtual Art Gallery:33 files; https://drive.google.com/drive/folders/1Ojkn7ujxHMoCrgx_zF3DQguqLdZM0uoJ
- AWS warehouse ros1:130 files; https://drive.google.com/drive/folders/1f4SLZjYxqniMug8BDV09tqmXlZQbDJdU
- SuperSplat editor:292 files; https://drive.google.com/drive/folders/1J2O__nXylluJNAFBOhIEKcsN6fNBLzRH
- NASA:1,199 original files / 5,003,809,285 bytes in 384 source folders, zero missing/extra/size mismatches; https://drive.google.com/drive/folders/102ukSkFRxsAiYirnG31FTf87oN-JiT1U

Voxel51 is PARTIAL in Drive:10/18 original files,4,101,882 bytes, at https://drive.google.com/drive/folders/117urpLss1ZLwg9tRA3tW5eXqRjJyfQVt . All 18 source files downloaded locally, and 16 LFS assets match pinned upstream SHA-256 identifiers;8 original PLYs are absent from Drive because every one exceeds the connector's effective 100 MiB transfer limit. One 788 MB file also exceeds 512 MiB staging. A supported authenticated large-file upload route is required; files were not split or substituted. See folder transfer-status and integrity records.

The dynamic SuperSplat scene listing remains index-only: no exact scene selections or blanket scene license were established.

The initial “indexed only” notes below describe the first transfer pass and are superseded by this status for NASA and Voxel51. Local download and completed Drive transfer are explicitly distinguished.

---

# Enviroments — source archive index
Prepared9 November 2026. User-requested repository snapshots inside Hamza Brain. No repository code was executed, installed or integrated. ZIP integrity checked and SHA-256 recorded. Folder sharing inherited unchanged. Downloading does not establish compatibility or grant rights beyond the source licenses.

## Downloaded snapshots

### adamjenkins/moodle-vrroomenv_rooms
- Source: https://github.com/adamjenkins/moodle-vrroomenv_rooms
- Snapshot: 542a394ba28761d17c74b093769b3fdfbd544422
- File: moodle-vrroomenv_rooms-542a394ba287-NO-KITCHEN.zip
- ZIP bytes: 11668114
- SHA-256: fe894a9fef78045806800d0639f872982d6dbde48029d7b64cf7003c0e5619ab
- Modified: rooms/kitchen/ removed and environments.json kitchen entry removed;19 rooms remain. Change notice included. GPL-3.0-or-later code; individual room assets CC0, CC-BY-3.0, CC-BY-4.0 or MPL-2.0. Original license/credit files preserved. See room_licenses.json. Original upstream README may retain historical kitchen references; no kitchen directory or selectable manifest entry is delivered.

### ClementCariou/virtual-art-gallery
- Source: https://github.com/ClementCariou/virtual-art-gallery
- Snapshot: 674e29bd8e6572ed7b761aad8bb518090d5adc01
- File: ClementCariou__virtual-art-gallery-674e29bd8e65.zip
- ZIP bytes: 2964265
- SHA-256: ccb80a9da93c57f9fcf28bc6acb1a176996cc1d6c9c1b7bb034b19c835c0f0df
- MIT source. External paintings fetched at runtime from Art Institute API were not downloaded; their rights require separate review.

### aws-robotics/aws-robomaker-small-warehouse-world
- Source: https://github.com/aws-robotics/aws-robomaker-small-warehouse-world
- Snapshot: 3c23a698bf0b4e366ddf8b084af507c519bd3483
- File: aws-robotics__aws-robomaker-small-warehouse-world-3c23a698bf0b.zip
- ZIP bytes: 10214085
- SHA-256: 00cd9528271002b30396e2957da9fb969584c9b18d5b8ad9a8b97fde2c14f214
- Actual assets from ros1, not the default archive branch (which contains only a notice). MIT-0. Unsupported since10 September2025; reference only, not a supported production dependency.

### playcanvas/supersplat
- Source: https://github.com/playcanvas/supersplat
- Snapshot: 4069712370df3425c386610f28a814403e835543
- File: playcanvas__supersplat-4069712370df.zip
- ZIP bytes: 2362078
- SHA-256: 19523e8ac69d9a140cac85701ee2c9fe451bba3a3f3b84ad243356e7b08ebceb
- MIT editor source. Does not include the hosted SuperSplat scene library or installed dependencies.

## Indexed only — not bulk-downloaded

NASA: https://github.com/nasa/NASA-3D-Resources — master commit11ebb4ee043715aefbba6aeec8a61746fad67fa7. GitHub repository size metadata5,279,154 KiB (~5.03GiB), not an exact compressed snapshot size. Large collection held pending selected assets or approval for full transfer. README describes assets as free of copyright, subject to https://www.nasa.gov/nasa-brand-center/images-and-media/ . Logo/endorsement/person/third-party restrictions still apply. No NASA assets claimed downloaded.

Voxel51 dataset: https://huggingface.co/datasets/Voxel51/gaussian_splatting — main commit6aaba1b1dd0439c0db464842f8a6600a37e0eae9. Dataset card reports3.49GB and Apache-2.0. Contains drjohnson, playroom, train and truck; no kitchen folder identified. Held pending selected scene(s) or explicit full-dataset scope. Keep author/paper attribution and review upstream asset rights before reuse. No dataset assets claimed downloaded.

SuperSplat worlds listing: https://superspl.at/search?features=downloadable&sort=trending . Dynamic search, not a repository or one fixed asset. No blanket scene license, exact total or stable snapshot verified. No world downloaded from this listing; select exact scene links and inspect each license before transfer.

## Reuse gate
Preserve credits and license files. Review each actual asset license, required attribution and intended use before public redistribution or integration. Repository download is not proof that external media, trademarks, models or likenesses are cleared. Kitchens are excluded from the Moodle working snapshot; other downloaded repos have no kitchen-named paths in their inspected trees. This is a path-based exclusion, not a claim of exhaustive visual inspection of every geometry surface.


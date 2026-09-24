# Asset Credits and Asset Licenses

**This file is the effective license record for media assets in this project.**

The root [LICENSE](LICENSE) (Apache-2.0) covers **source code only**. Art, audio, fonts, atlases, and every other media file are governed by the licence recorded against them in the tables below, **and that record controls over Apache-2.0** for those files.

**Media not listed here is not licensed to you by Apache-2.0.** A missing record means *not yet documented*, not *free to reuse*. This project ships art under four different upstream regimes, one of which forbids redistributing its source files at all — so treating an unlisted file as free is the exact mistake this register exists to prevent.

## Redistribution tiers

| Tier | Meaning |
|---|---|
| `Yes` | Public-domain, CC0, MIT, or equivalent media. Commercial and non-commercial redistribution is allowed, with or without the project. |
| `Yes, attribution required` | Redistribution is allowed only while preserving the required credit and licence notice in the form the upstream licence demands. |
| `With the project only` | Project-authored media, or a derivative whose upstream licence permits distribution only as part of a larger work. It may ship inside a working fork of Todak, but may not be extracted, resold, or repackaged as an asset pack. |
| `No, permission required` | Purchased, pay-what-you-want, or otherwise restricted source media. It must not be redistributed, and its path is listed in the publication exclusion list so that it never enters a public snapshot at all. |

## Inventory of this snapshot

Measured on this snapshot, **785 media payload files** ship (`.png`, `.svg`, `.ogg`, `.wav`, `.ttf`; Godot `.import` sidecars and atlas `.json` descriptors are metadata and are not counted):

| Group | Files | Tier |
|---|---|---|
| Music tracks (`assets/music/`, 14 genres x 30) | 420 | `Yes` |
| Ambience loops (`assets/ambience/`) | 29 | `Yes` / `With the project only` (see below) |
| Sound effects (`assets/sfx/`) | 12 | `With the project only` |
| Packed pet atlases (`assets/atlases/pets/`) | 14 | mixed, per row |
| Prop and UI atlases (`assets/atlases/`, `assets/ui/`) | 17 | mixed, per row |
| VS Code panel copies (`extension/media/`) | 20 | mirrors the atlas rows |
| CC0 source sheets retained in-tree (`assets/thirdparty/{cats_lm,pet_cats_pack,dogs}/`) | 213 | `Yes` |
| Test-harness media shipped with GUT (`addons/gut/`) | 25 | `Yes` / `Yes, attribution required` |
| Retained AI stills, unused by the build (`tools/artgen/.spriteai_cache/`, `assets/thirdparty/spriteai/`) | 33 | `With the project only` |
| Application icon (`icon.svg`, `assets/icon_1024.png`) | 2 | `With the project only` |

## What must a fork remove before redistributing?

**Nothing — because the removal already happened before this snapshot existed.** Two upstream packs in the private development tree forbid redistributing their source files, and the publication pipeline excludes them along with every derivative that was packed from them. What you have here is already clean:

| Excluded from this snapshot | Files removed | Why |
|---|---|---|
| `assets/thirdparty/cat85/` (Bow.Pixel, *Cat 85+ Animations*) | 7 | Pay-what-you-want licence permits use and editing inside a product, and explicitly forbids distributing the asset — or an edit of it — to others. |
| `assets/atlases/pets/cat_normal_{solid,tabby,tuxedo}.*` and their `extension/` copies | 15 | Atlases packed *from* the Bow.Pixel sheets; an edited redistribution is exactly what the licence forbids. |
| `assets/ui/frames/cat_{grey,ginger,tuxedo}_top.png` (+ `.import`) | 6 | Panel frames cut from the same Bow.Pixel atlases. |
| `assets/thirdparty/toffeecraft_bunny/*.png`, `*.gif` | 10 | ToffeeCraft source sheets: commercial use and edits are permitted, redistribution of the asset itself is not. |

Total: **38 files withheld**. The two licence records for those packs (`assets/thirdparty/toffeecraft_bunny/{SOURCE.txt,LICENSE.txt}`) are deliberately kept, so the reason for the absence is documented in the tree rather than only here.

### The replacement path, implemented rather than promised

Removing the cats would have removed a species, so the publication pipeline substitutes them. `tools/artgen/import_cats_lm.py` imports LuizMelo's **CC0** *Pet Cats Pack* and packs three variants — `cc0_black`, `cc0_ginger`, `cc0_grey` — which is why this snapshot still ships 6 species and 14 art variants with no restricted source anywhere in the tree. The importer is deliberately disabled in the private trunk (the owner prefers the paid pack's richer climb and leisure motion for the shipped product); the publication step enables it, regenerates the three atlases, rewrites `data/petspec/art.json`, and mirrors the result into `extension/media/`. The generation is deterministic: running it twice produces byte-identical atlases, which is what makes the digests below meaningful.

The three CC0 cat variants are labelled `(CC0)` in the settings UI, so a user can see which art they are looking at without reading this file.

## Pet atlases — what ships, and what each was packed from

Every pet in the build is a packed atlas produced by project code from a source pack. The atlas is the shipped artefact; the tier is inherited from the source pack's licence, because packing does not loosen an upstream restriction.

| Asset | Source pack | Source URL | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `assets/atlases/pets/cat_normal_cc0_black.png` | LuizMelo — Pet Cats Pack | [https://luizmelo.itch.io/pet-cats-pack](https://luizmelo.itch.io/pet-cats-pack) | CC0 1.0 | `Yes` | `f3bfeba3c2b19775ccc4e3f2699a67b6eec2724af45d8767b8a102165b46f55b` |
| `assets/atlases/pets/cat_normal_cc0_ginger.png` | LuizMelo — Pet Cats Pack | [https://luizmelo.itch.io/pet-cats-pack](https://luizmelo.itch.io/pet-cats-pack) | CC0 1.0 | `Yes` | `30d2a2fbd783b93c234cf13cffbea586d19702071124f358ace7b3b3df8f822c` |
| `assets/atlases/pets/cat_normal_cc0_grey.png` | LuizMelo — Pet Cats Pack | [https://luizmelo.itch.io/pet-cats-pack](https://luizmelo.itch.io/pet-cats-pack) | CC0 1.0 | `Yes` | `a7d389fcc1b9010a3eea783e4432633b1710688c61d6ac79a4684dd8b4252c0b` |
| `assets/atlases/pets/cow_normal_spot.png` | Duckhive — cow | [https://duckhive.itch.io/cow](https://duckhive.itch.io/cow) | CC0 | `Yes` | `0ec11a89a7c541053084a17b8d2867f4922810df73bc0b010ab2edc25e3a3144` |
| `assets/atlases/pets/dog_normal_akita.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `c62254793db93312e4e082807be9983a1bb9767c41f6d1c5d7286aa4d182824d` |
| `assets/atlases/pets/dog_normal_golden.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `6c0e7c8da95499490b3dc63e99746df06edae915890d23e46a24c18f7d247435` |
| `assets/atlases/pets/dog_normal_great_dane.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `11423d83760c42f0fe0b76110c5fb68769a24f5a5851eaf05d6fbd14bde450a4` |
| `assets/atlases/pets/dog_normal_husky.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `cb53071c319a1a69aae9f29b81e4a2df411949f7808dca83f65dc508fd186eb1` |
| `assets/atlases/pets/dog_normal_saint_bernard.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `ef0853f103144afcc6215af9ccc79a05ae05e1cca0d1ca058273422daeaadbba` |
| `assets/atlases/pets/dog_normal_schnauzer.png` | LuizMelo — Pet Dogs Pack | [https://luizmelo.itch.io/pet-dogs-pack](https://luizmelo.itch.io/pet-dogs-pack) | CC0 | `Yes` | `f3c6fbce4edcbe89964c02e6a3b8645a1742a6fcae1d53253c9744ab6cf2ab3c` |
| `assets/atlases/pets/goose_normal_grey.png` | Duckhive — goose | [https://duckhive.itch.io/goose](https://duckhive.itch.io/goose) | CC0 | `Yes` | `4dbc4830030ebb628cbeb7a3d5926a04b95314a6eb5d2f3d627ee00b930d1241` |
| `assets/atlases/pets/rabbit_normal_brown.png` | Duckhive — bunny | [https://duckhive.itch.io/bunny](https://duckhive.itch.io/bunny) | CC0 | `Yes` | `e13c6763ea65eb83813850a4a25217ec89a7143d5d08705061d61ade745f1a55` |
| `assets/atlases/pets/rabbit_normal_white.png` | ToffeeCraft — Bunny Pixel Animations | [https://toffeecraft.itch.io/bunny-pixel-animations](https://toffeecraft.itch.io/bunny-pixel-animations) | Custom: commercial use and edits permitted; redistribution of the asset itself forbidden | `With the project only` | `2c85c385bfcf96cbe3bcb89692c619d79dd8d5e37ad67f30c090b212b6ecf343` |
| `assets/atlases/pets/squirrel_normal_red.png` | Duckhive — squirrel | [https://duckhive.itch.io/squirrel](https://duckhive.itch.io/squirrel) | CC0 | `Yes` | `5096abd3de014f79bd49f9a763cf01d98514307b6e9089be084100efa489b259` |

Notes on this table:

- The dog atlases are **modified** CC0 source: `tools/artgen/add_dog_outline.py` adds a 1px black outline to every frame so the dogs match the roster's register. CC0 permits that without condition.

- `rabbit_normal_white` is the one restricted row. Its source sheets are excluded from this snapshot; the packed atlas ships because the upstream licence permits use inside a production, and it carries `With the project only` because that same licence forbids passing the artwork on by itself.

- `extension/media/atlases/pets/` holds copies of these atlases for the VS Code panel pets. Each copy inherits its source atlas's row and tier.

## UI art

| Asset group | Author | Source URL | Licence | Redistribution |
|---|---|---|---|---|
| `assets/ui/{button,button_hover,button_pressed,panel,inlay}.png` | Kenney Vleugels, with Lynn Evers — Pixel UI pack | [https://kenney.nl](https://kenney.nl) | CC0 1.0 (`assets/ui/KENNEY_LICENSE.txt`, shipped alongside) | `Yes` |
| `assets/ui/icons.png`, `assets/atlases/ui/*`, `assets/atlases/props/*` | Project-authored, generated by `tools/artgen/gen_ui*.py`, `gen_toys.py`, `gen_care_props.py`, `gen_record_player.py` | Generated in-project | Owner self-authored | `With the project only` |
| `icon.svg`, `assets/icon_1024.png` | Project-authored (`tools/artgen/make_app_icon.py`) | Generated in-project | Owner self-authored | `With the project only` |

### ToffeeCraft *Cat User Interface* — re-composed pieces only

Purchased from the paid tier. The licence permits commercial and personal use and editing, forbids redistribution or resale of the asset, and clarifies that it may be distributed as part of a larger project. The raw sheet is therefore **not in this repository at all**; only the pieces `tools/artgen/import_toffee_ui.py` cuts and re-composes ship, and they carry `With the project only`.

| Asset | Author | Source URL | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `assets/ui/frames/toffee_cream_top.png` | ToffeeCraft | [https://toffeecraft.itch.io/cat-user-interface](https://toffeecraft.itch.io/cat-user-interface) | Custom: commercial use and edits permitted, redistribution of the asset forbidden, distribution as part of a larger project permitted | `With the project only` | `5490abc66462f58b4190983efdef868fb6db40d2ff295587776b2b4e0a746a77` |
| `assets/ui/frames/toffee_ginger_top.png` | ToffeeCraft | [https://toffeecraft.itch.io/cat-user-interface](https://toffeecraft.itch.io/cat-user-interface) | Custom: commercial use and edits permitted, redistribution of the asset forbidden, distribution as part of a larger project permitted | `With the project only` | `0f1549e8f177c02513ffb275a80c6a9d4663dab87d10dc6f03fb64b5188a0b2e` |
| `assets/ui/frames/toffee_grey_top.png` | ToffeeCraft | [https://toffeecraft.itch.io/cat-user-interface](https://toffeecraft.itch.io/cat-user-interface) | Custom: commercial use and edits permitted, redistribution of the asset forbidden, distribution as part of a larger project permitted | `With the project only` | `2005d7441d89db2f67d9d14be4e1f0ff8529a4d1f810fb7cb223485988f77080` |
| `assets/ui/frames/toffee_white_top.png` | ToffeeCraft | [https://toffeecraft.itch.io/cat-user-interface](https://toffeecraft.itch.io/cat-user-interface) | Custom: commercial use and edits permitted, redistribution of the asset forbidden, distribution as part of a larger project permitted | `With the project only` | `be2c3de684360feefe52fcc4af1f6605ce96a7cd84e67e7533f67dcdb19a97c4` |
| `assets/ui/seek_cat.png` | ToffeeCraft | [https://toffeecraft.itch.io/cat-user-interface](https://toffeecraft.itch.io/cat-user-interface) | Custom: commercial use and edits permitted, redistribution of the asset forbidden, distribution as part of a larger project permitted | `With the project only` | `71cfe8eab975333a82c232c60fa4f41adb0e9007ac4c4d8609e4e344f8a44812` |

## Sound effects — project-authored synthesis

Generated by `tools/artgen/gen_sfx.py`. No model, no third-party sample source, nothing to credit upstream. They are `With the project only` because the project owns them and has not offered them as free media.

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `assets/sfx/bark.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `3a49ef8032ec76320d0eec60730d70cef512fe703c0d907b80cd0652564f3f9e` |
| `assets/sfx/boing.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `13347083714e37d194c42cdbc328e7f7a01eff168193fd7ebf3c72d729a5d20e` |
| `assets/sfx/chitter.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `00d517a9a52bf31ae7b005e2b5e6949723d81a3dc51c8d779603f5b1eb68ce8f` |
| `assets/sfx/crunch.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `be0ae360054d16867976a7318e3a318fd11719af64b59825cb3908b32babc540` |
| `assets/sfx/gulp.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `688c5286287be91314204e7be1dc4ad7a07d27595be06c836d89ea446bd04e95` |
| `assets/sfx/honk.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `41f0b0582ebf5d5ee45c048386511c26800e37c0b45d198b595d937f27754014` |
| `assets/sfx/meow.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `084a0f4f0146ddbea4b686ea2fd983a1698330fed2e4720cb81c9b4d4e691be1` |
| `assets/sfx/moo.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `687e52d293961e7c7f382e4445a3d3ae29e57fb41bb3f1c7e7a44832b2c9c714` |
| `assets/sfx/pop.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `3628b082056ce6f9eb5701c6a9315135c4384867f2789ca48a3494db16f80cd2` |
| `assets/sfx/splash.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `e10f0aa5c4dae779d31c0d7d2a09d36fb92e8107cc161cf00ecf4fd01216306d` |
| `assets/sfx/squeak.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `e26a25830885074fc09c483e25b5d83d8b650b86a6b73612e5f5657ef5bf9672` |
| `assets/sfx/thud.wav` | Project-authored (`tools/artgen/gen_sfx.py`) | Generated in-project | Owner self-authored | `With the project only` | `ef4cfea3400ca8fb922e3123aab2a08dffbab44ff3eb6bf42259c69d9f19612a` |

## Ambience — two different origins, two different tiers

28 `.ogg` loops plus one `.wav` ship in `assets/ambience/`. 13 of them are re-rendered from CC0 field recordings and 15 are synthesized by project code, so they do not share a tier:

| Origin | Layers | Licence | Redistribution |
|---|---|---|---|
| Re-rendered from CC0 field recordings (per-sound rows below) | `birds_dawn`, `cafe`, `city_wet_road`, `crickets`, `crowd`, `fire_hearth`, `kitchen`, `kitchen_room`, `rain_downpour`, `rain_soft`, `storm_far`, `stream_brook`, `waves_calm` | CC0 1.0 upstream | `Yes` |
| Synthesized by `tools/artgen/gen_ambience.py` | `airplane`, `birds_forest`, `city_traffic`, `fire_bonfire`, `fire_camp`, `noise_brown`, `noise_pink`, `noise_white`, `rain_pane`, `rain_window`, `storm_near`, `stream_river`, `waves_surf`, `wind_breeze`, `wind_gale` | Owner self-authored | `With the project only` |

Per-sound provenance for the recorded layers is also machine-readable in `assets/thirdparty/ambience_src/SOURCES.json`, which records the sound id, credit, licence, licence page, and source URL for each one. **None of them ships verbatim**: each was re-cut to its calmest event-free window, re-EQ'd, and re-rendered as a seamless loop by `tools/artgen/make_ambience_loops.py`.

## Promoted from the project's own generated ledger

The sections below are the project's in-repo credits, which are generated by `tools/artgen/gen_credits.py` from the two harvester ledgers (`assets/music/ledger/`, 30 JSON files, and `assets/thirdparty/ambience_src/SOURCES.json`). They are reproduced here rather than replaced, so this file is a superset of what the project generates and nothing was lost by promoting it into the four-tier format. Every row in both sections is CC0 and therefore tier `Yes`.

## Music — 420 tracks, all CC0

Every track's licence was verified on the source's **own page**, not from a search listing or a
summary. Where a source offered several licences at once, CC0 was elected and what else was on
offer is recorded in the ledger.

One thing a licence cannot fix, said plainly because it affects the people who buy this: CC0
waives the *author's* rights. It does not stop a third party from fraudulently registering a CC0
recording with YouTube's Content ID — Loyalty Freak Music's own FAQ says this happens to his music
"quite often". If a claim ever lands on your stream because of Todak's record player, the licence
below is your defence, and it wins.


### acoustic (30)

- **1-2-3-4 (Guitar)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/1-2-3-4-guitar)
- **A Small Fire Will Do (Calming Loop)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/a-small-fire-will-do-calming-loop)
- **Acoustic Guitar Rpg Tune With Strings And Piccolo** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/acoustic-guitar-rpg-tune-with-strings-and-piccolo)
- **Action Style 10** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/action-style-10)
- **Apple Cider** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/apple-cider)
- **Balance** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/balance-0)
- **Big City Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/big-city-theme)
- **Cozy Puzzle In-Game 3** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cozy-puzzle-in-game-3)
- **Desert Settlement** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/desert-settlement)
- **Dialup Song** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dialup-song)
- **Down The River** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/down-the-river)
- **Etirwer** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/etirwer)
- **Fast Merry Tune 5** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/fast-merry-tune-5)
- **Fouler l'horizon** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/fouler-lhorizon)
- **Gypselectric (Guitar)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/gypselectric-guitar)
- **Happy Ukelele Island Surfing Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/happy-ukelele-island-surfing-theme)
- **Just you and me Guitar** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/just-you-and-me-guitar)
- **LaDaDa Guitar** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ladada-guitar)
- **Midi Pack 1 24 New Tunes** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/midi-pack-1-24-new-tunes)
- **Midi Pack 2 (27 New Tunes)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/midi-pack-2-27-new-tunes)
- **No Country For Old Alex** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/no-country-for-old-alex)
- **Piano Melody With Acoustic Bass** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-melody-with-acoustic-bass)
- **Post-Apocalyptic Morning, Afternoon and Night** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/post-apocalyptic-morning-afternoon-and-night)
- **Remember this shadow** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/remember-this-shadow)
- **Revelation** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/revelation)
- **Serenade Guitar** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/serenade-guitar)
- **Short kalimba loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/short-kalimba-loop)
- **Wasteland Caravan** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/wasteland-caravan)
- **Wine Less Cry More** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/wine-less-cry-more)
- **Wooden Inn** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/wooden-inn)

### ambient (30)

- **01** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **03** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **666_test_2** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **Ambient - The Beach Where Dreams Die** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ambient-the-beach-where-dreams-die)
- **Ambient Soundscape** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/ambient-soundscape)
- **Ambient horror song** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ambient-horror-song)
- **Ambient/loading screen game music Pack** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/ambientloading-screen-game-music-pack)
- **Ancient caverns (horror ambient loop)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ancient-caverns-horror-ambient-loop)
- **Birds and Wind - Ambient, Birds, Wind and Synth** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth)
- **Cathedral in the forest (ambient loop)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cathedral-in-the-forest-ambient-loop)
- **Creepy Ambient Loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/creepy-ambient-loop)
- **Creepy ambient noise sound effect** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/creepy-ambient-noise-sound-effect)
- **Crimson Space Station Background Ambient Music 1** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/crimson-space-station-background-ambient-music-1)
- **Crimson Space Station Bgm Ambient Music 2 Short** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/crimson-space-station-bgm-ambient-music-2-short)
- **Dark Cavern Ambient** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dark-cavern-ambient)
- **Desolate_6** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **Feel good slow ambient track with a beat.** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/feel-good-slow-ambient-track-with-a-beat)
- **Gates_2** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **Great** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **Inspirational Cinematic Ambient - After The Storm** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/inspirational-cinematic-ambient-after-the-storm)
- **Lowbeat** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **Menu** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/album-1-0)
- **PS2 horror / mystery ambient theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ps2-horror-mystery-ambient-theme)
- **Space Graveyard - Ambient Track** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/space-graveyard-ambient-track)
- **Stranger synth, retro ambient soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 4.0, CC0) · [source](https://opengameart.org/content/stranger-synth-retro-ambient-soundtrack)
- **Sunset Walk / Ambient / Quiet / Sweet / Loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/sunset-walk-ambient-quiet-sweet-loop)
- **The Heavy Truth** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/the-heavy-truth)
- **Tragic ambient main menu** — OpenGameArt contributor · CC0 1.0 (offered: OGA-BY 3.0, CC0) · [source](https://opengameart.org/content/tragic-ambient-main-menu)
- **ambient sound creepy** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ambient-sound-creepy)
- **ambient_horror_track01** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ambient-horror-track-01)

### chiptune (30)

- **(Chiptune) Plucked** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-plucked)
- **A Wonderful Nightmare (Chiptune version)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/a-wonderful-nightmare-chiptune-version)
- **Aeitia PD Famitracker Chiptune Dump** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC-BY-SA 3.0, OGA-BY 3.0, CC0) · [source](https://opengameart.org/content/aeitia-pd-famitracker-chiptune-dump)
- **Alex'sStyle(Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/alexsstylechiptune)
- **Bebop (Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bebop-chiptune)
- **Chaos** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Classical Pop (Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/classical-pop-chiptune)
- **Dead** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Desert** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Fly** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Frozen In Time (Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/frozen-in-time-chiptune)
- **GypsyAlex(Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/gypsyalexchiptune)
- **Herring Farmer-Title** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/herring-farmer-title-chiptune)
- **Invasion** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Lo-fi chiptune glitch D'n'B** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/lo-fi-chiptune-glitch-dnb)
- **March** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **ParallelWorld** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Pretty Good Chiptune, don't know what to call it.** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/pretty-good-chiptune-dont-know-what-to-call-it)
- **Richer Than Me Chiptune** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/richer-than-me-chiptune)
- **Silence** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Something** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Sometimes** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Sunless** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **Talking Cute (Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/talking-cute-chiptune)
- **TuNiNuNiNiNu** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-loops-0)
- **[Chiptune] Medieval: Minstrel Dance** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-medieval-minstrel-dance)
- **[Chiptune] Medieval: The Old Tower Inn** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-medieval-the-old-tower-inn)
- **chiptune police loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chiptune-police-loop)
- **hardcore chiptune theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/hardcore-chiptune-theme)
- **town 6 chiptune** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/town-6-chiptune)

### classical (30)

- **01-0x2A721-Lake_Aria** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **02-0x2A722-Rachels_Weave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **03-0x2A723-Sun_Cave_Village** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **04-0x2A724-Skypole_Gorge** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **05-0x2A725-Moon_Cave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **06-0x2A726-Orions_Geology_Workshop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **07-0x2A727-Forgotten_Shrine_in_the_Forest** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **08-0x2A728-City_of_the_Leviathan** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chasing-the-leviathan-adventure-world-music-album)
- **Bedazzled** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bedazzled)
- **Bluebonnet** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bluebonnet)
- **Claire De Lune Dark Mist edition** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/claire-de-lune-dark-mist-edition)
- **Classical Pop (Chiptune)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/classical-pop-chiptune)
- **Classical Pop (Instrumental)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/classical-pop-instrumental)
- **Cyberpunk Moonlight Sonata** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cyberpunk-moonlight-sonata)
- **Dance Of The Little Swans/"You Need Bashers This Time"** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dance-of-the-little-swansyou-need-bashers-this-time)
- **Eternal Light** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/eternal-light)
- **Faraway** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/faraway)
- **Intensity Buffer (Electronic)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/intensity-buffer-electronic)
- **Intensity Buffer (Guitar)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/intensity-buffer-guitar)
- **Majesty** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/majesty)
- **Natures Beauty** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/natures-beauty)
- **OPL2 - Buxtehude - BuxWv185** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/opl2-buxtehude-buxwv185)
- **Prologue Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/prologue-theme)
- **Spinning (2 Versions)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/spinning-2-versions)
- **Swordfight** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/swordfight)
- **The March of Devils Dome** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-march-of-devils-dome)
- **The Promise** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-promise)
- **Town 6** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/town-6)
- **Town 6** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/town-6)
- **Warden** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/warden)

### focus (30)

- **A Small Town On Pluto (Composed)** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/a-small-town-on-pluto-composed/)
- **A Small Town On Pluto (Music Box)** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/a-small-town-on-pluto-music-box/)
- **Cabin Fever** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/cabin-fever/)
- **Chill (Pro Sensory)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-pro-sensory)
- **Chill Jungle** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-jungle)
- **Chill Main Menu music** — OpenGameArt contributor · CC0 1.0 (offered: OGA-BY 3.0, CC0) · [source](https://opengameart.org/content/chill-main-menu-music)
- **Chill Out Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-out-theme)
- **Chill lofi inspired** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-lofi-inspired)
- **Chill lofi inspired [loop edit]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-lofi-inspired-loop-edit)
- **Creepy Piano 4** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/creepy-piano-4/)
- **Creepy Piano 4** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/creepy-piano-4/)
- **Creepy Piano 4** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/creepy-piano-4/)
- **Creepy Piano 4** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/creepy-piano-4/)
- **Dangerous Voyage** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/dangerous-voyage/)
- **Dangerous Voyage (Music Box)** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/dangerous-voyage-music-box/)
- **Drifting Piano** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/drifting-piano/)
- **Game Travel 1 (Piano)** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/game-travel-1-piano/)
- **Hypnotic Chill (Extended 4 minute mix)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/hypnotic-chill-extended-4-minute-mix)
- **I think I'd stay (jungle chill)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/i-think-id-stay-jungle-chill)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **OST Music Box 7** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/ost-music-box-7/)
- **Spring On The Horizon** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/spring-on-the-horizon/)
- **VST guitar** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/background-music/vst-guitar/)
- **canon in D chill arrange** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/canon-in-d-chill-arrange)
- **chill chiptune** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-chiptune)

### funk (30)

- **01 HoliznaCC0 - Eat.mp3** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **02 HoliznaCC0 - Sleep** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **03 HoliznaCC0 - Breath** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **04 HoliznaCC0 - Make Money** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **05 HoliznaCC0 - Make Love** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **06 HoliznaCC0 - Make Funk** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funk-collection)
- **Barriers** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/barriers)
- **DJ Synth Wave / Funk** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dj-synth-wave-funk)
- **Detour** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/detour)
- **Drive** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/drive-0)
- **Empty Stretch** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/empty-stretch)
- **Freeway Fumes** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/freeway-fumes)
- **Funked Up** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funked-up)
- **High Funktioning AUTISM** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/high-funktioning-autism)
- **Jazzy blues** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazzy-blues)
- **Komiku - Helice Awesome Dance Adventure !! - 01 An anarchist utopia** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Komiku - Helice Awesome Dance Adventure !! - 02 Hélice's Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Komiku - Helice Awesome Dance Adventure !! - 03 I'm in the Not-a-Club** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Komiku - Helice Awesome Dance Adventure !! - 04 Everything is groovy (How to move your body)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Komiku - Helice Awesome Dance Adventure !! - 05 Captain Glouglou contest** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Komiku - Helice Awesome Dance Adventure !! - 07 The promoters of capitalism** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/helice-incredible-adventure-fantasy-disco-rpg-battle-music-and-midi-files-pack)
- **Midnight Cruiser** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/midnight-cruiser)
- **MoonStage** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/moonstage)
- **Nokia Funk - Day 1** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/nokia-funk-day-1)
- **Plomo** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/plomo)
- **Rythm factory, rythm garden, raspberry jam & second cruise remixed (Congusbongus vs ZaneLittleMusic)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/rythm-factory-rythm-garden-raspberry-jam-second-cruise-remixed-congusbongus-vs)
- **Rythm garden & second cruise (congusbongus remixed)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/rythm-garden-second-cruise-congusbongus-remixed)
- **Simple Action Beat** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/simple-action-beat)
- **Wednesday Night [Funk Fusion]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/wednesday-night-funk-fusion)
- **Xenocity - Sidekick** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/xenocity-sidekick)

### house (30)

- **// Blitsky // TECHNO // Meditation Relaxing Peaceful Sound // W4CK** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/blitsky-techno-meditation-relaxing-peaceful-sound-w4ck)
- **A Thing For Fami** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/a-thing-for-fami)
- **Alien Fight** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/alien-fight)
- **Atmosphere** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/atmosphere)
- **Bouncer** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bouncer-0)
- **Coffee House Bump** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/coffee-house-bump)
- **Coming After You** — OpenGameArt contributor · CC0 1.0 (offered: GPL 3.0, CC0) · [source](https://opengameart.org/content/coming-after-you)
- **Droogy Doog** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/droogy-doog)
- **Free Rhythm Game Music Pack 1** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/free-rhythm-game-music-pack-1)
- **Funky House** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funky-house)
- **Funky House (Of Far Different Nature & Fupi & Congusbongus)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/funky-house-of-far-different-nature-fupi-congusbongus)
- **Hella Bumps (menu music)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/hella-bumps-menu-music)
- **Liquid Flame** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/liquid-flame)
- **Looping Beats** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/looping-beats)
- **NOSFERATUS HOUSE PARTY** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/nosferatus-house-party)
- **OMW to beat the big bad** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/omw-to-beat-the-big-bad)
- **Out of world trippy techno country track** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/out-of-world-trippy-techno-country-track)
- **Pacific Ocean** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/pacific-ocean)
- **Piece of techno music** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piece-of-techno-music)
- **Progress** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/progress)
- **Repentant** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/repentant)
- **Slampe - Synthwave House** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/slampe-synthwave-house)
- **Slow fun techno track 1** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/slow-fun-techno-track-1)
- **Spaghetti Sauce** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/spaghetti-sauce)
- **Synthwave House Loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/synthwave-house-loop)
- **The Bass of the Future** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-bass-of-the-future)
- **The Days Roll On** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-days-roll-on)
- **Unfinished/Scraps/(Even) Less Good Tracks** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/unfinishedscrapseven-less-good-tracks)
- **Vengeance Electro** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/vengeance-electro)
- **owzers chamber** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/owzers-chamber)

### jazz (30)

- **(Basically not) Fusion Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/basically-not-fusion-jazz)
- **Action Packed Jazz Chiptune** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/action-packed-jazz-chiptune)
- **Beat 'Em Up Jazz Club** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/beat-em-up-jazz-club)
- **Chill Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/chill-jazz)
- **Done (Rock and Jazz)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/done-rock-and-jazz)
- **Electronic Jazz (Chromatic)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/electronic-jazz-chromatic)
- **Faster jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/faster-jazz)
- **Flashy (Pop/Jazz)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/flashy-popjazz)
- **Forest (Jazz Remix)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/forest-jazz-remix)
- **Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-1)
- **Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-1)
- **Jazz (flute)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-flute)
- **Jazz / Pop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-pop)
- **Jazz Slower** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-slower)
- **NES chiptune "Swingshot" (Swing Jazz)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/nes-chiptune-swingshot-swing-jazz)
- **Quirky Jazz** — OpenGameArt contributor · CC0 1.0 (offered: OGA-BY 3.0, CC0) · [source](https://opengameart.org/content/quirky-jazz)
- **Ragtime! Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ragtime-jazz)
- **Wild Jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/wild-jazz)
- **jazz (saxaphone)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-saxaphone)
- **jazz aug 10 10 22 2021** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-aug-10-10-22-2021)
- **jazz aug 10 1256 2021** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-aug-10-1256-2021)
- **jazz chimes** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-chimes)
- **jazz chromatic** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-chromatic)
- **jazz improvisation july 14** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-improvisation-july-14)
- **jazz improvisation june 2, 2021** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-improvisation-june-2-2021)
- **jazz improvisation looped** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-improvisation-looped)
- **jazz mastered june 3, 2021** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-mastered-june-3-2021)
- **jazz synth dec 17** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jazz-synth-dec-17)
- **lydian synth jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/lydian-synth-jazz)
- **short jazz** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/short-jazz)

### lofi (30)

- **01 HoliznaCC0 - Poor, But Happy** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/happy-lo-fi-lofi-collection)
- **03 HoliznaCC0 - Blue Skies.mp3** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/happy-lo-fi-lofi-collection)
- **Bubbles ( Lofi , Bright , Relaxed )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/bubbles-lofi-bright-relaxed/)
- **Calm Currents ( Lofi , Relax , Calm )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/calm-currents-lofi-relax-calm/)
- **Canon Event ( Lofi , Sad , Reflection )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/canon-event-lofi-sad-reflection/)
- **Color Of A Soul ( Lofi , Calm , Nostalgic )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/color-of-a-soul-lofi-calm-nostalgic/)
- **Fractured** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/fractured-1/)
- **Ghost Town** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ghost-town-1/)
- **Going _Home_** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/going-home-3/)
- **Lucid ( Lofi , Dreamy , Chill )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/lucid-lofi-dreamy-chill/)
- **Moon Unit ( Lofi , Reflection , Dreamy )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/moon-unit-lofi-reflection-dreamy/)
- **Nine To Death** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/nine-to-death/)
- **Ode To Forgetting ( Lofi , Chill , Relax )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ode-to-forgetting-lofi-chill-relax/)
- **One Good Day** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-good-day-1/)
- **One Night In France ( Lofi, Nostalgic, Chill )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-night-in-france-lofi-nostalgic-chill/)
- **Peaceful Drift ( Lofi , Nostalgic , Calm )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/peaceful-drift-lofi-nostalgic-calm/)
- **Reminders ( Lofi , Calm , Nostalgic )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/reminders-lofi-calm-nostalgic/)
- **Saturation ( Lofi , Calm , Relaxed )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/saturation-lofi-calm-relaxed/)
- **Shimmer ( LoFi , Chill )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/shimmer-lofi-chill/)
- **Still Life ( Lofi , Chill , Nostalgic )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/still-life-lofi-chill-nostalgic/)
- **Theta Frequency ( Lofi , Chill , Calm )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/theta-frequency-lofi-chill-calm/)
- **Tokyo Sunset ( Lofi , Peaceful , Soft )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tokyo-sunset-lofi-peaceful-soft/)
- **Tranquil Mindscape ( Lofi , Happy , Reflection )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tranquil-mindscape-lofi-happy-reflection/)
- **Waiting Around ( LoFi , Calm )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/waiting-around-lofi-calm/)
- **Walking Away ( Lofi , Peaceful , Motivating )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/walking-away-lofi-peaceful-motivating/)
- **Warm Fuzz ( LoFi , Retro )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/warm-fuzz-lofi-retro/)
- **When I Was Human ( LoFi , Chill )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/when-i-was-human-lofi-chill/)
- **When Time Called Me Darling ( Lofi, Relaxing, Chill)** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/when-time-called-me-darling-lofi-relaxing-chill/)
- **Yet Again ( LoFi , Peaceful )** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/yet-again-lofi-peaceful/)
- **lofi Compilation** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/lofi-compilation)

### piano (30)

- **Andy's report (8bit and piano ver)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/andys-report-8bit-and-piano-ver)
- **Calm Piano 1 (Vaporware)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-piano-1-vaporware)
- **Diminished Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/diminished-piano)
- **Electric Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/electric-piano)
- **Electric Piano And Piano Soft Melody** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/electric-piano-and-piano-soft-melody)
- **Emotional Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/emotional-piano-0)
- **Fantasy Orchestral Theme & Emotional piano loop (Joth vs extenz)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/fantasy-orchestral-theme-emotional-piano-loop-joth-vs-extenz)
- **Gem Popper Piano Tune** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/gem-popper-piano-tune)
- **Haunting piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/haunting-piano)
- **Mystical Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/mystical-piano)
- **Piano & Drums, positive melancholy [2:12]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-drums-positive-melancholy-212)
- **Piano Emo 10** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-emo-10)
- **Piano Emotional Solo 139** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-emotional-solo-139)
- **Piano IIX** — OpenGameArt contributor · CC0 1.0 (offered: GPL 3.0, GPL 2.0, OGA-BY 3.0, CC0) · [source](https://opengameart.org/content/piano-iix)
- **Piano Melody 6** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-melody-6)
- **Piano Melody Solo 14** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-melody-solo-14)
- **Piano Melody Solo 14** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-melody-solo-14)
- **Piano Melody Solo 14** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-melody-solo-14)
- **Piano Rythym 1** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-rythym-1)
- **Piano Swap Rpg** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-swap-rpg)
- **Piano With Electric Piano 2** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/piano-with-electric-piano-2)
- **Red Heels (piano ver)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/red-heels-piano-ver)
- **Regret - Short Emotional Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/regret-short-emotional-piano)
- **Sci Fi / Adventure / Eastern /Quiet Piano / Loop** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/sci-fi-adventure-eastern-quiet-piano-loop)
- **Slow Piano Intermission** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/slow-piano-intermission)
- **Solo Piano 4** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/solo-piano-4)
- **Strange d'n'b piano theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/strange-dnb-piano-theme)
- **Vampire's Piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/vampires-piano)
- **bright glitch d'n'b theme piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bright-glitch-dnb-theme-piano)
- **skeleton chamber piano** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/skeleton-chamber-piano)

### relax (30)

- **8-bit - Truth** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/8-bit-truth)
- **At Home - Orchestral** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/at-home-orchestral)
- **Busy but Calm Street** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/busy-but-calm-street)
- **Calm Ambient 1 (Synthwave 4k)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-ambient-1-synthwave-4k)
- **Calm Ambient 2 (Synthwave 15k)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-ambient-2-synthwave-15k)
- **Calm Ambient 3 (Lifewave 2k)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-ambient-3-lifewave-2k)
- **Calm Relax 1 (Synthwave 421k)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-relax-1-synthwave-421k)
- **Calm Track** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-track)
- **Calm and simple title music** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-and-simple-title-music)
- **Calm fireplace guitar song** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-fireplace-guitar-song)
- **Calm1 - A Place I Call Home** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Calm2 - Childhood Friends** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Calm3 - Peaceful Days** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Calm4 - Sand Castles** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Calm5 - Summer Memories** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Calm6 - Innocence** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/jrpg-pack-4-calm)
- **Crickets - General calm ambient music** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/crickets-general-calm-ambient-music)
- **Disturbingly Calm** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/disturbingly-calm)
- **Gravity Turn** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/gravity-turn)
- **In the middle of nowhere** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/in-the-middle-of-nowhere)
- **Lonely Night** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/lonely-night)
- **Raining_Sala_segura_soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/save-sound-suspense)
- **Sala_segura_soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/save-sound-suspense)
- **Two looping retro midi songs (calm, tense)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/two-looping-retro-midi-songs-calm-tense)
- **Veritas** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/veritas)
- **Walking Calm** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/walking-calm)
- **calm music** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-music)
- **calm theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/calm-theme)
- **sPACE** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/space-5)
- **safe_room_soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/save-sound-suspense)

### sleep (30)

- **Abandon Hope** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/abandon-hope)
- **Balance** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/balance-0)
- **Cave explorer** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cave-explorer)
- **Downfall** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/downfall)
- **Flimsy** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/flimsy)
- **Fuhuiyolo** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/fuhuiyolo)
- **Ice Shine Bells** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/ice-shine-bells)
- **Infinite World** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/infinite-world)
- **Lullabies For The End Of The World #5** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/lullabies-for-the-end-of-the-world/lullabies-for-the-end-of-the-world-5/)
- **Lullabies For The End Of The World #5** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/lullabies-for-the-end-of-the-world/lullabies-for-the-end-of-the-world-5/)
- **Lullabies For The End Of The World #5** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/lullabies-for-the-end-of-the-world/lullabies-for-the-end-of-the-world-5/)
- **Lullabies For The End Of The World #5** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/lullabies-for-the-end-of-the-world/lullabies-for-the-end-of-the-world-5/)
- **Lullabies For The End Of The World #5** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/lullabies-for-the-end-of-the-world/lullabies-for-the-end-of-the-world-5/)
- **Manaos Drones** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/manaos-drones)
- **Midi Pack 3 (35 so far)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/midi-pack-3-35-so-far)
- **Morning Sky** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/morning-sky)
- **MyVeryOwnDeadShip** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/background-space-track)
- **Overshadow** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/overshadow)
- **Persistence** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/persistence)
- **Revelation** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/revelation)
- **Safety (2 Versions)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/safety-2-versions)
- **Searching** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/searching)
- **Singularity** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/singularity-0)
- **Sleepy Clouds** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/sleepy-clouds)
- **Sparkling Cosmic Dust** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/sparkling-cosmic-dust)
- **Station Drone 2** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/station-drone-2)
- **Sunset Plains** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/sunset-plains)
- **The Wyner (Electric Guitar)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-wyner-electric-guitar)
- **Vaata** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/vaata)
- **Vargas** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/vargas)

### synthwave (30)

- **02 HoliznaCC0 - Retro Soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **03 HoliznaCC0 - Cyber Anxiety** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **04 HoliznaCC0 - Lost In The Jungle** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **04 HoliznaCC0 - Night Life** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **05 HoliznaCC0 - Day Dreams** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **05 HoliznaCC0 - Fires Uptown** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **80s Mysterywave music** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/80s-mysterywave-music)
- **Aerobics Synth Wave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/aerobics-synth-wave)
- **Boss Fight 2** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/boss-fight-2)
- **Cyber March** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cyber-march)
- **Eyeless (Retrowave)** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 4.0, CC-BY 3.0, CC0) · [source](https://opengameart.org/content/eyeless-retrowave)
- **Futility Belt** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/futility-belt)
- **Good Ending - Diamond Dust** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/good-ending-diamond-dust)
- **Hello World** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/hello-world)
- **Lost in the Snow Wave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/lost-in-the-snow-wave)
- **Main Menu Theme - Diamond Dust** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/main-menu-theme-diamond-dust)
- **Nova** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 3.0, CC0) · [source](https://opengameart.org/content/nova)
- **Space Adventure** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/space-adventure)
- **Space City** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/space-city)
- **Space Synth Wave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/space-synth-wave)
- **Stranger synth, retro ambient soundtrack** — OpenGameArt contributor · CC0 1.0 (offered: CC-BY 4.0, CC0) · [source](https://opengameart.org/content/stranger-synth-retro-ambient-soundtrack)
- **Synth Wave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/synth-wave)
- **Synthwave - Auferstanden aus Ruinen [2:45]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/synthwave-auferstanden-aus-ruinen-245)
- **Tech rave** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/tech-rave)
- **The Slimeking's Tower OST (Retro like)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-slimekings-tower-ost-retro-like)
- **Vintage Menu** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/vintage-menu)
- **cyber_runner** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cyber-runner-music)
- **dark-happy-world** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dark-happy-world)
- **synthwave_type** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/synthwavetype)
- **up_and_right** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/up-and-right)

### vaporwave (30)

- **01 HoliznaCC0 - Drama** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/retro-wave-collection)
- **80s Hidden Lab** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/80s-hidden-lab)
- **Agressive Action** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/agressive-action)
- **All The Fight Left!** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/all-the-fight-left)
- **Arion** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/arion)
- **Backfoot** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/backfoot)
- **Bio-Hazard (Menu/Stage)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/bio-hazard-menustage)
- **Cosmic Priest** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/cosmic-priest)
- **Dance field** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dance-field)
- **Dawn of Hope(Techno)** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/dawn-of-hopetechno)
- **Die Hard Battle** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/die-hard-battle)
- **Down to Business - Day 25** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/down-to-business-day-25)
- **Final Stand** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/final-stand-0)
- **Ganymede** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ganymede)
- **Ground Zero** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/ground-zero)
- **Last One Standing** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/last-one-standing)
- **Mechanical Golem** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/mechanical-golem)
- **Midnight Drive** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/midnight-drive)
- **Nightmare{Chiptune}[Final]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/nightmarechiptunefinal)
- **ONLY HUMAN** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/phonk-aura-farming/only-human/)
- **One Last Time...** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/one-last-time)
- **Pantheon** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/phonk-aura-farming/pantheon/)
- **Phonk Remix** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/phonk-aura-farming/phonk-remix/)
- **Phonk ish** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/phonk-aura-farming/phonk-ish/)
- **Re Adusjtment** — HoliznaCC0 · CC0 1.0 · [source](https://freemusicarchive.org/music/holiznacc0/phonk-aura-farming/re-adusjtment/)
- **StarShooter** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/starshooter)
- **Synth/Metal Climax Theme** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/synthmetal-climax-theme)
- **Techno_Chiptale** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/technochiptale)
- **The Berggren-Malde Complex** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/the-berggren-malde-complex)
- **Trance / trap / electronic [2:37]** — OpenGameArt contributor · CC0 1.0 (offered: CC0) · [source](https://opengameart.org/content/trance-trap-electronic-237)

## Ambience — 13 from recordings, the rest synthesized

The synthesized layers (`tools/artgen/gen_ambience.py`) are ours: no licence, nothing to credit.

The recorded layers below are CC0 or public domain, verified on each sound's own page. **None of
them ships verbatim.** Each was re-cut to its calmest event-free window, re-EQ'd, and re-rendered
as a 30-second seamless loop (`tools/artgen/make_ambience_loops.py`) — that is what makes a loop
out of a field recording, and it also means the file in the build is not byte-identical to
anything a third party may have registered with Content ID.

- **birds_dawn** — resaural · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/resaural/sounds/634511/)
- **cafe** — arpeggio1980 · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/arpeggio1980/sounds/437461/)
- **city_wet_road** — klau78 · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/klau78/sounds/648786/)
- **crickets** — felixblume · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/felixblume/sounds/479041/)
- **crowd** — psykophobia · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/psykophobia/sounds/608996/)
- **fire_hearth** — uniuniversal · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/uniuniversal/sounds/620007/)
- **kitchen** — cyoung510 · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/s/535534/)
- **kitchen_room** — AlexLane · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/s/459843/)
- **rain_downpour** — bajko · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/bajko/sounds/378052/)
- **rain_soft** — joedeshon · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/joedeshon/sounds/430765/)
- **storm_far** — nickmaysoundmusic · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/nickmaysoundmusic/sounds/513251/)
- **stream_brook** — cher1101 · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/cher1101/sounds/671883/)
- **waves_calm** — profispiesser · CC0 1.0 (Creative Commons Zero) · [source](https://freesound.org/people/profispiesser/sounds/543819/)

## Test-harness media shipped with GUT

GUT 9.6.0 is vendored under `addons/gut/` (MIT, `addons/gut/LICENSE.md`). It brings its own media:

| Asset group | Files | Author | Licence | Redistribution |
|---|---|---|---|---|
| `addons/gut/fonts/*.ttf` (Anonymous Pro, Courier Prime, Lobster Two) | 12 | respective type designers | SIL Open Font License (`addons/gut/fonts/OFL.txt`, shipped alongside) | `Yes, attribution required` |
| `addons/gut/{images,gui}/*` | 13 | Tom "Butch" Wesley and GUT contributors | MIT | `Yes` |

## Retained AI stills — recorded, tiered, and unused

`assets/thirdparty/spriteai/{blackcat.png,rabbit.png}` and `tools/artgen/.spriteai_cache/` (33 files in total) are stills generated by the owner through the Sprite-AI service with the owner's own key. They are **not used by the build**: `tools/artgen/import_rabbit.py` is disabled in-tree with a recorded reason, and the shipped rabbit comes from Duckhive's CC0 bunny instead. They are kept as a record of the technique and its failure mode. Tier `With the project only`; they are owner-generated output, not licensed media, and nothing upstream is being credited or redistributed.

## Required attribution, in one place

Nothing in this snapshot *requires* attribution except the SIL Open Font License notice that ships with GUT's fonts, which is satisfied by keeping `addons/gut/fonts/OFL.txt` in place. The credits below are given because they are deserved, not because a licence compels them:

- Kenney (kenney.nl) and Lynn Evers — Pixel UI pack

- LuizMelo — Pet Cats Pack, Pet Dogs Pack

- Duckhive — bunny, squirrel, cow, goose

- ToffeeCraft — Bunny Pixel Animations, Cat User Interface

- OpenGameArt, Free Music Archive and Loyalty Freak Music contributors — the 420-track CC0 library

- Freesound contributors named in the ambience section — the 13 recorded layers

- Tom "Butch" Wesley — GUT

## Observations recorded rather than tidied away

A register is only useful if it reports what is actually in the tree:

1. **A duplicated source pack.** `assets/thirdparty/cats_lm/` and `assets/thirdparty/pet_cats_pack/` are byte-identical directories of 74 files each — the same LuizMelo CC0 pack staged twice under two names. Licensing is unaffected (CC0 either way); it is redundant weight, not a rights problem.

2. **CC0 waives the author's rights, not a third party's bad behaviour.** The music section below keeps the project's own warning that a CC0 recording can still be fraudulently claimed through an automated content-matching system. The licence record is the defence, which is a reason to keep this file with any fork rather than to delete it.

3. **Raw third-party sheets are hidden from the engine, not merely unused.** `assets/thirdparty/.gdignore` keeps Godot from importing or exporting anything under that directory, so a source sheet cannot ride along into a build by accident. The publication exclusion list is the second, independent layer.

## If you add media to a fork

1. Record the file here first — author or generator, source URL, licence, tier, and SHA-256 — and only then wire it into the build.

2. Prefer a licence that lands in the `Yes` tier. If a source forbids redistribution, keep the raw files out of the repository entirely and add their paths to the publication exclusion list; shipping only a composed derivative is what the two restricted packs above demonstrate.

3. Treat an orphan — a media file on disk with no row here — as a shipping blocker, not a warning.


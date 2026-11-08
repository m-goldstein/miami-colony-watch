# ColonyWatch visual direction

The map now replaces the large welcome header as a compact overview. An Expand map dropdown grows it in place and reveals filters, saved measurements, and the colony list. The hardware panel follows immediately; the cats and population-management mission remain below. The application runs locally and has not been deployed as a hosted website.

The supplied references are `ui-inspo/catssss/image0.png` through `image3.png`, plus the later `ui-inspo/image0.png`, `image4.png`, and `image5.png`. The implementation combines their ivory background, lagoon teal controls, coral actions, bold sans-serif headings, cat-and-Miami mark, sleeping-cat line art, mint waves, outline sensor icons, selected-colony map card, and mobile bottom navigation. The earlier photography direction remains in the mission section. Icons, logo, sleeping cat, station illustration, and schematic map are editable native SVG/CSS.

## Behavior

- Desktop composition follows thirds: a two-thirds map beside a one-third colony summary, three equally sized sensor cards, and a two-thirds station illustration beside a one-third care action. History and notes also use a 2:1 split. Mobile stacks these sections and gives the principal controls at least 44px touch targets.
- The map starts compact. Expand map reveals the full view in place; Collapse map or Escape restores the preview. Escape returns focus to the toggle. Selection, filters, and the USB connection survive expansion and collapse. The mobile preview keeps the record summary behind the expansion control to leave room for hardware readings.

- The main panel shows this tab's demo scenarios or directly connected Arduino. Its three care cards keep the animated food, rain, and wetness effects.
- The map reads saved records from the local `/api/state` endpoint. Its dataset follows the demo/physical mode; map selection never changes the USB panel or submits a reading.
- Pins and an accessible colony list select the record summary. Food, wet weather, standing water, and missing-signal filters use each station's saved calibration and freshness. Stale/unknown readings cannot become a false all-clear or empty hopper. Refresh records requests a new snapshot; accepted manual USB saves also refresh it.
- Map positions are explicitly schematic, using the existing illustrative layout coordinates. They are not GPS or verified colony locations. Records sharing a schematic position form a pin that cycles between them; the list can select each record directly.
- The selected-colony care action opens the field workspace with that colony selected, so the visit form defaults to the intended colony. It opens another tab to preserve the USB connection.
- Workspace counts distinguish fictional demo records from physical records; they do not claim a county-wide population census or deployment count.
- The 300,000–400,000 population-management CTA and its dated county source remain visible in the mission section.

## Generated photo

Saved project asset: [`public/assets/miami-community-cat.png`](../public/assets/miami-community-cat.png). Created with the built-in `image_gen` tool, then copied into the project; no external image service is required at runtime. The photo is illustrative and is not used as an identity photo of any cat in the records.

Exact generation prompt:

> Use case: photorealistic-natural. Asset type: website hero photograph for a Miami community cat monitoring dashboard. Primary request: a warmly observed natural editorial photograph of a healthy adult brown mackerel tabby community cat resting on a pale sandy waterfront ledge in Miami, with its head raised, eyes gently squinting in the sun, paws relaxed in front. Scene/backdrop: softly blurred turquoise Biscayne Bay, a few palms, distant subtle Miami skyline in the upper right. Composition: landscape 3:2 composition, cat fills the center and lower left, breathing room of turquoise sea around the upper right, close enough to see whiskers and natural fur texture. Lighting/mood: soft morning sunlight, caring and hopeful, realistic photography. Palette: natural warm ivory sand, teal water, soft palm green. Constraints: one cat, no humans, no text, no logo, no UI, no borders, no watermark, no collars or clothing, no exaggerated or cartoon features. This is an illustrative hero photograph, not an identification photo of a monitored cat.

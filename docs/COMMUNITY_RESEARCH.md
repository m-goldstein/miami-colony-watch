# Miami Colony Watch: community research and field design

Research checked **November 7, 2026**. This document separates published evidence, the supplied fictional hackathon scenario, and proposed product decisions. It is a design brief for a local prototype, not evidence that stations have been deployed or that a partner organization has endorsed the project.

## The problem to solve

The supplied **Mangrove Mews Cat Rescue** brief describes a fictional coordinator supporting **20 volunteers and 18 Miami colonies**. Cat photographs, feeding updates, injury reports, and trapping needs arrive through scattered chats, notebooks, and spreadsheets. The same cat may acquire two records; an urgent update can disappear in a busy conversation; sponsor reports become guesswork. These numbers and people belong to the exercise and must not be presented as measured Miami-Dade statistics.

The operational problem is broader than knowing whether a food container is empty: **a team needs one current account of each colony, each known cat, and the next action someone has agreed to take**. Hardware contributes timely observations between visits. People still identify cats, assess welfare, clean stations, arrange care, and confirm what happened.

A useful end-to-end demonstration follows a low-food observation through a station reading, an actionable alert, an assigned visit, a refill record, and subsequent recovery. A second demonstration takes a volunteer's new-cat observation through human identity review and a TNR task. Neither workflow should depend on a coordinator reconstructing a group chat.

## Population-management call to action

The homepage uses **300,000–400,000 free-roaming cats in Miami-Dade County**, with explicit attribution to Animal Services' **February 16, 2023** release. This is a historical county estimate, not a current measured census or a count restricted to the City of Miami. The date and direct source are visible alongside the call to action. [County Animal Services release](https://www.miamidade.gov/global/release.page?Mduid_release=rel1676560952008934).

The action is to help manage a colony through shared identity records, caregiver coordination, and TNVR follow-up. Food telemetry supports visits; population management still requires verified cat records and documented sterilization outcomes. The interactive demonstration is separate from live device data and cannot write simulated readings to physical stations.

## What the local evidence says

### Population management needs individual records and follow-through

Miami-Dade's TNVR service includes sterilization, vaccination, ear-tip marking, and return to the original area, with services also available through participating veterinarians. That makes a colony-wide population total insufficient: the system must distinguish a sighting, a suspected identity, an ear-tip observation, and a documented completed procedure. Clinic schedules and eligibility should be checked with the service provider when arranging care rather than frozen into software. [Miami-Dade TNVR service](https://www.miamidade.gov/global/service.page?Mduid_service=ser1599404922449638).

**Design implication:** Give every cat a stable internal identifier, aliases, descriptive markings, a usual colony, dated sightings, and separate unknown/observed/documented statuses. Never infer sterilization from absence of an ear tip in a poor photograph. Suggested duplicate matches should remain suggestions until a caregiver reviews them. Keep original observations when two records are merged so a mistaken merge can be investigated.

### Feeders already perform monitoring, not just food delivery

Miami Beach's municipal program combines TNVR, adoption, and registered feeders. The city describes feeders as monitors who identify cats needing sterilization and locate new litters. It also instructs participants not to trespass and to remove leftovers and serving items after feeding. This is local evidence for a management workflow that joins visits, census updates, and site care. It does not establish one uniform rule for every Miami-Dade municipality. [Miami Beach Community Cat Program](https://www.miamibeachfl.gov/city-hall/public-works/sobecats/).

**Design implication:** A visit form should be brief enough for a feeder's phone: colony, time, observed cats, new arrivals, food replenished, water changed, visible concern, cleanup, and a note. A missed visit is its own condition even if a container still looks full. A person should own each open task, with a backup when the usual feeder is unavailable.

### Feeding needs limits and cleanup

Alley Cat Allies recommends fresh water, a clean feeding location, and removing uneaten food within 30 minutes; it notes that food left overnight can attract insects and wildlife. This supports scheduled care rather than interpreting “food available” as permission for unattended, unlimited feeding. [Community colony-care guidance](https://www.alleycat.org/resources/best-practices-community-cat-colony-care/).

**Design implication:** Prefer measuring reserve kibble inside an approved, protected container. Record intended feeding windows and cleanup checks separately. A large remaining food reading cannot prove that cats ate, that the food is fresh, or that a feeding area is hygienic. The prototype should not dispense food automatically: the provided kit contains no suitable dispenser actuator.

## Miami's weather changes the operating model

Miami-Dade's Weather Ready guidance groups extreme heat, hurricanes, and flooding as recurring local hazards. It identifies hurricane season as June through November, heat season as May through October, and a usual mid-May to mid-October rainy season. These are planning periods, not a prediction of conditions at a particular colony. [Miami-Dade Weather Ready](https://www.miamidade.gov/initiative/weather-ready/home.page).

A dry weather icon is therefore insufficient. Coordinators need to know whether food has been exposed to moisture, whether water is reaching the station, whether a device has stopped reporting, and whether a responsible caregiver has checked the site.

The county warns that flash flooding can occur quickly, including without visible rain at the observer's location, and directs people to flood information and official alerts. Consequently, **a dry raindrop plate must never be interpreted as a flood all-clear**. Sensor-based visit priorities should not direct volunteers into floodwater or override emergency instructions. [Miami-Dade flood preparedness](https://www.miamidade.gov/global/emergency/prepare-flood.page).

Alley Cat Allies' disaster guidance emphasizes descriptions and photographs of cats, backup caregivers, emergency contacts, supplies, and preparation before harsh weather. These are records and coordination needs that remain useful even when a station loses connectivity. [Disaster preparation for cats](https://www.alleycat.org/community-cat-care/be-prepared-for-disasters/).

**Proposed storm workflow:** Before an anticipated event, review permissions, caregiver coverage, supplies, and protected station placement. During an event, mark access restrictions and suspend routine dispatch when appropriate. Afterward, use official guidance and caregiver reports to authorize checks, reconcile missing-cat sightings, inspect hardware, and record damage. A sensor cannot certify that a route or shelter is safe.

## What the provided hardware can establish

| Component | Useful observation | Boundary on interpretation |
| --- | --- | --- |
| HC-SR04 sonar | Distance from a fixed overhead position to a food surface; calibrated approximate fill | Not food mass, nutrition, consumption, or cat presence |
| Raindrop AO/DO | Local plate wetness, with a configurable digital threshold | Not rainfall rate, humidity, or a weather forecast |
| Analog water probe | Wetness or standing water at the probe's installed height | Not drinking-water quality or regional flood depth |
| OLED and rotary encoder | Current readings and device state without a phone | Rotating between pages does not change what the sensors measure |
| Traffic/RGB LEDs | A quick local indication that inspection is needed | A green light is not a welfare or safety certification |
| Uno and Node gateway | Local sampling, processing, and forwarding of observations | Gateway, power, and network availability remain separate dependencies |

The HC-SR04 documentation specifies a 2–400 cm nominal range and a target-dependent measurement geometry; it describes testing against a sufficiently broad, smooth surface. Kibble is uneven and a narrow container may reflect from its sides. A small bowl or poor mounting may therefore be unsuitable despite a plausible reading. [HC-SR04 datasheet](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf).

**Proposed calibration:** Mount the sensor rigidly above a dry, protected container. Measure empty and safely full distances, retaining the sensor's near-range clearance. Compare estimates at several known fill amounts. Report an approximate fill percentage from those endpoints, retaining raw distance and quality status. Treat no echo or impossible geometry as **unknown**, not empty. Do not convert volume to kilograms without separate validated mass calibration.

For rain and water, record dry and wet baseline ADC values for the actual modules. Install the water probe where standing water is the intended measurement; moving it into a drinking reservoir changes its meaning and requires a different interpretation. Splash, dirt, and salt exposure should be considered during validation. The supplied sensors do not measure temperature, relative humidity, wind, lightning, or water potability. Those fields must remain unavailable unless an explicitly identified additional sensor or external source supplies them.

The Uno R3 is an ATmega328P board with USB and local I/O. A USB-connected Node process can act as the gateway; remote connectivity is an additional part of the installation, not a feature to assume from this board. [Arduino Uno R3 documentation](https://docs.arduino.cc/hardware/uno-rev3).

## Care, ecology, and permission belong in the same system

The Florida Fish and Wildlife Conservation Commission identifies predation, disease, and other effects of free-ranging cats as wildlife concerns. Its policy discussion does not itself prohibit all TNVR; it emphasizes humane, science-based responses where cats affect wildlife. A responsible project should acknowledge this tension instead of presenting expanded feeding infrastructure as an unqualified conservation benefit. [FWC feral-cat guidance](https://myfwc.com/wildlifehabitats/nonnatives/feral-cats/).

**Proposed site review:** Record permission to install, the municipality or land manager, a caregiver contact, access restrictions, nearby sensitive habitat, cleanup arrangements, and an agreed escalation contact. Review conservation concerns before placing hardware near protected habitat. A map pin is not evidence of permission, and a successful bench test is not approval for field deployment. Do not use monitoring to encourage abandonment or uncontrolled colony expansion.

A station should support an existing responsible care plan. Replenishment tasks need to coexist with TNVR follow-up, adoption referrals, cleanup, and conflict resolution. More food telemetry alone cannot establish a shrinking population or improved wildlife outcomes.

## Make observations trustworthy and actionable

A useful record retains **what was observed, where, when, by whom or which device, and with what confidence**. Sensor capture time and gateway receipt time should be separate so replaying offline observations does not make an old condition look new. Repeated transmission should not duplicate a reading or create repeated tasks. Late readings can enrich history without silently replacing a newer current state.

**Proposed operational rules:** Require repeated low-food readings before opening a routine replenishment task, allow different clear/reopen thresholds to avoid flicker, and expose the original measurements. Keep stale-device alerts distinct from food or weather alerts. A missing signal is not a healthy station. A caregiver's completed visit and later sensor recovery are separate evidence; neither should erase the other.

Incoming volunteer notes should preserve their source and time, then resolve to an existing cat or an explicit “identity unresolved” record. The hackathon brief permits a phone form, authorized export, or approved bot. It does not authorize scraping private chats. Human review is especially important for uncertain identity, injury descriptions, and changes to a procedure record.

## Privacy and deployment operations

All demonstration people, cats, observations, and colony locations should be fictional and labeled. A public-facing view should aggregate geography; exact real sites and caregiver contact details should be restricted to people responsible for that work. This is a proposed data-minimization policy, not a claim that a particular law mandates this implementation.

A future hosted service needs authenticated staff access, role-based authorization, per-device credentials, HTTPS, backups, retention controls, and a clear way to revoke a lost station. Credentials must stay out of Git. The USB gateway remains a local edge process even if the dashboard later moves to Vercel; uploading a frontend does not connect an unplugged Uno.

Treat each hardware deployment as a record with a lifecycle: planned, bench-tested, permission-confirmed, calibrated, active, maintenance, and retired. Retain station-to-colony assignment history, calibration dates, firmware version, last contact, gateway identity, and inspection notes. Outdoor mounting, protected power, cable strain relief, drainage, corrosion checks, and cleaning are practical work that the bench kit has not yet demonstrated. Inspect after weather exposure and compare sensor readings to a manual check before trusting them again.

## A pilot that can tell whether this helps

Start with a small, permissioned group of existing care sites and caregiver-defined priorities. Collect a manual baseline before relying on alerts; then compare the same sites over a defined trial. The following are **proposed measurements**, not promised results:

| Question | Evidence to collect |
| --- | --- |
| Is the food estimate useful? | Sensor estimate versus manual fill checks across fill levels; invalid-reading rate |
| Do alerts lead to care? | Time from a confirmed alert to acceptance, visit, and documented resolution |
| Are volunteers saving effort? | Reconciliation minutes per week and avoidable duplicate trips, compared with baseline |
| Is the census more reliable? | Unresolved identities, corrected duplicates, and dated evidence behind TNVR totals |
| Does the station survive field conditions? | Uptime, stale periods, lost observations, maintenance time, and replacement incidents |
| Are there unwanted effects? | Cleanup compliance, wildlife interactions, complaints, and access or permission issues |

Do not claim “cats saved,” food consumed, or population reduction from station uptime or alert counts. Sponsor reports should distinguish unique cats, sightings, documented procedures, caregiver visits, and sensor observations, and state the reporting period and missing data. The strongest outcome is a team that can explain a colony's current needs and show what it did about them, with uncertainty still visible.

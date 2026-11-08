# Bonus track review: shared care for community cats

This branch repositions ColonyWatch around the supplied Bonus challenge: original messages, photographs, location notes, and clinic notes become reviewed cat identities, assigned care, recorded visits, and a report with supporting evidence. The Arduino and weather plan remain part of the same care story.

## Review in isolation

Branch: `review/bonus-cat-care`, based on `main` at `265f9f0`.

The separate checkout is `/home/max/hackathon/DevDayHackathon/miami-colony-watch-judges`. This task leaves the original `miami-colony-watch` checkout and its service on port 3000 alone. Independent temperature/hardware edits appearing there during this work are not part of this branch; its comparison baseline remains `265f9f0`.

```bash
cd /home/max/hackathon/DevDayHackathon/miami-colony-watch-judges
npm ci
npm run review
```

Open http://127.0.0.1:3001. This command uses this worktree's `data/review.sqlite`. Do not point it at the original checkout's database. The app remains a loopback-only local coordinator prototype. Stop it with Ctrl+C.

## Walk through the rescue story

1. Choose **Try the rescue story**. Six fictional updates enter the persistent inbox, with original text, timestamps, source IDs, two illustrative photograph attachments, a location note, and a fictional clinic note. Importing again does not duplicate the batch.
2. Review Elena's Mango sighting and link the existing identity. Review Marco's “Stripey” sighting and confirm Mango with the alias. Two sightings become evidence for one cat. Open Mango's record to inspect both sources. The census remains at 14.
3. Review the concern about Pippa and link her existing identity. A care follow-up appears. Assign Elena, save, then complete it with an outcome note and the number of cats actually observed. A dated care visit is recorded. A visit does not alter census or sensor evidence.
4. Review Pebble as a new, distinctly described identity if the available evidence supports that decision. The census becomes 15 and TNVR remains unknown. Unresolved updates can stay pending; dismissing requires a reason.
5. Review the location handoff as a colony note. Review Pippa's fictional clinic note only after entering a procedure date, reference, and checked-evidence note. The confirmed TNVR total increases once, with a dated completion in the report. Baseline confirmations never masquerade as new procedures.
6. Try **low food**. The Arduino exercise creates a linked refill follow-up. Assign and complete the visit, then separately record the later refill reading. The task outcome and sensor observation remain separate evidence.
7. Review the report date range, follow the source links, and download the evidence CSV. Reload the page: reviews, aliases, care assignments, completed visits, sensor exercise state, plans, and pilot assumptions persist.
8. **Reset exercise** clears only the isolated fictional exercise after a clear confirmation. Existing workspace/physical-device records remain unchanged.

The same form also accepts new fictional phone notes without a connected Arduino. Suggestions in the sample batch are prepared annotations, not results of live AI extraction or automatic photo matching. The software was built with Codex; runtime AI, chat integrations, and hosted multi-user access are not claimed.

## Nonprofit fit

- The opening names the coordinator's burden and the team benefiting from a shared record.
- Today's follow-ups expose ownership, source evidence, check-in time, and documented outcomes.
- Cat identities retain aliases and original observations. Unknown procedure status remains explicit.
- Reports separate the current census from dated sightings, unique cats observed, documented TNVR completions, care visits, and completed follow-ups.
- Pilot assumptions accept the team's own equipment, enclosure, power, gateway, and recurring-cost quotes. Blank values stay unknown; entered subtotals are not vendor prices.
- The adoption panel proposes baseline measurement of reconciliation time, duplicate records, and response times. No time savings, population reduction, or welfare outcomes are invented.
- The original light ivory, lagoon teal, coral, cat artwork, weather outlook, readiness plan, and live USB tooling remain available.

## Data boundaries and reporting

The rescue exercise is one namespaced record in a new `care_demo` SQLite table. It has its own colony, cats, updates, tasks, visits, sensor samples, readiness plan, pilot assumptions, and append-only evidence events between explicit resets. Existing `/api/state` collections and authenticated device ingestion are unchanged.

The `/api/care-demo` namespace is available only in demo mode. Review decisions are validated and transactional. Repeat imports are idempotent, repeat reviews are refused, existing names/aliases block duplicate identity creation, and already-confirmed TNVR cannot create another completion. Only a reviewer can resolve identity; matching photographs are never proof by themselves.

Reports use inclusive UTC dates. Current census counts are labeled separately from activity in the chosen period. Procedure activity uses the entered documented procedure date; the evidence also retains the date it was recorded. No animal health diagnosis is made from a note, image, or sensor.

## Verification

Run `npm test`, `npm run test:rescue-browser`, `npm run test:planning-browser`, `npm run test:serial-browser`, `npm run test:browser`, and `npm run build`.

The rescue browser test follows sample import, two sightings/one identity, a new cat, care assignment and completion, procedure evidence, dated report export, reload persistence, physical-data isolation, reset, and desktop/mobile rendering. USB checks use mock hardware. Hardware has not been deployed or field-validated by this change.

## Submission

An MIT license is included. The supplied hackathon instructions require a public GitHub repository by submission. This review branch is local; publishing the repository or changing its visibility is a separate user decision. It has not been deployed or pushed as part of this task.

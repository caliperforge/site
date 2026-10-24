---
title: How few Rubin objects ever get a name
slug: rubin-names
date: 2026-10-24
---

Almost none of the objects Rubin's alerts find get a name in the Transient Name Server, and that name is how astronomers agree an object is worth following up.

From 2026-06-15 to 2026-07-14, 2,929,058 of Rubin's alerts were the first detection of an object. Over the same nights, alerts came in on 2,347 objects that have a name in the Transient Name Server. Set against the first detections, that is 1 in 1,248, or 0.080%.

## What an alert is, and what a name is

Each night the Vera C. Rubin Observatory compares its new images of the southern sky with earlier ones and sends an alert for every source that has changed: something new, something brighter or fainter, something that moved. Fink is one of the brokers that take in that stream, add their own flags and serve it through a public API.

An alert does not say what an object is, or that anyone should look at it. That is what the Transient Name Server (TNS) is for. It is the International Astronomical Union's register of new transients: an object reported there gets a name such as AT 2025agpz, one of the objects in this window, and spectra, classifications and papers then cite that name. A TNS name is the community's agreement that an object deserves follow-up.

## How the count works

Fink's statistics give one row per night. Over the 16 nights with data, they count 4,807,653 alerts, 2,929,058 first detections (`is_first`) and 7,084 alerts flagged `in_tns`.

The named objects come from Fink's `in_tns` tag, which lists each flagged alert with its object and its TNS name. It returned 7,063 rows against a limit of 200,000, so the limit cut nothing off. Those rows belong to 2,347 distinct objects with a TNS name.

*Chart: alerts flagged `in_tns` on each night with data, from Fink's statistics.*

`is_first` is only the closest figure for new objects. It counts alerts that were an object's first detection, and we have not checked that it equals the number of distinct objects first seen each night. The statistics also give `f:objects`, the objects seen each night, but summed over the window it counts an object again on every night it was seen. It overstates the total and is not used here.

## Where the data stops

Plan 1614, the research job behind this post, ran on 2026-10-23 and asked for the month before it, 2026-09-23 to 2026-10-22. Fink's Rubin statistics hold 0 nights there: the newest night they hold is 20260714. The plan found that edge and counted the same length of time ending there instead, 2026-06-15 to 2026-07-14, of which 16 nights have data. Why the statistics stop at that night is still unknown.

## Where the tag and the statistics disagree

The statistics flag 7,084 alerts `in_tns`, and the tag returns 7,063: 21 fewer. The whole difference is night 20260615, which has that many in the statistics and none in the tag on its UTC date. On other nights the two disagree only between neighbouring nights, by amounts that cancel, so Fink's night label is probably not the UTC date of the observation. If the tag leaves out night 20260615's alerts, the count of named objects misses any object flagged only that night.

## Why so few

This is not a failing of Fink or of Rubin. Rubin is built to catch everything in its sky that changes, and Fink takes in all of it. A name needs someone to report the object to the TNS, and follow-up needs spectra, which need time on other telescopes. That capacity is small next to a stream this size, and the gap between first detections and names measures it.

## How we counted

Each call to Fink's API beside the numbers it gave. The numbers are in [data/rubin_names.json](/data/rubin_names.json).

| Call | What it gave |
|---|---|
| `https://api.lsst.fink-portal.org/api/v1/statistics?date=202609` and `https://api.lsst.fink-portal.org/api/v1/statistics?date=202610` | 0 nights with data from 2026-09-23 to 2026-10-22 |
| `https://api.lsst.fink-portal.org/api/v1/statistics?date=&columns=f%3Anight%2Cf%3Aalerts` | Newest night 20260714 |
| `https://api.lsst.fink-portal.org/api/v1/statistics?date=202606` and `https://api.lsst.fink-portal.org/api/v1/statistics?date=202607` | 16 nights, 4,807,653 alerts, 2,929,058 first detections, 7,084 alerts flagged `in_tns` |
| `https://api.lsst.fink-portal.org/api/v1/tags?tag=in_tns&n=200000&startdate=2026-06-15&stopdate=2026-07-15&columns=r%3AdiaObjectId%2Cr%3AmidpointMjdTai%2Cf%3Axm_tns_fullname%2Cf%3Axm_tns_type` | 7,063 rows from 2,347 named objects, against a limit of 200,000 |
| `https://api.lsst.fink-portal.org/api/v1/tags?tag=in_tns&n=200000&startdate=2026-06-14&stopdate=2026-07-15&columns=r%3AdiaObjectId%2Cr%3AmidpointMjdTai` | Tag alerts on each UTC date, set against the statistics night by night |

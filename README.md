# Somerville PorchFest 2026 Map

**Live site:** https://sgechter.github.io/porchfest-2026/

Porchfest is a great part of living in Somerville. I'm Shomer Shabbos (Sabbath observant), and Porchfest is usually on Saturday, so I can't reference my phone to decide which bands to see. My usual routine: the day before, I check the Somerville Arts Council website, filter down to the genres I like (bluegrass, Americana, funk), zoom in to the radius I want to stay within around my house, and print it out.

This year's changes to the official website made that harder — the search wasn't as clear, and there was no multi-select for band types. So using their xlsx download (thank you, Somerville Arts Council!) and working with Claude Code, I was able to put together a new site in about an hour: time and genre filters, numbered pins color-coded by time slot, detailed hover info, and a printable guide that actually uses the full page width.

It's a niche use case, but something my community will appreciate next year when I update it more than an hour before sundown. 😁

## Features

- **Time filters** — All / Noon–2pm / 2pm–4pm / 4pm–6pm
- **Genre filters** — multi-select chips, clear/restore all
- **Color-coded markers** — blue (12–2pm), green (2–4pm), orange (4–6pm)
- **Hover tooltips** — venue address, band name, time, genres
- **Printable** — 3-column layout sized for a single sheet

## Data source

Band and venue data from the [Somerville Arts Council](https://www.somervilleartscouncil.org/) PorchFest 2026 xlsx export. Addresses geocoded via the US Census Geocoder batch API.

## Built with

- [Leaflet.js](https://leafletjs.com/) + CartoDB Voyager tiles
- Plain HTML/CSS/JS — no build step
- [Claude Code](https://claude.ai/code)

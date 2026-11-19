# MMM-DilbertThisDay

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that shows a Dilbert strip from this calendar day in a random year.

Dilbert is a comic created by Scott Adams. This module is based on [MMM-DailyDilbert](https://github.com/andrecarlucci/MMM-DailyDilbert).

Dilbert ended on **2023-03-12**, and dilbert.com no longer publishes a daily strip. This module reads the public archive at [jvarn/dilbert-archive](https://github.com/jvarn/dilbert-archive) (1989–2023). Each year is a JSON file. Dates are `YYYY-MM-DD` keys, and each strip's image is the `originalimageurl` copy on the Wayback Machine. The first strip in the archive is **1989-04-16**.

The module takes the computer's local month and day, chooses one year in that range that has the same date, and shows that strip. The caption looks like **April 16, 1995**. February 29 is used only in leap years. A year with no strip for that exact date is skipped. The chosen strip stays up until `updateInterval` elapses, then a new year is chosen. If the image URL fails, another year with the same month and day is tried before an error is shown.

The date is the MagicMirror machine's local calendar date. The module does not apply a fixed UTC offset, so daylight saving time follows the system timezone. Set the Pi's timezone to `America/Chicago` if that is the day you want.

This is a standalone module. It does not modify any other module.

No npm packages are required. Node 18 or newer provides the global `fetch` used by the helper.

## Installation

Clone this repository into your MagicMirror `modules` directory:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/msimon360/MMM-DilbertThisDay.git
```

Add an entry to `config/config.js` when you want the module on screen. `bottom_bar` below is an example position only.

```js
{
    module: "MMM-DilbertThisDay",
    position: "bottom_bar", // example position only
    config: {
        updateInterval: 36000000,
        scale: 100,
        showDate: true
    }
},
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `updateInterval` | `36000000` | How long to keep the chosen strip, in milliseconds (10 hours). After it elapses, a new year is chosen. Values below `60000` are raised to `60000` (1 minute). |
| `scale` | `100` | Width of the strip as a percent. `100` is full width of the module region. |
| `showDate` | `true` | Show the publication date under the strip, for example `April 16, 1995`. |

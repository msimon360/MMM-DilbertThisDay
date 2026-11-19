// Node 18+ global fetch. No extra packages.
// Dilbert ended on 2023-03-12. Strips come from the jvarn archive:
// https://github.com/jvarn/dilbert-archive
// Year files: {ARCHIVE_BASE}/YYYY.json, keyed by YYYY-MM-DD.
var NodeHelper = null;
try {
	NodeHelper = require("node_helper");
} catch (err) {
	NodeHelper = null;
}

var ARCHIVE_BASE = "https://raw.githubusercontent.com/jvarn/dilbert-archive/main/public/comics-data";
var FIRST_YEAR = 1989;
var LAST_YEAR = 2023;
var FIRST_DATE = "1989-04-16";
var LAST_DATE = "2023-03-12";
var DEFAULT_INTERVAL = 36000000;
var MIN_INTERVAL = 60000;

var MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];

function pad2(n) {
	return String(n).padStart(2, "0");
}

function isoDate(year, month, day) {
	return year + "-" + pad2(month) + "-" + pad2(day);
}

function isLeapYear(year) {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isRealCalendarDate(year, month, day) {
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return false;
	}
	var dt = new Date(year, month - 1, day);
	return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

// Process local calendar. No fixed UTC offset, so DST follows the machine timezone.
function localMonthDay(now) {
	var dt = now ? new Date(now) : new Date();
	return {
		year: dt.getFullYear(),
		month: dt.getMonth() + 1,
		day: dt.getDate()
	};
}

function displayDateFromIso(iso) {
	var parts = String(iso).split("-");
	var year = Number(parts[0]);
	var month = Number(parts[1]);
	var day = Number(parts[2]);
	return MONTHS[month - 1] + " " + day + ", " + year;
}

function normalizeInterval(value) {
	var ms = Number(value);
	if (!isFinite(ms)) {
		ms = DEFAULT_INTERVAL;
	}
	if (ms < MIN_INTERVAL) {
		ms = MIN_INTERVAL;
	}
	return ms;
}

// Years 1989–2023 whose calendar can contain this month and day.
// Feb 29 is limited to leap years. Missing archive keys are skipped later.
function candidateYears(month, day) {
	if (!Number.isInteger(month) || !Number.isInteger(day)) {
		return [];
	}
	var years = [];
	for (var year = FIRST_YEAR; year <= LAST_YEAR; year++) {
		if (month === 2 && day === 29 && !isLeapYear(year)) {
			continue;
		}
		if (!isRealCalendarDate(year, month, day)) {
			continue;
		}
		years.push(year);
	}
	return years;
}

function shuffle(list, random) {
	var arr = list.slice();
	var rng = typeof random === "function" ? random : Math.random;
	for (var i = arr.length - 1; i > 0; i--) {
		var j = Math.floor(rng() * (i + 1));
		var tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
}

function asSet(value) {
	if (!value) {
		return new Set();
	}
	if (value instanceof Set) {
		return new Set(value);
	}
	return new Set(value);
}

function createArchive(options) {
	var fetchImpl = (options && options.fetch) || fetch;
	var yearCache = new Map();

	async function loadYear(year) {
		if (yearCache.has(year)) {
			return yearCache.get(year);
		}
		var url = ARCHIVE_BASE + "/" + year + ".json";
		var response = await fetchImpl(url, {
			method: "GET",
			redirect: "follow",
			signal: AbortSignal.timeout(20000)
		});
		if (!response.ok) {
			throw new Error("Archive HTTP " + response.status + " for " + year);
		}
		var data = await response.json();
		yearCache.set(year, data);
		return data;
	}

	async function imageOk(url) {
		if (!url || typeof url !== "string") {
			return false;
		}
		try {
			var response = await fetchImpl(url, {
				method: "GET",
				redirect: "follow",
				signal: AbortSignal.timeout(20000)
			});
			var ok = response.ok;
			if (response.body && typeof response.body.cancel === "function") {
				try {
					await response.body.cancel();
				} catch (cancelErr) {
					// Status is enough; the body does not need to finish.
				}
			}
			return ok;
		} catch (err) {
			return false;
		}
	}

	async function selectComic(month, day, opts) {
		opts = opts || {};
		var exclude = asSet(opts.excludeYears);
		var checkImage = typeof opts.imageOk === "function" ? opts.imageOk : imageOk;
		var years = candidateYears(month, day).filter(function(year) {
			return !exclude.has(year);
		});
		if (Array.isArray(opts.yearOrder)) {
			var allowed = new Set(years);
			years = opts.yearOrder.filter(function(year) {
				return allowed.has(year);
			});
		} else {
			years = shuffle(years, opts.random);
		}

		var skipped = [];
		var attempts = [];

		for (var i = 0; i < years.length; i++) {
			var year = years[i];
			var key = isoDate(year, month, day);
			var comics;
			try {
				comics = await loadYear(year);
			} catch (err) {
				skipped.push({ year: year, date: key, reason: "fetch-failed" });
				continue;
			}
			if (!comics || typeof comics !== "object" || !Object.prototype.hasOwnProperty.call(comics, key)) {
				skipped.push({ year: year, date: key, reason: "missing-key" });
				continue;
			}
			var entry = comics[key];
			var img = entry && typeof entry.originalimageurl === "string" ? entry.originalimageurl.trim() : "";
			if (!img) {
				skipped.push({ year: year, date: key, reason: "missing-image" });
				continue;
			}
			attempts.push({ year: year, date: key, img: img });
			var ok = false;
			try {
				ok = await checkImage(img);
			} catch (imageErr) {
				ok = false;
			}
			if (!ok) {
				skipped.push({ year: year, date: key, reason: "image-failed", img: img });
				continue;
			}
			return {
				img: img,
				date: key,
				displayDate: displayDateFromIso(key),
				year: year,
				skipped: skipped,
				attempts: attempts
			};
		}

		return {
			img: null,
			date: null,
			displayDate: null,
			year: null,
			skipped: skipped,
			attempts: attempts
		};
	}

	return {
		selectComic: selectComic,
		loadYear: loadYear,
		candidateYears: candidateYears
	};
}

function comicPayload(result) {
	return {
		img: result.img,
		date: result.date,
		displayDate: result.displayDate
	};
}

var defaultArchive = createArchive();

if (NodeHelper) {
	module.exports = NodeHelper.create({
		start: function() {
			console.log("Starting node helper: " + this.name);
			this.archive = defaultArchive;
			this.cycle = null;
			this.generation = 0;
			this._queue = Promise.resolve();
		},

		socketNotificationReceived: function(notification, payload) {
			if (notification === "GET_COMIC") {
				this.enqueue({ type: "get", payload: payload || {} });
				return;
			}
			if (notification === "IMAGE_ERROR") {
				this.enqueue({ type: "image-error", payload: payload || {} });
			}
		},

		enqueue: function(job) {
			var self = this;
			this._queue = this._queue.then(function() {
				return self.handleJob(job);
			}).catch(function(err) {
				console.log("DilbertThisDay error -> " + (err && err.message ? err.message : err));
				self.sendSocketNotification("COMIC", { error: true });
			});
		},

		handleJob: async function(job) {
			if (job.type === "image-error") {
				await this.onImageError(job.payload);
				return;
			}
			await this.onGetComic(job.payload);
		},

		onGetComic: async function(payload) {
			var config = payload.config || {};
			var refresh = payload.refresh === true;
			var today = localMonthDay();
			var interval = normalizeInterval(config.updateInterval);
			var cycle = this.cycle;

			if (!refresh && cycle && cycle.current && Date.now() < cycle.expires &&
				cycle.month === today.month && cycle.day === today.day) {
				console.log("DilbertThisDay -> keeping " + cycle.current.date);
				this.sendSocketNotification("COMIC", comicPayload(cycle.current));
				return;
			}

			this.generation += 1;
			this.cycle = {
				month: today.month,
				day: today.day,
				expires: Date.now() + interval,
				exclude: new Set(),
				current: null,
				gen: this.generation
			};
			console.log("DilbertThisDay -> choosing for " + isoDate(today.year, today.month, today.day).slice(5) + " local");
			await this.pickNext();
		},

		onImageError: async function(payload) {
			var cycle = this.cycle;
			if (!cycle || !cycle.current) {
				return;
			}
			if (payload && payload.img && payload.img !== cycle.current.img) {
				return;
			}
			console.log("DilbertThisDay -> image failed in the browser for " + cycle.current.date);
			cycle.exclude.add(cycle.current.year);
			cycle.current = null;
			await this.pickNext();
		},

		pickNext: async function() {
			var cycle = this.cycle;
			var gen = this.generation;
			var result = await this.archive.selectComic(cycle.month, cycle.day, {
				excludeYears: cycle.exclude
			});
			if (gen !== this.generation || this.cycle !== cycle) {
				return;
			}
			(result.skipped || []).forEach(function(item) {
				cycle.exclude.add(item.year);
				console.log("DilbertThisDay -> skip " + item.date + " (" + item.reason + ")");
			});
			if (!result.img) {
				cycle.current = null;
				console.log("DilbertThisDay -> no strip for month " + cycle.month + " day " + cycle.day);
				this.sendSocketNotification("COMIC", { error: true });
				return;
			}
			cycle.exclude.add(result.year);
			cycle.current = {
				img: result.img,
				date: result.date,
				displayDate: result.displayDate,
				year: result.year
			};
			console.log("DilbertThisDay -> " + result.date + " -> " + result.img);
			this.sendSocketNotification("COMIC", comicPayload(result));
		}
	});
}

module.exports.createArchive = createArchive;
module.exports.candidateYears = candidateYears;
module.exports.normalizeInterval = normalizeInterval;
module.exports.localMonthDay = localMonthDay;
module.exports.displayDateFromIso = displayDateFromIso;
module.exports.isoDate = isoDate;
module.exports.FIRST_YEAR = FIRST_YEAR;
module.exports.LAST_YEAR = LAST_YEAR;
module.exports.FIRST_DATE = FIRST_DATE;
module.exports.LAST_DATE = LAST_DATE;
module.exports.ARCHIVE_BASE = ARCHIVE_BASE;

Module.register("MMM-DilbertThisDay", {

	defaults: {
		updateInterval: 36000000, // 10 hours
		scale: 100, // image width in percent
		showDate: true
	},

	start: function() {
		var interval = Number(this.config.updateInterval);
		if (!isFinite(interval)) {
			interval = 36000000;
		}
		if (interval < 60000) {
			interval = 60000;
		}
		this.config.updateInterval = interval;

		Log.info("Starting module: " + this.name);
		Log.info("DilbertThisDay updateInterval=" + this.config.updateInterval +
			" scale=" + this.config.scale +
			" showDate=" + this.config.showDate);

		this.dailyComic = "";
		this.comicDate = "";
		this.displayDate = "";
		this.failed = false;
		this.reportedErrorFor = "";

		var self = this;
		this.getComic(false);
		setInterval(function() {
			self.getComic(true);
		}, self.config.updateInterval);
	},

	getScripts: function() {
		return [];
	},

	getStyles: function() {
		return ["dilbert.css"];
	},

	getComic: function(refresh) {
		Log.info("DilbertThisDay: Getting comic. refresh=" + (refresh === true));
		this.sendSocketNotification("GET_COMIC", {
			config: this.config,
			refresh: refresh === true
		});
	},

	socketNotificationReceived: function(notification, payload) {
		if (notification !== "COMIC") {
			return;
		}
		Log.info("DilbertThisDay: COMIC payload -> " + JSON.stringify(payload));
		if (!payload || payload.error || !payload.img) {
			Log.error("DilbertThisDay: no strip to show.");
			this.dailyComic = "";
			this.comicDate = "";
			this.displayDate = "";
			this.failed = true;
			this.updateDom(1000);
			return;
		}
		this.failed = false;
		this.dailyComic = payload.img;
		this.comicDate = payload.date || "";
		this.displayDate = payload.displayDate || "";
		this.updateDom(1000);
	},

	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.failed && !this.dailyComic) {
			wrapper.innerHTML = "Dilbert strip unavailable.";
			return wrapper;
		}

		if (!this.dailyComic) {
			wrapper.innerHTML = "Loading Dilbert...";
			return wrapper;
		}

		var comicWrapper = document.createElement("div");
		comicWrapper.className = "dilbert-container";

		var img = document.createElement("img");
		var src = this.dailyComic;
		var self = this;
		img.id = "dilbert-content";
		img.src = src;
		img.alt = this.displayDate || "Dilbert";
		img.classList.add("dilbert-image");
		img.style.width = this.config.scale + "%";
		img.onload = function() {
			Log.info("DilbertThisDay: image loaded OK -> " + src);
		};
		img.onerror = function() {
			Log.error("DilbertThisDay: image FAILED to load -> " + src);
			if (self.reportedErrorFor === src) {
				return;
			}
			self.reportedErrorFor = src;
			self.failed = false;
			self.dailyComic = "";
			self.updateDom(0);
			self.sendSocketNotification("IMAGE_ERROR", {
				img: src,
				date: self.comicDate
			});
		};
		comicWrapper.appendChild(img);

		if (this.config.showDate !== false && this.displayDate) {
			var caption = document.createElement("div");
			caption.className = "dilbert-date";
			caption.textContent = this.displayDate;
			comicWrapper.appendChild(caption);
		}

		wrapper.appendChild(comicWrapper);
		return wrapper;
	}
});

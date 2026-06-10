(function () {
  "use strict";

  var newsSection = document.querySelector("[data-news-feed]");
  var newsList = document.querySelector(".news-list");
  var newsMoreLink = document.querySelector(".news-all");
  var NEWS_QUERY =
    (newsSection && newsSection.dataset.newsQuery) || "아르바이트";
  var NEWS_COUNT = parseInt(
    (newsSection && newsSection.dataset.newsDisplay) || "3",
    10
  );
  var NEWS_FETCH_COUNT = 12;
  var BLOCKED_IMAGE_PATTERNS = [
    "J6_coFbogxhRI9iM864NL",
    "/common/common_og_",
    "yonhapnews_logo",
    "/favicon",
    "logo_1200x800",
  ];

  if (!newsList) {
    return;
  }

  var SOURCE_MAP = {
    chosun: "조선일보",
    donga: "동아일보",
    hani: "한겨레",
    joongang: "중앙일보",
    joins: "중앙일보",
    mk: "매일경제",
    hankyung: "한국경제",
    yna: "연합뉴스",
    newsis: "뉴시스",
    news1: "뉴스1",
    fnnews: "파이낸셜뉴스",
    sedaily: "서울경제",
    mt: "머니투데이",
    khan: "경향신문",
    hankookilbo: "한국일보",
    segye: "세계일보",
    kmib: "국민일보",
    nocutnews: "노컷뉴스",
    edaily: "이데일리",
    etoday: "이투데이",
    naver: "네이버뉴스",
  };

  function stripHtml(text) {
    var container = document.createElement("div");
    container.innerHTML = text || "";
    return (container.textContent || container.innerText || "").trim();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveArticleUrl(url) {
    try {
      var parsed = new URL(url);
      var embedded = parsed.searchParams.get("url");

      if (embedded) {
        return decodeURIComponent(embedded);
      }

      return url;
    } catch (error) {
      return url;
    }
  }

  function isUsableImageUrl(imageUrl) {
    if (!imageUrl) {
      return false;
    }

    for (var i = 0; i < BLOCKED_IMAGE_PATTERNS.length; i += 1) {
      if (imageUrl.indexOf(BLOCKED_IMAGE_PATTERNS[i]) !== -1) {
        return false;
      }
    }

    return /^https?:\/\//.test(imageUrl);
  }

  function isLikelyNoImageHost(url) {
    try {
      return new URL(url).hostname.indexOf("msn.com") !== -1;
    } catch (error) {
      return false;
    }
  }

  function extractImageFromDescription(description) {
    if (!description) {
      return null;
    }

    var match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1].replace(/&amp;/g, "&") : null;
  }

  function getItemUrlCandidates(item) {
    var candidates = [];
    var seen = {};

    [item.originallink, item.link].forEach(function (url) {
      if (!url) {
        return;
      }

      [url, resolveArticleUrl(url)].forEach(function (candidate) {
        if (candidate && !seen[candidate]) {
          seen[candidate] = true;
          candidates.push(candidate);
        }
      });
    });

    return candidates;
  }

  function fetchWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("Request timed out"));
      }, timeoutMs);

      fetch(url)
        .then(function (response) {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(function (error) {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  function parseTitleAndSource(item) {
    var rawTitle = stripHtml(item.title);
    var source = "";

    if (item.author) {
      source = stripHtml(item.author);
    }

    if (!source) {
      var titleParts = rawTitle.split(" - ");

      if (titleParts.length > 1) {
        var maybeSource = titleParts[titleParts.length - 1].trim();

        if (maybeSource && maybeSource.length <= 20) {
          source = maybeSource;
          rawTitle = titleParts.slice(0, -1).join(" - ").trim();
        }
      }
    }

    if (!source) {
      source = extractSourceFromLink(item.originallink || item.link || "");
    }

    return {
      title: rawTitle,
      source: source || "뉴스",
    };
  }

  function extractSourceFromLink(link) {
    try {
      var hostname = new URL(link).hostname.replace(/^www\./, "");
      var key = hostname.split(".")[0].toLowerCase();

      if (SOURCE_MAP[key]) {
        return SOURCE_MAP[key];
      }

      if (hostname.indexOf("naver.com") !== -1) {
        return "네이버뉴스";
      }

      return hostname;
    } catch (error) {
      return "뉴스";
    }
  }

  function formatRelativeTime(pubDate) {
    var date = new Date(pubDate);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    var diffMs = Date.now() - date.getTime();
    var diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) {
      return "방금 전";
    }

    if (diffMin < 60) {
      return diffMin + "분 전";
    }

    var diffHour = Math.floor(diffMin / 60);

    if (diffHour < 24) {
      return diffHour + "시간 전";
    }

    var diffDay = Math.floor(diffHour / 24);

    if (diffDay < 7) {
      return diffDay + "일 전";
    }

    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  }

  function buildCardHtml(item, index) {
    var parsed = parseTitleAndSource(item);
    var title = escapeHtml(parsed.title);
    var source = escapeHtml(parsed.source);
    var when = escapeHtml(formatRelativeTime(item.pubDate));
    var link = item.originallink || item.link || "#";
    var imageClass = "news-img-" + ((index % 3) + 1);

    return (
      "<li>" +
      '<a href="' +
      escapeHtml(link) +
      '" target="_blank" rel="noopener noreferrer" aria-label="' +
      title +
      ' 기사 열기">' +
      '<article class="news-card card">' +
      '<div class="news-img ' +
      imageClass +
      '" role="img" aria-label="뉴스 썸네일"></div>' +
      '<div class="news-body">' +
      '<h3 class="news-name">' +
      title +
      "</h3>" +
      '<div class="news-info">' +
      '<div class="news-from">' +
      source +
      "</div>" +
      '<div class="news-when">' +
      when +
      "</div>" +
      "</div>" +
      "</div>" +
      "</article>" +
      "</a>" +
      "</li>"
    );
  }

  function applyImageToCard(index, imageUrl) {
    if (!isUsableImageUrl(imageUrl)) {
      return;
    }

    var cards = newsList.querySelectorAll(".news-card");

    if (!cards[index]) {
      return;
    }

    var imageWrap = cards[index].querySelector(".news-img");

    if (!imageWrap || imageWrap.querySelector(".news-img-photo")) {
      return;
    }

    var img = document.createElement("img");
    img.className = "news-img-photo";
    img.src = imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.remove();
      imageWrap.classList.remove("has-photo");
    });
    img.addEventListener("load", function () {
      imageWrap.classList.add("has-photo");
    });

    imageWrap.appendChild(img);
  }

  async function fetchArticleImageFromApi(articleUrl) {
    var response = await fetchWithTimeout(
      "/api/article-image?url=" + encodeURIComponent(articleUrl),
      8000
    );

    if (!response.ok) {
      throw new Error("Article image API unavailable");
    }

    var data = await response.json();
    return data.imageUrl || null;
  }

  async function fetchArticleImageFromMicrolink(articleUrl) {
    var response = await fetchWithTimeout(
      "https://api.microlink.io/?url=" + encodeURIComponent(articleUrl),
      10000
    );

    if (!response.ok) {
      throw new Error("Microlink unavailable");
    }

    var data = await response.json();

    if (data.status === "success" && data.data && data.data.image) {
      return data.data.image.url || null;
    }

    return null;
  }

  async function fetchImageFromUrl(articleUrl) {
    if (!articleUrl || isLikelyNoImageHost(articleUrl)) {
      return null;
    }

    try {
      var apiImage = await fetchArticleImageFromApi(articleUrl);

      if (isUsableImageUrl(apiImage)) {
        return apiImage;
      }
    } catch (apiError) {
      /* API 미사용 환경에서는 Microlink로 폴백 */
    }

    try {
      var microImage = await fetchArticleImageFromMicrolink(articleUrl);

      if (isUsableImageUrl(microImage)) {
        return microImage;
      }
    } catch (microError) {
      return null;
    }

    return null;
  }

  async function fetchArticleImage(item) {
    var descriptionImage = extractImageFromDescription(item.description);

    if (isUsableImageUrl(descriptionImage)) {
      return descriptionImage;
    }

    if (isUsableImageUrl(item.imageUrl)) {
      return item.imageUrl;
    }

    if (isUsableImageUrl(item.thumbnail)) {
      return item.thumbnail;
    }

    var candidates = getItemUrlCandidates(item);

    for (var i = 0; i < candidates.length; i += 1) {
      var imageUrl = await fetchImageFromUrl(candidates[i]);

      if (isUsableImageUrl(imageUrl)) {
        return imageUrl;
      }
    }

    return null;
  }

  async function prepareDisplayItems(items) {
    var candidates = items.slice(0, NEWS_FETCH_COUNT);
    var enriched = [];

    for (var i = 0; i < candidates.length; i += 1) {
      var item = candidates[i];
      var imageUrl =
        item.imageUrl ||
        item.thumbnail ||
        extractImageFromDescription(item.description);

      if (!isUsableImageUrl(imageUrl)) {
        var urlCandidates = getItemUrlCandidates(item);
        var canFetch = urlCandidates.some(function (url) {
          return !isLikelyNoImageHost(url);
        });

        if (canFetch) {
          imageUrl = await fetchArticleImage(item);
        }
      }

      enriched.push({
        title: item.title,
        link: item.link,
        originallink: item.originallink || item.link,
        pubDate: item.pubDate,
        author: item.author,
        description: item.description,
        imageUrl: isUsableImageUrl(imageUrl) ? imageUrl : null,
      });

      var withImageCount = enriched.filter(function (entry) {
        return isUsableImageUrl(entry.imageUrl);
      }).length;

      if (withImageCount >= NEWS_COUNT) {
        for (var j = i + 1; j < candidates.length; j += 1) {
          var rest = candidates[j];
          var restImage =
            rest.imageUrl ||
            rest.thumbnail ||
            extractImageFromDescription(rest.description);

          enriched.push({
            title: rest.title,
            link: rest.link,
            originallink: rest.originallink || rest.link,
            pubDate: rest.pubDate,
            author: rest.author,
            description: rest.description,
            imageUrl: isUsableImageUrl(restImage) ? restImage : null,
          });
        }

        break;
      }
    }

    enriched.sort(function (a, b) {
      var aHasImage = isUsableImageUrl(a.imageUrl) ? 1 : 0;
      var bHasImage = isUsableImageUrl(b.imageUrl) ? 1 : 0;

      if (bHasImage !== aHasImage) {
        return bHasImage - aHasImage;
      }

      return 0;
    });

    return enriched.slice(0, NEWS_COUNT);
  }

  function attachImages(items) {
    items.forEach(function (item, index) {
      if (isUsableImageUrl(item.imageUrl)) {
        applyImageToCard(index, item.imageUrl);
      }
    });
  }

  function renderLoading() {
    var skeleton = "";

    for (var i = 0; i < NEWS_COUNT; i += 1) {
      var imageClass = "news-img-" + ((i % 3) + 1);
      skeleton +=
        "<li>" +
        '<article class="news-card card">' +
        '<div class="news-img ' +
        imageClass +
        '" role="img" aria-label="뉴스 썸네일"></div>' +
        '<div class="news-body">' +
        '<h3 class="news-name">뉴스 불러오는 중...</h3>' +
        '<div class="news-info">' +
        '<div class="news-from">—</div>' +
        '<div class="news-when">—</div>' +
        "</div>" +
        "</div>" +
        "</article>" +
        "</li>";
    }

    newsList.innerHTML = skeleton;
  }

  function renderError() {
    newsList.innerHTML =
      "<li>" +
      '<article class="news-card card">' +
      '<div class="news-body">' +
      '<h3 class="news-name">뉴스를 불러오지 못했습니다.</h3>' +
      '<div class="news-info">' +
      '<div class="news-from">잠시 후 다시 시도해주세요.</div>' +
      "</div>" +
      "</div>" +
      "</article>" +
      "</li>";
  }

  function renderNews(items) {
    if (!items.length) {
      renderError();
      return;
    }

    newsList.innerHTML = items
      .map(function (item, index) {
        return buildCardHtml(item, index);
      })
      .join("");

    attachImages(items);
  }

  function normalizeRssItems(items) {
    return items.map(function (item) {
      return {
        title: item.title,
        link: item.link,
        originallink: item.link,
        pubDate: item.pubDate,
        author: item.author,
        description: item.description,
        thumbnail: item.thumbnail,
      };
    });
  }

  async function loadFromNaverApi() {
    var response = await fetch(
      "/api/naver-news?query=" +
        encodeURIComponent(NEWS_QUERY) +
        "&display=" +
        NEWS_FETCH_COUNT
    );

    if (!response.ok) {
      throw new Error("Naver API unavailable");
    }

    var data = await response.json();
    return data.items || [];
  }

  async function loadFromRssFallback() {
    var rssUrl =
      "https://www.bing.com/news/search?q=" +
      encodeURIComponent(NEWS_QUERY) +
      "&format=rss";
    var response = await fetch(
      "https://api.rss2json.com/v1/api.json?rss_url=" +
        encodeURIComponent(rssUrl)
    );

    if (!response.ok) {
      throw new Error("RSS fallback unavailable");
    }

    var data = await response.json();

    if (data.status !== "ok") {
      throw new Error("RSS fallback failed");
    }

    return normalizeRssItems(data.items || []);
  }

  async function loadNews() {
    renderLoading();

    try {
      var items;

      try {
        items = await loadFromNaverApi();
      } catch (naverError) {
        items = await loadFromRssFallback();
      }

      var displayItems = await prepareDisplayItems(items);
      renderNews(displayItems);
    } catch (error) {
      renderError();
    }
  }

  if (newsMoreLink) {
    newsMoreLink.href =
      "https://search.naver.com/search.naver?where=news&query=" +
      encodeURIComponent(NEWS_QUERY);
    newsMoreLink.target = "_blank";
    newsMoreLink.rel = "noopener noreferrer";
  }

  loadNews();
})();

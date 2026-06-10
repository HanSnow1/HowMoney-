(function () {
  "use strict";
  var newsSection = document.querySelector("[data-news-feed]");
  var newsList = document.querySelector(".news-list");
  var newsMoreLink = document.querySelector(".news-all");
  var NEWS_QUERY =
    (newsSection && newsSection.dataset.newsQuery) || "아르바이트";
  var NEWS_DISPLAY = parseInt(
    (newsSection && newsSection.dataset.newsDisplay) || "3",
    10
  );
  if (!newsList) {
    return;
  }
  function stripHtml(text) {
    var container = document.createElement("div");
    container.innerHTML = text || "";
    return container.textContent || container.innerText || "";
  }
  function formatNewsDate(pubDate) {
    var date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) {
      return "네이버 뉴스";
    }
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  }
  function clearNewsList() {
    while (newsList.firstChild) {
      newsList.removeChild(newsList.firstChild);
    }
  }
  function createNewsCard(item, index) {
    var title = stripHtml(item.title);
    var description = stripHtml(item.description);
    var link = item.originallink || item.link || "#";
    var imageClass = "news-img-" + ((index % 3) + 1);
    var li = document.createElement("li");
    var anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.setAttribute("aria-label", title + " 기사 열기");
    var article = document.createElement("article");
    article.className = "news-card card";
    var image = document.createElement("div");
    image.className = "news-img " + imageClass;
    image.setAttribute("role", "img");
    image.setAttribute("aria-label", "뉴스 썸네일");
    var body = document.createElement("div");
    body.className = "news-body";
    var heading = document.createElement("h3");
    heading.className = "news-name";
    heading.textContent = title;
    var info = document.createElement("div");
    info.className = "news-info";
    var from = document.createElement("div");
    from.className = "news-from";
    from.textContent = description || "네이버 뉴스";
    var when = document.createElement("div");
    when.className = "news-when";
    when.textContent = formatNewsDate(item.pubDate);
    info.appendChild(from);
    info.appendChild(when);
    body.appendChild(heading);
    body.appendChild(info);
    article.appendChild(image);
    article.appendChild(body);
    anchor.appendChild(article);
    li.appendChild(anchor);
    return li;
  }
  function renderError() {
    clearNewsList();
    var li = document.createElement("li");
    var article = document.createElement("article");
    var body = document.createElement("div");
    var heading = document.createElement("h3");
    var info = document.createElement("div");
    var from = document.createElement("div");
    article.className = "news-card card";
    body.className = "news-body";
    heading.className = "news-name";
    info.className = "news-info";
    from.className = "news-from";
    heading.textContent = "뉴스를 불러오지 못했습니다.";
    from.textContent = "잠시 후 다시 시도해주세요.";
    info.appendChild(from);
    body.appendChild(heading);
    body.appendChild(info);
    article.appendChild(body);
    li.appendChild(article);
    newsList.appendChild(li);
  }
  function renderNews(items) {
    clearNewsList();
    if (!items.length) {
      renderError();
      return;
    }
    items.forEach(function (item, index) {
      newsList.appendChild(createNewsCard(item, index));
    });
  }
  async function loadNews() {
    try {
      var response = await fetch(
        "/api/naver-news?query=" +
          encodeURIComponent(NEWS_QUERY) +
          "&display=" +
          NEWS_DISPLAY
      );
      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }
      var data = await response.json();
      renderNews(data.items || []);
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

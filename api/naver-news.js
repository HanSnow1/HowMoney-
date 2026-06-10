const DEFAULT_QUERY = "아르바이트";
const DEFAULT_DISPLAY = 12;

const articleImage = require("./article-image");

function getQueryParam(value, fallback) {
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }

  return value || fallback;
}

function getItemUrlCandidates(item) {
  const seen = new Set();
  const urls = [];

  [item.originallink, item.link].forEach((url) => {
    if (!url) {
      return;
    }

    articleImage.getArticleUrlCandidates(url).forEach((candidate) => {
      if (!seen.has(candidate)) {
        seen.add(candidate);
        urls.push(candidate);
      }
    });
  });

  return urls;
}

async function fetchImageForItem(item) {
  const descriptionImage = articleImage.extractImageFromDescription(
    item.description
  );

  if (articleImage.isUsableImageUrl(descriptionImage)) {
    return descriptionImage;
  }

  return articleImage.fetchArticleImageFromCandidates(getItemUrlCandidates(item));
}

module.exports = async function handler(req, res) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      message: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경변수가 없습니다.",
    });
  }

  const query = getQueryParam(req.query.query, DEFAULT_QUERY);
  const display = getQueryParam(req.query.display, String(DEFAULT_DISPLAY));

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", display);
  url.searchParams.set("sort", "date");

  try {
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "네이버 뉴스 API 요청에 실패했습니다.",
        details: data,
      });
    }

    const items = await Promise.all(
      (data.items || []).map(async (item) => {
        const imageUrl = await fetchImageForItem(item);

        return {
          ...item,
          imageUrl,
        };
      })
    );

    return res.status(200).json({
      items,
    });
  } catch (error) {
    return res.status(500).json({
      message: "뉴스를 불러오는 중 오류가 발생했습니다.",
    });
  }
};

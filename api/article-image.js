function getQueryParam(value, fallback) {
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }

  return value || fallback;
}

function resolveArticleUrl(url) {
  try {
    const parsed = new URL(url);
    const embedded = parsed.searchParams.get("url");

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

  const blockedPatterns = [
    "J6_coFbogxhRI9iM864NL",
    "/common/common_og_",
    "yonhapnews_logo",
    "/favicon",
    "logo_1200x800",
  ];

  return !blockedPatterns.some((pattern) => imageUrl.indexOf(pattern) !== -1);
}

function extractImageFromDescription(description) {
  if (!description) {
    return null;
  }

  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, "&") : null;
}

function findJsonLdImage(data) {
  if (!data) {
    return null;
  }

  if (typeof data === "string" && /^https?:\/\//.test(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      const found = findJsonLdImage(entry);
      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof data === "object") {
    if (data.image) {
      return findJsonLdImage(data.image);
    }

    if (data.thumbnailUrl) {
      return findJsonLdImage(data.thumbnailUrl);
    }

    if (data["@graph"]) {
      return findJsonLdImage(data["@graph"]);
    }

    if (data.url && typeof data.url === "string") {
      return data.url;
    }
  }

  return null;
}

function extractImageFromJsonLd(html) {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  if (!scripts) {
    return null;
  }

  for (const script of scripts) {
    try {
      const jsonText = script.replace(/<\/?script[^>]*>/gi, "");
      const data = JSON.parse(jsonText);
      const image = findJsonLdImage(data);

      if (isUsableImageUrl(image)) {
        return image;
      }
    } catch (error) {
      /* JSON-LD 파싱 실패 시 다음 스크립트 시도 */
    }
  }

  return null;
}

function extractOgImage(html) {
  const patterns = [
    /property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+itemprop=["']image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      const imageUrl = match[1].replace(/&amp;/g, "&");

      if (isUsableImageUrl(imageUrl)) {
        return imageUrl;
      }
    }
  }

  return extractImageFromJsonLd(html);
}

function getArticleUrlCandidates(url) {
  const candidates = [];
  const seen = new Set();

  [url, resolveArticleUrl(url)].forEach((candidate) => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  });

  return candidates;
}

async function fetchArticleImage(url) {
  const articleUrl = resolveArticleUrl(url);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractOgImage(html);
  } catch (error) {
    return null;
  }
}

async function fetchArticleImageFromCandidates(urls) {
  for (const url of urls) {
    const imageUrl = await fetchArticleImage(url);

    if (isUsableImageUrl(imageUrl)) {
      return imageUrl;
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  const url = getQueryParam(req.query.url, "");

  if (!url) {
    return res.status(400).json({
      message: "url 파라미터가 필요합니다.",
      imageUrl: null,
    });
  }

  const imageUrl = await fetchArticleImageFromCandidates(getArticleUrlCandidates(url));

  return res.status(200).json({
    imageUrl,
    articleUrl: resolveArticleUrl(url),
  });
};

module.exports.resolveArticleUrl = resolveArticleUrl;
module.exports.isUsableImageUrl = isUsableImageUrl;
module.exports.extractOgImage = extractOgImage;
module.exports.extractImageFromDescription = extractImageFromDescription;
module.exports.getArticleUrlCandidates = getArticleUrlCandidates;
module.exports.fetchArticleImageFromCandidates = fetchArticleImageFromCandidates;

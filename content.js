function getArticleContent() {
  const article = document.querySelector("article");
  let content = { text: "", media: [] };

  if (article) {
    content.text = article.innerText;
    // Extract images and videos from article
    const images = article.querySelectorAll("img");
    const videos = article.querySelectorAll("video, iframe[src*='youtube.com'], iframe[src*='vimeo.com']");

    images.forEach(img => {
      if (img.src) {
        content.media.push({
          type: 'image',
          src: img.src,
          alt: img.alt || ''
        });
      }
    });

    videos.forEach(video => {
      let src = video.tagName.toLowerCase() === 'iframe' ? video.src : video.currentSrc;
      if (src) {
        content.media.push({
          type: 'video',
          src: src
        });
      }
    });
  } else {
    // fallback
    const paragraphs = Array.from(document.querySelectorAll("p"));
    content.text = paragraphs.map((p) => p.innerText).join("\n");
    
    // Extract media from the entire document
    const images = document.querySelectorAll("img");
    const videos = document.querySelectorAll("video, iframe[src*='youtube.com'], iframe[src*='vimeo.com']");

    images.forEach(img => {
      if (img.src) {
        content.media.push({
          type: 'image',
          src: img.src,
          alt: img.alt || ''
        });
      }
    });

    videos.forEach(video => {
      let src = video.tagName.toLowerCase() === 'iframe' ? video.src : video.currentSrc;
      if (src) {
        content.media.push({
          type: 'video',
          src: src
        });
      }
    });
  }

  return content;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ARTICLE_TEXT") {
    const content = getArticleContent();
    sendResponse(content);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  let currentUtterance = null;
  let isPlaying = false;

  // Load saved settings
  chrome.storage.sync.get(['defaultLanguage', 'ttsVoice'], (result) => {
    if (result.defaultLanguage) {
      document.getElementById('summary-language').value = result.defaultLanguage;
    }
  });

  document.getElementById('summarize').addEventListener('click', () => {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

    const summaryType = document.getElementById('summary-type').value;
    const targetLanguage = document.getElementById('summary-language').value;

    chrome.storage.sync.get(['geminiApiKey'], async (result) => {
      if (!result.geminiApiKey) {
        resultDiv.innerHTML = 'API key not found. Please set your API key in the extension options.';
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_ARTICLE_TEXT' }, async (res) => {
          if (!res || !res.text) {
            resultDiv.innerText = 'Could not extract article text from this page.';
            return;
          }

          try {
            const summary = await getGeminiSummary(res.text, summaryType, targetLanguage, result.geminiApiKey);
            
            // Create container for summary and media
            let contentHTML = `<div class="summary-text">${summary}</div>`;
            
            // Add media content if available
            if (res.media && res.media.length > 0) {
              contentHTML += '<div class="media-container">';
              res.media.forEach(item => {
                if (item.type === 'image') {
                  contentHTML += `
                    <div class="media-item">
                      <img src="${item.src}" alt="${item.alt}" class="media-item-img" 
                          onerror="this.onerror=null; this.src='icon.png'; this.classList.add('fallback-img');"
                          loading="lazy"/>
                    </div>`;
                } else if (item.type === 'video') {
                  contentHTML += `<div class="media-item"><iframe src="${item.src}" class="media-item" allowfullscreen></iframe></div>`;
                }
              });
              contentHTML += '</div>';
            }
            
            resultDiv.innerHTML = contentHTML;
            setupAudioControls(summary);
          } catch (error) {
            resultDiv.innerText = `Error: ${error.message || 'Failed to generate summary.'}`;
          }
        });
      });
    });
  });

  async function getGeminiSummary(text, summaryType, targetLanguage, apiKey) {
    const maxLength = 20000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    let prompt;
    const languageMap = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'kn': 'Kannada',
      'ta': 'Tamil',
      'ml': 'Malayalam',
      'mr': 'Marathi',
      'gu': 'Gujarati',
      'bn': 'Bengali',
      'pa': 'Punjabi'
    };

    switch (summaryType) {
      case 'brief':
        prompt = `Provide a brief summary of the following article in ${languageMap[targetLanguage]} using 2-3 sentences:\n\n${truncatedText}`;
        break;
      case 'detailed':
        prompt = `Provide a detailed summary of the following article in ${languageMap[targetLanguage]}, covering all main points and key details:\n\n${truncatedText}`;
        break;
      case 'bullets':
        prompt = `Summarize the following article in ${languageMap[targetLanguage]} using 5-7 key points. Format each point as a line starting with "- " (dash followed by a space). Do not use asterisks or other bullet symbols, only use the dash. Keep each point concise and focused on a single key insight from the article:\n\n${truncatedText}`;
        break;
      default:
        prompt = `Summarize the following article in ${languageMap[targetLanguage]}:\n\n${truncatedText}`;
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available.';
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to generate summary. Please try again later.');
    }
  }

  function setupAudioControls(text) {
    const playBtn = document.getElementById('play-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const progressBar = document.getElementById('audio-progress');
    const timeDisplay = document.getElementById('time-display');

    // Stop any existing speech
    if (currentUtterance) {
      window.speechSynthesis.cancel();
      currentUtterance = null;
      isPlaying = false;
    }

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    chrome.storage.sync.get(['ttsVoice', 'defaultLanguage'], (result) => {
      const voices = window.speechSynthesis.getVoices();
      if (result.ttsVoice) {
        const selectedVoice = voices.find(voice => voice.name === result.ttsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        }
      } else if (result.defaultLanguage) {
        // Language code mapping with primary language codes
        const languageMap = {
          'en': { codes: ['en-US', 'en-GB', 'en'], primary: 'en-US' },
          'hi': { codes: ['hi-IN', 'hi'], primary: 'hi-IN' },
          'te': { codes: ['te-IN', 'te'], primary: 'te-IN' },
          'kn': { codes: ['kn-IN', 'kn'], primary: 'kn-IN' },
          'ta': { codes: ['ta-IN', 'ta'], primary: 'ta-IN' },
          'ml': { codes: ['ml-IN', 'ml'], primary: 'ml-IN' },
          'mr': { codes: ['mr-IN', 'mr'], primary: 'mr-IN' },
          'gu': { codes: ['gu-IN', 'gu'], primary: 'gu-IN' },
          'bn': { codes: ['bn-IN', 'bn'], primary: 'bn-IN' },
          'pa': { codes: ['pa-IN', 'pa'], primary: 'pa-IN' }
        };
        const languageConfig = languageMap[result.defaultLanguage] || { codes: [], primary: '' };
        const matchingVoice = voices.find(voice => {
          const voiceLang = voice.lang.toLowerCase();
          return languageConfig.codes.some(code =>
            voiceLang === code.toLowerCase() ||
            voiceLang.startsWith(code.toLowerCase())
          );
        });
        
        // Set utterance language to primary language code even if no matching voice found
        utterance.lang = languageConfig.primary || result.defaultLanguage;
        if (matchingVoice) {
          utterance.voice = matchingVoice;
          utterance.lang = matchingVoice.lang;
        }
      }
    });

    // Update progress
    let progressInterval;
    let startTime;
    let pausedTime = 0;
    let lastElapsedTime = 0;

    utterance.onstart = () => {
      startTime = Date.now();
      progressInterval = setInterval(() => {
        if (isPlaying) {
          const currentTime = Date.now();
          const elapsedTime = ((currentTime - startTime) + pausedTime) / 1000;
          lastElapsedTime = elapsedTime;
          const progress = (elapsedTime / utterance.duration) * 100;
          progressBar.style.width = `${Math.min(progress, 100)}%`;
          progressBar.style.transition = 'width 0.1s linear';
          timeDisplay.textContent = formatTime(elapsedTime);
        }
      }, 50);
    };

    utterance.onend = () => {
      clearInterval(progressInterval);
      isPlaying = false;
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      progressBar.style.width = '0%';
      progressBar.style.transition = 'width 0.3s ease';
      timeDisplay.textContent = '00:00';
      currentUtterance = null;
      pausedTime = 0;
      lastElapsedTime = 0;
    };

    utterance.onpause = () => {
      clearInterval(progressInterval);
      pausedTime += Date.now() - startTime;
    };

    utterance.onresume = () => {
      startTime = Date.now();
      progressInterval = setInterval(() => {
        if (isPlaying) {
          const currentTime = Date.now();
          const elapsedTime = ((currentTime - startTime) + pausedTime) / 1000;
          lastElapsedTime = elapsedTime;
          const progress = (elapsedTime / utterance.duration) * 100;
          progressBar.style.width = `${Math.min(progress, 100)}%`;
          progressBar.style.transition = 'width 0.1s linear';
          timeDisplay.textContent = formatTime(elapsedTime);
        }
      }, 50);
    };

    playBtn.onclick = () => {
      if (!isPlaying) {
        if (!currentUtterance) {
          currentUtterance = utterance;
          window.speechSynthesis.speak(utterance);
        } else {
          window.speechSynthesis.resume();
        }
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      } else {
        window.speechSynthesis.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
      isPlaying = !isPlaying;
    };
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
});

// Share functionality
document.getElementById("share-btn").addEventListener("click", () => {
  const modal = document.getElementById("share-modal");
  const overlay = document.getElementById("modal-overlay");
  modal.style.display = "block";
  overlay.style.display = "block";
});

document.getElementById("modal-overlay").addEventListener("click", () => {
  const modal = document.getElementById("share-modal");
  const overlay = document.getElementById("modal-overlay");
  modal.style.display = "none";
  overlay.style.display = "none";
});

// Social media share handlers
document.getElementById('whatsapp-share').addEventListener('click', () => {
  const summaryText = document.getElementById('result').innerText;
  if (summaryText && summaryText.trim() !== '') {
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  }
});

document.getElementById('linkedin-share').addEventListener('click', () => {
  const summaryText = document.getElementById('result').innerText;
  if (summaryText && summaryText.trim() !== '') {
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodedText}`, '_blank');
  }
});
document.getElementById("twitter-share").addEventListener("click", () => {
  const text = document.getElementById("result").innerText;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
});

document.getElementById("copy-btn").addEventListener("click", async () => {
  const summaryText = document.getElementById("result").innerText;
  const copyBtn = document.getElementById("copy-btn");

  if (summaryText && summaryText.trim() !== "") {
    try {
      await navigator.clipboard.writeText(summaryText);
      const originalText = copyBtn.innerText;
      copyBtn.style.background = "#4CAF50";
      copyBtn.innerText = "Copied!";
      
      setTimeout(() => {
        copyBtn.style.background = "linear-gradient(135deg, #2575fc, #6a11cb)";
        copyBtn.innerText = originalText;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      copyBtn.style.background = "#f44336";
      copyBtn.innerText = "Failed to copy";
      
      setTimeout(() => {
        copyBtn.style.background = "linear-gradient(135deg, #2575fc, #6a11cb)";
        copyBtn.innerText = "Copy Summary";
      }, 2000);
    }
  }
});

// Share functionality
document.getElementById("share-btn").addEventListener("click", () => {
  const modal = document.getElementById("share-modal");
  const overlay = document.getElementById("modal-overlay");
  modal.style.display = "block";
  overlay.style.display = "block";
});

document.getElementById("modal-overlay").addEventListener("click", () => {
  const modal = document.getElementById("share-modal");
  const overlay = document.getElementById("modal-overlay");
  modal.style.display = "none";
  overlay.style.display = "none";
});

// Social media share handlers
document.getElementById('whatsapp-share').addEventListener('click', () => {
  const summaryText = document.getElementById('result').innerText;
  if (summaryText && summaryText.trim() !== '') {
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  }
});

document.getElementById('linkedin-share').addEventListener('click', () => {
  const summaryText = document.getElementById('result').innerText;
  if (summaryText && summaryText.trim() !== '') {
    const encodedText = encodeURIComponent(summaryText);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodedText}`, '_blank');
  }
});
document.getElementById("twitter-share").addEventListener("click", () => {
  const text = document.getElementById("result").innerText;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
});

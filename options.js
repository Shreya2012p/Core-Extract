document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings
  chrome.storage.sync.get(["geminiApiKey", "defaultLanguage", "ttsVoice"], (result) => {
    if (result.geminiApiKey) {
      document.getElementById("api-key").value = result.geminiApiKey;
    }
    if (result.defaultLanguage) {
      document.getElementById("default-language").value = result.defaultLanguage;
    }
    if (result.ttsVoice) {
      document.getElementById("tts-voice").value = result.ttsVoice;
    }
  });

  // Populate available TTS voices grouped by language
  if ('speechSynthesis' in window) {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const ttsVoiceSelect = document.getElementById("tts-voice");
      const selectedLanguage = document.getElementById("default-language").value;
      
      // Clear existing options
      ttsVoiceSelect.innerHTML = '<option value="">Default Voice</option>';
      
      // Language code and alternative code mapping with primary language codes
      const languageMap = {
        'en': { codes: ['en-US', 'en-GB', 'en'], primary: 'en-US' },
        'hi': { codes: ['hi-IN', 'hi'], primary: 'hi-IN' },
        'te': { codes: ['te-IN', 'te'], primary: 'te-IN' },
        'kn': { codes: ['kn-IN', 'kn'], primary: 'kn-IN' }
      };
      
      // Filter voices based on selected language
      const languageConfig = languageMap[selectedLanguage] || { codes: [], primary: '' };
      const filteredVoices = voices.filter(voice => {
        const voiceLang = voice.lang.toLowerCase();
        return languageConfig.codes.some(code => 
          voiceLang === code.toLowerCase() || 
          voiceLang.startsWith(code.toLowerCase())
        );
      });

      // Sort voices to prioritize the primary language code
      filteredVoices.sort((a, b) => {
        const aPrimary = a.lang.toLowerCase() === languageConfig.primary.toLowerCase();
        const bPrimary = b.lang.toLowerCase() === languageConfig.primary.toLowerCase();
        return bPrimary - aPrimary;
      });
      
      filteredVoices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        ttsVoiceSelect.appendChild(option);
      });

      // If no voices found for the selected language, show all voices
      if (filteredVoices.length === 0) {
        voices.forEach(voice => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang})`;
          ttsVoiceSelect.appendChild(option);
        });
      }
    };
  }

  // Save settings when button is clicked
  document.getElementById("save-button").addEventListener("click", () => {
    const apiKey = document.getElementById("api-key").value.trim();
    const defaultLanguage = document.getElementById("default-language").value;
    const ttsVoice = document.getElementById("tts-voice").value;

    if (apiKey) {
      chrome.storage.sync.set({
        geminiApiKey: apiKey,
        defaultLanguage: defaultLanguage,
        ttsVoice: ttsVoice
      }, () => {
        const successMessage = document.getElementById("success-message");
        successMessage.style.display = "block";

        setTimeout(() => {
          window.close();
          chrome.tabs.getCurrent((tab) => {
            if (tab) {
              chrome.tabs.remove(tab.id);
            }
          });
        }, 1000);
      });
    }
  });
});

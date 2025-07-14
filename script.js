document.addEventListener('DOMContentLoaded', () => {
    // --- URL Parameter Handling ---
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    function encodeWord(word) {
        return btoa(word).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    
    function decodeWord(encodedWord) {
        try {
            // Add padding if needed
            let padded = encodedWord.replace(/-/g, '+').replace(/_/g, '/');
            while (padded.length % 4) {
                padded += '=';
            }
            return atob(padded);
        } catch (error) {
            return null;
        }
    }
    
    // Check if there's a shared word in URL
    const sharedWordParam = getUrlParameter('w');
    let predeterminedWord = null;
    
    if (sharedWordParam) {
        const decodedWord = decodeWord(sharedWordParam);
        if (decodedWord && decodedWord.length >= 6) {
            predeterminedWord = decodedWord.toLowerCase(); // Store in lowercase for consistency
            
            // Update start screen to show the challenge
            const startScreenDesc = document.querySelector('#start-screen p:first-of-type');
            if (startScreenDesc) {
                startScreenDesc.innerHTML = `<strong>Challenge Mode!</strong><br>Your friend wants you to nestword: <span class="text-green-400 font-bold text-xl">${predeterminedWord.toUpperCase()}</span><br>How many words can you find?`;
            }
        }
    }

    // --- Dynamic Tips System ---
    const gameTips = [
        "💡 Hint: Fill the progress bar by submitting words to earn +2 seconds!",
        "💡 Hint: Longer words fill the progress bar faster!",
        "💡 Hint: Plurals oftentimes don't work.",
        "💡 Hint: Try rearranging letters to spot hidden words!",
        "🥚 Egg: You found a rare Easter egg! ...or not, to be honest. Just a roll of the dice.",
        "💡 Hint: Every letter counts toward your progress bar!",
        "💡 Fact: The text library used for this minigame is from Bookworm Adventures.",
        "💡 Hint: Type letters directly using the keyboard or click the tiles. Both work!",
        "💡 Hint: Win the game by guessing all the words before the timer runs out.",
        "💡 Hint: You can submit the whole word at once. Bonus +2 seconds!",
    ];
    
    // Select random tip and update the HTML
    const randomTip = gameTips[Math.floor(Math.random() * gameTips.length)];
    const tipElement = document.querySelector('#start-screen p.text-gray-300');
    if (tipElement) {
        tipElement.textContent = randomTip;
    }

    // --- DOM Elements ---
    const playButton = document.getElementById('play-button');
    const restartButton = document.getElementById('restart-button');
    const startScreen = document.getElementById('start-screen');
    const gameArea = document.getElementById('game-area');
    const endScreen = document.getElementById('end-screen');
    const letterTilesContainer = document.getElementById('letter-tiles');
    const wordInput = document.getElementById('word-input');
    const submitButton = document.getElementById('submit-button');
    const clearButton = document.getElementById('clear-button');
    const timerDisplay = document.getElementById('timer').querySelector('span');
    const scoreDisplay = document.getElementById('score').querySelector('span');
    const foundWordsList = document.getElementById('found-words-list');
    const finalScoreDisplay = document.getElementById('final-score');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const shareButton = document.getElementById('share-button');

    // --- Game State ---
    let dictionary = new Set();
    const potentialSourceWords = [];
    let currentSourceWord = '';
    let foundWords = new Set();
    let possibleWords = new Set();
    let timer;
    let timeLeft = 30;
    let usedTiles = [];
    let gameActive = false;
    let currentProgress = 0;
    let maxProgress = 10; // Will be set to source word length
    let canRestart = true; // Controls whether restart is allowed

    // --- Dictionary Loading ---
    async function loadDictionary() {
        try {
            const response = await fetch('words.txt');
            const text = await response.text();
            const allWords = text.split('\n');
            
            allWords.forEach(wordRaw => {
                const word = wordRaw.trim();
                if (word.length > 0) {
                    dictionary.add(word); // Add every word to the main dictionary

                    // If the word is between 8 and 12 letters, add it as a potential source word
                    if (word.length >= 8 && word.length <= 12) {
                        potentialSourceWords.push(word);
                    }
                }
            });

            // If we have a predetermined word, ensure it's in the dictionary and potentialSourceWords
            if (predeterminedWord) {
                // Add to dictionary if not already there
                if (!dictionary.has(predeterminedWord)) {
                    dictionary.add(predeterminedWord);
                }
                
                // Add to potentialSourceWords if not already there and meets criteria
                if (predeterminedWord.length >= 6 && !potentialSourceWords.includes(predeterminedWord)) {
                    potentialSourceWords.push(predeterminedWord);
                }
            }

            playButton.disabled = false;
            playButton.innerHTML = 'Play <span class="text-xs opacity-75">[Enter]</span>';
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            playButton.innerHTML = 'Failed to load dictionary';
        }
    }
    
    // --- Game Logic ---
    function selectSourceWord() {
        // Use predetermined word if available, otherwise select random
        if (predeterminedWord) {
            const word = predeterminedWord;
            predeterminedWord = null; // Use it only once, then fall back to random
            return word;
        }
        
        // Select a random word from our list of potential source words
        return potentialSourceWords[Math.floor(Math.random() * potentialSourceWords.length)];
    }

    function findAllPossibleWords(sourceWord) {
        const possible = new Set();
        
        // Check every word in dictionary
        for (const word of dictionary) {
            if (word.length >= 4 && canBeFormed(word, sourceWord)) {
                possible.add(word);
            }
        }
        
        // console.log(Array.from(possible).sort());
        return possible;
    }

    function startGame() {
        // Reset state
        timeLeft = 30;
        foundWords.clear();
        gameActive = true;
        currentProgress = 0;
        
        currentSourceWord = selectSourceWord();
        maxProgress = currentSourceWord.length; // Set progress bar to word length
        possibleWords = findAllPossibleWords(currentSourceWord);
        updateUI();
        
        displayLetterTiles(currentSourceWord);

        // Show/hide screens
        startScreen.classList.add('hidden');
        endScreen.classList.add('hidden');
        gameArea.classList.remove('hidden');

        wordInput.value = '';
        wordInput.focus();
        
        // Start timer
        timer = setInterval(updateTimer, 1000);
    }

    function endGame() {
        gameActive = false;
        canRestart = false; // Disable restart initially
        clearInterval(timer);
        finalScoreDisplay.textContent = `${foundWords.size} / ${possibleWords.size}`;
        gameArea.classList.add('hidden');
        endScreen.classList.remove('hidden');
        
        // Disable restart button and show countdown
        restartButton.disabled = true;
        let countdown = 3;
        restartButton.textContent = `Play Again (${countdown})`;
        
        const countdownTimer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                restartButton.textContent = `Play Again (${countdown})`;
            } else {
                // Enable restart after 3 seconds
                canRestart = true;
                restartButton.disabled = false;
                restartButton.innerHTML = 'Play Again <span class="text-sm opacity-75">[Enter]</span>';
                clearInterval(countdownTimer);
            }
        }, 1000);
    }

    function updateTimer() {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }
    
    function updateUI() {
        scoreDisplay.textContent = `${foundWords.size} / ${possibleWords.size}`;
        foundWordsList.innerHTML = '';
        Array.from(foundWords).sort().forEach(word => {
            const li = document.createElement('li');
            li.classList.add('bg-green-400', 'text-gray-900', 'py-1', 'px-2.5', 'rounded', 'font-bold');
            li.textContent = word;
            foundWordsList.appendChild(li);
        });
        
        // Update progress bar
        const progressPercentage = (currentProgress / maxProgress) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        progressText.textContent = `${currentProgress} / ${maxProgress}`;
        
        validateWord();
    }

    function displayLetterTiles(word) {
        letterTilesContainer.innerHTML = '';
        usedTiles = [];
        word.split('').forEach((letter, index) => {
            const tile = document.createElement('div');
            tile.classList.add('w-12', 'h-12', 'bg-gray-600', 'rounded-lg', 'flex', 'justify-center', 'items-center', 'text-3xl', 'font-bold', 'cursor-pointer', 'select-none', 'transition-all', 'duration-200', 'hover:bg-gray-500', 'hover:scale-105');
            tile.textContent = letter.toUpperCase();
            tile.dataset.index = index;
            tile.addEventListener('click', () => handleTileClick(tile, letter));
            letterTilesContainer.appendChild(tile);
        });
    }

    function handleTileClick(tile, letter) {
        if (tile.classList.contains('bg-gray-800')) return; // Check for used state

        wordInput.value += letter;
        // Remove hover classes and add used state
        tile.classList.remove('hover:bg-gray-500', 'hover:scale-105', 'bg-gray-600', 'cursor-pointer');
        tile.classList.add('bg-gray-800', 'text-gray-500', 'cursor-not-allowed', 'used');
        usedTiles.push(tile);
        validateWord();
    }

    function clearInput() {
        wordInput.value = '';
        usedTiles.forEach(tile => {
            // Reset to original state
            tile.classList.remove('bg-gray-800', 'text-gray-500', 'cursor-not-allowed', 'used');
            tile.classList.add('bg-gray-600', 'cursor-pointer', 'hover:bg-gray-500', 'hover:scale-105');
        });
        usedTiles = [];
        validateWord();
    }

    function validateWord() {
        const word = wordInput.value.toLowerCase();
        
        // Check 1: Length
        if (word.length < 3) {
            submitButton.disabled = true;
            return;
        }

        // Check 2: Uses valid letters
        if (!canBeFormed(word, currentSourceWord)) {
            submitButton.disabled = true;
            return;
        }

        // Check 3: Is in dictionary and not already found
        if (dictionary.has(word) && !foundWords.has(word)) {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    function canBeFormed(word, source) {
        let sourceLetters = source.split('');
        for (const letter of word.split('')) {
            const index = sourceLetters.indexOf(letter);
            if (index === -1) {
                return false; // Letter not in source
            }
            sourceLetters.splice(index, 1); // Use each letter only once
        }
        return true;
    }

    function updateTileStatesFromInput(inputValue) {
        // Reset all tiles to available state first
        const allTiles = letterTilesContainer.querySelectorAll('div');
        allTiles.forEach(tile => {
            tile.classList.remove('bg-gray-800', 'text-gray-500', 'cursor-not-allowed', 'used');
            tile.classList.add('bg-gray-600', 'cursor-pointer', 'hover:bg-gray-500', 'hover:scale-105');
        });
        
        // Clear the usedTiles array since we're recalculating
        usedTiles = [];
        
        // Track which letters from input need to be marked as used
        const inputLetters = inputValue.split('');
        const sourceLetters = currentSourceWord.split('');
        
        // For each letter in the input, find and disable a corresponding tile
        inputLetters.forEach(inputLetter => {
            // Find an available tile with this letter
            const availableTile = Array.from(allTiles).find(tile => {
                const tileLetter = sourceLetters[parseInt(tile.dataset.index)];
                return tileLetter === inputLetter && !tile.classList.contains('used');
            });
            
            if (availableTile) {
                // Disable this tile
                availableTile.classList.remove('hover:bg-gray-500', 'hover:scale-105', 'bg-gray-600', 'cursor-pointer');
                availableTile.classList.add('bg-gray-800', 'text-gray-500', 'cursor-not-allowed', 'used');
                usedTiles.push(availableTile);
            }
        });
    }

    function filterValidInput(inputValue) {
        // Get available letters from source word
        const availableLetters = currentSourceWord.split('');

        // Filter the input to only include valid characters
        let validInput = '';
        const inputLetters = inputValue.split('');
        const tempAvailable = [...availableLetters]; // Copy for tracking usage
        
        for (const letter of inputLetters) {
            const letterIndex = tempAvailable.indexOf(letter);
            if (letterIndex !== -1) {
                validInput += letter;
                tempAvailable.splice(letterIndex, 1); // Remove used letter
            }
            // If letter not found in available letters, skip it (don't add to validInput)
        }
        
        return validInput;
    }
    
    function submitWord() {
        const word = wordInput.value.toLowerCase();
        if (submitButton.disabled || !gameActive) return;

        foundWords.add(word);
        
        // Add progress equal to word length
        currentProgress += word.length;
        
        // Check if progress bar is full
        if (currentProgress >= maxProgress) {
            // Add 2 seconds to timer
            timeLeft += 2;
            timerDisplay.textContent = timeLeft;
            
            // Keep leftover progress (preserve overflow)
            currentProgress = currentProgress - maxProgress;
        }
        
        clearInput();
        updateUI();
    }

    function shareResults() {
        const wordsFound = foundWords.size;
        const totalWords = possibleWords.size;
        const sourceWord = currentSourceWord.toUpperCase();
        const encodedWord = encodeWord(currentSourceWord);
        
        // Create the game URL with encoded word
        const gameUrl = `${window.location.origin}${window.location.pathname}?w=${encodedWord}`;
        
        // Create the engaging tweet text
        const tweetText = `I just played #Nestword! 🪺🔠\nI nestworded ${wordsFound} out of ${totalWords} possible words from "${sourceWord}"! 🧠\n\nCan you nestword better than me?\n${gameUrl}`;
        
        // Create Twitter share URL
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        
        // Open Twitter in new tab
        window.open(twitterUrl, '_blank');
    }

    // --- Event Listeners ---
    playButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    
    wordInput.addEventListener('input', (e) => {
        // Validate each character as it's typed
        const currentValue = e.target.value.toLowerCase();
        const validValue = filterValidInput(currentValue);
        
        if (currentValue !== validValue) {
            e.target.value = validValue;
        }
        
        // Update tile states based on typed input
        updateTileStatesFromInput(validValue);
        
        validateWord();
    });
    
    wordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') submitWord();
        if (e.key === 'Escape') clearInput();
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Enter to start game when on start screen
        if (e.key === 'Enter' && !gameActive && startScreen.classList.contains('hidden') === false) {
            startGame();
        }
        // Enter to restart game when game is over (only if restart is allowed)
        if (e.key === 'Enter' && !gameActive && endScreen.classList.contains('hidden') === false && canRestart) {
            startGame();
        }
        // X to share results when game is over
        if (e.key.toLowerCase() === 'x' && !gameActive && endScreen.classList.contains('hidden') === false) {
            shareResults();
        }
        // Esc to clear input during active game
        if (e.key === 'Escape' && gameActive) {
            clearInput();
            e.preventDefault(); // Prevent default Esc behavior
        }
    });

    submitButton.addEventListener('click', submitWord);
    clearButton.addEventListener('click', clearInput);
    shareButton.addEventListener('click', shareResults);

    // --- Initial Load ---
    playButton.disabled = true;
    playButton.textContent = 'Loading Dictionary...';
    loadDictionary();
});
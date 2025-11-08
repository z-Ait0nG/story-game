// --- THIS IS YOUR NEW HELPER FUNCTION ---
function normalizeText(text) {
  
  // 1. Make it all lowercase
  let normalized = text.toLowerCase();
  
  // 2. Define our "leet speak" swaps
  const swaps = {
    '0': 'o',
    '@': 'a',
    '4': 'a',
    '3': 'e',
    '1': 'i',
    '!': 'i',
    '$': 's',
    '5': 's'
  };
  
  // 3. Loop through the swaps and replace them
  for (const char in swaps) {
    normalized = normalized.replaceAll(char, swaps[char]);
  }
  
  // 4. Squash repeating letters (e.g., "poooop" -> "pop")
  // This regex finds any character followed by itself and replaces
  // the whole group (like "aaaa") with just one ("a").
  normalized = normalized.replace(/([a-z])\1+/g, '$1');
  
  // 5. Remove all spaces and punctuation
  normalized = normalized.replace(/[^a-z]/g, '');
  
  return normalized;
}
// --- END OF HELPER FUNCTION ---


// Your old code starts here:
document.addEventListener("DOMContentLoaded", function() {
  // ... (rest of your file) ...
});

document.addEventListener("DOMContentLoaded", function() {

  // --- 1. Connect to our database ---
  const database = firebase.database();

  // --- 2. Find our HTML elements ---
  const storyElement = document.getElementById('story-text');
  const choicesContainer = document.getElementById('choices-container');
  const newChoiceInput = document.getElementById('new-choice-text');
  const newStoryInput = document.getElementById('new-story-text');
  const addChoiceButton = document.getElementById('add-choice-button');
  
  // --- THIS IS ALL NEW! ---
  const goBackButton = document.getElementById('go-back-button');
  const goStartButton = document.getElementById('go-start-button');
  
  let pageHistory = []; // Our new "memory" array
  let currentPageId = null;
  // --- END OF NEW ---


  // --- 3. Our "machine" to render a page ---
  function renderPage(pageId) {
    currentPageId = pageId;
    pageHistory.push(pageId); // Add this page to our memory

    // --- NEW: Show or hide the back button ---
    if (pageHistory.length > 1) {
      goBackButton.style.display = 'inline-block'; // Show it
    } else {
      goBackButton.style.display = 'none'; // Hide it
    }
    // --- END OF NEW ---
    
    const pageRef = database.ref('pages/' + pageId);
    
    pageRef.on('value', function(snapshot) {
      const pageData = snapshot.val();
      
      if (!pageData) {
        storyElement.innerText = "This page doesn't exist!";
        choicesContainer.innerHTML = "";
        return;
      }

      storyElement.innerText = pageData.story_text;
      choicesContainer.innerHTML = "";
      
      const choices = pageData.choices;
      if (choices) {
        document.getElementById('add-choice-form').style.display = 'block';
        for (const choiceId in choices) {
          const choice = choices[choiceId];
          const newButton = document.createElement('button');
          newButton.innerText = choice.text;
          newButton.addEventListener('click', function() {
            renderPage(choice.leads_to_page);
          });
          choicesContainer.appendChild(newButton);
        }
      } else {
        document.getElementById('add-choice-form').style.display = 'block';
      }
    });
  } // --- END OF "renderPage" FUNCTION ---


// --- 4. "ADD CHOICE" BUTTON LOGIC (WITH NORMALIZER!) ---
  addChoiceButton.addEventListener('click', function() {
    
    const choiceText = newChoiceInput.value;
    const storyText = newStoryInput.value;
    
    if (choiceText === "" || storyText === "") {
      alert("Please fill out both the 'choice' and the 'story'!");
      return; 
    }

    // -----------------------------------------------------------------
    // --- THIS IS THE NEW FILTER LOGIC ---
    // -----------------------------------------------------------------
    const blocklist = ["shit", "fuck", "bitch", "nigger", "drugs", "ass", ]; // Your list can stay simple!
    
    // 1. Normalize the *user's* text
    const normalizedInput = normalizeText(choiceText + " " + storyText);

    // 2. Check the *normalized* text against the blocklist
    for (let i = 0; i < blocklist.length; i++) {
      const blockedWord = blocklist[i];
      
      // We don't need to normalize the blocklist since it's already clean
      if (normalizedInput.includes(blockedWord)) {
        // If we find a bad word:
        alert("Whoops! Please use appropriate language and try again.");
        return; // STOPS the function
      }
    }
    // -----------------------------------------------------------------
    // --- END OF NEW FILTER LOGIC ---
    // -----------------------------------------------------------------

    // This code below will only run if no bad words were found
    const newPageRef = database.ref('pages').push();
    // --- THIS IS THE FIXED LINE ---
    const newPageId = newPageRef.key;    
    newPageRef.set({ story_text: storyText });

    const newChoice = {
      text: choiceText,
      leads_to_page: newPageId 
    };
    
    database.ref('pages/' + currentPageId + '/choices').push(newChoice);
    
    newChoiceInput.value = "";
    newStoryInput.value = "";
  });

  // --- 5. NEW NAVIGATION BUTTONS ---
  
  // When user clicks "Go to Start"
  goStartButton.addEventListener('click', function() {
    pageHistory = []; // Wipe the memory
    renderPage('page_1'); // Go to the start
  });
  
  // When user clicks "Go Back"
  goBackButton.addEventListener('click', function() {
    // 1. Remove the current page from memory
    pageHistory.pop(); 
    // 2. Get the new last page (which is the previous one)
    const previousPageId = pageHistory.pop();
    // 3. Go to that page (renderPage will add it back to the history)
    renderPage(previousPageId);
  });
  // --- END OF NEW ---


  // --- 6. THIS IS WHAT STARTS EVERYTHING ---
  renderPage('page_1');

});

// --- THIS IS YOUR NEW HELPER FUNCTION ---
function normalizeText(text) {
  let normalized = text.toLowerCase();
  const swaps = {'0':'o','@':'a','4':'a','3':'e','1':'i','!':'i','$':'s','5':'s'};
  for (const char in swaps) {
    normalized = normalized.replaceAll(char, swaps[char]);
  }
  normalized = normalized.replace(/([a-z])\1+/g, '$1');
  normalized = normalized.replace(/[^a-z]/g, '');
  return normalized;
}


document.addEventListener("DOMContentLoaded", function() {

  // --- 1. Connect to our database ---
  const database = firebase.database();

  // --- 2. Find our HTML elements ---
  const storyElement = document.getElementById('story-text');
  const choicesContainer = document.getElementById('choices-container');
  const newChoiceInput = document.getElementById('new-choice-text');
  const newStoryInput = document.getElementById('new-story-text');
  const addChoiceButton = document.getElementById('add-choice-button');
  const goBackButton = document.getElementById('go-back-button');
  const goStartButton = document.getElementById('go-start-button');
  const themeToggleButton = document.getElementById('theme-toggle-button');
  const sortPopularButton = document.getElementById('sort-popular-button');
  const sortNewestButton = document.getElementById('sort-newest-button');
  
  let pageHistory = [];
  let currentPageId = null;
  let currentSortMode = 'popular'; // 'popular' or 'newest'


  // --- 3. Our "machine" to render a page (UPGRADED FOR LIKES) ---
  function renderPage(pageId) {
    currentPageId = pageId;
    if (pageId === 'page_1') {
      pageHistory = ['page_1'];
    } else if (pageHistory[pageHistory.length - 1] !== pageId) {
      pageHistory.push(pageId);
    }

    goBackButton.style.display = (pageHistory.length > 1) ? 'inline-block' : 'none';
    
    database.ref().off(); 
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
      
      document.getElementById('add-choice-form').style.display = 'block';

      if (choices) {
        // --- Get the list of liked choices from browser memory ---
        let likedChoices = localStorage.getItem('likedChoices');
        likedChoices = likedChoices ? JSON.parse(likedChoices) : [];
        // --- End of new part ---

        let choicesArray = [];
        for (const choiceId in choices) {
          choicesArray.push({
            id: choiceId,
            ...choices[choiceId]
          });
        }
        
        if (currentSortMode === 'popular') {
          choicesArray.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else {
          choicesArray.reverse();
        }
        
        choicesArray.forEach(choice => {
          const choiceContainer = document.createElement('div');
          choiceContainer.className = 'choice-container';
          
          const newButton = document.createElement('button');
          newButton.innerText = choice.text;
          newButton.className = 'choice-button';
          newButton.addEventListener('click', function() {
            renderPage(choice.leads_to_page);
          });
          
          const likeButton = document.createElement('button');
          likeButton.innerText = '👍';
          likeButton.className = 'like-button';
          
          // --- NEW LOGIC TO CHECK IF ALREADY LIKED ---
          if (likedChoices.includes(choice.id)) {
            likeButton.classList.add('liked'); // Add new CSS class
            likeButton.disabled = true;       // Disable the button
          }
          // --- END OF NEW LOGIC ---
          
          likeButton.addEventListener('click', function() {
            // Double-check just in case
            let currentLikedChoices = localStorage.getItem('likedChoices');
            currentLikedChoices = currentLikedChoices ? JSON.parse(currentLikedChoices) : [];

            if (currentLikedChoices.includes(choice.id)) {
              return; // Already liked, do nothing
            }

            // 1. Update Firebase
            const currentLikes = choice.likes || 0;
            const choiceRef = database.ref('pages/' + currentPageId + '/choices/' + choice.id);
            choiceRef.update({ likes: currentLikes + 1 });
            
            // 2. "Stamp" the browser's memory
            currentLikedChoices.push(choice.id);
            localStorage.setItem('likedChoices', JSON.stringify(currentLikedChoices));
            
            // 3. Visually disable the button right away
            likeButton.classList.add('liked');
            likeButton.disabled = true;
          });
          
          const likeCount = document.createElement('span');
          likeCount.innerText = (choice.likes || 0) + ' likes';
          likeCount.className = 'like-count';
          
          choiceContainer.appendChild(newButton);
          choiceContainer.appendChild(likeButton);
          choiceContainer.appendChild(likeCount);
          choicesContainer.appendChild(choiceContainer);
        });
      }
    });
  } // --- END OF "renderPage" FUNCTION ---


  // --- 4. "ADD CHOICE" BUTTON LOGIC (UPGRADED) ---
  addChoiceButton.addEventListener('click', function() {
    
    const choiceText = newChoiceInput.value;
    const storyText = newStoryInput.value; 
    
    if (choiceText === "" || storyText === "") {
      alert("Please fill out both the 'choice' and the 'story'!");
      return; 
    }
    
    const blocklist = ["poop", "silly", "badword"];
    const normalizedInput = normalizeText(choiceText + " " + storyText);
    for (let i = 0; i < blocklist.length; i++) {
      if (normalizedInput.includes(blocklist[i])) {
        alert("Whoops! Please use appropriate language and try again.");
        return;
      }
    }

    const newPageRef = database.ref('pages').push();
    const newPageId = newPageRef.key;
    
    newPageRef.set({ story_text: storyText });

    const newChoice = {
      text: choiceText,
      leads_to_page: newPageId,
      likes: 0
    };
    
    database.ref('pages/' + currentPageId + '/choices').push(newChoice);
    
    newChoiceInput.value = "";
    newStoryInput.value = "";
  });


  // --- 5. NAVIGATION BUTTONS ---
  goStartButton.addEventListener('click', function() {
    renderPage('page_1');
  });
  
  goBackButton.addEventListener('click', function() {
    pageHistory.pop(); // Remove current page
    const previousPageId = pageHistory.pop(); // Get page before that
    renderPage(previousPageId); // <-- THIS WAS THE SECOND BUG (previousPageEId)
  });
  
  themeToggleButton.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
  });
  
  // --- 6. NEW SORT BUTTON LOGIC ---
  sortPopularButton.addEventListener('click', function() {
    currentSortMode = 'popular';
    sortPopularButton.classList.add('sort-active');
    sortNewestButton.classList.remove('sort-active');
    renderPage(currentPageId);
  });
  
  sortNewestButton.addEventListener('click', function() {
    currentSortMode = 'newest';
    sortNewestButton.classList.add('sort-active');
    sortPopularButton.classList.remove('sort-active');
    renderPage(currentPageId); // <-- THIS WAS YOUR BUG
  });
  

  // --- 7. THIS IS WHAT STARTS EVERYTHING ---
  renderPage('page_1');

});

// --- 1. HELPER FUNCTION ---
function normalizeText(text) {
  let normalized = text.toLowerCase();
  const swaps = { '0': 'o', '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '$': 's', '5': 's' };
  for (const char in swaps) {
    normalized = normalized.replaceAll(char, swaps[char]);
  }
  normalized = normalized.replace(/([a-z])\1+/g, '$1');
  normalized = normalized.replace(/[^a-z]/g, '');
  return normalized;
}

// --- 2. GLOBAL VARIABLES ---
// We define these globally so the map's click handler can find them
let mapModal = null;
let renderPage = null;

window.goToPageFromMap = function(pageId) {
//
// --- END OF THE CHANGE ---
//

  if (pageId && renderPage) {
    renderPage(pageId); // Call the main render function
  } else {
    // This will show an error if something is wrong
    console.error("Error: renderPage function is not ready.");
  }

  if (mapModal) {
    mapModal.style.display = 'none'; // Close the modal
  }
}

// --- 3. MAIN SCRIPT START ---
document.addEventListener("DOMContentLoaded", function () {

  // --- 4. Initialize Firebase Services ---
  const database = firebase.database();
  const auth = firebase.auth();

  // --- 5. Find HTML Elements ---
  const storyElement = document.getElementById('story-text');
  const choicesContainer = document.getElementById('choices-container');
  const goBackButton = document.getElementById('go-back-button');
  const goStartButton = document.getElementById('go-start-button');
  const themeToggleButton = document.getElementById('theme-toggle-button');
  const sortPopularButton = document.getElementById('sort-popular-button');
  const sortNewestButton = document.getElementById('sort-newest-button');

  // Build Form Elements
  const newChoiceInput = document.getElementById('new-choice-text');
  const newStoryInput = document.getElementById('new-story-text');
  const addChoiceButton = document.getElementById('add-choice-button');
  const newImageUrlInput = document.getElementById('new-image-url'); // Image
  const storyImageContainer = document.getElementById('story-image-container'); // Image

  // Auth Elements
  const authCard = document.getElementById('auth-card');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const authError = document.getElementById('auth-error');
  const userInfoCard = document.getElementById('user-info-card');
  const userEmailDisplay = document.getElementById('user-email-display');
  const logoutButton = document.getElementById('logout-button');
  const buildCard = document.getElementById('build-card');
  
  // Map Elements
  mapModal = document.getElementById('map-modal'); // Assign to global var
  const openMapButton = document.getElementById('open-map-button');
  const closeMapButton = document.getElementById('close-map-button');
  const mermaidGraphDiv = document.getElementById('mermaid-graph');

  // --- 6. Global State Variables ---
  let pageHistory = [];
  let currentPageId = null;
  let currentSortMode = 'popular';
  
  // -------------------------------------------------------------------
  // --- 7. AUTHENTICATION LOGIC ---
  // -------------------------------------------------------------------

  auth.onAuthStateChanged(function(user) {
    if (user) {
      // User is LOGGED IN
      authCard.style.display = 'none';
      userInfoCard.style.display = 'block';
      buildCard.style.display = 'block';
      userEmailDisplay.innerText = user.displayName || user.email;
      authError.innerText = '';
    } else {
      // User is LOGGED OUT
      authCard.style.display = 'block';
      userInfoCard.style.display = 'none';
      buildCard.style.display = 'none';
      userEmailDisplay.innerText = '';
    }
  });

  // --- Sign Up Button ---
  document.getElementById('signup-button').addEventListener('click', function() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const username = document.getElementById('signup-username').value;
    
    if (username === "" || email === "" || password === "") {
      authError.innerText = "Please fill out all fields.";
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const usernamesRef = database.ref('usernames/' + normalizedUsername);

    usernamesRef.once('value', (snapshot) => {
      if (snapshot.exists()) {
        authError.innerText = "This username already exists.";
      } else {
        auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            userCredential.user.updateProfile({ displayName: username });
            database.ref('usernames/' + normalizedUsername).set(userCredential.user.uid);
            database.ref('username_to_email/' + normalizedUsername).set(email);
          })
          .catch((error) => { authError.innerText = error.message; });
      }
    });
  });

  // --- Log In Button ---
  document.getElementById('login-button').addEventListener('click', function() {
    const username = loginUsernameInput.value;
    const password = document.getElementById('login-password').value;

    if (username === "" || password === "") {
      authError.innerText = "Please enter a username and password.";
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const emailLookupRef = database.ref('username_to_email/' + normalizedUsername);

    emailLookupRef.once('value', (snapshot) => {
      if (!snapshot.exists()) {
        authError.innerText = "Invalid username or password.";
      } else {
        const email = snapshot.val();
        auth.signInWithEmailAndPassword(email, password)
          .then((userCredential) => { authError.innerText = ""; })
          .catch((error) => { authError.innerText = "Invalid username or password."; });
      }
    });
  });

  // --- Log Out Button ---
  logoutButton.addEventListener('click', function() {
    auth.signOut();
  });


  // -------------------------------------------------------------------
  // --- 8. RENDERPAGE FUNCTION (MERGED) ---
  // -------------------------------------------------------------------
  
  // Assign to the global variable so the map can call it
  renderPage = function (pageId) {
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
      
      // MERGED: Clear old image
      storyImageContainer.innerHTML = '';

      if (!pageData) {
        storyElement.innerText = "This page doesn't exist!";
        choicesContainer.innerHTML = "";
        return;
      }

      storyElement.innerText = pageData.story_text;
      choicesContainer.innerHTML = "";

      // MERGED: Display new image if it exists
      if (pageData.image_url) {
        const img = document.createElement('img');
        img.src = pageData.image_url;
        img.id = 'story-image';
        storyImageContainer.appendChild(img);
      }
      
      const choices = pageData.choices;
      document.getElementById('add-choice-form').style.display = 'block';

      if (choices) {
        let likedChoices = localStorage.getItem('likedChoices');
        likedChoices = likedChoices ? JSON.parse(likedChoices) : [];

        let choicesArray = [];
        for (const choiceId in choices) {
          choicesArray.push({ id: choiceId, ...choices[choiceId] });
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
          newButton.addEventListener('click', () => renderPage(choice.leads_to_page));
          
          const likeButton = document.createElement('button');
          likeButton.innerText = '👍';
          likeButton.className = 'like-button';
          
          if (likedChoices.includes(choice.id)) {
            likeButton.classList.add('liked');
            likeButton.disabled = true;
          }
          
          likeButton.addEventListener('click', function() {
            let currentLikedChoices = localStorage.getItem('likedChoices');
            currentLikedChoices = currentLikedChoices ? JSON.parse(currentLikedChoices) : [];
            if (currentLikedChoices.includes(choice.id)) return;

            const currentLikes = choice.likes || 0;
            const choiceRef = database.ref(`pages/${currentPageId}/choices/${choice.id}`);
            choiceRef.update({ likes: currentLikes + 1 });
            
            currentLikedChoices.push(choice.id);
            localStorage.setItem('likedChoices', JSON.stringify(currentLikedChoices));
            
            likeButton.classList.add('liked');
            likeButton.disabled = true;
          });
          
          const likeCount = document.createElement('span');
          likeCount.innerText = (choice.likes || 0) + ' likes';
          likeCount.className = 'like-count';
          
          // MERGED: Creator Info
          const creatorInfo = document.createElement('span');
          creatorInfo.className = 'creator-info';
          creatorInfo.innerText = `by: ${choice.creatorName || 'Anonymous'}`; 
          
          choiceContainer.appendChild(newButton);
          choiceContainer.appendChild(likeButton);
          choiceContainer.appendChild(likeCount);
          choiceContainer.appendChild(creatorInfo); // Add creator info
          choicesContainer.appendChild(choiceContainer);
        });
      }
    });
  }; // End of renderPage function


  // -------------------------------------------------------------------
  // --- 9. "ADD CHOICE" BUTTON LOGIC (MERGED) ---
  // -------------------------------------------------------------------
  
  addChoiceButton.addEventListener('click', function() {
    
    // Auth check
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to build a new path!");
      return;
    }

    const choiceText = newChoiceInput.value;
    const storyText = newStoryInput.value;
    // Image URL
    const imageUrl = newImageUrlInput.value.trim(); 
    
    if (choiceText === "" || storyText === "") {
      alert("Please fill out both the 'choice' and the 'story'!");
      return; 
    }
    
    // Filter
    const blocklist = ["poop", "silly", "badword"];
    const normalizedInput = normalizeText(choiceText + " " + storyText);
    if (blocklist.some(word => normalizedInput.includes(word))) {
      alert("Whoops! Please use appropriate language.");
      return;
    }

    const newPageRef = database.ref('pages').push();
    const newPageId = newPageRef.key;
    
    // MERGED: Create new page data with optional image
    const newPageData = {
      story_text: storyText
    };
    if (imageUrl) {
      newPageData.image_url = imageUrl;
    }
    newPageRef.set(newPageData);

    // MERGED: Add user info to the choice object
    const newChoice = {
      text: choiceText,
      leads_to_page: newPageId,
      likes: 0,
      createdBy: user.uid,
      creatorName: user.displayName || user.email 
    };
    
    database.ref(`pages/${currentPageId}/choices`).push(newChoice);
    
    newChoiceInput.value = "";
    newStoryInput.value = "";
    newImageUrlInput.value = ""; // Clear image input
  });


  // -------------------------------------------------------------------
  // --- 10. NAVIGATION & SORT BUTTONS ---
  // -------------------------------------------------------------------
  
  goStartButton.addEventListener('click', () => renderPage('page_1'));
  
  goBackButton.addEventListener('click', function() {
    pageHistory.pop();
    const previousPageId = pageHistory.pop();
    renderPage(previousPageId);
  });
  
  themeToggleButton.addEventListener('click', () => document.body.classList.toggle('dark-mode'));
  
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
    renderPage(currentPageId);
  });
  

  // -------------------------------------------------------------------
  // --- 11. NEW: STORY MAP LOGIC ---
  // -------------------------------------------------------------------

  // Initialize Mermaid.js
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark', 
    
    // --- THIS IS THE NEW, IMPORTANT LINE ---
    securityLevel: 'loose', 
    // --- END OF NEW LINE ---

    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      rankSpacing: 70,
      nodeSpacing: 60,
      curve: 'linear'
    }
  });

  // Add click listeners for modal
  openMapButton.addEventListener('click', generateAndShowMap);
  closeMapButton.addEventListener('click', () => {
    mapModal.style.display = 'none';
  });

  // The main function to build and show the map
  async function generateAndShowMap() {
    mermaidGraphDiv.innerHTML = 'Loading map...';
    mapModal.style.display = 'flex';

    try {
      const snapshot = await firebase.database().ref('pages').once('value');
      const allPages = snapshot.val();

      if (!allPages) {
        mermaidGraphDiv.innerHTML = 'No story pages found.';
        return;
      }

      let mermaidString = 'graph TD;\n'; // Top Down graph

      for (const pageId in allPages) {
        const page = allPages[pageId];

        // Get clean text for the node label
        const shortText = page.story_text.substring(0, 20).replace(/"/g, '#quot;') + '...';
        mermaidString += `  ${pageId}["${shortText}"];\n`;
        
        // This is the new, fixed line
        mermaidString += `  click ${pageId} "javascript:goToPageFromMap('${pageId}')";\n`;

        if (page.choices) {
          for (const choiceId in page.choices) {
            const choice = page.choices[choiceId];
            const choiceText = choice.text.replace(/"/g, '#quot;');
            // Ensure the leads_to_page exists before drawing an arrow
            if (allPages[choice.leads_to_page]) {
              mermaidString += `  ${pageId} -- "${choiceText}" --> ${choice.leads_to_page};\n`;
            }
          }
        }
      }

      // Render the graph
      mermaid.render('mermaid-svg', mermaidString, (svgCode) => {
        mermaidGraphDiv.innerHTML = svgCode;
      });

    } catch (error) {
      console.error("Error generating map:", error);
      mermaidGraphDiv.innerHTML = 'Error loading map.';
    }
  }

  // --- 12. THIS IS WHAT STARTS EVERYTHING ---
  renderPage('page_1');

});

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

// --- 2. GLOBAL VARIABLES & MAP HANDLER ---
let mapModal = null;
let renderPage = null;

window.goToPageFromMap = function (pageId) {
  if (pageId && renderPage) {
    renderPage(pageId);
  } else {
    console.error("Error: renderPage function is not ready.");
  }
  if (mapModal) {
    mapModal.style.display = 'none';
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
  // Image-related lines have been REMOVED

  // Auth Elements
  const authCard = document.getElementById('auth-card');
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const showLoginLink = document.getElementById('show-login-link');
  const showSignupLink = document.getElementById('show-signup-link');
  const authError = document.getElementById('auth-error');
  const userInfoCard = document.getElementById('user-info-card');
  const userEmailDisplay = document.getElementById('user-email-display');
  const logoutButton = document.getElementById('logout-button');
  const buildCard = document.getElementById('build-card');

  // Map Elements
  mapModal = document.getElementById('map-modal');
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

  auth.onAuthStateChanged(function (user) {
    if (user) {
      authCard.style.display = 'none';
      userInfoCard.style.display = 'block';
      buildCard.style.display = 'block';
      userEmailDisplay.innerText = user.displayName || user.email;
      authError.innerText = '';
    } else {
      authCard.style.display = 'block';
      userInfoCard.style.display = 'none';
      buildCard.style.display = 'none';
      userEmailDisplay.innerText = '';
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
    }
  });

  // --- FORM SWITCHING LOGIC ---
  showLoginLink.addEventListener('click', function (e) {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
    authError.innerText = '';
  });

  showSignupLink.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    authError.innerText = '';
  });

  // --- Sign Up Button ---
  document.getElementById('signup-button').addEventListener('click', function () {
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
  document.getElementById('login-button').addEventListener('click', function () {
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
  logoutButton.addEventListener('click', function () {
    auth.signOut();
  });


  // -------------------------------------------------------------------
  // --- 8. RENDERPAGE FUNCTION (REMOVED IMAGE LOGIC) ---
  // -------------------------------------------------------------------

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

    pageRef.on('value', function (snapshot) {
      const pageData = snapshot.val();
      
      // storyImageContainer.innerHTML = ''; // REMOVED

      if (!pageData) {
        storyElement.innerText = "This page doesn't exist!";
        choicesContainer.innerHTML = "";
        return;
      }

      storyElement.innerText = pageData.story_text;
      choicesContainer.innerHTML = "";

      // The if(pageData.image_url) { ... } block has been REMOVED

      const choices = pageData.choices;
      
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
          likeButton.innerText = '\u{1F44D}'; // Unicode for 👍
          likeButton.className = 'like-button';

          if (likedChoices.includes(choice.id)) {
            likeButton.classList.add('liked');
            likeButton.disabled = true;
          }

          likeButton.addEventListener('click', function () {
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

          const creatorInfo = document.createElement('span');
          creatorInfo.className = 'creator-info';
          creatorInfo.innerText = `by: ${choice.creatorName || 'Anonymous'}`;

          choiceContainer.appendChild(newButton);
          choiceContainer.appendChild(likeButton);
          choiceContainer.appendChild(likeCount);
          choiceContainer.appendChild(creatorInfo);
          choicesContainer.appendChild(choiceContainer);
        });
      }
    });
  }; // End of renderPage function


  // -------------------------------------------------------------------
  // --- 9. "ADD CHOICE" BUTTON LOGIC (REMOVED IMAGE LOGIC) ---
  // -------------------------------------------------------------------

  addChoiceButton.addEventListener('click', function () {

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to build a new path!");
      return;
    }

    const choiceText = newChoiceInput.value;
    const storyText = newStoryInput.value;
    // const imageUrl = ... // REMOVED

    if (choiceText === "" || storyText === "") {
      alert("Please fill out both the 'choice' and the 'story'!");
      return;
    }

    const blocklist = ["shit", "fuck", "dick", "nigger", "ass", "gangbang", "orgy", "bitch", "retard", "bigget", "faggot", "chink", "hitle", "nazi", 
                      "kys", "kill", "dead", "die", "dying", "suicide", "sex", "gay", "blackie", "rape", "cocaine", "heroin", "meth", "crack", "mauijuana",
                      " Marijuana", "pussy", "vagina", "penis", "cracker", "slave", "cock", "torture"];
    const normalizedInput = normalizeText(choiceText + " " + storyText);
    if (blocklist.some(word => normalizedInput.includes(word))) {
      alert("Whoops! Please use appropriate language.");
      return;
    }

    const newPageRef = database.ref('pages').push();
    const newPageId = newPageRef.key;

    // The newPageData block has been replaced with the simpler version
    newPageRef.set({
      story_text: storyText
    });

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
    // newImageUrlInput.value = ""; // REMOVED
  });


  // -------------------------------------------------------------------
  // --- 10. NAVIGATION & SORT BUTTONS ---
  // -------------------------------------------------------------------

  goStartButton.addEventListener('click', () => renderPage('page_1'));

  goBackButton.addEventListener('click', function () {
    pageHistory.pop();
    const previousPageId = pageHistory.pop();
    renderPage(previousPageId);
  });

  themeToggleButton.addEventListener('click', () => document.body.classList.toggle('dark-mode'));

  sortPopularButton.addEventListener('click', function () {
    currentSortMode = 'popular';
    sortPopularButton.classList.add('sort-active');
    sortNewestButton.classList.remove('sort-active');
    renderPage(currentPageId);
  });

  sortNewestButton.addEventListener('click', function () {
    currentSortMode = 'newest';
    sortNewestButton.classList.add('sort-active');
    sortPopularButton.classList.remove('sort-active');
    renderPage(currentPageId);
  });


  // -------------------------------------------------------------------
  // --- 11. STORY MAP LOGIC (LATEST VERSION) ---
  // -------------------------------------------------------------------

  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      rankSpacing: 90,
      nodeSpacing: 75,
      curve: 'linear',
      padding: 20
    }
  });

  openMapButton.addEventListener('click', generateAndShowMap);
  closeMapButton.addEventListener('click', () => {
    mapModal.style.display = 'none';
  });

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

      let mermaidString = 'graph TD;\n';
      mermaidString += 'classDef currentNode fill:#10b981,stroke:#fff,stroke-width:2px,color:#fff;\n';

      for (const pageId in allPages) {
        const page = allPages[pageId];
        const shortText = page.story_text.substring(0, 30).replace(/"/g, '#quot;') + '...';
        mermaidString += `  ${pageId}["${shortText}"];\n`;
        mermaidString += `  click ${pageId} "javascript:goToPageFromMap('${pageId}')";\n`;

        if (pageId === currentPageId) {
          mermaidString += `  class ${pageId} currentNode;\n`;
        }

        if (page.choices) {
          for (const choiceId in page.choices) {
            const choice = page.choices[choiceId];
            const choiceText = choice.text.replace(/"/g, '#quot;');
            if (allPages[choice.leads_to_page]) {
              mermaidString += `  ${pageId} -- "${choiceText}" --> ${choice.leads_to_page};\n`;
            }
          }
        }
      }

      mermaid.render('mermaid-svg', mermaidString, (svgCode) => {
        mermaidGraphDiv.innerHTML = svgCode;

        mermaidGraphDiv.querySelectorAll('.node').forEach(nodeEl => {
          const clickAttr = nodeEl.getAttribute('onclick');
          if (clickAttr) {
            const match = clickAttr.match(/goToPageFromMap\('([^']+)'\)/);
            if (match && match[1]) {
              const pageId = match[1];
              if (allPages[pageId]) {
                const fullText = allPages[pageId].story_text;
                const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                titleEl.textContent = fullText;
                nodeEl.insertBefore(titleEl, nodeEl.firstChild);
              }
            }
          }
        });
      });

    } catch (error) {
      console.error("Error generating map:", error);
      mermaidGraphDiv.innerHTML = 'Error loading map.';
    }
  }

  // --- 12. THIS IS WHAT STARTS EVERYTHING ---
  renderPage('page_1');

});

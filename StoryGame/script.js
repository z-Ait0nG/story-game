// --- THIS IS YOUR HELPER FUNCTION ---
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

// --- 1. NEW: DEFINE GLOBALS ---
// We define these variables in the global scope so Mermaid can access them.
// They will be given their values inside DOMContentLoaded.
let mapModal = null;
let renderPage = null;

// --- 2. NEW: GLOBAL CLICK HANDLER ---
// This function *must* be global for Mermaid.js to find it.
function goToPageFromMap(pageId) {
  // Check if renderPage has been assigned a function yet
  if (pageId && renderPage) {
    renderPage(pageId); // Call the function
  }
  // Check if mapModal has been assigned an element yet
  if (mapModal) {
    mapModal.style.display = 'none'; // Close the modal
  }
}


document.addEventListener("DOMContentLoaded", function () {

  // --- 3. Connect to our database ---
  const database = firebase.database();

  // --- 4. Find our HTML elements ---
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

  // NEW: Image Support Elements
  const storyImageContainer = document.getElementById('story-image-container');
  const newImageUrlInput = document.getElementById('new-image-url');

  // NEW: Story Map Modal Elements
  // --- 5. NEW: ASSIGN GLOBAL VARIABLE ---
  // We assign the element to the global 'mapModal' variable we defined earlier.
  mapModal = document.getElementById('map-modal');
  const openMapButton = document.getElementById('open-map-button');
  const closeMapButton = document.getElementById('close-map-button');
  const mermaidGraphDiv = document.getElementById('mermaid-graph');

  let pageHistory = [];
  let currentPageId = null;
  let currentSortMode = 'popular'; // 'popular' or 'newest'


  // --- 6. Our "machine" to render a page (UPGRADED FOR LIKES & IMAGES) ---
  // --- 7. NEW: ASSIGN GLOBAL VARIABLE ---
  // Instead of 'function renderPage()', we assign the function to the
  // global 'renderPage' variable we defined earlier.
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

      // NEW: Clear any old image from the container
      storyImageContainer.innerHTML = '';

      if (!pageData) {
        storyElement.innerText = "This page doesn't exist!";
        choicesContainer.innerHTML = "";
        return;
      }

      storyElement.innerText = pageData.story_text;
      choicesContainer.innerHTML = "";

      // NEW: Check for an image URL and display it
      if (pageData.image_url) {
        const img = document.createElement('img');
        img.src = pageData.image_url;
        img.id = 'story-image'; // Add id for styling
        storyImageContainer.appendChild(img);
      }
      // --- End of new image logic ---

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
          newButton.addEventListener('click', function () {
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

          likeButton.addEventListener('click', function () {
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
  }; // <-- Note the semicolon, because this is an assignment


  // --- 8. "ADD CHOICE" BUTTON LOGIC (UPGRADED) ---
  addChoiceButton.addEventListener('click', function () {

    const choiceText = newChoiceInput.value;
    const storyText = newStoryInput.value;
    // NEW: Get the image URL value
    const imageUrl = newImageUrlInput.value.trim();

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

    // NEW: Create the new page data object
    const newPageData = {
      story_text: storyText
    };

    // NEW: Only add the image_url if one was provided
    if (imageUrl) {
      newPageData.image_url = imageUrl;
    }

    // NEW: Set the new page data
    newPageRef.set(newPageData);

    const newChoice = {
      text: choiceText,
      leads_to_page: newPageId,
      likes: 0
    };

    database.ref('pages/' + currentPageId + '/choices').push(newChoice);

    newChoiceInput.value = "";
    newStoryInput.value = "";
    // NEW: Clear the image input
    newImageUrlInput.value = "";
  });


  // --- 9. NAVIGATION BUTTONS ---
  goStartButton.addEventListener('click', function () {
    renderPage('page_1');
  });

  goBackButton.addEventListener('click', function () {
    pageHistory.pop(); // Remove current page
    const previousPageId = pageHistory.pop(); // Get page before that
    renderPage(previousPageId);
  });

  themeToggleButton.addEventListener('click', function () {
    document.body.classList.toggle('dark-mode');
  });

  // --- 10. NEW SORT BUTTON LOGIC ---
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


  // --- 11. THIS IS WHAT STARTS EVERYTHING ---
  renderPage('page_1');


  // --- 12. NEW: STORY MAP LOGIC ---

  // Initialize Mermaid.js
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark', // Use dark theme to match your UI
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      rankSpacing: 70, // More vertical space
      nodeSpacing: 60, // More horizontal space
      curve: 'linear'  // Use straight lines
    }
  });

  // Add click listeners for modal
  openMapButton.addEventListener('click', generateAndShowMap);
  closeMapButton.addEventListener('click', () => {
    mapModal.style.display = 'none';
  });

  // The main function to build and show the map
  async function generateAndShowMap() {

    // Show the modal with a loading message
    mermaidGraphDiv.innerHTML = 'Loading map...';
    mapModal.style.display = 'flex';

    try {
      // Fetch ALL pages from Firebase
      const snapshot = await firebase.database().ref('pages').once('value');
      const allPages = snapshot.val();

      if (!allPages) {
        mermaidGraphDiv.innerHTML = 'No story pages found.';
        return;
      }

      let mermaidString = 'graph TD;\n'; // TD = Top Down graph

      // Loop through every page
      for (const pageId in allPages) {
        const page = allPages[pageId];

        // Get a short, clean version of the story text for the node label
        const shortText = page.story_text.substring(0, 20).replace(/"/g, '#quot;') + '...';
        mermaidString += `  ${pageId}["${shortText}"];\n`;

        // This click handler tells Mermaid to call the GLOBAL 'goToPageFromMap' function
        // This syntax is correct and will now work.
        mermaidString += `  click ${pageId} call goToPageFromMap("${pageId}");\n`;

        // Now, loop through the choices for this page
        if (page.choices) {
          for (const choiceId in page.choices) {
            const choice = page.choices[choiceId];

            // Get clean text for the link label
            const choiceText = choice.text.replace(/"/g, '#quot;');
            mermaidString += `  ${pageId} -- "${choiceText}" --> ${choice.leads_to_page};\n`;
          }
        }
      }

      // Now, render the graph
      mermaid.render('mermaid-svg', mermaidString, (svgCode) => {
        mermaidGraphDiv.innerHTML = svgCode;
      });

    } catch (error) {
      console.error("Error generating map:", error);
      // --- THIS IS THE CORRECTED TYPO ---
      mermaidGraphDiv.innerHTML = 'Error loading map.';
    }
  }
  // --- END OF NEW STORY MAP LOGIC ---

});

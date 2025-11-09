This is a collaborative story-telling game built for the SBUHack!

Live Demo
You can play the game live here:
https://sbuhack-storygame.netlify.app/ 

---

How to Run Locally

The live demo is the best way to test the project, but if you wish to run the code locally, you must provide your own Firebase API keys.

1.  Clone this repository.
2.  Create a new project in your own Firebase account and enable the Realtime Database and Authentication.
3.  In the root of the project folder, create a new file named `config.js`.
4.  Paste your Firebase `firebaseConfig` object into `config.js`. The file should look like this:

    ```javascript
    // config.js
    const firebaseConfig = {
      apiKey: "YOUR-API-KEY-HERE",
      authDomain: "YOUR-AUTH-DOMAIN",
      databaseURL: "YOUR-DATABASE-URL",
      // ...etc
    };
    ```
5.  Open `index.html` in your browser.
6.  Enjoy!

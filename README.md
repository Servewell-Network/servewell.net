# servewell.net

This should be an app for streamlining the in-person work of caring for and empowering people. So technology that draws people in a little through excellence but ultimately points away from itself, letting people return to God and to the world as they're sent by God.

It starts with a simple BSB Bible perhaps, but via Expo (for web+native) and Wrangler (for Cloudflare hosting).

Basic foundations:
- I think both Cloudflare/Wrangler and Expo use Node.js. I'm using v22 or v24 (LTS).
- Cloudflare/Wrangler structures the base folder, ~/Documents/servewell.net (ref needed)
- At that level, key commands are
  - npx wrangler dev
  - npx wrangler deploy
- servewell.net/src/index.ts seems to have server-side code
- not sure when to use that deploy command vs simply committing to git
- client-side code server looks at servewell.net/wrangler.jsonc > assets > directory
- Expo structures the second level in servewell.net/swn-expo (e.g., https://docs.expo.dev/more/create-expo/)
- At that level, nxp expo start # (then press w) this command allows dev of both web and native mobile apps, and the w opens localhost:8081
- npx expo export --platform web # or npx expo export -p web # creates swn-expo/dist
- Set servewell.net/wrangler.jsonc > assets > directory to "./swn-expo/dist"
- cd ~/Documents/servewell.net; npx wrangler dev # puts expo's app in localhost:8787
- (before npx wrangler deploy, servewell.net includes "Create a way to log in and do a git PR")
- npx wrangler deploy wants me to remember how to log in, because it opens https://dash.cloudflare.com/login?login_challenge=1642f55524fc412dbb8d2be29aa16511 
- git commit should do the trick. moving away from servewell.net/public...


Latest rough notes are in servewith.me/public/inner-admin/first-client-side-scripts.html, should move. Use what's above the delete warning. Next steps are proving that expo output can also be served by cloudflare and wrangler, not just by expo start. Also see in android and ios simulators. Also try to recall how wrangler directory was set up and record that in servewell.net/public/articles/combine-static-cloudflare-with-expo.html, where rough notes are converted to confident. But three notes places is too many right now, so consolidate somehow.

Then with God's help I'll need to learn to pull from simple English text (not code) src files to build React SSG articles in Expo. 

To see what it will serve (i.e., do development), run what?
Expo says: cd swn-expo/; npx expo start
then type w to open demo content in web browser
or a for android sdk or i for ios simulator, but those require installation first
or s to switch to development build
In web I see
Demo!
Step 1: Try it
Edit app/(tabs)/index.tsx to see changes. Press F12 to open developer tools.
    Download the React DevTools for a better development experience: https://react.dev/link/react-devtools
    entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable:62193 Running application "main" with appParams:
    Objecthydrate: undefined
    rootTag: "#root"[[Prototype]]: Object 
    Development-level warnings: ON.
    Performance optimizations: OFF.

Step 2: Explore
Tap the Explore tab to learn more about what's included in this starter app.
    File-based routing
    Android, iOS, and web support
    Images
    Custom fonts
    Light and dark mode components'

At some point blank it out with 
npm run reset-project

Cloudflare says:



For more details about implementation, see servewith.me/public/inner-admin/history-of-sites.html (maybe not working on line?) and https://servewell.net/articles/combine-static-cloudflare-with-expo 



Potential Roadmap Features
- Articles, like on Bible topics or on people I meet, with 
    - layers of sensitivity (private insertions only show up for whom they're intended)
    - optional notifications per section
        - each can be made more or less frequent
        - dismissing one brings up the next, like flash cards
    - comments
    - suggestions
    - reactions
- Lists, like best movies, with
    - ability to re-order
    - votes to re-order
- Tags, like on people
    - on topics of their expertise, their vote counts more
    - and/or can sort by the votes of different tag-groups (e.g., what x-group thinks, what y-group thinks)

Repos
- servewell.net (could be renamed to be more specific) has MIT (free, open) license for most client-side stuff

# servewell.net

This should be an app for streamlining the in-person work of caring for and empowering people. So technology that draws people in through excellence but ultimately points away from itself, letting people return to God and to the world as they're sent by God.

It starts with a Step Bible via Wrangler (for Cloudflare hosting).

## Technical Overview
   - Cloudflare/Wrangler uses Node.js. I'm using v22, should move to v24 (LTS).
   - Cloudflare/Wrangler structures the base folder (ref needed)
   - At that level, key commands are
    - npx wrangler dev
    - npx wrangler deploy
    - npm install -D wrangler@latest
   - servewell.net/src/index.ts has server-side code
   - client-side code server looks at servewell.net/wrangler.jsonc > assets > directory
   - cd servewell.net; npx wrangler dev # puts app in localhost:8787
   - npx wrangler deploy wants me to remember how to log in (email mo), because it opens https://dash.cloudflare.com/login?login_challenge=1642f55524fc412dbb8d2be29aa16511, but once I logged in and granted permission, it immediately seemed to change what was served at https://servwell.net
   - Starting with STEP Bible data (Thankful for their generosity!)
     - They want us to let you know this data came from https://github.com/STEPBible/STEPBible-Data/tree/master
     - They want us to report changes to STEPBible@gmail.com
     - For now, no changes, so to update simply copy from parallel repo copy:
         - cp -r ../STEPBible-Data/Translators\ Amalgamated\ OT+NT src/stepAmalgamated


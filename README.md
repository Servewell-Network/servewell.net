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
     - They say
       - You can make corrections or report possible errors to be checked at STEPBibleATgmail.com
         - I considered starting by reporting some english lemmas (last part of "Expanded Strong tags") start with ": ". Example: "Expanded Strong tags" for Gen.1.1#01=L includes "=: beginning»first:1_beginning". However, there are so many of them, it must be me that doesn't know the purpose of this. So I guess I'll hold off for now.
       - Any changes made to data should be recorded and made available to subsequent users.
          - I think this is fulfilled by everything I'm doing being open to the public right now. Example, in my code I have this: .replace(/^:/, '').trim(); // unsure why this occurs in step data
          - But perhaps since I'm not actually altering the data, but making derivative data, they might not consider it to be changes.
     - For now, no changes, so to update simply copy from parallel repo copy:
         - cp -r ../STEPBible-Data/Translators\ Amalgamated\ OT+NT src/step-Phase1a
         - npm run p1a-2
    
## Next steps
 - create init pages with literal
    - <button popovertarget="my-tooltip">Help</button>
      <div id="my-tooltip" popover>
        This is a native flyout that works on touch!
      </div>
    - .row {
        display: grid;
        grid-template-columns: 1fr; /* One column for mobile */
        gap: 1rem;
      }

      @media (min-width: 600px) {
        .row {
          grid-template-columns: 1fr 1fr; /* Two parallel cells for wide */
        }
      }
    - 
 - add a navigation system
    - dropdown-like carat on document name, chap and verse, skip taps if possible for chap and verse
 - how does traditional bible fit in json?
    - can add suggested english ordinal to morphemes, though that's supplemental
    - should primarily be a list of words separate from morphemes
 - perhaps use BSB or LSV or similar
   - to get English order
   - to get alternate renderings (English morphemes)
   - BSB could be the foundational traditional translation
 - perhaps build concordance json (words parallel to docs)
   - to see how consistent English lemmas and renderings are, and see if the can be made more consistent or somehow show when words are same or different in togglable ruby text. Like if there's just one or two Eng lemmas for each Hebrew, could combine with number? Or should ruby be used for alternate morphemes? Not as exact-looking but nicer to read and clear in most cases? Perhaps if two passages are compared, clicking one highlights in the other, one color for full match and another for root match and another for subroot match?
   - to reduce what's in docs json so as to change once, change everywhere? I don't want docs json to become any more unreadable than it already is, 
   - to see what lemmas overlap creating ambiguity, and see if one alternate will solve that or if a number is needed?
 - get orig root script from expanded strongs (or from lexicon to get translit)


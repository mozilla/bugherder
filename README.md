[![Build Status](https://travis-ci.org/mozilla/bugherder.svg?branch=master)](https://travis-ci.org/mozilla/bugherder)
[![Dependency Status](https://david-dm.org/mozilla/bugherder.svg)](https://david-dm.org/mozilla/bugherder)
[![devDependency Status](https://david-dm.org/mozilla/bugherder/dev-status.svg)](https://david-dm.org/mozilla/bugherder#info=devDependencies)

Bugherder is a tool for marking bugs post-merge, created by [Graeme McCutcheon](http://www.graememcc.co.uk/).

RESTRICTED BUGS
---------------
Bugherder loads bug data anonymously, so bugs that are restricted to a Bugzilla group can't
be loaded, and can't be marked. Sheriffs generally don't have access to them either, so they
are normally left for someone from Release Management to deal with by hand afterwards.

When a push contains such bugs, bugherder offers to load them with an API key. Supply one
belonging to an account that can see them, and bugherder will restart the normal flow with
everything except those bugs filtered out - the same commenting, resolving and flag setting as
usual, over just the restricted bugs. The key is reused for the submission, so it is only asked
for once. Anything that still can't be loaded with the key given is called out so it can be
followed up manually.

This doesn't affect the sheriff pass in any way: without a key, nothing loads and the push is
presented exactly as before.


NOTES ON TESTING
----------------
Adding "?debug=1" shows how all changesets were identified, and shows what changesets Bugherder decided were affected by a backout.

Adding "?remap=1" allows you to divert output to the bzapi sandbox bugzilla at [landfill.bugzilla.org](https://://landfill.bugzilla.org/bzapi_sandbox/).
If you use this option, you will be presented with a table of all the bugs associated with changesets. You can then enter a bug number from bzapi that output will be sent to. You don't need to enter a new bug number for every single bug shown, but only those you do enter will be transmitted, other bugs will be ignored.

Bugherder will not check the existence of any bugs you enter - be careful! Each bug number entered must be unique - that **will** be checked, as apparently I can't follow my own instructions. You will probably want to review the pushlog - if the push for the only bug you entered was backed out, then nothing will be sent.

When testing target milestone setting, the equivalent bug in landfill must be filed in the *mcMerge Test Product* product, or the submission will fail.

There are various checkbox options at the bottom of the screen:
* an option to add checkin-needed to some random bug whiteboards, to allow you to test it's removal on submission. Be careful of bugs with additional keywords - if they are not defined on landfill (and they probably won't be), the submission will fail
* an option to throw up an alert - hacky, I know - partway through the submission process, to allow you to jump over to the landfill bug, and mid-air Bugherder
* a useful option to ignore the real bug status, and set it to NEW, as you will likely be working with historic pushlogs when testing

If you do not enter any diversion bugs on the remap page, you will return to live mode, with changes going to [bugzilla.mozilla.org](https://bugzilla.mozilla.org/).


Running the Node.js static server locally
-----------------------------------------
1. Install [Node.js](https://nodejs.org/).
2. $ ``npm install --production``
(optionally omit ``--production`` to also install packages for the test suite).
3. $ ``npm start``
4. Navigate to [http://localhost:5000/](http://localhost:5000/).


Heroku notes
------------
* For setup instructions/CLI guide, see the Heroku
[getting started](https://devcenter.heroku.com/articles/getting-started-with-nodejs) tutorial.
* The presence of `package.json` will cause Heroku to pick the
[Node.js buildpack](https://github.com/heroku/heroku-buildpack-nodejs) automatically, however
it's preferable to pin to a specific version tag of the buildpack, using eg:
``heroku buildpacks:set git://github.com/heroku/heroku-buildpack-nodejs.git#v86``
* During deploy, Heroku runs ``npm install --production``.
* On start-up, the web dyno runs the command defined in the ``Procfile``.
* On production, HTTP is 301 redirected to HTTPS, and all files are served
with a Cache-Control max-age set.
* The "auto-deploy from master when CI has passed" option is enabled, to override
don't use ``git push`` - instead use the manual branch deploy controls
[here](https://dashboard.heroku.com/apps/bugherder/deploy/github).


STANDING ON THE SHOULDERS OF GIANTS
-----------------------------------
Bugherder uses the following third-party projects:

* bz.js by Heather Arthur - [https://github.com/harthur/bz.js](https://github.com/harthur/bz.js)
* jQuery - [http://jquery.com/](http://jquery.com)
* Toast CSS framework by Dan Eden - [http://www.daneden.me/toast](http://www.daneden.me/toast)

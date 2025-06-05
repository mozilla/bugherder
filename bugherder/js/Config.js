"use strict";

var Config = {
  supportsHistory : !!(window.history && history.pushState),
  inMaintenanceMode : false,

  treeName: 'mozilla-central',
  hgBaseURL: "https://hg.mozilla.org/",
  hgURL: "https://hg.mozilla.org/mozilla-central/",
  hgRevURL: "https://hg.mozilla.org/mozilla-central/rev/",
  hgPushlogURL: "https://hg.mozilla.org/mozilla-central/pushloghtml?changeset=",
  showBugURL: "https://bugzilla.mozilla.org/show_bug.cgi?id=",

  // Here be dragons
  versionRE: /^mozilla\d+$/i,
  csetInputRE: /^(tip|[\da-f]{12,40})$/i,
  csetIDRE: /\b([\da-f]{12,40})\b/ig,
  leaveOpenRE: /(?:leave|keep)(?:-|\s+)open/i,
  bugNumRE: /\b(\d{4,7})\b/g,
  strictBugNumRE: /^(\d{4,7})$/,
  mergeRE: /\bmerg(ed?|ing)\b/i,
  backoutRE: /back(ing|ed)?\s*out/i,
  backoutOtherBugRE: /^Bug\s+\d{4,7}.*back(ing|ed)?\s*out.*bug\s+\d{4,7}/i,
  revertRE: /^revert(ing)?/i,
  partialRevertRE: /(?:from|in)(?:\s+(?:rev(?:ision)?|c(?:hange)?set))?\s+([\da-f]{12,40})/i,
  partialTestRE: /test\s+for/i,
  revertRangeRE: /revert(?:ing)?\s+(?:\S+\s+)?to(?:\s+(?:rev(?:ision)?|c(?:hange)set))?\s+([\da-f]{12,40})/i,
  csetRangeRE: /\b([\da-f]{12,40})\s*(?:to|:|-|through)\s*([\da-f]{12,40})/i,
  hgRevRE: /https?:\/\/hg.mozilla.org\/mozilla-central\/rev\//ig,
  hgRevFullRE: /https?:\/\/hg.mozilla.org\/mozilla-central\/rev\/[\da-f]{12}/ig,
  hgPushlogRE: /https?:\/\/hg.mozilla.org\/mozilla-central\/pushloghtml\?changeset=/ig,
  emailRE: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i,   // I'm not looking for RFC 822 compliance here!

  // The many ways bug numbers are specified
  bugRE1: /b(?:ug)?=(\d{4,7})\b/i,                       // e.g. b=XXXXXX
  bugRE2: /^fix(?:es)?\s*(?:for\s*)?(\d{4,7})\b/i,                         // Fix is sometimes used as a synonym for bug
  bugRE3: /to\s+fix\s+bug\s+(\d{4,7})/i,
  bugRE4: /\((\d{4,7}), r=/i,                          // e.g. JS-team style (XXXXXX, r=foo)
  bugRE5: /but\s*(\d{4,7})/i,                          // The typo but XXXXXX happens quite often
  bugRE6: /\bb(?:u?g(?:zilla)?)?:?\s*#?(\d{4,7})\b/i,  // The catchall
  bugRE7: /^(\d{4,7})\b/i,                              // e.g. XXXXXX,

  repoMergeRE: "\\s+(&|and|with|<->|<>|-?->|(in|on)?to)\\s+",

  mcSynonyms: ["mozilla-central", "central", "m-c", "mc", "mozilla central"],

  rewriteTrees: {
    "thunderbird-trunk": "comm-central",
    "thunderbird-beta": "comm-beta",
    "thunderbird-release": "comm-release",
    "thunderbird-esr102": "comm-esr102",
    "thunderbird-esr115": "comm-esr115",
    "thunderbird-esr128": "comm-esr128",
    "thunderbird-esr140": "comm-esr140",
  },

  treeInfo: {
    "mozilla-central": {
      repo: "mozilla-central",
      trackedTree: true,
      synonyms: ["mozilla-central", "central", "m-c", "mc", "mozilla central"]
    },
    "autoland": {
      repo: "integration/autoland",
      trackedTree: false,
      synonyms: ["autoland"]
    },
    "mozilla-beta": {
      repo: "releases/mozilla-beta",
      trackedTree: true,
      synonyms: ["releases/mozilla-beta", "mozilla-beta"]
    },
    "mozilla-release": {
      repo: "releases/mozilla-release",
      trackedTree: true,
      synonyms: ["releases/mozilla-release", "mozilla-release"]
    },
    "mozilla-esr102": {
      repo: "releases/mozilla-esr102",
      trackedTree: true,
      synonyms: ["esr102", "releases/mozilla-esr102", "mozilla-esr102"]
    },
    "mozilla-esr115": {
      repo: "releases/mozilla-esr115",
      trackedTree: true,
      synonyms: ["esr115", "releases/mozilla-esr115", "mozilla-esr115"]
    },
    "mozilla-esr128": {
      repo: "releases/mozilla-esr128",
      trackedTree: true,
      synonyms: ["esr128", "releases/mozilla-esr128", "mozilla-esr128"]
    },
    "mozilla-esr140": {
      repo: "releases/mozilla-esr140",
      trackedTree: true,
      synonyms: ["esr140", "releases/mozilla-esr140", "mozilla-esr140"]
    },
    "ash": {
      repo: "projects/ash",
      trackedTree: false,
      synonyms: ["ash", "projects/ash"]
    },
    "birch": {
      repo: "projects/birch",
      trackedTree: false,
      synonyms: ["birch", "projects/birch"]
    },
    "cedar": {
      repo: "projects/cedar",
      trackedTree: false,
      synonyms: ["projects/cedar", "cedar"]
    },
    "cypress": {
      repo: "projects/cypress",
      trackedTree: false,
      synonyms: ["projects/cypress", "cypress"]
    },
    "date": {
      repo: "projects/date",
      trackedTree: false,
      synonyms: ["projects/date", "date"]
    },
    "elm": {
      repo: "projects/elm",
      trackedTree: false,
      synonyms: ["projects/elm", "elm"]
    },
    "fig": {
      repo: "projects/fig",
      trackedTree: false,
      synonyms: ["projects/fig", "fig"]
    },
    "graphics": {
      repo: "projects/graphics",
      trackedTree: false,
      synonyms: ["projects/graphics", "graphics"]
    },
    "holly": {
      repo: "projects/holly",
      trackedTree: false,
      synonyms: ["projects/holly", "holly"]
    },
    "jamun": {
      repo: "projects/jamun",
      trackedTree: false,
      synonyms: ["projects/jamun", "jamun"]
    },
    "larch": {
      repo: "projects/larch",
      trackedTree: false,
      synonyms: ["projects/larch", "larch"]
    },
    "maple": {
      repo: "projects/maple",
      trackedTree: false,
      synonyms: ["projects/maple", "maple"]
    },
    "oak": {
      repo: "projects/oak",
      trackedTree: false,
      synonyms: ["projects/oak", "oak"]
    },
    "pine": {
      repo: "projects/pine",
      trackedTree: false,
      synonyms: ["projects/pine", "pine"]
    },
    "comm-central": {
      repo: "comm-central",
      trackedTree: true,
      synonyms: ["comm-central", "c-c"]
    },
    "comm-beta": {
      repo: "releases/comm-beta",
      trackedTree: true,
      synonyms: ["releases/comm-beta", "comm-beta"]
    },
    "comm-release": {
      repo: "releases/comm-release",
      trackedTree: true,
      synonyms: ["releases/comm-release", "comm-release"]
    },
    "comm-esr102": {
      repo: "releases/comm-esr102",
      trackedTree: true,
      synonyms: ["releases/comm-esr102", "comm-esr102"]
    },
    "comm-esr115": {
      repo: "releases/comm-esr115",
      trackedTree: true,
      synonyms: ["releases/comm-esr115", "comm-esr115"]
    },
    "comm-esr128": {
      repo: "releases/comm-esr128",
      trackedTree: true,
      synonyms: ["releases/comm-esr128", "comm-esr128"]
    },
    "comm-esr140": {
      repo: "releases/comm-esr140",
      trackedTree: true,
      synonyms: ["releases/comm-esr140", "comm-esr140"]
    },
    "ci-configuration": {
      repo: "ci/ci-configuration",
      trackedTree: false
    },
  }
};

Config.bugNumberREs = [Config.bugRE1, Config.bugRE2, Config.bugRE3,
                       Config.bugRE4, Config.bugRE5, Config.bugRE6, Config.bugRE7];

(function () {
  var base = Config.hgBaseURL;
  for (var treeName in Config.treeInfo) {
    var repo = Config.treeInfo[treeName].repo; 
    Config.treeInfo[treeName]['hgURL'] = base + repo + '/';
    Config.treeInfo[treeName]['hgRevURL'] = base + repo + '/rev/';
    Config.treeInfo[treeName]['hgPushlogURL'] = base + repo + '/pushloghtml?changeset=';
    Config.treeInfo[treeName]['hgRevRE'] = new RegExp('https?:\/\/hg.mozilla.org\/' + repo + '\/rev\/', 'ig');
    Config.treeInfo[treeName]['hgRevFullRE'] = new RegExp('https?:\/\/hg.mozilla.org\/' + repo + '\/rev\/[\\da-f]{12}', 'ig');
    Config.treeInfo[treeName]['hgPushlogRE'] = new RegExp('https?:\/\/hg.mozilla.org\/' + repo + '\/pushloghtml\\?changeset=', 'ig');
  }
})();

// Detect input type="email" support
$(document).ready(function() {
  Config.needsValidation = $('#username').prop('type') != 'email';
});

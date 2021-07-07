"use strict";

var PushData = {
  // All pushes in sequential order
  allPushes: [],

  // All normal pushes
  fixes: [],

  // Backout pushes where the things they back out are in this merge
  foundBackouts: [],

  // Pushes that were backed out by an entry in foundBackouts
  backedOut: [],

  // Backout pushes where the things they back out are not in this merge
  notFoundBackouts: [],

  // All "merge" changesets
  merges: [],

  // Pushes with no bug number
  others: [],

  tip: null,


  clear: function PD_clear() {
    this.allPushes = [];
    this.foundBackouts = [];
    this.fixes = [];
    this.merges = [];
    this.backedOut = [];
    this.notFoundBackouts = [];
    this.others = [];
  },


  init: function PD_init(cset, loadCallback, errorCallback) {
    this.clear();
    var self = this;
    $.ajax({
      url: Config.hgURL + 'json-pushes?full=1&changeset=' + cset,
      dataType: 'json',
      timeout: 30000,
      success: function PD_ajaxSuccessCallback(data) {
        self.parseData(data, loadCallback);
      },
      error: errorCallback
    });
  },


  // Check whether to handle backouts
  safeToReopen: function PD_safeToReopen() {
    return this.fixes.length == 0 && this.backedOut.length == 0 && this.foundBackouts.length == 0;
  },


  // Make a naive attempt at guessing the bug number from the push's description
  getBugNumber: function PD_getBugNumber(push) {
    // How shall I specify a bug number?
    // Let me count the ways...
    var len = Config.bugNumberREs.length;
    for (var i = 0; i < len; i++) {
      var re = Config.bugNumberREs[i];
      var reResult = re.exec(push.desc);

      if (reResult) {
        push.bug = reResult[1];
        break;
      }
    }
  },


  // Parse the push description to see if it's a merge push;
  // mark it as such and clear the bug number if it is
  checkIfMerge: function PD_checkIfMerge(push) {
    // The fun here is deciding whether this is a bug whose description
    // includes the word "merge",
    //   e.g. "Bug 718255 - Merge nsIPrefBranch2 with nsIPrefBranch - Part A"
    // or a merge that happens to include a bug number
    //   e.g "backout merge for bug 724310. r=irc"
    // I use this heuristic: if the bug number appears before "merge"
    // then it's a bug, otherwise it's a merge. This will still get some cases
    // wrong where the bug number follows the bug description, and said description
    // contains the word "merge"
    //   e.g "Mostly cosmetic arm merges, merge ARM fcmp(e)d changes (522403, r=graydon)"
    // but such cases are sufficiently rare to not be worth worrying about
    var reResult = Config.mergeRE.exec(push.desc);
    if (!reResult) {
      push.isMerge = false;
      return;
    }

    if (!push.bug) {
      push.isMerge = true;
      return;
    }

    var mergeIndex = reResult.index;
    var bugIndex = push.desc.indexOf(push.bug);
    if (bugIndex < mergeIndex) {
      push.isMerge = false;
      return;
    }

    push.isMerge = true;
    delete push.bug;
  },


  // Parse the push description to see if it's a backout push;
  // mark it as such and clear the bug number if it is
  // Note: checkIfBackout assumes checkIfMerge has already been called
  checkIfBackout: function PD_checkIfBackout(push) {
    // Get a list of all csets in the description
    var descCsets = []
    Config.csetIDRE.lastIndex = 0;
    var csetRERes;
    while (csetRERes = Config.csetIDRE.exec(push.desc)) {
      descCsets.push(csetRERes[1]);
    }

    // "Merge backout" and "backout merge" are merges, not backouts
    // However, look for csets that are not already backed out
    // (ie "Merge backout of X" should follow "backout of X" and can be regarded as a merge
    // See merge e7d5dd9efeca cset d0c677daedff for a cset that would otherwise have been
    // incorrectly determined to be a merge
    if (push.isMerge) {
      if (descCsets.length == 0) {
        push.isBackout = false;
        return;
      }

      var csetFound = false;
      for (var i = 0; i < descCsets.length; i++) {
        var cset = descCsets[i];
        if (cset.length > 12)
          cset = cset.substring(0,12);
        if (cset in this._csets && !this.allPushes[this._csets[cset]].backedOut)
          csetFound = true;
      }
      if (!csetFound) {
        push.isBackout = false;
      } else {
        push.isBackout = true;
        push.isMerge = false;
      }
      return;
    }

    var reResult = Config.backoutRE.exec(push.desc);
    var backoutOtherBug = Config.backoutOtherBugRE.exec(push.desc);
    if (reResult && backoutOtherBug) {
      // Example: "Bug 1449532 - Part I, Backed out changeset 99fc41ec7ce9 (Bug 1444489 Part VIII)"
      push.isBackout = false;
      return
    }

    // If "backout" didn't match, try "revert"
    if (!reResult) {
      reResult = Config.revertRE.exec(push.desc);

      // Watch out for partial reverts, eg  "revert accidental change in cset"
      // Don't classify them as backouts
      if (reResult) {
        var reResult2 = Config.partialRevertRE.exec(push.desc);
        if (reResult2)
          reResult = null;
      }

      if (!reResult) {
        push.isBackout = false;
        return;
      }
    }

    var backoutIndex = reResult.index;

    // The backout may just have been identified in cset terms
    if (!push.bug) {
      push.isBackout = true;
      return;
    }

    // If there were csets in the description, we can be pretty sure it's
    // some kind of backout - we only need to decide whether to delete the
    // bug number to allow the push to be correctly classified
    if (descCsets.length > 0)
      push.isBackout = true;

    // From here on, we know there is a bug number in the message, as
    // push.bug is set. Gather up all the bug numbers in the desc
    var descBugs = []
    Config.bugNumRE.lastIndex = 0;
    var bugRERes;
    while (bugRERes = Config.bugNumRE.exec(push.desc)) {
      descBugs.push(bugRERes[1]);
    }

    var bugIndex = push.desc.indexOf(push.bug);
    if (bugIndex > backoutIndex) {
      // "Backout" appears before the bug number, so we can be pretty confident
      // that this is a backout.
      delete push.bug;

      // However, there is one more thing to test: look for "test for" before the
      // bug number. In that case, we're only backing out the test, not the fix
      Config.partialTestRE.lastIndex = 0;
      reResult = Config.partialTestRE.exec(push.desc);
      if (reResult) {
        var testIndex = reResult.index;
        if (testIndex < bugIndex) {
          push.isBackout = false;
          return;
        }
      }
      push.isBackout = true;
      return;
    }

    // Having reached this point, the bug number is before the backout text. This makes
    // things...interesting.
    // - If the bug number matches an earlier push, assume it's a backout of said push
    // - If there's more than one bug number in the description, and those other bugs are
    //     earlier in the push, mark them as backed out
    // - Otherwise, it's a bug tracker tracked bug

    // Check to see if we've already had a push with this bug number. (At this point, this
    // push is not yet in this._bugs). Only consider this a backout if there is one previous
    // push with this bug number, and there isn't anything claiming it was backed out.
    if (descBugs.length == 1) {
      if (push.bug in this._bugs && this._bugs[push.bug].length == 1 &&
          !this.allPushes[this._bugs[push.bug][0]].backedOut) {
        delete push.bug;
        push.isBackout = true;
      } else {
        // Only 1 bug number? Looks like we've picked up a random commit with backout in message
        push.isBackout = false;
        return;
      }
    }

    // More than 1 bug number is likely a backout, but the bug number before the word backout is
    // likely to be the bug number tracking the backout rather than the thing backed out
    push.isBackout = true;
    return;
  },

  getTags: function PD_getTags(push) {
    push.tags = ['bugherder'];

    if (push.isBackout) {
      push.tags.push('backout');
    }

    // If this is on a release branch and NOT a backout, tag as 'uplift'
    if (push.tags.indexOf('backout') >= 0  && push.hgLink.search(/releases\//) >= 0) {
      push.tags.push('uplift');
    }

    // If this is on an integration branch and NOT a backout, tag as 'landing'
    if (push.tags.indexOf('backout') >= 0 && push.hgLink.search(/integration\//) >= 0) {
      push.tags.push('landing');
    }
  },


  // "Applies" or reverses the effect of the specified backout
  // i.e if reverse is false, it sets the backedOut property on the
  // affected changesets, and applies/reverses any of those changesets
  // that themselves are backouts
  actionBackout: function PD_actionBackout(push, reverse) {
    if (!push.isBackout || push.affected.length == 0)
      return;

    var cset = push.cset;
    var affected = push.affected;
    var len = affected.length

    // Safest to go backwards
    for (var i = push.affected.length - 1; i >= 0; i--) {
      var p = this.allPushes[affected[i]];
      if (!reverse)
        p.backedOut = cset;
      else
        delete p.backedOut;

      if (p.isBackout)
        this.actionBackout(p, !reverse);
    }
  },


  // Calculates the indices in this.allPushes of changesets affected by this
  // backout. Adds an "affected" property to the backout, which is an array
  // of said indices
  buildBackoutAffectedList: function PD_backoutAffectedList(push) {
    function chop(cset) {
      if ((typeof cset == 'string') && cset.length > 12)
        cset = cset.substr(0,12);
      return cset;
    }

    if (!push.isBackout)
      return;

    var desc = push.desc;
    var cset = push.cset;

    push.affected = new Array();

    // Look for "revert to" messages
    var reResult = Config.revertRangeRE.exec(desc);
    if (reResult) {
      var floor = chop(reResult[1]);
      if (!floor)
        return;

      // The csets are backed out are the one immediately following floor, and up to
      // and including the cset immediately prior to this one
      if (!(floor in this._csets && cset in this._csets))
        return;

      var lower = this._csets[floor] + 1;
      var upper = this._csets[cset];
      for (var i = lower; i < upper; i++)
        // Don't let backouts affect merges
        if (!this.allPushes[i].isMerge)
          push.affected.push(i);
      return;
    }

    // Backouts can sometimes be specified by a cset range
    // e.g aaabbbcccddd to eeefff000111 or 222333444555:666777888999
    // This is similar to the "revert to" situation above
    reResult = Config.csetRangeRE.exec(desc);
    if (reResult) {
      var bound1 = chop(reResult[1]);
      var bound2 = chop(reResult[2]);
      if (!bound1 || !bound2)
        return;

      if (!(bound1 in this._csets && bound2 in this._csets))
        return;

      // Two key differences from the "revert to" logic above:
      // Bounds are inclusive, and we shouldn't assume an ordering of the two changesets
      var lower = this._csets[bound1];
      var upper = this._csets[bound2];
      if (upper < lower) {
        var temp = upper;
        upper = lower;
        lower = temp;
      }

      for (var i = lower; i <= upper; i++)
        // Don't let backouts affect merges
        if (!this.allPushes[i].isMerge)
          push.affected.push(i);
      return;
    }

    // Now try looking for individual changeset IDs
    var hadChangesets = false;


    Config.csetIDRE.lastIndex = 0;
    while (reResult = Config.csetIDRE.exec(desc)) {
      hadChangesets = true;
      var outCset = chop(reResult[0]);
      if (outCset in this._csets)
        // Don't let backouts affect merges
        if (!this.allPushes[this._csets[outCset]].isMerge && push.affected.indexOf(this._csets[outCset]) == -1)
          push.affected.push(this._csets[outCset]);
    }

    // Don't look for bug numbers if description included
    // changesets: any bug numbers are likely to refer to the
    // same changesets
    if (hadChangesets) {
      push.affected.sort(function compare(a, b) {
        return a - b;
      });
      return;
    }

    Config.bugNumRE.lastIndex = 0;
    while (reResult = Config.bugNumRE.exec(desc)) {
      var bug = reResult[0];
      // Ignore the bug number if it matches the push bug number
      if (bug == push.bug)
        continue;

      // If we have this bug, any pushes with this bug number will have had their
      // indices in pushes added to this._bugs
      if (this._bugs[bug]) {
        var bugPushes = this._bugs[bug];

        for (var i = 0; i < bugPushes.length; i++) {
          if (!this.allPushes[bugPushes[i]].isMerge && push.affected.indexOf(bugPushes[i]) == -1)
            push.affected.push(bugPushes[i]);
        }
      }
    }
  },


  // Do a second check for merge backouts - if we have two sequential backouts which both
  // claim to affect the same changeset, then the second is a merge backout
  postBackoutMergeCheck: function PD_postBackoutMergeCheck(push) {
    push.affected.sort(function compare(a, b) {
      return a - b;
    });

    // Now, do a check for merge backouts that don't have the word
    // "merge" in them. If every affected changeset is also affected
    // by the immediately preceding changeset, then this is a merge
    if (push.affected.length == 0 || this.allPushes.length < 2 || !this.allPushes[this.allPushes.length - 2].isBackout)
      return;

    var prevAffected = this.allPushes[this.allPushes.length - 2].affected;
    if (!prevAffected || prevAffected.length < push.affected.length)
      return;

    var allInPrevious = true;
    for (var i = 0; i < push.affected.length; i++) {
      if (prevAffected.indexOf(push.affected[i]) == -1)
        allInPrevious = false;
    }

    if (!allInPrevious)
      return;

    push.isBackout = false;
    delete push.affected;
    delete push.bug;
    push.isMerge = true;
  },


  // Create a push object, and flag it as a merge or backout if necessary
  makePush: function PD_makePush(cset) {
    var push = {};
    push.cset = cset.node.substring(0,12);
    push.hgLink = Config.hgRevURL + push.cset;
    // Only use the first line of the commit message, to avoid false
    // positives when checking for bug numbers and backouts later.
    push.desc = UI.htmlEncode(cset.desc.split('\n', 1)[0]);
    push.files = cset.files;

    var author = cset.author;
    var index = author.indexOf(' <');
    if (author.indexOf(' <') != -1) {
      var emailEnd = author.indexOf('>');
      push.email = author.substring(index + 2, emailEnd);
      author = author.substr(0, index);
    } else
      push.email = author;
    push.author = UI.htmlEncode(author);

    // Have a stab at working out the bug number. This will return the first possibility
    // it finds - which may not in fact be the bug number! It may also turn out to be the
    // tip of a merge, or the bug number of the bug backed out by this changeset
    this.getBugNumber(push);

    // Flag various "special" pushes. Order is important here:
    // checkIfBackout assumes merges have already been flagged as such
    this.checkIfMerge(push);
    this.checkIfBackout(push);
    this.getTags(push);
    return push;
  },


  // Given a cset, make a push, and add it to the appropriate array
  createPushFromCset: function PD_createPushFromCset(cset) {
    var push = this.makePush(cset);
    var index = this.allPushes.push(push) - 1;
    // Note where this cset is in case buildBackoutAffectedList needs to find it
    this._csets[push.cset] = index;

    if (push.bug) {
      if (!this._bugs[push.bug])
        this._bugs[push.bug] = new Array();
       var len = this._bugs[push.bug].push(index);

      if (push.isBackout) {
        this.buildBackoutAffectedList(push);
        this.postBackoutMergeCheck(push);
      }
    } else if (push.isBackout) {
        this.buildBackoutAffectedList(push);
        this.postBackoutMergeCheck(push);
    }

    // postBackoutMergeCheck may have removed the backout flag
    if (push.isBackout)
        this.actionBackout(push, false);
  },


  // Classifies each push, and inserts into the appropriate array
  classifyPushes: function PD_classifyPush(push, index) {
    if (push.isMerge)
      this.merges.push(index);
    else if (push.bug && !push.backedOut && !push.isBackout)
      this.fixes.push(index);
    else if (push.backedOut)
      this.backedOut.push(index);
    else if (push.isBackout && push.affected && push.affected.length > 0)
      this.foundBackouts.push(index);
    else if (push.isBackout && push.affected && push.affected.length == 0)
      this.notFoundBackouts.push(index);
    else
      this.others.push(index);
  },


  parseData: function PD_parseData(data, loadCallback) {
    // Maps csets to their indices in pushes
    this._csets = new Array();

    // Maps bug numbers to their indices in pushes
    this._bugs = new Array();

    for (var c in data) {
      var changesets = data[c].changesets;
      changesets.forEach(this.createPushFromCset, this);
    }

    this.allPushes.forEach(this.classifyPushes, this);

    delete this._csets;
    delete this._bugs;

    loadCallback();
  }
};

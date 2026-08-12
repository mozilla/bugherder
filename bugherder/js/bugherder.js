"use strict";

var bugherder = {
  debug: false,
  expand: false,
  milestone: null,
  remap: false,
  resume: false,
  tree: null,
  trackingFlag: null,
  statusFlag: null,
  requestedBugs: [],
  restrictedMode: false,
  restrictedBugs: null,

  stageTypes: [{name: 'foundBackouts'},
    {name: 'notFoundBackouts'},
    {name: 'merges'},
    {name: 'others'},
    {name: 'fixes'}
  ],


  init: function mcM_Init() {
    var self = this;
    $(window).load(function onDocReady() {
      if (Config.inMaintenanceMode) {
        $('#errorText').text('bugherder is down for maintenance!');
        UI.show('errors');
        return;
      }

      if (Config.supportsHistory) {
        // Set the popstate handler on a timeout, to avoid the inital load popstate in Webkit
        window.setTimeout(function mcM_onLoadTimeout() {
          $(window).on('popstate', {bugherder: self}, function mcM_InitPopstate(e) {
           self.parseQuery(e);
          });
        }, 1);
      }
      self.parseQuery();
    });

    $(window).unload(function mcM_InitCleanUp() {
      delete Step.privilegedLoad;
      delete Step.privilegedUpdate;
      delete Step.username;
      BugData.setApiKey(null);
    });
  },


  // Show the initial cset form, optionally with an error, and
  // setup a listener to validate input
  acquireChangeset: function mcM_acquireChangeset(errorText) {
    delete this.cset;
    delete this.loading;

    var self = this;

    document.title = 'bugherder';

    var formListener = function mcM_acquireListener(e) {
      self.validateForm(e);
    };

    if (!errorText)
      UI.showForm(formListener);
    else
      UI.showFormWithError(formListener, errorText);
  },


  // Display an appropriate error, then display the cset form
  errorPage: function mcM_errorPage(params) {
    var errorType = params['error'];
    var errorText = 'Unknown error';
    var cset = 'cset' in params ? ' ' + UI.htmlEncode(params['cset'][0]) : '';
    var treeName = 'tree' in params ? ' ' + UI.htmlEncode(params['tree'][0]) : '';

    var dataType = 'pushlog';
    if (this.loading == 'bz')
      dataType = 'bugzilla';
    if (this.loading == 'version')
      dataType = 'target milestone';
    if (this.loading == 'tracking')
      dataType = 'tracking and status flag';

    if (errorType == 'invalid')
      errorText = 'You entered an invalid changeset ID: IDs should either be 12-40 hexadecimal characters, or "tip"';

    if (errorType == 'fetch')
      errorText = 'Unable to fetch ' + dataType + ' data for changeset' + cset + '.';

    if (errorType == 'timeout')
      errorText = 'Request timed out when trying to fetch ' + dataType + ' data for changeset' + cset + '.';

    if (errorType == 'buglist')
      errorText = 'No bugs found for changeset' + cset + '.';

    if (errorType == 'bugs')
      errorText = 'Unable to load bugzilla data for changeset' + cset + '.';

    if (errorType == 'version')
      errorText = 'Unable to load target milestone possibilities for changeset' + cset + '.';

    if (errorType == 'treename')
      errorText = 'Unknown repository' + treeName + '.';

    this.acquireChangeset(errorText);
  },


  ajaxError: function mcM_ajaxError(response, textStatus, errorThrown, cset) {
    // Ideally, I would use this to provide meaningful error text, if eg cset doesn't exist on m-c.
    // However, jQuery seems to discard the HTTP 500 error that is returned (jqXHR.status gives 0)
    // so, we'll need to fallback to generic text
    if (!cset && this.cset)
      cset = this.cset;

    if (textStatus == 'timeout')
      this.go('error=timeout&cset='+cset, false);
    else
      this.go('error=fetch&cset='+cset, false);
  },


  // Parse the first merge cset description to try and find out what repo was merged with m-c
  findSourceRepo: function mcM_findSourceRepo() {
    var fromRepo = '';
    var mergeDesc = '';
    if (PushData.merges[0])
      mergeDesc = PushData.allPushes[PushData.merges[0]].desc;

    if (!mergeDesc)
      return '';

    mergeDesc = mergeDesc.toLowerCase();

    var reArray = new Array();

    // Create the various regular expressions to match repo merges
    var synonyms = Config.mcSynonyms;
    for (var i = 0; i < synonyms.length; i++) {
      var re = new RegExp(Config.repoMergeRE + synonyms[i], 'ig');
      reArray.push(re);
      re = new RegExp(synonyms[i] + Config.repoMergeRE, 'ig');
      reArray.push(re);
    }

    var reResult = null;
    for (i = 0; i < reArray.length; i++) {
      reResult = reArray[i].exec(mergeDesc);
      if (reResult)
        break;
    }

    if (!reResult)
      return '';

    // We've found text declaring that it's a merge to m-c, can we find another repo name?
    var otherRepo = '';
    for (i in Config.treeInfo) {
      if (i === "mozilla-central")
        continue;

      synonyms = Config.treeInfo[i].synonyms;
      for (var j = 0; j < synonyms.length; j++) {
        if (mergeDesc.indexOf(synonyms[j]) != -1) {
          otherRepo = i;
          break;
        }
      }
      if (otherRepo)
        break;
    }

    if (otherRepo)
      return otherRepo;

    return '';
  },


  // Callback following load of bug data from Bugzilla. Providing there's no errors, it's time
  // to display the UI
  onBugLoad: function mcM_onBugLoad() {
    if (!BugData.bugs) {
      this.go('error=bugs&cset='+this.cset, false);
      return;
    }

    this.updateUI();
  },


  // Callback following load of version options from Bugzilla. Checks for errors, then kicks off
  // bug loading
  onbzVersionLoad: function mcM_onBZVersionLoad() {
    if (!ConfigurationData.milestones) {
      this.go('error=version&cset='+this.cset, false);
      return;
    }

    // Don't bother loading bugs for the debug UI
    if (this.debug) {
      this.updateUI();
      return;
    }

    this.loadBugs();
  },


  // Callback following load of tracking flag names. Kicks off loading of configuration data from BZ
  onFlagsLoad: function mcM_onFlagLoad(flagData) {
    UI.hideLoadingMessage();
    if(flagData.tracking) {
      this.trackingFlag = flagData.tracking;
    }
    if(flagData.status) {
      this.statusFlag = flagData.status;
      // statusFlag has as value e.g. "status_firefox60"
      this.milestone = (this.statusFlag.match(/\D+(\d+)\D*/))[1];
    }
    this.loadConfigurationFromBZ();
  },


  // Callback following load of pushlog data. Kicks off loading of current version from m-c
  onPushlogLoad: function mcM_onPushlogLoad(cset) {
    UI.hideLoadingMessage();

    if (!PushData.allPushes || PushData.allPushes.length == 0) {
      this.go('error=fetch&cset='+cset, false);
      return;
    }

    if (this.tree === "mozilla-central")
      UI.sourceRepo = this.findSourceRepo();

    // Stash the changeset requested for future error messages
    this.cset = cset;

    if (Config.treeInfo[this.tree].trackedTree)
      this.loadFlags();
    else
      this.loadConfigurationFromBZ();
  },


  // Build the list of bugs we're interested in, kick off the async load
  loadBugs: function mcM_loadBugs() {
    if (!PushData.allPushes || !PushData.fixes || !PushData.notFoundBackouts)
      return;

    this.loading = 'bz';
    UI.showLoadingMessage('Loading Bugzilla data...');

    // Build list of bugs to load
    var bugArray = [];
    function forEachCB(val) {
      var bugNum = this.getBug(val);
      // A push can reach backedOut without a bug number of its own
      if (bugNum && bugArray.indexOf(bugNum) == -1)
        bugArray.push(bugNum);
    }

    PushData.fixes.forEach(forEachCB, this);
    PushData.backedOut.forEach(forEachCB, this);


    // Parse commit messages and load backout bugs when the push only contains backouts
    if (PushData.safeToReopen() && bugArray.length == 0 && PushData.notFoundBackouts.length > 0) {
      var reResult;
      for (var i = 0; i < PushData.notFoundBackouts.length; i++) {
        var ind = PushData.notFoundBackouts[i];
        var backoutBugs = [];
        Config.bugNumRE.lastIndex = 0;
         while (reResult = Config.bugNumRE.exec(PushData.allPushes[ind].desc))
          if (backoutBugs.indexOf(reResult[0]) == -1)
            backoutBugs.push(reResult[0]);
        PushData.allPushes[ind].backoutBugs = backoutBugs;
        for (var j = 0; j < backoutBugs.length; j++)
          if (bugArray.indexOf(backoutBugs[j]) == -1)
            bugArray.push(backoutBugs[j]);
      }
    }

    // There were no bug numbers found? Might happen when called with a
    // non-merge "no bug" changeset
    if (bugArray.length == 0) {
      this.updateUI();
      return;
    }

    var self = this;
    var loadCallback = function mcM_loadBugsLoadCallback() {
     self.onBugLoad();
    };

    var errorCallback = function mcM_loadBugsErrorCallback(jqResponse, textStatus, errorThrown) {
      self.ajaxError(jqResponse, textStatus, errorThrown);
    };

    // BugData consumes the array it is given, so keep our own copy to work out
    // afterwards which bugs Bugzilla declined to hand over
    this.requestedBugs = bugArray.slice();

    BugData.load(bugArray, this.resume, loadCallback, errorCallback);
  },


  // Clear it all in one place, so loading another changeset behaves like a page reload
  resetForNewChangeset: function mcM_resetForNewChangeset() {
    this.requestedBugs = [];
    this.restrictedMode = false;
    this.restrictedBugs = null;
    ViewerController.priorSteps = [];
    ViewerController.forgetCredentials();
  },


  // Bugzilla silently omits bugs the requesting user can't see, so these are restricted
  // bugs - or, occasionally, a bug number misdetected in a commit message
  getUnloadedBugs: function mcM_getUnloadedBugs() {
    return this.requestedBugs.filter(function mcM_isUnloaded(bug) {
      return !(bug in BugData.bugs);
    });
  },


  loadRestrictedBugs: function mcM_loadRestrictedBugs() {
    var self = this;
    ViewerController.acquireCredentials(function mcM_onRestrictedKey(key) {
      self.onRestrictedCredentials(key);
    });
  },


  onRestrictedCredentials: function mcM_onRestrictedCredentials(key) {
    var wanted = this.getUnloadedBugs();
    if (wanted.length == 0)
      return;

    UI.showLoadingOverlay();

    // Every load from here on is made as this user, so bugs added by hand can be
    // restricted ones too
    BugData.setApiKey(key);

    var self = this;
    var loadCallback = function mcM_restrictedLoadCallback() {
      self.onRestrictedBugLoad(wanted);
    };

    var errorCallback = function mcM_restrictedLoadErrorCallback(errmsg) {
      UI.hideLoadingOverlay();
      ViewerController.forgetCredentials();
      var reason = errmsg && errmsg.message ? errmsg.message : 'Unknown error';
      UI.showErrorMessage('Unable to load the restricted bugs: ' + reason);
    };

    // Check the comments: this pass is likely to be a second visit
    BugData.load(wanted.slice(), true, loadCallback, errorCallback);
  },


  onRestrictedBugLoad: function mcM_onRestrictedBugLoad(wanted) {
    UI.hideLoadingOverlay();

    var loaded = {};
    var count = 0;
    for (var i = 0; i < wanted.length; i++) {
      if (wanted[i] in BugData.bugs) {
        loaded[wanted[i]] = true;
        count++;
      }
    }

    if (count == 0) {
      ViewerController.forgetCredentials();
      UI.showErrorMessage('None of those bugs could be loaded with that api key. The key may be ' +
                          'wrong, the bugs may be restricted to a group you are not a member of, ' +
                          'or the bug numbers may have been misdetected in the commit messages.');
      return;
    }

    this.restrictedMode = true;
    this.restrictedBugs = loaded;
    this.showSteps();
  },


  updateRestrictedUI: function mcM_updateRestrictedUI() {
    var unloaded = this.getUnloadedBugs();

    if (this.restrictedMode) {
      UI.showRestrictedStatus(Object.keys(this.restrictedBugs).length, unloaded);
      return;
    }

    if (unloaded.length == 0) {
      UI.hideRestricted();
      return;
    }

    var self = this;
    UI.showRestrictedOffer(unloaded.length, function mcM_onRestrictedClick() {
      self.loadRestrictedBugs();
    });
  },


  // Load options for options menu from Bugzilla config
  loadConfigurationFromBZ: function mcM_loadConfigurationFromBZ() {
    this.loading = 'version';
    UI.showLoadingMessage('Loading Bugzilla configuration...');
    var self = this;

    var versionsCallback = function mcM_loadConfigurationLoadCallback() {
      self.onbzVersionLoad();
    };

    var errorCallback = function mcM_loadConfigurationErrorCallback(jqResponse, textStatus, errorThrown) {
      self.ajaxError(jqResponse, textStatus, errorThrown);
    };

    ConfigurationData.init(versionsCallback, errorCallback);
  },


  loadFlags: function mcM_loadFlags() {
    this.loading = 'tracking';
    UI.showLoadingMessage('Calculating tracking/status flags...');

    var self = this;
    var loadCallback = function mcM_loadFlagsLoadCallback(flagData) {
     self.onFlagsLoad(flagData);
    };

    var errorCallback = function mcM_loadFlagsErrorCallback(jqResponse, textStatus, errorThrown) {
      self.ajaxError(jqResponse, textStatus, errorThrown);
    };

    var tree = this.tree;
    FlagLoader.init(this.cset, tree, loadCallback, errorCallback);
  },


  // Load the pushlog for the given cset
  loadChangeset: function mcM_loadChangeset(cset) {
    if (!this.validateChangeset(cset)) {
      this.go('error=invalid', false);
      return;
    }

    // This can run more than once per page load
    this.resetForNewChangeset();

    document.title = 'bugherder (changeset: ' + cset + ')';
    this.loading = 'cset';
    UI.showLoadingMessage('Loading pushlog data...');

    var self = this;
    var loadCallback = function mcM_loadChangsetLoadCallback(pushData) {
     self.onPushlogLoad(cset);
    };

    var errorCallback = function mcM_loadChangesetErrorCallback(jqResponse, textStatus, errorThrown) {
      self.ajaxError(jqResponse, textStatus, errorThrown, cset);
    };

    PushData.init(cset, loadCallback, errorCallback);
  },


  getBug: function mcM_getBug(push) {
    return PushData.allPushes[push].bug;
  },


  showDebugUI: function mcM_debugUI() {
    DebugUI.displayPushes();
  },


  updateUI: function mcM_updateUI() {
    UI.hideAll();
    UI.displayDetail();

    if (this.debug) {
      this.showDebugUI();
      return;
    }

    this.remaps = {items: 0};

    if (this.remap)
      Remapper.show();
    else
      this.showSteps();
  },


  onRemap: function mcM_onRemap(remaps) {
    this.remaps = remaps;
    this.showSteps();
  },


  showSteps: function mcM_showSteps() {
    Step.remaps = this.remaps;
    Viewer.expand = this.expand;
    ViewerController.init(this.remap, this.resume);
    Viewer.init();

    var bugFilter = this.restrictedMode ? this.restrictedBugs : null;

    // How many stages do we have?
    for (var i = 0; i < this.stageTypes.length; i++) {
      var stageName = this.stageTypes[i].name;

      if (PushData[stageName].length == 0)
        continue;

      ViewerController.addStep(stageName, stageName == 'foundBackouts', bugFilter);
    }

    // Shouldn't happen, but don't leave the user staring at nothing if it does
    if (ViewerController.steps.length == 0) {
      this.restrictedMode = false;
      this.restrictedBugs = null;
      UI.showMessageModal('Could not match those bugs to any changeset in this push.');
      this.showSteps();
      return;
    }

    ViewerController.viewStep(0);
    this.updateRestrictedUI();
  },


  validateChangeset: function mcM_validateChangeset(input) {
    return Config.csetInputRE.test(input);
  },


  // Verify form content is valid, and try to load it if so
  validateForm: function mcM_validateForm(e) {
    e.preventDefault();
    var input = $('#changeset').attr('value');
    input = input.trim();

    if (this.validateChangeset(input)) {
      this.go('cset='+input, false);
      return;
    }

    var tree = null;

    for (var treeName in Config.treeInfo) {
      var reRes = Config.treeInfo[treeName].hgRevRE.exec(input);
      if (reRes) {
        input = input.substring(reRes[0].length);
        tree = treeName;
        break;
      } else {
        reRes = Config.treeInfo[treeName].hgPushlogRE.exec(input);
        if (reRes) {
          input = input.substring(reRes[0].length);
          tree = treeName;
          break;
        }
      }
    }

    if (tree && this.validateChangeset(input)) {
      this.go('cset='+input + '&tree=' + tree, false);
      return;
    }

    // Don't fill history stack with multiple error pages
    var replace = document.location.href.indexOf('error') != -1;
    this.go('error=invalid', replace);
  },


  // Parse URL to display correct content
  parseQuery: function mcM_parseQuery(event) {
    var self = null;
    if (!event)
      self = this;
    else
      self = event.data.bugherder;

    var query = document.location.search;
    if (query) {
      var paramsObj = this.chunkQuery(query);
      if ('debug' in paramsObj)
        this.debug = (paramsObj['debug'][0] == '1');
      if ('expand' in paramsObj)
        this.expand = (paramsObj['expand'][0] == '1');
      if ('remap' in paramsObj)
        this.remap = (paramsObj['remap'][0] == '1');
      if ('resume' in paramsObj)
        this.resume = (paramsObj['resume'][0] == '1');

      if ('error' in paramsObj)
        return self.errorPage(paramsObj);

      if ('cset' in paramsObj) {
        var cset = paramsObj['cset'][0];

        if ('tree' in paramsObj) {
          var treeName = paramsObj['tree'][0].toLowerCase();
          if (!(treeName in Config.treeInfo) && !(treeName in Config.rewriteTrees)) {
            var replace = document.location.href.indexOf('error') != -1;
            this.go('error=treename&tree=' + treeName, replace);
            return;
          }

          if (treeName in Config.rewriteTrees) {
            var newTree = Config.rewriteTrees[treeName];
            this.go('cset=' + cset + '&tree=' + newTree, true);
            return;
          }

          this.tree = treeName;
        } else
          this.tree = treeName = "mozilla-central";

        Config.hgURL = Config.treeInfo[treeName].hgURL;
        Config.hgRevURL = Config.treeInfo[treeName].hgRevURL;
        Config.hgPushlogURL = Config.treeInfo[treeName].hgPushlogURL;
        Config.treeName = treeName;

        return self.loadChangeset(cset);
      }
    }
    return self.acquireChangeset();
  },

  // Create an object that contains all parameters from a search/query string
  // The properties are arrays to make room for a future of multi-tree/cset marking
  chunkQuery: function mcM_chunkQuery(query) {
    query = query.substring(1);
    var params = query.split('&');
    var paramsObj = {}
    for (var x in params) {
      var p = params[x].split('=');
      if(!paramsObj[p[0]]) {
        paramsObj[p[0]] = [p[1]];
      } else {
        paramsObj[p[0]].push(p[1]);
      }
    }
    return paramsObj;
  },


  // Push a new URL onto history
  go: function mcM_go(query, replace) {
    var maintained = [];
    function persist(prop) {
      if (this[prop])
        maintained.push(prop + '=1');
    }

    // Maintain various parameters across page loads
    var persisted = ['debug', 'expand', 'remap', 'resume'];
    persisted.forEach(persist, this);

    var newURL = document.location.href.split('?')[0];
    if (query)
      newURL = newURL + '?' + query;

    var maintainedQuery = maintained.join('&');
    if (!query && maintainedQuery.length > 0)
      newURL += '?';
    else if (query && maintainedQuery.length > 0)
      newURL += '&';
    newURL += maintainedQuery;

    // Put the cset and tree parameters back in no matter what if present
    var currentURLSearch = this.chunkQuery(document.location.search);
    var newURLSearch = this.chunkQuery(newURL.split('?')[1]);
    if (currentURLSearch['cset'] && !newURLSearch['cset']) {
      newURL = newURL + '&cset=' + currentURLSearch['cset'][0];
    }
    if (currentURLSearch['tree'] && !newURLSearch['tree']) {
      newURL = newURL + '&tree=' + currentURLSearch['tree'][0];
    }

    if (Config.supportsHistory) {
      if (replace)
        history.replaceState(null, null, newURL);
      else
        history.pushState(null, null, newURL);
      this.parseQuery();
    } else {
       document.location.href = newURL;
    }
  }
};
bugherder.init();

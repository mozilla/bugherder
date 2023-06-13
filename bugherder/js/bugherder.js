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
    var errorType = params.get('error');
    var errorText = 'Unknown error';
    var cset = params.has('cset') ? ' ' + UI.htmlEncode(params.get('cset')) : '';
    var treeName = params.has('tree') ? ' ' + UI.htmlEncode(params.get('tree')) : '';

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
      if (bugArray.indexOf(bugNum) == -1)
        bugArray.push(bugNum);
    }

    PushData.fixes.forEach(forEachCB, this);
    PushData.backedOut.forEach(forEachCB, this);


    // Parse commit messages and load backout bugs when the push only contains backouts
    if (PushData.safeToReopen() && bugArray.length == 0 && PushData.notFoundBackouts.length > 0) {
      var reResult;
      for (var i = 0; i < PushData.notFoundBackouts.length; i++) {
        var ind = PushData.notFoundBackouts[i];
        PushData.allPushes[ind].backoutBugs = [];
        Config.bugNumRE.lastIndex = 0;
         while (reResult = Config.bugNumRE.exec(PushData.allPushes[ind].desc))
          if (PushData.allPushes[ind].backoutBugs.indexOf(reResult[0]) == -1)
            PushData.allPushes[ind].backoutBugs.push(reResult[0]);
        bugArray.push.apply(bugArray, PushData.allPushes[ind].backoutBugs);
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

    BugData.load(bugArray, this.resume, loadCallback, errorCallback);
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

    // How many stages do we have?
    for (var i = 0; i < this.stageTypes.length; i++) {
      var stageName = this.stageTypes[i].name;

      if (PushData[stageName].length == 0)
        continue;

      ViewerController.addStep(stageName, stageName == 'foundBackouts');
    }

    ViewerController.viewStep(0);
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
      var paramsObj = new URLSearchParams(query);
      this.persistingParams.forEach((param) => {
        if (paramsObj.has(param))
          this[param] = (paramsObj.get(param) == '1');
      }, this);

      if (paramsObj.has('error'))
        return self.errorPage(paramsObj);

      if (paramsObj.has('cset')) {
        var cset = paramsObj.get('cset');

        if (paramsObj.has('tree')) {
          var treeName = paramsObj.get('tree').toLowerCase();
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

  // Parameters maintained across page loads
  persistingParams: ['debug', 'expand', 'remap', 'resume'],

  // Push a new URL onto history
  go: function mcM_go(query, replace) {
    var params = new URLSearchParams(query);
    this.persistingParams.forEach((param) => {
      if (this[param]) {
        params.append(param, '1');
      }
    }, this);

    var newQueryString = params.toString();
    var newURL = document.location.href.split('?')[0];
    if (newQueryString)
      newURL = newURL + '?' + newQueryString;

    // Put the cset and tree parameters back in no matter what if present
    var currentURLSearch = new URLSearchParams(document.location.search);
    var newURLSearch = new URLSearchParams(newURL.split('?')[1]);
    if (currentURLSearch.has('cset') && !newURLSearch.has('cset')) {
      newURL = newURL + '&cset=' + currentURLSearch.get('cset');
    }
    if (currentURLSearch.has('tree') && !newURLSearch.has('tree')) {
      newURL = newURL + '&tree=' + currentURLSearch.get('tree');
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

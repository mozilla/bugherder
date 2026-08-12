"use strict";

var ViewerController = {
  credentialsCallback: null,
  priorSteps: [],

  init: function vc_Init(remap, resume) {
    this.remap = remap;
    this.currentStep = -1;
    this.maxStep = -1;

    // A Step is the only record of what it submitted and which of its bugs could not
    // be loaded, both of which the summary still needs
    if (this.steps)
      this.priorSteps = this.priorSteps.concat(this.steps);

    this.steps = [];
    this.resume = resume;
  },


  getCurrentStep: function vc_getCurrentStep() {
    if (this.currentStep != -1)
      return this.steps[this.currentStep];
  },


  removeBug: function vc_RemoveBug(index, bug) {
    // Remove from attachedBugs
    this.steps[this.currentStep].detachBugFromCset(index, bug);

    // Call in to viewer
    Viewer.removeBug(index, bug);
    Viewer.updateHelpText();
  },


  isValidBugNumber: function vc_IsValidBugNumber(input) {
    return Config.strictBugNumRE.test(input);
  },


  isValidEmail: function vc_IsValidBugNumber(input) {
    return Config.emailRE.test(input);
  },


  addBug: function vc_AddBug(index, bug) {
    UI.hideLoadingOverlay();
    var step = this.steps[this.currentStep];
    step.attachBugToCset(index, bug);
    Viewer.addBug(index, bug);
    Viewer.updateHelpText();
  },


  onCredentialsEntered: function vc_onCredentialsEntered(key) {
    $('#apikey')[0].value = '';

    // Create privileged loader
    var options = {username: null, password: null, api_key: key}
    if (this.remap)
      options.url = "https://bugzilla-dev.allizom.org/rest";

    var privLoader = bz.createClient(options);

    var privilegedUpdate = function(id, data, callback) {
      privLoader.updateBug(id, data, callback);
    }

    var privilegedLoad = function(id, callback) {
      privLoader.getBug(id, callback);
    }

    Step.privilegedUpdate = privilegedUpdate;
    Step.privilegedLoad = privilegedLoad;

    // The key may have been asked for on someone else's behalf
    var callback = ViewerController.credentialsCallback;
    ViewerController.credentialsCallback = null;
    if (callback) {
      callback(key);
      return;
    }

    this.steps[this.currentStep].onCredentialsAcquired();
  },


  // Called detached from ViewerController by the submit path, so don't rely on |this|
  acquireCredentials: function vc_acquireCredentials(callback) {
    ViewerController.credentialsCallback = callback || null;
    UI.showCredentialsForm();
  },


  forgetCredentials: function vc_forgetCredentials() {
    ViewerController.credentialsCallback = null;
    BugData.setApiKey(null);
    delete Step.privilegedLoad;
    delete Step.privilegedUpdate;
  },


  onAddBug: function vc_onAddBug(index, input) {
    UI.showLoadingOverlay();

    // Verify input is valid
    input = input.trim();
    if (!this.isValidBugNumber(input)) {
      UI.showInvalidBugDialog();
      return;
    }

    // Verify bug is not already attached
    if (this.steps[this.currentStep].isAttached(index, input)) {
      UI.hideLoadingOverlay();
      return;
    }

    // Check to see if we already have bug in BugData
    if (input in BugData.bugs) {
      this.addBug(index, input);
      return;
    }

    // Kick off load if not
    var self = this;
    var loadCallback = function vc_onAddBugLoadCallback() {
      self.addBug(index, input);
    };
    BugData.load([input], this.resume, loadCallback, null);
  },


  onChangeBug: function vc_onAddBug(index, bug, input) {
    UI.showLoadingOverlay();

    // Verify input is valid
    input = input.trim();
    if (!this.isValidBugNumber(input)) {
      UI.showInvalidBugDialog();
      return;
    }

    // Verify it's not the same!
    if (bug == input) {
      UI.hideLoadingOverlay();
      Viewer.addChangeButtonListener(cset, bug);
      return;
    }

    // If the new bug number is already attached, just delete the old one
    if (this.steps[this.currentStep].isAttached(index, input)) {
      UI.hideLoadingOverlay();
      this.removeBug(index, bug);
      return;
    }

    // Check to see if we already have bug in BugData.bugs
    if (input in BugData.bugs) {
      this.addBug(index, input);
      this.removeBug(index, bug);
      return;
    }

    // Kick off load if not
    var self = this;
    var loadCallback = function vc_onChangeBugLoadCallback() {
      self.addBug(index, input);
      self.removeBug(index, bug);
    };
    BugData.load([input], this.resume, loadCallback, null);
  },


  onCommentCheckClick: function vc_onCommentCheckClick(index, bug, newVal) {
    this.steps[this.currentStep].setShouldComment(index, bug, newVal);
    Viewer.updateHelpText();
    Viewer.updateSubmitButton();
  },


  onResolveCheckClick: function vc_onResolveCheckClick(bug, newVal) {
    this.steps[this.currentStep].setShouldResolve(bug, newVal);
    Viewer.updateHelpText();
    Viewer.updateSubmitButton();
  },


  onReopenCheckClick: function vc_onReopenCheckClick(bug, newVal) {
    this.steps[this.currentStep].setShouldReopen(bug, newVal);
    Viewer.updateSubmitButton();
  },


  onCommentInput: function vc_onCommentInput(index, bug, newVal) {
    this.steps[this.currentStep].setComment(index, bug, newVal);
  },


  onWhiteboardInput: function vc_onWhiteboardInput(index, bug, newVal) {
    this.steps[this.currentStep].setWhiteboard(index, bug, newVal.replace(/\n/g, ''));
  },


  onMilestoneChange: function vc_onMilestoneChange(bug, newVal) {
    this.steps[this.currentStep].setMilestone(bug, newVal);
  },


  onTestsuiteChange: function vc_onTestsuiteChange(bug, newVal) {
    this.steps[this.currentStep].setTestsuite(bug, newVal);
  },


  postSubmitUpdate: function vc_postSubmitUpdate(index, bug) {
    Viewer.removeBug(index, bug);
    Viewer.addBug(index, bug);
  },


  addStep: function vc_addStage(name, isBackedOut, bugFilter) {
    var step;

    var callbacks = {credentialsCallback: this.acquireCredentials,
                     uiUpdate: this.postSubmitUpdate};

    step = new Step(name, callbacks, isBackedOut, bugFilter);

    if (bugFilter && step.getPushes().length == 0)
      return;

    var index = this.steps.push(step) - 1;
    this.maxStep = this.steps.length;
    step.setStepNumber(index + 1);
    for (var i = 0; i < this.maxStep; i++)
      this.steps[i].setMaxStepNumber(this.maxStep);
  },


  onPrevious: function vc_onPrevious() {
    this.viewStep(this.currentStep - 1);
  },


  onNext: function vc_onNext() {
    this.viewStep(this.currentStep + 1);
  },


  viewStep: function vc_viewStep(stepIndex) {
    this.currentStep = stepIndex;
    if (stepIndex == this.maxStep) {
      this.viewSummary();
      return;
    }

    var step = this.steps[this.currentStep];
    var self = this;
    var onPreviousFn = function vc_viewStepOnPrevious(target) {
      self.onPrevious();
    };
    var onPrevious = {label: 'Previous', fn: onPreviousFn};
    if (stepIndex == 0)
      onPrevious.fn = null;

    var onNextfn = function vc_viewStepOnNext(target) {
      self.onNext();
    };
    var onNext = {label: 'Next', fn: onNextfn};
    if (stepIndex == (this.maxStep - 1))
      onNext.label = 'Summary';

    Viewer.view(step, onPrevious, onNext);
  },


  viewSummary: function vc_viewSummary() {
    var self = this;
    var onPreviousFn = function vc_viewSummaryOnPrevious() {
      self.onPrevious();
    };
    var onPrevious = {label: 'Previous', fn: onPreviousFn};

    var onNextfn = function vc_viewSummaryOnNext() {
      self.onNext();
    };
    var onNext = {label: 'Next', fn: null};

    Summary.view(this.steps, onPrevious, onNext, this.priorSteps);
  }
};

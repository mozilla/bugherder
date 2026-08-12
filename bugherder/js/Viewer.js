"use strict";

var Viewer = {
  init: function viewer_init() {
    var listener = this.listener;
    function bindListener(that, listeners) {
      return function (e) {
        listener.call(that, listeners, e);
      };
    }

    var indexOnly = ['index'];
    var indexBug = ['index', 'bug'];

    var clickListeners = {
      'addBug'      : this.decorateWithRequired(this.onAddButtonClick, indexOnly, 'Add'),
      'changeButton': this.decorateWithRequired(this.onChangeButtonClick, indexBug, 'Change'),
      'removeButton': this.decorateWithRequired(this.onRemoveButtonClick, indexBug, 'Remove'),
      'commentCheck': this.decorateWithRequired(this.onCommentCheckClick, indexBug, 'Comment'),
      'resolveCheck': this.decorateWithRequired(this.onResolveCheckClick, indexBug, 'Resolve'),
      'reopenCheck' : this.decorateWithRequired(this.onReopenCheckClick, indexBug, 'Reopen'),
      'securityReleaseCheck': this.decorateWithRequired(this.onSecurityReleaseCheckClick, indexBug, 'Security release'),
      'viewhide'    : this.decorateWithRequired(this.onViewHideClick, indexBug, 'View/Hide'),
      'fileviewhide': this.decorateWithRequired(this.onFileViewHideClick, indexOnly, 'View/Hide files'),
      'expandButton': this.onExpandButtonClick,
      'submitButton': this.onSubmitButtonClick,
      'prevButton'  : this.onPreviousButtonClick,
      'nextButton'  : this.onNextButtonClick
    };

    var inputListeners = {
      'comment': this.decorateWithRequired(this.onCommentInput, indexBug, 'Comment text'),
      'whiteboardTA': this.decorateWithRequired(this.onWhiteboardInput, indexBug, 'Whiteboard')
    };

    var changeListeners = {
      'milestone': this.decorateWithRequired(this.onMilestoneChange, indexBug, 'Milestone'),
      'testsuite': this.decorateWithRequired(this.onTestsuiteChange, indexBug, 'Testsuite')
    };

    // init runs again when the steps are rebuilt, so don't stack a second handler set
    var self = this;
    $('#viewerOutput').off('.viewer');
    $('#viewerOutput').on('click.viewer', bindListener(self, clickListeners));
    $('#viewerOutput').on('input.viewer', bindListener(self, inputListeners));
    $('#viewerOutput').on('change.viewer', bindListener(self, changeListeners));
  },


  listener: function viewer_listener(listeners, e) {
    var className = e.target.className.split(' ')[0];
    if (!(className in listeners))
      return;

    listeners[className].call(this, e.target);
  },


  decorateWithRequired: function viewer_decorateWithRequired(fn, required, which) {
    return function (target) {
      var args = [];
      for (var i = 0; i < required.length; i++) {
        var attribute = 'data-' + required[i];
        if (!target.hasAttribute(attribute)) {
          UI.showErrorMessage(which + ' had event without data!');
          return;
        }
        args.push(target.getAttribute(attribute));
      }
      args.push(target);
      fn.apply(this, args);
    };
  },

  // Buttons
  onPreviousButtonClick: function viewer_onPreviousButtonClick() {
    if (this.onPreviousFn)
      this.onPreviousFn();
  },


  onNextButtonClick: function viewer_onNextButtonClick() {
    if (this.onNextFn)
      this.onNextFn();
  },


  onAddButtonClick: function viewer_onAddButtonClick(index, target) {
    UI.showBugLoadForm(index);
  },


  onChangeButtonClick: function viewer_onChangeButtonClick(index, bug, target) {
    UI.showBugChangeForm(index, bug);
  },


  onRemoveButtonClick: function viewer_onRemoveButtonClick(index, bug, target) {
    ViewerController.removeBug(index, bug);
  },


  onExpandButtonClick: function viewer_onExpandButtonClick(target) {
    var shouldExpand = $('#expandButton').text() === 'Expand all comments';
    $('.commentDiv').toggle(shouldExpand);
    var expandText = shouldExpand ? 'Hide all comments' : 'Expand all comments';
    $('#expandButton').text(expandText);
    var individualText = shouldExpand ? 'Hide comment' : 'View comment';
    $('.viewhide').text(individualText);
  },


  onSubmitButtonClick: function viewer_onSubmitButtonClick(target) {
    this.step.onSubmit();
  },


  // Spans
  onViewHideClick: function viewer_onViewHideClick(index, bug, target) {
    var cset = PushData.allPushes[index].cset;
    var currentText = target.textContent;
    var expandThis = currentText == 'View comment';
    $('#' + this.getCommentID(cset, bug)).toggle(expandThis);
    target.textContent = expandThis ? 'Hide comment' : 'View comment';
    
    // Update 'expand all' button text
    var shouldExpand = false;
    if (expandThis) {
      var divs = $('.commentDiv').get();
      for (var i = 0, l = divs.length; i < l; i++) {
        var style = divs[i].style.display.toLowerCase();
        if (style === 'none' || style === '')
          shouldExpand = true;
      }
    } else {
      // Shortcut if we've just minimised a comment
      shouldExpand = true;
    }

    var expandText = shouldExpand ? 'Expand all comments' : 'Hide all comments';
    $('#expandButton').text(expandText);
  },


  onFileViewHideClick: function viewer_onFileViewHideClick(cset, target) {
    var shouldExpand = target.textContent == 'View files';
    $('#' + this.getFilesID(cset)).toggle(shouldExpand);

    // Flip the text appropriately
    var classes = target.className.split(' ');
    var classToChange = '';
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf('Files') != -1)
        classToChange = classes[i];
    }
    var newText = shouldExpand ? 'Hide files' : 'View files';
    $('.' + classToChange).text(newText);
  },


  // Text inputs
  onCommentInput: function viewer_onCommentInput(index, bug, target) {
    ViewerController.onCommentInput(index, bug, target.value);
  },


  onWhiteboardInput: function viewer_onWhiteboardInput(index, bug, target) {
    $('.' + bug + 'whiteboard').val(target.value); 
    ViewerController.onWhiteboardInput(index, bug, target.value);
  },


  // Checkboxes
  onResolveCheckClick: function viewer_onResolveCheckClick(index, bug, target) {
    // Update all other instances of this bug
    $('.'+bug+'resolvecheck').attr('checked', target.checked);

    // If we've turned it off, also turn off milestone selection
    // (we don't support setting the milestone without setting the
    // resolution).
    $('.'+bug+'Milestone').attr('disabled', !target.checked);

    $('.'+bug+'securityReleasecheck').attr('checked', target.checked);

    ViewerController.onResolveCheckClick(bug, target.checked);
  },


  onReopenCheckClick: function viewer_onReopenCheckClick(index, bug, target) {
    // Update all other instances of this bug
    $('.'+bug+'reopencheck').attr('checked', target.checked);

    // If we've turned it on, also turn on commenting - I don't think
    // you would ever backout a bug without an explanation!
    this.unsetComments(bug, target.checked);
    ViewerController.onReopenCheckClick(bug, target.checked);
  },


  onSecurityReleaseCheckClick: function viewer_onSecurityReleaseCheckClick(index, bug, target) {
    // Update all other instances of this bug
    $('.'+bug+'securityReleasecheck').attr('checked', target.checked);

    ViewerController.onSecurityReleaseCheckClick(bug, target.checked);
  },


  onCommentCheckClick: function viewer_onCommentCheckClick(index, bug, target) {
    ViewerController.onCommentCheckClick(index, bug, target.checked);

    // Comments and reopening are dependent
    if (ViewerController.getCurrentStep().canReopen(bug)) {
      this.unsetComments(bug, target.checked);
      var elems = $('.' + bug + 'reopencheck');
      if (elems.length > 0 && elems.attr('checked') != target.checked)
        elems[0].click();
    }
  },


  unsetComments: function viewer_unsetComments(bug, checked) {
    var elems = $('.' + bug + 'commentcheck');
    var l = elems.length;
    for (var i = 0; i < l; i++) {
      var elem = elems[i];
      if (elem.getAttribute('checked') != checked) {
        var index = elem.getAttribute('data-index');
        ViewerController.onCommentCheckClick(index, bug, checked);
      }
    }
    elems.attr('checked', checked);
  },


  // Selects
  onMilestoneChange: function viewer_onMilestoneChange(index, bug, target) {
    // Update all other instances of this bug
    $('.'+bug+'Milestone').val(target.value);
    ViewerController.onMilestoneChange(bug, target.value);
  },


  onTestsuiteChange: function viewer_onTestsuiteChange(index, bug, target) {
    // Update all other instances of this bug
    $('.'+bug+'Testsuite').val(target.value);
    ViewerController.onTestsuiteChange(bug, target.value);
  },


  addBug: function viewer_attachBug(index, bugID) {
    var cset = PushData.allPushes[index].cset;

    var bugHTML = this.makeBugHTML(index, bugID);
    $('#' + this.getBugDivID(cset)).prepend(bugHTML);

    this.updateSubmitButton();
  },


  // Assumes the bug has already been removed from attachedBugs[cset]
  removeBug: function viewer_removeBug(index, id) {
    var cset = PushData.allPushes[index].cset;
    $('#' + this.getBugCsetID(cset, id)).remove();
    this.updateSubmitButton();
  },


  getAddBugIDForCset: function viewer_getAddBugIDForPush(index) {
    return 'addBug' + index;
  },


  getBugCsetID: function viewer_getBugCsetID(cset, id) {
    return cset + id;
  },


  getMilestonesID: function viewer_getMilestones(cset, id) {
    return cset + id + 'Milestones';
  },


  getTestsuiteID: function viewer_getTestsuiteID(cset, id) {
    return cset + id + 'Testsuite';
  },


  getViewHideID: function viewer_getViewHideID(cset, id) {
    return cset + id + 'ViewHide';
  },


  getFilesID: function viewer_getFilesID(cset) {
    return cset + 'Files';
  },


  getCommentCheckID: function viewer_getCommentCheckID(cset, id) {
    return cset + id + 'CommentCheck';
  },


  getResolveCheckID: function viewer_getResolveCheckID(cset, id) {
    return cset + id + 'ResolveCheck';
  },


  getReopenCheckID: function viewer_getReopenCheckID(cset, id) {
    return cset + id + 'ReopenCheck';
  },


  getSecurityReleaseCheckID: function viewer_getSecurityReleaseCheckID(cset, id) {
    return cset + id + 'SecurityReleaseCheck';
  },


  getRemoveButtonID: function viewer_getRemoveButtonID(cset, id) {
    return cset + id + 'Remove';
  },


  getChangeButtonID: function viewer_getChangeButtonID(cset, id) {
    return cset + id + 'Change';
  },


  getCommentID: function viewer_getCommentID(cset, id) {
    return cset + id + 'Comment';
  },


  getCommentTextAreaID: function viewer_getCommentTextAreaID(cset, id) {
    return cset + id + 'CommentText';
  },


  getWhiteboardID: function viewer_getWhiteboardID(cset, id) {
    return cset + id + 'Whiteboard';
  },


  getBugDivID: function viewer_getBugDivID(cset) {
    return cset + 'Bugs';
  },


  makeDataHTML: function viewer_makeDataHTML(index, bug) {
    bug = bug || null;
    var html = 'data-index="' + index + '" ';
    if (bug)
      html += 'data-bug="' + bug + '" ';
    return html;
  },


  makeMilestoneSelectHTML: function viewer_makeMilestoneSelectHTML(cset, index, id) {
    var product = BugData.bugs[id].product;
    // Milestones are already encoded by the time they reach bugInfo
    if (!(product in ConfigurationData.milestones))
      return this.step.getMilestone(id);

    var html = '<select id="';
    html += this.getMilestonesID(cset, id);
    html += '" class="milestone ' + id + 'Milestone"';
    html += ' ' + this.makeDataHTML(index, id);
    if (!this.step.canResolve(id) || !this.step.shouldResolve(id) || !this.step.canSetMilestone(id))
      html += ' disabled="true"';
    html += '>';
    var milestones = ConfigurationData.milestones[product].values;
    var defaultMilestone = this.step.getMilestone(id);
    for (var i = 0; i < milestones.length; i++) {
      html += '<option value="' + milestones[i] + '"';
      if (milestones[i] == defaultMilestone)
        html += ' selected';
      html += '>' + milestones[i] + '</option>';
    }
    html += '</select>';
    return html;
  },


  makeTestsuiteHTML: function viewer_makeTestsuiteHTML(cset, index, id) {
    var html = '<select id="';
    html += this.getTestsuiteID(cset, id);
    html += '" class="testsuite ' + id + 'Testsuite"';
    html += ' ' + this.makeDataHTML(index, id);
    html += '>';
    var statuses = [' ', '?', '+', '-'];
    var defaultStatus = this.step.getTestsuite(id);
    for (var i = 0; i < statuses.length; i++) {
      html += '<option value="' + statuses[i] + '"';
      if (statuses[i] == defaultStatus)
        html += ' selected';
      html += '>' + statuses[i] + '</option>';
    }
    html += '</select>';
    return html;
  },


  makeRemoveButtonHTML: function viewer_makeRemoveButtonHTML(cset, index, id) {
     var html = '<button class="removeButton" id="' + this.getRemoveButtonID(cset, id) + '" ';
     html += this.makeDataHTML(index, id);
     html += ' type="button">Remove</button>';
     return html;
  },


  makeChangeButtonHTML: function viewer_makeChangeButtonHTML(cset, index, bug) {
     var html = '<button class="changeButton" id="' + this.getChangeButtonID(cset, bug) + '" ';
     html += this.makeDataHTML(index, bug);
     html += ' type="button">Change</button>';
     return html;
  },


  makeCheckboxHTML: function viewer_makeCheckboxHTML(cset, index, id, type) {
    var upperType = type.charAt(0).toUpperCase() + type.slice(1);
    var html = '<input type="checkbox" class="' + type + 'Check';
    html += ' ' + id + type + 'check" value="' + type + '"';
    var canProp = "can" + upperType;
    var shouldProp = "should" + upperType;
    var idFn = 'get' + upperType + 'CheckID';
    html += ' name="' + this[idFn](cset,id) + '"';
    html += ' id="' + this[idFn](cset, id) + '" ';
    html += this.makeDataHTML(index, id);
    if (this.step.isAttached(index, id) && this.step.getProp(index, id, shouldProp))
      html  += ' checked="checked"';
    if (!this.step.isAttached(index, id) || !this.step.getProp(index, id, canProp)) {
      html  += ' disabled="disabled"';
    }
    html += ' />';
    return html;
  },


  makeCommentHTML: function viewer_makeCommentHTML(cset, index, id) {
    var html = 'Comment: ';
    html += '<textarea class="comment" rows="3" cols="60" id="' + this.getCommentTextAreaID(cset, id);
    html += '" ' + this.makeDataHTML(index, id);
    if (!this.step.canComment(index, id))
      html += ' disabled="true"';
    html += '>';
    html += this.step.getComment(index, id);
    html += '</textarea>';
    return html;
  },


  makeWhiteboardHTML: function viewer_makeWhiteBoardHTML(cset, index, id) {
    var bug = BugData.bugs[id];
    var html = '<textarea class="whiteboardTA ' + id + 'whiteboard" rows="4" id="' + this.getWhiteboardID(cset, id);
    html += '" ' + this.makeDataHTML(index, id) + '>';
    if (bug.whiteboard)
      html += bug.whiteboard.replace(/]/g, ']\n');
    html += '</textarea>';
    return html;
  },


  makeBugHTML: function viewer_makeBugHTML(index, id) {
    var html = '';

    var bug = BugData.bugs[id];
    // Need to use the cset rather than index for unique IDs
    // otherwise we could have eg index 8 bug 765432 and index 87 bug 65432 generating non-unique IDs
    var cset = PushData.allPushes[index].cset;

    html += '    <div class="bug'
    if (bug && (bug.status == 'RESOLVED' || bug.status == 'VERIFIED'))
      html += ' resolved';
    html += '" id="' + this.getBugCsetID(cset, id) + '">';
    html += '      <div class="grid-3">Bug ' + UI.linkifyBug(id) + '</div>';
    html += '      <div class="grid-3">';
    if (bug)
      html += bug.status + " " + bug.resolution;
    html += '      </div>';
    html += '      <div class="grid-3">';
    if (bug)
      html += this.makeMilestoneSelectHTML(cset, index, id);
    html += '      </div>';
    html += '      <div class="grid-3 divRight">';
    html += this.makeRemoveButtonHTML(cset, index, id);
    html += this.makeChangeButtonHTML(cset, index, id);
    html += '</div>';
    html += '       <div class="grid-12">';
    if (bug)
      html += UI.linkifyDescription(bug.summary);
    else
      html += "<em>Unable to load bug " + id + " - security bug?</em>";
    html += '</div>'
    if (bug) {
      html += '       <div class="grid-6 whiteboard">Whiteboard:';
      html += this.makeWhiteboardHTML(cset, index, id);
      html += '       </div>';
    } else
      html += '<div class="grid-6"></div>';
    html += '<div class="grid-6 afterWhiteboard">';
    if (bug && bug.leaveOpen)
      html += ' <span class="afterWhiteboard leaveOpen">LEAVE OPEN</span><br>';
    else
      html += '<br>';
    html += '<span class="afterWhiteboard">';
    html += 'Comment: ';
    html += this.makeCheckboxHTML(cset, index, id, 'comment');
    html += ' Resolve: ';
    html += this.makeCheckboxHTML(cset, index, id, 'resolve');
    html += '</span>';
    if (this.step.canReopen(id)) {
      html += '<br><span class="afterWhiteboard">Reopen: ';
      html += this.makeCheckboxHTML(cset, index, id, 'reopen');
      html += '</span>';
    } else
      html += '<br>';
    if (this.step.canSecurityRelease(id)) {
      html += '<span class="afterWhiteboard" title="Move out of ';
      html += UI.htmlEncode(bug.securityGroups.join(', ')) + '">Move to ';
      html += UI.htmlEncode(Config.securityReleaseGroup) + ': ';
      html += this.makeCheckboxHTML(cset, index, id, 'securityRelease');
      html += '</span><br>';
    }
    if (bug && bug.canSetTestsuite) {
      html += '<span class="afterWhiteboard">In-testsuite: ';
      html += this.makeTestsuiteHTML(cset, index, id);
      html += '</span><br>';
    } else
      html += '<br>';
    html += '<br>';
    html += '<span class="afterWhiteboard">';
    html += '<span class="viewhide" id="' + this.getViewHideID(cset, id) + '" ';
    html += this.makeDataHTML(index, id) + '>View comment</span></span></div>';
    html += '<div class="grid-12 commentDiv" id ="' + this.getCommentID(cset, id) + '">';
    html += this.makeCommentHTML(cset, index, id);
    html += '</div>';
    html += '</div>';

    return html;
  },


  makeBugDivHTML: function viewer_makeBugDivHTML(index) {
    var html = '  <div id="' + this.getBugDivID(index) + '">';
    html += '    </div>';
    return html;
  },



  makeHTMLForChangeset: function viewer_makeHTMLForChangeset(index, classToAdd) {
    var html = "";
    var cset = PushData.allPushes[index].cset;
    var desc = PushData.allPushes[index].desc;
    var author = PushData.allPushes[index].author;
    var files = PushData.allPushes[index].files;
    html += '<div class="changeset';
    if (classToAdd != '')
      html += ' ' + classToAdd;
    html += '">';
    html += '  <div class="csetHead">';
    html += '    <div class="csetTitle';
    if (classToAdd != '')
      html += ' ' + classToAdd;
    html += '">';
    html += '      <div class="grid-12">Changeset: '+ UI.linkifyChangeset(cset) + '</div>';
    html += '    </div>';
    html += '      <div class="grid-12">'+ author + '</div>';
    html += '    <div class="grid-two-thirds">' + UI.linkifyDescription(desc);
    html += '    </div>';
    html += '    <div class="grid-one-third divRight">';
    html += '      <button class="addBug" ' + this.makeDataHTML(index);
    html += ' id="' + this.getAddBugIDForCset(index) + '" type="button">Add Bug</button>';
    html += '    </div>';
    html += '    <div class="grid-12"><span class="fileviewhide ' + cset + 'Files" ';
    html += this.makeDataHTML(cset) + '>View files</span></div>';
    html += '  </div>';
    html += '  <div class="files hiddenContent" id="' + this.getFilesID(cset) + '">';
    for (var i = 0; i < files.length; i++)
      html += UI.htmlEncode(files[i]) + '<br />';
    html += '    <span class="fileviewhide ' + cset + 'Files" ';
    html += this.makeDataHTML(cset) + '>Hide</span>';
    html += '    </div>';

    return html;
  },


  makeBackoutBannerHTML: function viewer_makeBackoutBannerHTML() {
    var html = '<div class="backoutbanner ctr" id="';
    html += '">BACKED OUT BY</div>';
   return html;
  },


  makeButtonHTML: function viewer_makeButtonHTML(prevLabel, nextLabel) {
    var html = '<div class="grid-4">';
    html += '  <button type="button" class="prevButton">' + prevLabel + '</button>';
    html += '</div>';
    html += '<div class="grid-4"></div>';
    html += '<div class="grid-4 divRight">';
    html += '  <button type="button" class="nextButton">' + nextLabel + '</button>';
    html += '</div>'
    return html;
  },


  makeExpandHTML: function viewer_makeExpandHTML() {
    var html = '<div class="grid-12 divRight" id="expand">';
    html += '  <button type="button" class="expandButton" id="expandButton">Expand all comments</button>';
    html += '</div>';
    return html;
  },


  makeSubmitHTML: function viewer_makeSubmitHTML() {
    var html = '<div class="grid-12 divRight" class="submit">';
    html += '  <button type="button" class="submitButton">Submit the changes</button>';
    html += '</div>';
    return html;
  },


  makeHeadlineHTML: function viewer_makeHeadlineHTML(headline) {
    var html = '<div class="grid-12" id="headline">';
    html += '<h3>' + headline + '</h3>';
    html += '</div>';
    return html;
  },


  makeHelpHTML: function viewer_buildHelp(helpText) {
    var html = '<p class="grid-12" id="helpText">';
    html += helpText;
    html += '</p>';
    return html;
  },


  updateHelpText: function viewer_updateHelpText() {
    $('#helpText').replaceWith(this.makeHelpHTML(this.step.getHelpText()));
  },


  updateSubmitButton: function viewer_updateSubmitButton() {
    $('.submitButton').attr('disabled', !(this.step.canSubmit()));
  },


  addChangeset: function viewer_addChangeset(index, isLast, classToAdd) {
    classToAdd = classToAdd || '';
    if (isLast)
      classToAdd += ' last';
    // build HTML for changeset part
    var pushHTML = this.makeHTMLForChangeset(index, classToAdd);
    pushHTML += this.makeBugDivHTML(PushData.allPushes[index].cset);
    // build html for bugs
    var attachedBugs = this.step.getAttachedBugs(index);
    if (attachedBugs.length == 0)
      return pushHTML +' </div>';

    pushHTML += attachedBugs.map(function viewer_addChangsetBugHTMLMaker(j) {return this.makeBugHTML(index, j);},this).join('');
    pushHTML += '</div>';
    return pushHTML;
  },


  view: function view_View(step, onPrevious, onNext) {
    // Hide any previous viewer output
    UI.hide('viewerOutput');
    UI.clearErrorMessage();
    $('#viewerOutput').empty();

    $('#viewerOutput').append(this.makeHeadlineHTML(step.getHeading()));
    $('#viewerOutput').append(this.makeHelpHTML(step.getHelpText()));
    $('#viewerOutput').append(this.makeExpandHTML());
    $('#viewerOutput').append(this.makeSubmitHTML());
    $('#viewerOutput').append(this.makeButtonHTML(onPrevious.label, onNext.label));

    this.step = step;
    var isBackedOut = step.hasBackouts;
    var pushes = step.getPushes();
    var len = pushes.length;

    if (!isBackedOut) {
      var html = pushes.map(function viewer_ViewChangesetMaker(i, ind, arr) {return this.addChangeset(i, ind == arr.length - 1);}, this).join('');
      $('#viewerOutput').append(html);
    } else {
      var html = pushes.map(function viewer_ViewChangesetMaker2(i, ind, arr) {
        var h = step.getAffected(i).map(function viewer_ViewBackoutMaker(j) {return this.addChangeset(j, false, 'backedout');}, this).join('');
        return h + this.makeBackoutBannerHTML() + this.addChangeset(i, ind == arr.length - 1, 'backout');
      }, this).join('');
      $('#viewerOutput').append(html);
    }

    $('#viewerOutput').append(this.makeSubmitHTML());
    $('#viewerOutput').append(this.makeButtonHTML(onPrevious.label, onNext.label));
    this.onPreviousFn = onPrevious.fn;
    if (!onPrevious.fn)
      $('.prevButton').attr('disabled', true);
    this.onNextFn = onNext.fn;
    if (!onNext.fn)
      $('.nextButton').attr('disabled', true);

    this.updateSubmitButton();

    if (Viewer.expand) {
      $('.commentDiv').toggle(true);
      $('.viewhide').text('Hide comment');
      $('#expandButton').text('Hide all comments');
    }

    UI.show('viewerOutput');
    $('html')[0].scrollIntoView();
  }
}

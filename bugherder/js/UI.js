"use strict";

var UI = {
  modalID: null,
  modalForm: null,
  modalCancelAction: null,
  modalSubmitAction: null,
  modalCancelButton: null,


  // Encode text for HTML insertion per OWASP guidelines
  htmlEncode: function UI_makeHTMLencode(input) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\//g, '&#x2f;');
  },


  hideAll: function UI_hideAll() {
    var selector = '.hideAll';
    $(selector).addClass('hiddenContent');
  },


  hide: function UI_hide(selector) {
    selector = '#' + selector;
    if (!$(selector).hasClass('hiddenContent'))
      $(selector).addClass('hiddenContent');
  },


  show: function UI_show(selector) {
    selector = '#' + selector;
    if ($(selector).hasClass('hiddenContent'))
      $(selector).removeClass('hiddenContent');
  },


  hideLoadingMessage: function UI_hideLoadingMessage(message) {
    this.hide('loading');
  },


  showLoadingMessage: function UI_showLoadingMessage(message) {
    this.hideAll();
    $('#loading').text(message);
    this.show('loading');
  },


  hideLoadingOverlay: function UI_hideLoadingOverlay() {
    $('#loadingModal').toggle();
    $('#opaque').toggle();
  },


  showLoadingOverlay: function UI_showLoadingOverlay() {
    $('#opaque').toggle();
    $('#loadingModal').toggle();
  },


  showInvalidEmailDialog: function UI_showInvalidEmailDialog() {
    this.hideLoadingOverlay();
    UI.showMessageModal('That didn\'t look like a valid email address!');
  },


  showInvalidBugDialog: function UI_showInvalidBugDialog() {
    this.hideLoadingOverlay();
    UI.showMessageModal('That didn\'t look like a valid bug number!');
  },


  showBugSubmitDialog: function UI_showBugSubmitDialog(sent, total) {
    $('#submissionMessage').attr('data-sent', sent);
    $('#submissionMessage').attr('data-max', total);
    $('#submissionMessage').dialog('open');
  },


  clearErrorMessage: function UI_clearErrorMessage() {
    this.hide('errors');
    $('#errorText').text('');
  },


  showErrorMessage: function UI_showErrorMessage(message) {
    this.hide('errors');
    $('#errorText').text(message);
    this.show('errors');
    $('html')[0].scrollIntoView();
  },


  hideProgressModal: function UI_hideProgressModal() {
    $('#progressModal').toggle();
    $('#opaque').toggle();
  },


  updateProgressModal: function UI_updateProgressModal(percentage) {
    percentage = Math.round(Number(percentage));
    $('#progressBar').attr('value', percentage);
    $('#progressText').text(percentage);
  },


  showProgressModal: function UI_showProgressModal(noReset) {
    noReset = noReset || false;
    if (!noReset) {
      $('#progressBar').attr('value', '0');
      $('#progressBar').attr('max', '100');
      $('#progressText').text('0');
    }
    $('#opaque').toggle();
    $('#progressModal').toggle();
  },


  onModalKey: function UI_onModalKey(e) {
    if (e.metaKey || e.altKey || e.ctrlKey || e.which != 27)
      return true;

    e.preventDefault(); 
    if (UI.modalForm)
      $(UI.modalForm).unbind('submit', UI.onModalConfirm);
    if (UI.cancelButton)
      $(UI.cancelButton).unbind('click', UI.onModalCancel);
    $(document).unbind('keydown', UI.onModalKey); 
    UI.hideModalForm();
    if (UI.modalCancelAction)
      UI.modalCancelAction(); 
  },


  onModalCancel: function UI_onModalCancel(e) {
    e.preventDefault();
    $(document).bind('keydown', UI.onModalKey);
    if (UI.modalForm)
      $(UI.modalForm).unbind('submit', UI.onModalConfirm);
    UI.hideModalForm();
    if (UI.modalCancelAction)
      UI.modalCancelAction(); 
  },


  onModalConfirm: function UI_onModalConfirm(e) {
    e.preventDefault();
    if (UI.cancelButton) {
      $(UI.cancelButton).unbind('click', UI.onModalCancel);
      $(document).unbind('keydown', UI.onModalKey); 
    }
    UI.hideModalForm();
    if (UI.modalSubmitAction)
      UI.modalSubmitAction();
  },


  hideModalForm: function UI_hideModalForm() {
    $(UI.modalID).toggle();
    $('#opaque').toggle();
    UI.modalID = null;
  },


  showModalForm: function UI_showModalForm(id, formID, submitAction, cancelID, cancelAction) {
    // The toggles below would put an already-open form straight back down again
    if (UI.modalID)
      return;

    UI.modalID = '#' + id;
    if (formID) {
      UI.modalForm = '#' + formID;
      if (submitAction)
        UI.modalSubmitAction = submitAction;
      $(UI.modalForm).one('submit', UI.onModalConfirm);
    }
    if (cancelID) {
      UI.cancelButton = '#' + cancelID;
      $(document).bind('keydown', UI.onModalKey);
      if (cancelAction)
        UI.modalCancelAction = cancelAction;
      $(UI.cancelButton).one('click', UI.onModalCancel);
    }
    $('#opaque').toggle();
    $(UI.modalID).toggle();
  },


  onExplanationSubmit: function UI_onExplanationSubmit(e, callback) {
    var text = $('#explanation').val();
    if (text != '' && text[text.length - 1] != '\n')
      text = text + '\n';
    var useForAll = $('#useForAll').prop('checked');
    UI.showProgressModal(true);
    callback(text, useForAll);
  },


  onExplanationCancel: function UI_onExplanationCancel(e, callback) {
    UI.showProgressModal(true);
    callback('', false);
  },


  acquireExplanation: function UI_acquireExplanation(callback, bug) {
    $('#explanation').val('');
    $('#useForAll').prop('checked', false);
    $('#exTitle').text('Add explanation for backout of ' + bug);
    UI.hideProgressModal();
    UI.showModalForm('explanationModal', 'explanationForm', function(e) {UI.onExplanationSubmit(e, callback);},
                     'exCancel', function(e) {UI.onExplanationCancel(e, callback);});
    $('#explanation')[0].focus();
  },


  onCredentialsSubmit: function UI_onCredentialsSubmit(e) {
    ViewerController.onCredentialsEntered($('#apikey').val().trim());
    $('#apikey').val('');
  },


  onCredentialsCancel: function UI_onCredentialsCancel(e) {
    $('#apikey').val('');
    ViewerController.credentialsCallback = null;
  },


  showCredentialsForm: function UI_showCredentialsForm() {
    $('#apikey').val('');
    UI.showModalForm('credentialsModal', 'credentialsForm', UI.onCredentialsSubmit,
                     'crCancel', UI.onCredentialsCancel);
    $('#apikey')[0].focus();
  },


  hideRestricted: function UI_hideRestricted() {
    this.hide('restricted');
  },


  showRestrictedOffer: function UI_showRestrictedOffer(count, onClick) {
    var them = count == 1 ? 'it' : 'them';
    var text = count + ' bug' + (count == 1 ? '' : 's') + ' in this push could not be';
    text += ' loaded, most likely because ' + (count == 1 ? 'it is' : 'they are') + ' restricted.';
    text += ' If you have access to ' + them + ', you can load and mark ' + them;
    text += ' with your api key.';

    $('#restrictedText').text(text);
    $('#restrictedButton').off('click.restricted').on('click.restricted', onClick);
    $('#restrictedButton').show();
    this.show('restricted');
  },


  showRestrictedStatus: function UI_showRestrictedStatus(loaded, stillUnloaded) {
    var text = 'Showing the ' + loaded + ' restricted bug' + (loaded == 1 ? '' : 's');
    text += ' from this push only. Everything else has been left out.';
    if (stillUnloaded.length > 0) {
      text += stillUnloaded.length == 1 ? ' Bug ' : ' Bugs ';
      text += stillUnloaded.join(', ') + ' could not be loaded with your api key,';
      text += ' and will still need marking by hand.';
    }

    $('#restrictedText').text(text);
    $('#restrictedButton').off('click.restricted').hide();
    this.show('restricted');
  },


  onAddBugSubmit: function UI_onAddBugSubmit(e) {
    var index = $('#addBugForm').attr('data-index');
    ViewerController.onAddBug(parseInt(index), $('#loadBug').val());
  },


  showBugLoadForm: function UI_showBugChangeForm(index) {
    var cset = PushData.allPushes[index].cset;
    $('#abTitle').text('Add bug to ' + cset);
    $('#loadBug').val('');
    $('#addBugForm').attr('data-index', index);
    UI.showModalForm('addBugModal', 'addBugForm', UI.onAddBugSubmit, 'abCancel');
    $('#loadBug')[0].focus();
  },


  onChangeBugSubmit: function UI_onChangeBugSubmit(e) {
    var index = $('#changeBugForm').attr('data-index');
    var bug = $('#changeBugForm').attr('data-bug');
    ViewerController.onChangeBug(parseInt(index), bug, $('#changeBug')[0].value);
  },


  onChangeBugCancel: function UI_onChangeBugCancel(e) {
    var cset = $('#changeBugForm').attr('data-cset');
    var bug = $('#changeBugForm').attr('data-bug');
    Viewer.addChangeButtonListener(cset, bug);
  },


  showBugChangeForm: function UI_showBugChangeForm(index, bug) {
    var cset = PushData.allPushes[index].cset;
    $('#cbTitle').text('Change bug ' + bug + ' for ' + cset);
    $('#changeBug').val('');
    $('#changeBugForm').attr('data-index', index);
    $('#changeBugForm').attr('data-bug', bug);
    $('#changeBugForm').attr('data-cset', cset);
    UI.showModalForm('changeBugModal', 'changeBugForm', UI.onChangeBugSubmit,
                     'cbCancel', UI.onChangeBugCancel);
    $('#changeBug')[0].focus();
  },


  onMessageKey: function UI_onMessageKey(e) {
    if (e.metaKey || e.altKey || e.ctrlKey || e.which != 27)
      return true;

    e.preventDefault(); 
    $('#mmOK').click();
  },


  showMessageModal: function UI_showMessageModal(message) {
    $('#mmText').text(message);

    var onOK = function UI_showMessageModal_onOK() {
      $('#messageModal').toggle();
      $(document).unbind('keydown', UI.onMessageKey);
      $('#opaque').toggle();
    }

    $('#mmOK').one('click', onOK);
    $(document).bind('keydown', UI.onMessageKey);
    $('#opaque').toggle();
    $('#messageModal').toggle();
    $('#mmOK')[0].focus();
  },


  showForm: function UI_showForm(listener) {
    this.hideAll();

    // Hook up click listener
    if (typeof listener == 'function')
      $('#csetForm').one('submit', listener);

    this.show('getCset');
    $('#changeset').focus();
  },


  showFormWithError: function UI_ShowFormWithError(listener, errorText) {
    // Call showForm first, as it will call hideAll
    this.showForm(listener);
    this.showErrorMessage(errorText);
  },


  linkifyChangeset: function UI_linkifyChangeset(cset) {
    var link = Config.hgRevURL;
    if (cset.indexOf(link) != -1)
      cset = cset.substring(link.length);
    link += cset;
    return '<a href="' + link + '" target="_blank">' + cset + '</a>';
  },


  linkifyRevURL: function UI_linkifyChangeset(revURL) {
    var cset = revURL;
    var link = Config.hgRevURL;
    if (cset.indexOf(link) != -1)
      cset = cset.substring(link.length);
    link += cset;
    return '<a href="' + link + '" target="_blank">' + revURL + '</a>';
  },


  linkifyBug: function UI_linkifyBug(bug) {
    return '<a href="' + Config.showBugURL + bug + '" target="_blank">' + bug + '</a>';
  },


  linkifyDescription: function UI_linkifyDescription(desc) {
    Config.csetIDRE.lastIndex = 0;
    Config.bugNumRE.lastIndex = 0;
    desc = desc.replace(Config.csetIDRE, this.linkifyChangeset);
    desc = desc.replace(Config.bugNumRE, this.linkifyBug);
    return desc;
  },


  buildMergeVerification: function UI_displayMergeVerification(sourceRepo) {
    var html = '';
    if (sourceRepo) {
      html += 'Merge from <a href="' + Config.hgBaseURL + Config.treeInfo[sourceRepo].repo + '" target="_blank">' + sourceRepo.toLowerCase() + '</a> ';
      html += 'to <a href="' + Config.hgURL + '" target="_blank">mozilla-central</a>';
    } else {
      html += 'Push to <a href="' + Config.hgURL + '" target="_blank">' + Config.treeName + '</a>';
    }
    return html;
  },


  displayDetail: function UI_displayDetail() {
    var tipCset = PushData.allPushes[PushData.allPushes.length - 1].cset;
    var numPushes = PushData.allPushes.length;
    var pushesParsed = 0;
    var pushTypes = ['fixes', 'backedOut', 'foundBackouts', 'notFoundBackouts', 'merges', 'others'];
    pushTypes.forEach(function(arr) {pushesParsed += PushData[arr].length});

    this.hide('detail');
    var html = '';


    html += this.buildMergeVerification(this.sourceRepo);
    html += ' (view <a href="' + Config.hgPushlogURL + tipCset + '" target="_blank">pushlog</a>).';
    $('#detail').html(html);
    this.show('detail');
    this.displayVerificationWarning(numPushes, pushesParsed);
  },


  displayVerificationWarning: function UI_displayVerificationWarning(rightLength, actualLength) {
    if (rightLength == actualLength)
      return;

    var errorText = 'Warning: Pushes length verification failed. (' + rightLength + ',' + actualLength + ')';
    errorText += 'Please ping the IRC channel #sheriffs with this cset!';
    this.showErrorMessage(errorText);
  }
};

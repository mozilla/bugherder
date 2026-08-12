"use strict";

var Summary = {
  makeSummaryForData: function summary_makeSummaryForData(data) {
    var html = '<tr><td>' + UI.linkifyBug(data.id) + '</td><td>';
    if ('status' in data && data.status == 'RESOLVED')
      html += 'Y';
    else
      html += 'N';
    html += '</td><td>';
    if ('status' in data && data.status == 'REOPENED')
      html += 'Y';
    else
      html += 'N';
    html += '</td><td>';
    if ('target_milestone' in data)
      html += data.target_milestone;
    else
      html += '&nbsp;';
    html += '</td><td>';
    if ('assigned_to' in data)
      html += UI.htmlEncode(data.assigned_to.name);
    else
     html += '&nbsp;';
    html += '</td><td>';
    if ('comment' in data) {
      var comment = data.comment.body;
      comment = comment.replace(/\n/g, '<br>');
      Config.hgRevFullRE.lastIndex = 0;
      comment = comment.replace(Config.hgRevFullRE, function(str) {return UI.linkifyRevURL(str);});
      html += comment;
    } else
      html += '&nbsp;';
    html += '</tr>';
    return html;
  },


  makeSummaryForStep: function summary_makeSummaryForStep(step) {
    var html = '<h3>' + step.getHeading(false) + '</h3>';
    var sent = step.getSentData();
    if (sent.length == 0) {
      html += '<p><em>No changes submitted.</em></p>';
      return html;
    }

    html += '<br><table class="summaryTable"><tr class="thead"><td>Bug</td><td>Resolved?</td>';
    html += '<td>Reopened?</td><td>Target Milestone</td><td>Assignee</td><td>Comment</td></tr>';
    html += sent.map(function(data) {return this.makeSummaryForData(data);}, this).join('');
    html += '</table>';
    return html;
  },


  makeUnsubmittedHTML: function summary_makeUnsubmittedHTML(steps) {
    var subhtml = '';
    for (var i = 0; i < steps.length; i++) {
       if (steps[i].canSubmit())
         subhtml += '<li>'+steps[i].getHeading(false)+'</li>';
    }

    if (subhtml == '')
      return subhtml;

    var html = '<p><span class="subwarn">WARNING: </span>The following steps seem to have changes that could be sent to Bugzilla,';
    html += ' but have not been submitted. You may wish to double-check them:</p><ul>' + subhtml + '</ul>';
    return html;
  },


  makeSecBugHTML: function summary_makeSecBugHTML(steps) {
    var sechtml = '';

    // Steps set aside during this session cover the same changesets as their
    // replacements, so the same bug can be reported by more than one of them
    var seen = {};
    function unseen(secBug) {
      var key = secBug.cset + ':' + secBug.bug;
      if (key in seen)
        return false;

      seen[key] = true;
      return true;
    }

    for (var i = 0; i < steps.length; i++) {
       var sb = steps[i].getSecurityBugs().filter(unseen);
       if (sb.length == 0)
         continue;

       sechtml += '<li>'+steps[i].getHeading(false) + '<br>';
       sechtml += '<table><tr><td>Changeset</td><td>Link</td><td>Bug</td></tr>';
       for (var j = 0; j < sb.length; j++) {
         sechtml += '<tr><td>' + sb[j].cset + '</td><td>' + UI.linkifyRevURL(sb[j].link);
         sechtml += '</td><td>' + UI.linkifyBug(sb[j].bug) + '</td></tr>';
       }
       sechtml += '</table>';
    }

    if (sechtml == '')
      return sechtml;

    var html = '<p>The following steps had security bugs, which you will need to check';
    html += ' and resolve/comment manually:</p><ul>' + sechtml + '</ul>';
    return html;
  },


  makeButtonHTML: function summary_makeButtonHTML(prevLabel, nextLabel) {
    var html = '<div class="grid-4">';
    html += '  <button type="button" class="summaryPrevButton">' + prevLabel + '</button>';
    html += '</div>';
    html += '<div class="grid-4"></div>';
    html += '<div class="grid-4 divRight">';
    html += '  <button type="button" class="summaryNextButton">' + nextLabel + '</button>';
    html += '</div>'
    return html;
  },


  view: function summary_View(steps, onPrevious, onNext, priorSteps) {
    priorSteps = priorSteps || [];

    // Only replaced steps that submitted something belong in the activity list and the
    // unsubmitted warning. All of them still know which bugs could not be loaded, so the
    // security bug table gets the lot
    var submitted = priorSteps.filter(function summary_hasSubmitted(step) {
      return step.getSentData().length > 0;
    });
    var activeSteps = submitted.concat(steps);

    // Hide any previous viewer output
    UI.hide('viewerOutput');
    UI.clearErrorMessage();
    $('#viewerOutput').empty();
    $('#viewerOutput').append(this.makeButtonHTML(onPrevious.label, onNext.label));

    var subHTML = this.makeUnsubmittedHTML(activeSteps);
    if (subHTML != '')
      $('#viewerOutput').append(subHTML + '<hr>');

    var secHTML = this.makeSecBugHTML(priorSteps.concat(steps));
    if (secHTML != '')
      $('#viewerOutput').append(secHTML + '<hr>');

    $('#viewerOutput').append('<div class="ctr"><h3 class="summaryHeading">Summary of activity</h3></div>');

    activeSteps.forEach(function step_viewSummaryMaker(step){
      $('#viewerOutput').append(this.makeSummaryForStep(step));
    }, this);

    $('#viewerOutput').append(this.makeButtonHTML(onPrevious.label, onNext.label));
    if (onPrevious.fn) {
      $('.summaryPrevButton').click(function Step_onPreviousClick(e) {
        onPrevious.fn();
      });
    } else {
      $('.summaryPrevButton').attr('disabled', true);
    }

    if (onNext.fn) {
      $('.summaryNextButton').click(function Step_onNextClick(e) {
        onNext.fn();
      });
    } else {
      $('.summaryNextButton').attr('disabled', true);
    }

    UI.show('viewerOutput');
    $('html')[0].scrollIntoView();
  }
}


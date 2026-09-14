// Allow filtering the activity view to only show city-wide ideas
// ==============================================================
//
// Usage:
// - The place form should have a `city_wide` field that is a string with
//   values `'true`' and `'false'`.
// - In the `sidebar` block in index.html, there should be an element with the
//   following structure:
//
//   <form class="activity-filters">
//     <div class="display-choice">
//       <input type="radio" name="activity_display_choice" value="all-ideas" id="activity-show-all-ideas" checked>
//       <label for="activity-show-all-ideas">All Ideas</label>
//     </div>
//     <div class="display-choice">
//       <input type="radio" name="activity_display_choice" value="city-wide" id="activity-show-city-wide">
//       <label for="activity-show-city-wide">City-wide Only</label>
//     </div>
//   </form>

(function() {
  let activityDisplayChoice = 'all-ideas';

  const Shareabouts_AppView_events = Shareabouts.AppView.prototype.events;
  Shareabouts.AppView.prototype.events = {
    ...Shareabouts_AppView_events,
    'change [name="activity_display_choice"]': 'onChangeActivityDisplayChoice',
  };

  Shareabouts.AppView.prototype.onChangeActivityDisplayChoice = function(evt) {
    const choice = evt.target.value;
    this.updateActivityDisplayChoice(choice);
  }

  Shareabouts.AppView.prototype.updateActivityDisplayChoice = function(choice) {
    activityDisplayChoice = choice;
    this.activityView.render()
  }

  const Shareabouts_ActivityView_renderAction = Shareabouts.ActivityView.prototype.renderAction;
  Shareabouts.ActivityView.prototype.renderAction = function(model, index) {
    if (activityDisplayChoice === 'city-wide' && (model.get('target') || {})['city_wide'] !== 'true') {
      return;
    }

    Shareabouts_ActivityView_renderAction.apply(this, arguments);
  }
})();